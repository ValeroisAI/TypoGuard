import asyncio
import json
import logging
import os
import re
import socket
import time
from urllib.parse import urlsplit

try:
    import google.generativeai as genai
except Exception:
    genai = None
try:
    import requests
except Exception:
    requests = None
try:
    import tldextract as _tldextract_module

    # Disable remote PSL fetch for deterministic and faster startup.
    _tld_extractor = _tldextract_module.TLDExtract(suffix_list_urls=None)

    class _TldExtractAdapter:
        @staticmethod
        def extract(value: str):
            return _tld_extractor(value)

    tldextract = _TldExtractAdapter()
except Exception:
    class _ExtractResult:
        def __init__(self, subdomain: str, domain: str, suffix: str):
            self.subdomain = subdomain
            self.domain = domain
            self.suffix = suffix

    class _SimpleTldExtract:
        COMMON_2L_SUFFIXES = {
            "co.uk",
            "com.tr",
            "gov.tr",
            "edu.tr",
            "org.tr",
            "net.tr",
        }

        @staticmethod
        def extract(value: str):
            candidate = value if value.startswith(("http://", "https://")) else f"http://{value}"
            host = (urlsplit(candidate).hostname or value).lower().strip(".")
            labels = [label for label in host.split(".") if label]
            if len(labels) < 2:
                return _ExtractResult("", labels[0] if labels else "", "")

            last_two = ".".join(labels[-2:])
            if len(labels) >= 3 and last_two in _SimpleTldExtract.COMMON_2L_SUFFIXES:
                suffix = last_two
                domain = labels[-3]
                subdomain = ".".join(labels[:-3])
                return _ExtractResult(subdomain, domain, suffix)

            suffix = labels[-1]
            domain = labels[-2]
            subdomain = ".".join(labels[:-2])
            return _ExtractResult(subdomain, domain, suffix)

    tldextract = _SimpleTldExtract()

try:
    from fuzzywuzzy import fuzz
except Exception:
    from difflib import SequenceMatcher

    class _FuzzFallback:
        @staticmethod
        def ratio(a: str, b: str) -> int:
            return int(SequenceMatcher(None, a, b).ratio() * 100)

        @staticmethod
        def partial_ratio(a: str, b: str) -> int:
            if not a or not b:
                return 0
            short, long = (a, b) if len(a) <= len(b) else (b, a)
            best = 0.0
            for i in range(0, len(long) - len(short) + 1):
                score = SequenceMatcher(None, short, long[i : i + len(short)]).ratio()
                if score > best:
                    best = score
            return int(best * 100)

        @staticmethod
        def token_sort_ratio(a: str, b: str) -> int:
            sa = " ".join(sorted(a.split()))
            sb = " ".join(sorted(b.split()))
            return int(SequenceMatcher(None, sa, sb).ratio() * 100)

    fuzz = _FuzzFallback()

from .whitelist_data import RISKY_KEYWORDS, TRUSTED_DOMAINS

logger = logging.getLogger(__name__)

# Configure Gemini
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if GOOGLE_API_KEY and genai is not None:
    genai.configure(api_key=GOOGLE_API_KEY)

# --- CACHE ---
ANALYSIS_CACHE = {}
IP_INFO_CACHE = {}


def _coerce_positive_int(value: str, default: int) -> int:
    try:
        parsed = int(value)
        return parsed if parsed > 0 else default
    except Exception:
        return default


def _coerce_positive_float(value: str, default: float) -> float:
    try:
        parsed = float(value)
        return parsed if parsed > 0 else default
    except Exception:
        return default


ANALYSIS_CACHE_TTL_SECONDS = _coerce_positive_int(
    os.environ.get("ANALYSIS_CACHE_TTL_SECONDS", "300"),
    300,
)
ANALYSIS_CACHE_MAX_SIZE = _coerce_positive_int(
    os.environ.get("ANALYSIS_CACHE_MAX_SIZE", "4096"),
    4096,
)
IP_CACHE_TTL_SECONDS = _coerce_positive_int(
    os.environ.get("IP_CACHE_TTL_SECONDS", "1800"),
    1800,
)
DEFAULT_FETCH_TIMEOUT_SECONDS = _coerce_positive_float(
    os.environ.get("FETCH_TIMEOUT_SECONDS", "1.5"),
    1.5,
)

# --- TYPO DETECTION CONFIG ---
MIN_SIMILARITY_SCORE = 78
LEET_TRANSLATION = str.maketrans(
    {
        "0": "o",
        "1": "l",
        "2": "z",
        "3": "e",
        "4": "a",
        "5": "s",
        "6": "g",
        "7": "t",
        "8": "b",
        "9": "g",
    }
)
NUMERIC_VARIANTS = {
    "0": ("o", "0"),
    "1": ("l", "i", "1"),
    "2": ("z", "2"),
    "3": ("e", "3"),
    "4": ("a", "4"),
    "5": ("s", "5"),
    "6": ("g", "b", "6"),
    "7": ("t", "7"),
    "8": ("b", "8"),
    "9": ("g", "q", "9"),
}
MAX_VARIANTS = 32
RISKY_TLDS = {"top", "xyz", "click", "shop", "zip", "mov", "cam", "icu", "gq"}
KNOWN_TR_SECOND_LEVEL = {"com", "net", "org", "gov", "edu", "bel", "k12"}
PREFERRED_BRAND_DOMAINS = {
    "google": "google.com",
}
DOMAIN_ALIASES = {
    "yt": "youtube.com",
    "ytb": "youtube.com",
    "fb": "facebook.com",
    "ig": "instagram.com",
    "wa": "whatsapp.com",
    "gh": "github.com",
    "gpt": "chatgpt.com",
    "oa": "openai.com",
}
SUFFIX_PRIORITY = {
    "com": 100,
    "com.tr": 96,
    "gov.tr": 95,
    "gov": 92,
    "org": 90,
    "net": 88,
    "edu": 87,
    "edu.tr": 86,
    "tr": 82,
}
TRUSTED_DOMAINS_CANONICAL = {domain.strip().lower() for domain in TRUSTED_DOMAINS}


def _analysis_cache_key(url: str) -> str:
    candidate = url if url.startswith(("http://", "https://")) else f"http://{url}"
    parsed = urlsplit(candidate)
    host = (parsed.hostname or "").strip(".").lower()
    return host or (url or "").strip().lower()


def _cache_get(cache_store: dict, key: str):
    entry = cache_store.get(key)
    if not entry:
        return None
    expires_at, payload = entry
    if expires_at <= time.monotonic():
        cache_store.pop(key, None)
        return None
    return payload


def _cache_set(cache_store: dict, key: str, payload, ttl_seconds: int, max_size: int):
    now = time.monotonic()
    cache_store[key] = (now + max(1, int(ttl_seconds)), payload)
    if len(cache_store) <= max_size:
        return

    # First remove expired entries, then trim oldest insertions if needed.
    expired_keys = [k for k, (exp, _) in cache_store.items() if exp <= now]
    for expired_key in expired_keys:
        cache_store.pop(expired_key, None)

    while len(cache_store) > max_size:
        cache_store.pop(next(iter(cache_store)), None)


def normalize_text_token(value: str) -> str:
    if not value:
        return ""
    lowered = value.lower().translate(LEET_TRANSLATION)
    return re.sub(r"[^a-z0-9]", "", lowered)


def normalize_token_keep_digits(value: str) -> str:
    if not value:
        return ""
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _collapse_repeated_chars(value: str, keep_repeats: int = 1) -> str:
    """
    Collapse repeated-char runs to a bounded length.
    Example (keep_repeats=1): garantiivvbba -> garantivba
    """
    if not value:
        return ""

    capped = max(1, int(keep_repeats))

    def _shrink(match):
        ch = match.group(1)
        return ch * capped

    return re.sub(r"(.)\1+", _shrink, value)


def expand_repeated_char_variants(value: str):
    """
    Generate variants resilient to repeated-char inflation in long domains.
    Example: garantiivvbba -> {garantivba}
    """
    seed = normalize_token_keep_digits(value)
    if not seed:
        return set()

    repeat_runs = list(re.finditer(r"(.)\1+", seed))
    if not repeat_runs:
        return set()

    # Keep noise low for short hostnames with only one doubled run.
    if len(repeat_runs) < 2 and len(seed) < 10:
        return set()

    variants = set()
    collapsed_single = _collapse_repeated_chars(seed, 1)
    if collapsed_single and collapsed_single != seed:
        variants.add(collapsed_single)

    collapsed_double = _collapse_repeated_chars(seed, 2)
    if collapsed_double and collapsed_double != seed:
        variants.add(collapsed_double)

    return {token for token in variants if len(token) >= 3}


def expand_numeric_variants(value: str, max_variants: int = MAX_VARIANTS):
    """
    Expand digit->letter alternatives with a strict cap.
    Example: g00gle -> {g00gle, google, go0gle, ...}
    """
    seed = normalize_token_keep_digits(value)
    if not seed:
        return set()

    # Use deterministic growth to avoid hash-order misses near max_variants cap.
    ordered_variants = [seed]
    seen = {seed}

    for idx, ch in enumerate(seed):
        choices = NUMERIC_VARIANTS.get(ch)
        if not choices:
            continue

        snapshot = list(ordered_variants)
        for v in snapshot:
            for repl in choices:
                mutated = normalize_token_keep_digits(v[:idx] + repl + v[idx + 1 :])
                if not mutated or mutated in seen:
                    continue
                seen.add(mutated)
                ordered_variants.append(mutated)
                if len(ordered_variants) >= max_variants:
                    break
            if len(ordered_variants) >= max_variants:
                break
        if len(ordered_variants) >= max_variants:
            break

    # Always try to include a full leet-normalized token for numeric-heavy inputs.
    fully_mapped = normalize_token_keep_digits(seed.translate(LEET_TRANSLATION))
    if fully_mapped and fully_mapped not in seen:
        if len(ordered_variants) < max_variants:
            ordered_variants.append(fully_mapped)
        else:
            ordered_variants[-1] = fully_mapped

    return {v for v in ordered_variants if v}


def _is_trusted_input_domain(full_domain: str, registered_domain: str) -> bool:
    full_lower = (full_domain or "").strip().lower()
    registered_lower = (registered_domain or "").strip().lower()
    return (
        full_lower in TRUSTED_DOMAINS_CANONICAL
        or registered_lower in TRUSTED_DOMAINS_CANONICAL
    )


def _edit_distance(a: str, b: str) -> int:
    """
    Lightweight Levenshtein distance to catch tiny typos aggressively.
    """
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    prev = list(range(len(b) + 1))
    for i, char_a in enumerate(a, start=1):
        current = [i]
        for j, char_b in enumerate(b, start=1):
            cost = 0 if char_a == char_b else 1
            current.append(
                min(
                    prev[j] + 1,      # deletion
                    current[j - 1] + 1,  # insertion
                    prev[j - 1] + cost,  # substitution
                )
            )
        prev = current
    return prev[-1]


def get_url_parts(url: str):
    if not url.startswith(("http://", "https://")):
        url = "http://" + url
    return tldextract.extract(url)


def get_registered_domain(parts) -> str:
    if parts.domain and parts.suffix:
        return f"{parts.domain}.{parts.suffix}"
    return parts.domain or ""


def parse_display_domain(url: str) -> str:
    parts = get_url_parts(url)
    if parts.suffix:
        if parts.subdomain:
            return f"{parts.subdomain}.{parts.domain}.{parts.suffix}"
        return f"{parts.domain}.{parts.suffix}"

    # Fallback for IP / localhost / invalid tld parsing
    candidate = url if url.startswith(("http://", "https://")) else f"http://{url}"
    parsed = urlsplit(candidate)
    return parsed.hostname or url


def get_hostname_core(full_hostname: str) -> str:
    raw_labels = [label for label in full_hostname.split(".") if label]
    if not raw_labels:
        return ""

    inferred_suffix = infer_input_suffix(full_hostname)
    suffix_labels = [label for label in inferred_suffix.split(".") if label]

    if suffix_labels:
        normalized_raw = [normalize_text_token(label) for label in raw_labels]
        normalized_suffix = [normalize_text_token(label) for label in suffix_labels]
        tail = normalized_raw[-len(normalized_suffix) :] if len(normalized_raw) >= len(normalized_suffix) else []

        if tail == normalized_suffix and len(raw_labels) > len(suffix_labels):
            core_labels = raw_labels[: -len(suffix_labels)]
            return ".".join(core_labels)

    # Fallback to tldextract when inference cannot safely remove suffix.
    parts = tldextract.extract(full_hostname)
    if parts.subdomain:
        return f"{parts.subdomain}.{parts.domain}"
    return parts.domain


def get_hostname_signatures(full_hostname: str):
    core = get_hostname_core(full_hostname)
    base = normalize_token_keep_digits(core)
    if not base:
        return set()

    candidates = {base}
    candidates |= expand_numeric_variants(core)

    repeated_variants = expand_repeated_char_variants(core)
    if repeated_variants:
        candidates |= repeated_variants
        for variant in repeated_variants:
            candidates |= expand_numeric_variants(variant)

    # Include mapped variants (digit->letter) for obfuscated inputs.
    mapped_candidates = {normalize_text_token(token) for token in candidates}
    mapped_candidates.add(normalize_text_token(core))

    all_candidates = candidates | {token for token in mapped_candidates if token}
    return {token for token in all_candidates if len(token) >= 3}


def _domain_suffix(domain: str) -> str:
    try:
        return tldextract.extract(domain).suffix.lower()
    except Exception:
        return ""


def infer_input_suffix(full_hostname: str) -> str:
    """
    Infer suffix even when tldextract cannot parse obfuscated endings.
    Examples:
    - g00gle.c0m -> com
    - e-devlet.g0v.tr -> gov.tr
    """
    parts = tldextract.extract(full_hostname)
    if parts.suffix:
        return parts.suffix.lower()

    labels = [
        normalize_text_token(label)
        for label in full_hostname.lower().split(".")
        if label
    ]
    labels = [label for label in labels if label]
    if not labels:
        return ""

    if len(labels) >= 2 and labels[-1] == "tr" and labels[-2] in KNOWN_TR_SECOND_LEVEL:
        return f"{labels[-2]}.tr"
    return labels[-1]


def _core_labels_without_suffix(full_hostname: str):
    labels = [label for label in full_hostname.lower().split(".") if label]
    if not labels:
        return []

    inferred_suffix = infer_input_suffix(full_hostname)
    suffix_labels = [normalize_text_token(label) for label in inferred_suffix.split(".") if label]
    normalized_labels = [normalize_text_token(label) for label in labels]

    if suffix_labels and len(labels) > len(suffix_labels):
        tail = normalized_labels[-len(suffix_labels) :]
        if tail == suffix_labels:
            return labels[: -len(suffix_labels)]

    parts = tldextract.extract(full_hostname)
    fallback_core = []
    if parts.subdomain:
        fallback_core.extend([label for label in parts.subdomain.split(".") if label])
    if parts.domain:
        fallback_core.append(parts.domain)
    return fallback_core


def _adapt_suggestion_with_subdomain(full_hostname: str, suggestion: str) -> str:
    if not suggestion:
        return suggestion

    clean_suggestion = suggestion.strip().lower()
    core_labels = _core_labels_without_suffix(full_hostname)

    if len(core_labels) < 2 or len(core_labels) > 4:
        return clean_suggestion

    prefix_labels = core_labels[:-1]
    if not prefix_labels or len(prefix_labels) > 2:
        return clean_suggestion

    for label in prefix_labels:
        if not re.fullmatch(r"[a-z0-9-]{2,24}", label):
            return clean_suggestion
        if label.isdigit() or label == "www":
            return clean_suggestion

    suggestion_brand = tldextract.extract(clean_suggestion).domain
    compact_input_core = normalize_text_token("".join(core_labels))
    if (
        suggestion_brand
        and compact_input_core
        and compact_input_core == normalize_text_token(suggestion_brand)
    ):
        # yo.utube.com -> youtube.com (avoid preserving fragmented brand labels)
        return clean_suggestion

    prefix = ".".join(prefix_labels)
    if clean_suggestion.startswith(f"{prefix}."):
        return clean_suggestion

    return f"{prefix}.{clean_suggestion}"


def _alias_candidates(full_hostname: str, registered_domain: str):
    candidates = set()
    core = get_hostname_core(full_hostname)
    if core:
        candidates.add(normalize_text_token(core))
        candidates.add(normalize_text_token(core.replace(".", "").replace("-", "")))

    parts = tldextract.extract(full_hostname)
    if parts.domain:
        candidates.add(normalize_text_token(parts.domain))

    labels = [label for label in full_hostname.lower().split(".") if label]
    if len(labels) == 1 or not parts.suffix:
        candidates.add(normalize_text_token(labels[0] if labels else full_hostname))

    if registered_domain:
        candidates.add(normalize_text_token(registered_domain.split(".")[0]))

    return {token for token in candidates if token}


def check_alias_shortcuts(full_hostname: str, registered_domain: str):
    if _is_trusted_input_domain(full_hostname, registered_domain):
        return False, None, 0, None

    parts = tldextract.extract(full_hostname)
    suffix = (parts.suffix or "").strip().lower()
    suffix_tail = suffix.split(".")[-1] if suffix else ""
    labels = [label for label in full_hostname.lower().split(".") if label]
    alias_eligible = (
        len(labels) == 1
        or not suffix
        or (suffix_tail and len(suffix_tail) < 2)
    )
    if not alias_eligible:
        return False, None, 0, None

    candidates = _alias_candidates(full_hostname, registered_domain)
    if not candidates:
        return False, None, 0, None

    full_lower = full_hostname.lower().strip(".")
    registered_lower = registered_domain.lower().strip(".")

    for token in candidates:
        exact = DOMAIN_ALIASES.get(token)
        if not exact:
            continue
        if exact in {full_lower, registered_lower}:
            continue
        suggestion = enforce_preferred_brand_domain(exact)
        suggestion = _adapt_suggestion_with_subdomain(full_hostname, suggestion)
        reason = f"Alias shortcut '{token}' matched '{suggestion}'."
        return True, suggestion, 99, reason

    best = None
    for token in candidates:
        if len(token) < 2:
            continue
        for alias_signature, alias_domain in DOMAIN_ALIASES.items():
            if abs(len(token) - len(alias_signature)) > 1:
                continue
            distance = _edit_distance(token, alias_signature)
            min_len = min(len(token), len(alias_signature))
            score = 94 if distance == 1 and min_len >= 2 else 0
            if not score:
                continue
            if not best or score > best["score"]:
                best = {
                    "score": score,
                    "token": token,
                    "alias": alias_signature,
                    "suggestion": alias_domain,
                }

    if best:
        suggestion = enforce_preferred_brand_domain(best["suggestion"])
        suggestion = _adapt_suggestion_with_subdomain(full_hostname, suggestion)
        if suggestion not in {full_lower, registered_lower}:
            reason = (
                f"Alias typo '{best['token']}' matched '{best['alias']}' "
                f"-> '{suggestion}'."
            )
            return True, suggestion, best["score"], reason

    return False, None, 0, None


def _suffix_rank(suffix: str) -> int:
    if suffix in SUFFIX_PRIORITY:
        return SUFFIX_PRIORITY[suffix]

    if suffix.endswith(".tr"):
        return 80
    if suffix:
        return 65
    return 40


def _candidate_domain_score(candidate: str, input_suffix: str = "") -> float:
    parts = tldextract.extract(candidate)
    suffix = parts.suffix.lower()
    brand = parts.domain.lower()

    score = float(_suffix_rank(suffix))

    preferred = PREFERRED_BRAND_DOMAINS.get(brand)
    if preferred and preferred == candidate:
        score += 55

    # Prefer same or close suffix as input (.com vs .com.tr etc.)
    if input_suffix:
        if suffix == input_suffix:
            score += 40
        elif (
            suffix.endswith(input_suffix)
            or input_suffix.endswith(suffix)
            or suffix.startswith(f"{input_suffix}.")
            or input_suffix.startswith(f"{suffix}.")
        ):
            score += 18
        elif suffix.split(".")[-1] == input_suffix.split(".")[-1]:
            score += 8
        else:
            score -= 6

    # Prefer flatter canonical domains over deep subdomains
    if parts.subdomain:
        score -= min(len(parts.subdomain.split(".")) * 3, 12)

    # Small tie-breakers
    score -= len(candidate) / 200
    return score


def _pick_best_suggestion(candidates, input_suffix: str, current_domains):
    if not candidates:
        return None

    filtered = [domain for domain in candidates if domain not in current_domains]
    if not filtered:
        return None

    ranked = sorted(
        filtered,
        key=lambda domain: _candidate_domain_score(domain, input_suffix),
        reverse=True,
    )
    return ranked[0]


def enforce_preferred_brand_domain(suggestion: str):
    if not suggestion:
        return suggestion
    parts = tldextract.extract(suggestion)
    preferred = PREFERRED_BRAND_DOMAINS.get(parts.domain.lower())
    return preferred or suggestion


def _build_trusted_signatures():
    signatures = {}

    def register(signature: str, trusted_domain: str):
        if len(signature) < 3:
            return
        signatures.setdefault(signature, set()).add(trusted_domain)

    def register_from_raw(raw_token: str, trusted_domain: str):
        if not raw_token:
            return
        base = normalize_token_keep_digits(raw_token)
        if base:
            register(base, trusted_domain)

        for variant in expand_numeric_variants(raw_token):
            register(variant, trusted_domain)

        mapped = normalize_text_token(raw_token)
        if mapped:
            register(mapped, trusted_domain)

    for trusted_domain in TRUSTED_DOMAINS:
        try:
            parts = tldextract.extract(trusted_domain)
            canonical_trusted = trusted_domain.strip().lower()

            # Root brand (youtube, google, etc.)
            register_from_raw(parts.domain, canonical_trusted)

            # Pre-TLD portion (subdomain + domain)
            pre_tld = (
                f"{parts.subdomain}.{parts.domain}" if parts.subdomain else parts.domain
            )
            register_from_raw(pre_tld, canonical_trusted)

            # Concatenated variant catches split attacks like yo.utube -> youtube
            pre_concat = f"{parts.subdomain}{parts.domain}" if parts.subdomain else parts.domain
            register_from_raw(pre_concat, canonical_trusted)

            # Individual subdomain labels
            if parts.subdomain:
                for label in parts.subdomain.split("."):
                    register_from_raw(label, canonical_trusted)
        except Exception:
            continue

    return signatures


# Maps normalized brand signatures to canonical trusted domain
TRUSTED_SIGNATURES_MAP = _build_trusted_signatures()


def _build_signature_index(signatures_map):
    index = {}
    for trusted_signature, domains in signatures_map.items():
        if not trusted_signature:
            continue
        first_char = trusted_signature[0]
        index.setdefault(first_char, []).append((trusted_signature, domains))
    return index


TRUSTED_SIGNATURE_INDEX = _build_signature_index(TRUSTED_SIGNATURES_MAP)


def get_real_ip_info(domain: str):
    try:
        clean_domain = (
            domain.replace("https://", "").replace("http://", "").split("/")[0]
        )
        ip_address = socket.gethostbyname(clean_domain)

        # Simple provider detection
        provider = "Unknown"
        if ip_address.startswith("104.") or ip_address.startswith("172."):
            provider = "Cloudflare"
        elif ip_address.startswith("142."):
            provider = "Google Cloud"
        elif ip_address.startswith("52.") or ip_address.startswith("54."):
            provider = "AWS"
        elif ip_address.startswith("185."):
            provider = "Offshore/High Risk?"
        else:
            provider = "Dedicated Hosting"

        return ip_address, provider
    except Exception:
        return "Unresolved", "Hidden"


def get_cached_real_ip_info(domain: str):
    cache_key = (domain or "").strip().lower()
    if not cache_key:
        return "Unresolved", "Hidden"

    cached = _cache_get(IP_INFO_CACHE, cache_key)
    if cached:
        return cached

    resolved = get_real_ip_info(cache_key)
    _cache_set(
        IP_INFO_CACHE,
        cache_key,
        resolved,
        ttl_seconds=IP_CACHE_TTL_SECONDS,
        max_size=ANALYSIS_CACHE_MAX_SIZE,
    )
    return resolved


def check_fragmented_domain(full_hostname: str):
    """
    Direct signature match after stripping separators and normalizing numbers.
    Example:
    - yo.utube.com -> youtube
    - y.o.u.t.u.b.e.com -> youtube
    - g00gle.com -> google
    """
    parts = tldextract.extract(full_hostname)
    registered_domain = get_registered_domain(parts)
    if _is_trusted_input_domain(full_hostname, registered_domain):
        return False, None, 0

    input_suffix = infer_input_suffix(full_hostname)
    full_lower = full_hostname.lower()
    signatures = get_hostname_signatures(full_hostname)
    if not signatures:
        return False, None, 0

    for signature in signatures:
        candidates = TRUSTED_SIGNATURES_MAP.get(signature)
        suggestion = _pick_best_suggestion(
            candidates,
            input_suffix=input_suffix,
            current_domains={registered_domain, full_lower},
        )
        if suggestion:
            suggestion = enforce_preferred_brand_domain(suggestion)
            suggestion = _adapt_suggestion_with_subdomain(full_hostname, suggestion)
            return True, suggestion, 99

    return False, None, 0


def _similarity_score(input_signature: str, trusted_signature: str, raw_core: str) -> int:
    ratio = fuzz.ratio(input_signature, trusted_signature)
    partial = fuzz.partial_ratio(input_signature, trusted_signature)
    token = fuzz.token_sort_ratio(input_signature, trusted_signature)
    base = max(ratio, partial, token)

    len_diff = abs(len(input_signature) - len(trusted_signature))
    len_penalty = min(len_diff * 4, 24)

    # Digits can signal obfuscation (e.g. g00gle) but large bonuses create false positives.
    number_bonus = 2 if re.search(r"\d", raw_core) else 0

    score = base - len_penalty + number_bonus
    return max(0, min(100, int(score)))


def check_typo_squatting_aggressive(full_domain: str):
    parts = tldextract.extract(full_domain)
    registered_domain = get_registered_domain(parts)
    if _is_trusted_input_domain(full_domain, registered_domain):
        return False, None, 0, None

    # Strategy 0: short alias shortcuts (yt, ig, gh, ...)
    is_alias, alias_domain, alias_score, alias_reason = check_alias_shortcuts(
        full_domain,
        registered_domain,
    )
    if is_alias:
        return True, alias_domain, alias_score, alias_reason

    # Strategy A: exact normalized signature match (highest confidence)
    is_frag, correct_domain, score = check_fragmented_domain(full_domain)
    if is_frag:
        reason = (
            f"Dot/number normalized signature match. Looks like '{correct_domain}' "
            f"(score={score})."
        )
        return True, correct_domain, score, reason

    # Strategy B: fuzzy + edit distance against all trusted signatures
    full_lower = full_domain.lower()
    input_suffix = infer_input_suffix(full_domain)
    raw_core = get_hostname_core(full_domain)
    contains_digits = bool(re.search(r"\d", raw_core))
    has_separator_obfuscation = "." in raw_core or "-" in raw_core
    base_signature = normalize_token_keep_digits(raw_core)
    alpha_count = sum(ch.isalpha() for ch in base_signature)
    digit_count = sum(ch.isdigit() for ch in base_signature)
    digit_ratio = (digit_count / len(base_signature)) if base_signature else 0.0
    candidate_signatures = get_hostname_signatures(full_domain)

    if not candidate_signatures:
        return False, None, 0, None

    # Highly numeric/noisy hostnames should not fuzzy-match trusted brands.
    if contains_digits and alpha_count < 3:
        return False, None, 0, None

    best_signature = None
    best_score = 0
    best_reason = None

    candidate_lengths = [len(sig) for sig in candidate_signatures if sig]
    if not candidate_lengths:
        return False, None, 0, None

    min_candidate_length = min(candidate_lengths)
    max_candidate_length = max(candidate_lengths)
    candidate_first_chars = {sig[0] for sig in candidate_signatures if sig}
    search_space = []
    for first_char in candidate_first_chars:
        search_space.extend(TRUSTED_SIGNATURE_INDEX.get(first_char, []))

    for trusted_signature, trusted_domains in search_space:
        trusted_length = len(trusted_signature)
        if trusted_length < (min_candidate_length - 6) or trusted_length > (max_candidate_length + 6):
            continue

        pair_best_score = 0
        pair_best_edit = 999
        pair_best_candidate = None

        for clean_input in candidate_signatures:
            # Skip obviously too-different lengths to reduce false positives
            if abs(len(clean_input) - len(trusted_signature)) > 6:
                continue

            score = _similarity_score(clean_input, trusted_signature, raw_core)
            edit_distance = _edit_distance(clean_input, trusted_signature)

            # Aggressive typo handling for tiny mistakes
            min_len = min(len(clean_input), len(trusted_signature))
            if edit_distance == 1 and min_len >= 4:
                score = max(score, 99)
            elif edit_distance == 2 and min_len >= 6:
                score = max(score, 95)

            # If numeric variant normalization improved similarity, add confidence.
            if contains_digits and clean_input != base_signature:
                score = min(100, score + 4)

            if score > pair_best_score:
                pair_best_score = score
                pair_best_edit = edit_distance
                pair_best_candidate = clean_input

        if pair_best_score <= 0:
            continue

        # Additional obfuscation bonuses
        if contains_digits:
            pair_best_score = min(100, pair_best_score + 1)
        if has_separator_obfuscation:
            pair_best_score = min(100, pair_best_score + 2)

        dynamic_threshold = MIN_SIMILARITY_SCORE
        if contains_digits:
            dynamic_threshold -= 3
        if has_separator_obfuscation:
            dynamic_threshold -= 2
        # Numeric-heavy random hosts need stronger evidence.
        if contains_digits and digit_ratio >= 0.35:
            dynamic_threshold += 7

        if contains_digits and pair_best_edit > 2 and pair_best_score < 90:
            continue

        if pair_best_score >= dynamic_threshold and pair_best_score > best_score:
            suggestion_candidate = _pick_best_suggestion(
                trusted_domains,
                input_suffix=input_suffix,
                current_domains={registered_domain, full_lower},
            )
            if not suggestion_candidate:
                continue
            suggestion_candidate = enforce_preferred_brand_domain(suggestion_candidate)
            suggestion_candidate = _adapt_suggestion_with_subdomain(
                full_domain,
                suggestion_candidate,
            )

            signals = [
                f"similarity={pair_best_score}",
                f"edit_distance={pair_best_edit}",
            ]
            if contains_digits:
                signals.append("digit-substitution")
            if has_separator_obfuscation:
                signals.append("separator-obfuscation")
            if pair_best_candidate and pair_best_candidate != base_signature:
                signals.append(f"normalized='{pair_best_candidate}'")

            suggestion_suffix = _domain_suffix(suggestion_candidate)
            if input_suffix and suggestion_suffix and input_suffix != suggestion_suffix:
                signals.append(f"tld-mismatch:{input_suffix}->{suggestion_suffix}")

            best_score = pair_best_score
            best_signature = suggestion_candidate
            best_reason = (
                f"Likely typo impersonation of '{suggestion_candidate}' "
                f"({', '.join(signals)})."
            )

    if best_signature and best_score >= (
        MIN_SIMILARITY_SCORE - 7 if contains_digits else MIN_SIMILARITY_SCORE
    ):
        return True, best_signature, best_score, best_reason

    return False, None, 0, None


def _contains_risky_keyword(full_hostname: str):
    tokens = [
        normalize_text_token(part)
        for part in re.split(r"[.\-_]", full_hostname.lower())
        if part.strip()
    ]
    risky_tokens = {normalize_text_token(keyword) for keyword in RISKY_KEYWORDS}
    risky_tokens = {token for token in risky_tokens if token}

    for token in tokens:
        if token in risky_tokens:
            return token
    return None


def _is_ipv4_host(hostname: str) -> bool:
    parts = hostname.split(".")
    if len(parts) != 4:
        return False
    if not all(part.isdigit() for part in parts):
        return False
    return all(0 <= int(part) <= 255 for part in parts)


def _hostname_risk_signals(full_hostname: str):
    """
    Extra structural risk signals beyond typo matching.
    Returns (score, reasons[]).
    """
    parts = tldextract.extract(full_hostname)
    core = get_hostname_core(full_hostname)
    normalized_core = normalize_token_keep_digits(core)

    score = 0
    reasons = []

    suffix = (parts.suffix or "").lower()
    if not suffix:
        score += 16
        reasons.append("missing or invalid TLD")
    elif len(suffix.split(".")[-1]) == 1:
        score += 10
        reasons.append("abnormal TLD length")

    if suffix in RISKY_TLDS:
        score += 14
        reasons.append(f"risky TLD '.{suffix}'")

    if full_hostname.startswith("xn--") or ".xn--" in full_hostname:
        score += 26
        reasons.append("punycode domain pattern")

    dot_depth = full_hostname.count(".")
    if dot_depth >= 3:
        score += 10
        reasons.append(f"deep subdomain chain ({dot_depth + 1} labels)")

    if normalized_core:
        digit_count = sum(ch.isdigit() for ch in normalized_core)
        digit_ratio = digit_count / max(1, len(normalized_core))
        if digit_count >= 3 and digit_ratio >= 0.22:
            score += 20
            reasons.append(
                f"high digit density ({digit_count}/{len(normalized_core)})"
            )

        if len(normalized_core) >= 24:
            score += 10
            reasons.append("unusually long hostname core")

    if _is_ipv4_host(full_hostname):
        score += 24
        reasons.append("direct IP host usage")

    return min(100, score), reasons


def fetch_page_content_sync(
    url: str,
    timeout: float = DEFAULT_FETCH_TIMEOUT_SECONDS,
) -> str:
    if requests is None:
        return ""
    try:
        headers = {"User-Agent": "Mozilla/5.0 ... Chrome/91.0"}
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        with requests.get(
            url,
            headers=headers,
            timeout=timeout,
            stream=True,
            allow_redirects=True,
        ) as response:
            chunk = next(response.iter_content(25000), b"")
            return chunk.decode("utf-8", errors="ignore")
    except Exception:
        return ""


async def analyze_domain_gemini_deep(domain: str, html_content: str = ""):
    if not GOOGLE_API_KEY or genai is None:
        return None
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        content_context = (
            f"HTML Snippet:\n```html\n{html_content[:2000]}\n```" if html_content else ""
        )
        prompt = f"""
        Analyze: '{domain}'
        {content_context}
        Task:
        1. Detect phishing/scam.
        2. Detect dot obfuscation and typo variants.
        Output JSON: {{ "is_suspicious": bool, "risk_score": int, "suggestion": "domain" or null, "reason": "string", "category": "string" }}
        """
        response = await asyncio.to_thread(model.generate_content, prompt)
        clean_text = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_text)
    except Exception:
        return None


async def analyze_url_logic(url: str):
    cache_key = _analysis_cache_key(url)
    cached = _cache_get(ANALYSIS_CACHE, cache_key)
    if cached:
        return cached

    parts = get_url_parts(url)
    registered_domain = get_registered_domain(parts).lower().strip(".")
    full_hostname = parse_display_domain(url).lower().strip(".")

    # 1. Whitelist checks
    if registered_domain in TRUSTED_DOMAINS_CANONICAL or full_hostname in TRUSTED_DOMAINS_CANONICAL:
        real_ip, server_location = await asyncio.to_thread(get_cached_real_ip_info, full_hostname)
        result = {
            "status": "safe",
            "domain": full_hostname,
            "suggestion": None,
            "score": 100,
            "description": "Trusted domain (whitelist).",
            "ip_address": real_ip,
            "server_location": server_location,
        }
        _cache_set(
            ANALYSIS_CACHE,
            cache_key,
            result,
            ttl_seconds=ANALYSIS_CACHE_TTL_SECONDS,
            max_size=ANALYSIS_CACHE_MAX_SIZE,
        )
        return result

    # 2. Heuristic analysis
    is_typo, typo_suggestion, typo_score, typo_reason = check_typo_squatting_aggressive(
        full_hostname
    )

    final_status = "unknown"
    final_suggestion = None
    final_score = 0
    source = "heuristic"
    reason = "Risk analysis in progress."

    if is_typo:
        final_status = "suspicious"
        final_suggestion = _adapt_suggestion_with_subdomain(
            full_hostname,
            enforce_preferred_brand_domain(typo_suggestion),
        )
        final_score = typo_score
        source = "typo_detection"
        reason = typo_reason or f"Potential impersonation of '{typo_suggestion}'."

    risky_keyword = _contains_risky_keyword(full_hostname)
    if risky_keyword and final_status != "suspicious":
        final_status = "suspicious"
        final_score = max(final_score, 70)
        source = "keyword_rule"
        reason = f"Risky keyword detected: '{risky_keyword}'."

    signal_score, signal_reasons = _hostname_risk_signals(full_hostname)
    if signal_reasons:
        signal_reason_text = "; ".join(signal_reasons[:3])

        if final_status == "suspicious":
            final_score = max(final_score, signal_score)
            reason = f"{reason} Additional host signals: {signal_reason_text}."
        elif signal_score >= 34:
            final_status = "suspicious"
            final_score = max(final_score, signal_score)
            source = "host_signal_rule"
            reason = f"Suspicious host structure: {signal_reason_text}."

    # 3. Deep analysis (Fetch + AI)
    high_confidence_typo = (
        final_status == "suspicious"
        and source == "typo_detection"
        and bool(final_suggestion)
        and final_score >= 94
    )
    should_run_deep = (
        not high_confidence_typo
        and GOOGLE_API_KEY
        and (
            final_status == "unknown"
            or (final_status == "suspicious" and final_score < 88)
        )
    )

    html_content = ""
    gemini_result = None
    if should_run_deep:
        html_content = await asyncio.to_thread(fetch_page_content_sync, url)
        gemini_result = await analyze_domain_gemini_deep(full_hostname, html_content)

    if gemini_result:
        g_suspicious = gemini_result.get("is_suspicious")
        g_score = int(gemini_result.get("risk_score", 0))
        g_suggestion = gemini_result.get("suggestion")

        if g_suggestion and (not final_suggestion or g_score > 60):
            final_suggestion = _adapt_suggestion_with_subdomain(
                full_hostname,
                enforce_preferred_brand_domain(g_suggestion),
            )

        if g_suspicious or g_score > 50:
            final_status = "suspicious"
            source = "ai_deep_scan"
            reason = gemini_result.get("reason") or reason
            if g_score > final_score:
                final_score = g_score
        elif not g_suspicious and g_score < 20 and final_status != "suspicious":
            final_status = "safe"
            source = "ai_verified"
            reason = "AI verified as low risk."

    # Resolve IP info only when needed; typo-block path stays fast.
    if high_confidence_typo:
        real_ip, server_location = "Unresolved", "Hidden"
    else:
        real_ip, server_location = await asyncio.to_thread(get_cached_real_ip_info, full_hostname)

    result = {
        "status": final_status,
        "domain": full_hostname,
        "suggestion": final_suggestion,
        "score": final_score,
        "source": source,
        "description": reason,
        "ip_address": real_ip,
        "server_location": server_location,
    }

    _cache_set(
        ANALYSIS_CACHE,
        cache_key,
        result,
        ttl_seconds=ANALYSIS_CACHE_TTL_SECONDS,
        max_size=ANALYSIS_CACHE_MAX_SIZE,
    )
    return result
