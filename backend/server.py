from datetime import datetime
import logging
import os
from pathlib import Path
import time
from typing import Optional
import uuid

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from app.domain_analysis import analyze_url_logic

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(mongo_url)
db_name = os.environ.get("DB_NAME", "test_db")
db = client[db_name]

COMMUNITY_CACHE_TTL_SECONDS = int(os.environ.get("COMMUNITY_CACHE_TTL_SECONDS", "60"))
COMMUNITY_SCORE_CACHE = {}

app = FastAPI()
api_router = APIRouter(prefix="/api")


class StatusCheck(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class StatusCheckCreate(BaseModel):
    client_name: str


class AnalyzeRequest(BaseModel):
    url: str


class AnalyzeResponse(BaseModel):
    status: str
    domain: str
    suggestion: Optional[str] = None
    score: Optional[int] = None
    source: Optional[str] = "local"
    community_trust_score: Optional[int] = 0
    total_votes: Optional[int] = 0
    description: Optional[str] = None
    ip_address: Optional[str] = None
    server_location: Optional[str] = None


class FeedbackRequest(BaseModel):
    domain: str
    vote: str


def _get_cached_community_stats(domain: str):
    key = (domain or "").strip().lower()
    if not key:
        return None

    cached = COMMUNITY_SCORE_CACHE.get(key)
    if not cached:
        return None

    expires_at, payload = cached
    if expires_at <= time.monotonic():
        COMMUNITY_SCORE_CACHE.pop(key, None)
        return None
    return payload


def _set_cached_community_stats(domain: str, payload):
    key = (domain or "").strip().lower()
    if not key:
        return
    COMMUNITY_SCORE_CACHE[key] = (
        time.monotonic() + max(1, COMMUNITY_CACHE_TTL_SECONDS),
        payload,
    )


@api_router.get("/")
async def root():
    return {"message": "Domain Guard API is Running"}


@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.dict()
    status_obj = StatusCheck(**status_dict)
    return status_obj


@api_router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_domain(request: AnalyzeRequest):
    try:
        result = await analyze_url_logic(request.url)

        domain = (result.get("domain") or "").strip().lower()
        cached_stats = _get_cached_community_stats(domain)
        if cached_stats is not None:
            stats = cached_stats
        else:
            stats = await db.reports.aggregate(
                [
                    {"$match": {"domain": domain}},
                    {
                        "$group": {
                            "_id": "$domain",
                            "safe_count": {
                                "$sum": {"$cond": [{"$eq": ["$vote", "safe"]}, 1, 0]}
                            },
                            "scam_count": {
                                "$sum": {"$cond": [{"$eq": ["$vote", "scam"]}, 1, 0]}
                            },
                        }
                    },
                ]
            ).to_list(1)
            _set_cached_community_stats(domain, stats)

        community_score = 0
        total_votes = 0

        if stats:
            s = stats[0]
            safe = s.get("safe_count", 0)
            scam = s.get("scam_count", 0)
            total_votes = safe + scam
            community_score = safe - scam

        if community_score <= -5:
            result["status"] = "suspicious"
            result["source"] = "community_flagged"
            result["suggestion"] = "Flagged as risky by the community"

        result["community_trust_score"] = community_score
        result["total_votes"] = total_votes

        return AnalyzeResponse(**result)
    except Exception as exc:
        logging.error(f"Analysis Error: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@api_router.post("/feedback")
async def report_domain(feedback: FeedbackRequest):
    try:
        normalized_domain = (feedback.domain or "").strip().lower()
        await db.reports.insert_one(
            {
                "domain": normalized_domain,
                "vote": feedback.vote,
                "timestamp": datetime.utcnow(),
            }
        )
        COMMUNITY_SCORE_CACHE.pop(normalized_domain, None)
        return {"message": "Feedback received"}
    except Exception as exc:
        logging.error(f"Feedback Error: {exc}")
        raise HTTPException(status_code=500, detail="Could not save feedback")


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
