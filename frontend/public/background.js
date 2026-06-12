// Background Service Worker
// EagleSky v3.1 Core Logic

const API_ENDPOINTS = [
  "http://localhost:8001/api",
  "https://safedomain.preview.emergentagent.com/api",
];

// Configuration
let isAutoRedirectEnabled = true; // Default: ON for maximum protection

// State Management
const cache = new Map();
let whitelist = new Set();
const redirectHistory = new Map(); // Loop prevention: { tabId: { url: timestamp } }

// Local typo fallback (used when API misses/returns unknown)
const KNOWN_MULTI_LABEL_SUFFIXES = new Set([
  "com.tr",
  "gov.tr",
  "edu.tr",
  "org.tr",
  "net.tr",
  "co.uk",
]);

const LEET_TRANSLATION = {
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
};

const NUMERIC_VARIANTS = {
  "0": ["o", "0"],
  "1": ["l", "i", "1"],
  "2": ["z", "2"],
  "3": ["e", "3"],
  "4": ["a", "4"],
  "5": ["s", "5"],
  "6": ["g", "b", "6"],
  "7": ["t", "7"],
  "8": ["b", "8"],
  "9": ["g", "q", "9"],
};

const MAX_LOCAL_VARIANTS = 32;

const PREFERRED_BRAND_DOMAINS = {
  google: "google.com",
};

const LOCAL_FALLBACK_DOMAINS = [
  "google.com",
  "google.de",
  "google.co.uk",
  "google.com.tr",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "whatsapp.com",
  "tiktok.com",
  "microsoft.com",
  "office.com",
  "office365.com",
  "outlook.com",
  "bing.com",
  "github.com",
  "apple.com",
  "icloud.com",
  "amazon.com",
  "amazon.com.tr",
  "netflix.com",
  "spotify.com",
  "discord.com",
  "dropbox.com",
  "slack.com",
  "adobe.com",
  "figma.com",
  "canva.com",
  "openai.com",
  "chatgpt.com",
  "yahoo.com",
  "yandex.com",
  "cloudflare.com",
  "paypal.com",
  "stripe.com",
  "wise.com",
  "revolut.com",
  "coinbase.com",
  "binance.com",
  "turkiye.gov.tr",
  "edevlet.gov.tr",
  "gib.gov.tr",
  "sgk.gov.tr",
  "meb.gov.tr",
  "saglik.gov.tr",
  "ziraatbank.com.tr",
  "ziraatbankasi.com.tr",
  "isbank.com.tr",
  "isbankasi.com.tr",
  "garantibbva.com.tr",
  "garanti.com.tr",
  "akbank.com",
  "akbank.com.tr",
  "yapikredi.com.tr",
  "vakifbank.com.tr",
  "halkbank.com.tr",
  "halkbankasi.com.tr",
  "qnb.com.tr",
  "enpara.com",
  "denizbank.com",
  "denizbank.com.tr",
  "teb.com.tr",
  "kuveytturk.com.tr",
  "albaraka.com.tr",
  "turkiyefinans.com.tr",
  "papara.com",
  "tosla.com",
  "ininal.com",
  "iyzico.com",
  "bkm.com.tr",
  "trendyol.com",
  "hepsiburada.com",
  "n11.com",
  "sahibinden.com",
  "yemeksepeti.com",
  "getir.com",
  "ciceksepeti.com",
  "migros.com.tr",
  "a101.com.tr",
  "bim.com.tr",
  "teknosa.com",
  "vatanbilgisayar.com",
  "turkcell.com.tr",
  "vodafone.com.tr",
  "turktelekom.com.tr",
  "thy.com",
  "pegasus.com",
  "obilet.com",
  "enuygun.com",
];

const LOCAL_FALLBACK_DOMAIN_SET = new Set(
  LOCAL_FALLBACK_DOMAINS.map((domain) => String(domain || "").toLowerCase()),
);

function normalizeTokenKeepDigits(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeTextToken(value) {
  const lowered = String(value || "").toLowerCase();
  const translated = lowered.replace(/[0-9]/g, (digit) => LEET_TRANSLATION[digit] || digit);
  return translated.replace(/[^a-z0-9]/g, "");
}

function extractCoreFromHostname(hostname) {
  const labels = String(hostname || "")
    .toLowerCase()
    .split(".")
    .filter(Boolean);
  if (labels.length <= 1) return labels[0] || "";

  const lastTwo = labels.length >= 2 ? `${labels[labels.length - 2]}.${labels[labels.length - 1]}` : "";
  const suffixLen = KNOWN_MULTI_LABEL_SUFFIXES.has(lastTwo) ? 2 : 1;
  const coreLabels = labels.slice(0, -suffixLen);
  if (coreLabels.length === 0) {
    return labels.slice(0, -1).join(".");
  }
  return coreLabels.join(".");
}

function getDomainSuffix(domain) {
  const labels = String(domain || "")
    .toLowerCase()
    .split(".")
    .filter(Boolean);
  if (labels.length < 2) return "";
  const lastTwo = `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;
  if (KNOWN_MULTI_LABEL_SUFFIXES.has(lastTwo)) return lastTwo;
  return labels[labels.length - 1];
}

function suffixRank(suffix) {
  if (suffix === "com") return 100;
  if (suffix === "com.tr") return 96;
  if (suffix === "gov.tr") return 95;
  if (suffix === "gov") return 92;
  if (suffix === "org") return 90;
  if (suffix === "net") return 88;
  if (suffix === "edu") return 87;
  if (suffix === "edu.tr") return 86;
  if (suffix === "tr") return 82;
  if (suffix.endsWith(".tr")) return 80;
  return suffix ? 65 : 40;
}

function candidateScore(domain) {
  const clean = String(domain || "").toLowerCase();
  const labels = clean.split(".").filter(Boolean);
  if (labels.length < 2) return 0;
  const brand = labels[labels.length - (KNOWN_MULTI_LABEL_SUFFIXES.has(`${labels[labels.length - 2]}.${labels[labels.length - 1]}`) ? 3 : 2)] || "";
  const suffix = getDomainSuffix(clean);
  let score = suffixRank(suffix);
  if (PREFERRED_BRAND_DOMAINS[brand] === clean) score += 55;
  score -= clean.length / 200;
  return score;
}

function pickBetterDomain(currentDomain, candidateDomain) {
  if (!currentDomain) return candidateDomain;
  return candidateScore(candidateDomain) > candidateScore(currentDomain)
    ? candidateDomain
    : currentDomain;
}

function expandNumericVariants(value, maxVariants = MAX_LOCAL_VARIANTS) {
  const seed = normalizeTokenKeepDigits(value);
  if (!seed) return new Set();

  const ordered = [seed];
  const seen = new Set([seed]);

  for (let i = 0; i < seed.length; i += 1) {
    const choices = NUMERIC_VARIANTS[seed[i]];
    if (!choices) continue;

    const snapshot = [...ordered];
    for (const variant of snapshot) {
      for (const replacement of choices) {
        const mutated = normalizeTokenKeepDigits(
          `${variant.slice(0, i)}${replacement}${variant.slice(i + 1)}`,
        );
        if (!mutated || seen.has(mutated)) continue;
        seen.add(mutated);
        ordered.push(mutated);
        if (ordered.length >= maxVariants) break;
      }
      if (ordered.length >= maxVariants) break;
    }
    if (ordered.length >= maxVariants) break;
  }

  const fullyMapped = normalizeTokenKeepDigits(seed.replace(/[0-9]/g, (digit) => LEET_TRANSLATION[digit] || digit));
  if (fullyMapped && !seen.has(fullyMapped)) {
    if (ordered.length < maxVariants) {
      ordered.push(fullyMapped);
    } else {
      ordered[ordered.length - 1] = fullyMapped;
    }
  }

  return new Set(ordered.filter(Boolean));
}

function buildLocalSignatureMap() {
  const map = new Map();

  function register(signature, domain) {
    const cleanSignature = normalizeTokenKeepDigits(signature);
    const cleanDomain = String(domain || "").toLowerCase();
    if (!cleanSignature || cleanSignature.length < 3 || !cleanDomain) return;
    map.set(cleanSignature, pickBetterDomain(map.get(cleanSignature), cleanDomain));
  }

  for (const domain of LOCAL_FALLBACK_DOMAINS) {
    const cleanDomain = String(domain || "").toLowerCase().trim();
    if (!cleanDomain) continue;

    const core = extractCoreFromHostname(cleanDomain);
    const compactCore = core.replace(/[.-]/g, "");
    const labels = core.split(".").filter(Boolean);

    register(core, cleanDomain);
    register(compactCore, cleanDomain);
    register(normalizeTextToken(core), cleanDomain);

    for (const variant of expandNumericVariants(core)) {
      register(variant, cleanDomain);
    }

    for (const label of labels) {
      register(label, cleanDomain);
      for (const variant of expandNumericVariants(label)) {
        register(variant, cleanDomain);
      }
      register(normalizeTextToken(label), cleanDomain);
    }
  }

  return map;
}

const LOCAL_SIGNATURES_MAP = buildLocalSignatureMap();

function editDistance(a, b) {
  const aa = String(a || "");
  const bb = String(b || "");
  if (aa === bb) return 0;
  if (!aa) return bb.length;
  if (!bb) return aa.length;

  let prev = new Array(bb.length + 1).fill(0).map((_, idx) => idx);
  for (let i = 1; i <= aa.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= bb.length; j += 1) {
      const cost = aa[i - 1] === bb[j - 1] ? 0 : 1;
      current[j] = Math.min(
        prev[j] + 1,
        current[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    prev = current;
  }
  return prev[bb.length];
}

function detectLocalNumericTypo(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (!/\d/.test(hostname)) return null;
    if (LOCAL_FALLBACK_DOMAIN_SET.has(hostname)) return null;

    const core = extractCoreFromHostname(hostname);
    const baseSignature = normalizeTokenKeepDigits(core);
    if (!baseSignature || baseSignature.length < 3) return null;

    const alphaCount = (baseSignature.match(/[a-z]/g) || []).length;
    if (alphaCount < 3) return null;

    const candidateSignatures = new Set([
      ...expandNumericVariants(core),
      normalizeTextToken(core),
      normalizeTokenKeepDigits(core.replace(/[.-]/g, "")),
    ]);

    for (const signature of candidateSignatures) {
      const directMatch = LOCAL_SIGNATURES_MAP.get(signature);
      if (directMatch && directMatch !== hostname) {
        return {
          status: "suspicious",
          domain: hostname,
          suggestion: directMatch,
          score: 99,
          source: "local_typo_fallback",
          description: `Local numeric typo fallback matched '${directMatch}'.`,
        };
      }
    }

    let best = null;
    for (const signature of candidateSignatures) {
      if (!signature || signature.length < 4) continue;
      for (const [trustedSignature, trustedDomain] of LOCAL_SIGNATURES_MAP.entries()) {
        if (trustedDomain === hostname) continue;
        if (Math.abs(signature.length - trustedSignature.length) > 1) continue;
        if (signature[0] !== trustedSignature[0]) continue;

        const distance = editDistance(signature, trustedSignature);
        const minLen = Math.min(signature.length, trustedSignature.length);
        const score = distance === 1 && minLen >= 5 ? 95 : 0;

        if (score && (!best || score > best.score)) {
          best = { score, suggestion: trustedDomain, distance };
        }
      }
    }

    if (best) {
      return {
        status: "suspicious",
        domain: hostname,
        suggestion: best.suggestion,
        score: best.score,
        source: "local_typo_fallback",
        description: `Local numeric typo fallback detected edit-distance=${best.distance}.`,
      };
    }

    return null;
  } catch (_error) {
    return null;
  }
}

function mergeWithLocalFallback(url, apiResult) {
  const localFallback = detectLocalNumericTypo(url);
  if (!localFallback) return apiResult;

  if (
    apiResult &&
    apiResult.status === "suspicious" &&
    isLikelyDomain(apiResult.suggestion)
  ) {
    return apiResult;
  }

  return {
    ...(apiResult || {}),
    ...localFallback,
  };
}

function normalizeApiBase(apiBase) {
  return (apiBase || "").replace(/\/+$/, "");
}

function isLikelyDomain(value) {
  return typeof value === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
}

async function fetchAnalysis(apiBase, url) {
  const response = await fetch(`${normalizeApiBase(apiBase)}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`Analysis API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data || !data.status) {
    throw new Error("Invalid analysis response");
  }

  return data;
}

// Load persisted whitelist
chrome.storage.local.get(["whitelist", "autoRedirect"], (result) => {
  if (result.whitelist) whitelist = new Set(result.whitelist);
  if (result.autoRedirect !== undefined) isAutoRedirectEnabled = result.autoRedirect;
});

async function analyzeUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    const normalizedHost = hostname.replace(/^www\./i, "");
    if (whitelist.has(hostname) || whitelist.has(normalizedHost)) {
      return { status: "safe", domain: hostname };
    }

    if (cache.has(url)) return cache.get(url);

    let lastError = null;
    for (const apiBase of API_ENDPOINTS) {
      try {
        const data = await fetchAnalysis(apiBase, url);
        const resolved = mergeWithLocalFallback(url, data);
        cache.set(url, resolved);
        setTimeout(() => cache.delete(url), 300000); // 5 min cache
        return resolved;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      console.error("[EagleSky] All analysis endpoints failed", lastError);
    }

    const fallbackResult = detectLocalNumericTypo(url);
    if (fallbackResult) {
      cache.set(url, fallbackResult);
      setTimeout(() => cache.delete(url), 300000);
      return fallbackResult;
    }

    return { status: "error", description: "Analysis service unavailable" };
  } catch (error) {
    return { status: "error", description: "Invalid URL" };
  }
}

function preventLoop(tabId, targetUrl) {
  const now = Date.now();
  const lastRedirect = redirectHistory.get(tabId);

  // If redirected to same URL within 5 seconds, block it
  if (
    lastRedirect &&
    lastRedirect.url === targetUrl &&
    now - lastRedirect.time < 5000
  ) {
    return true; // Loop detected
  }

  redirectHistory.set(tabId, { url: targetUrl, time: now });
  return false;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Trigger on 'loading' to intercept early
  if (changeInfo.url || (changeInfo.status === "loading" && tab.url)) {
    const currentUrl = changeInfo.url || tab.url;
    if (!currentUrl.startsWith("http")) return;

    // UI Feedback: Analyzing...
    chrome.action.setBadgeText({ text: "...", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#6b7280", tabId });

    const data = await analyzeUrl(currentUrl);

    // --- EAGLESKY AUTO-PILOT LOGIC ---
    const reasonText = String(data.description || "").toLowerCase();
    const numericScore = Number(data.score);
    const likelyTypoSignal =
      data.source === "typo_detection" ||
      data.source === "local_typo_fallback" ||
      reasonText.includes("typo") ||
      reasonText.includes("digit-substitution") ||
      reasonText.includes("normalized signature");

    const shouldAutoRedirect =
      isAutoRedirectEnabled &&
      data.status === "suspicious" &&
      isLikelyDomain(data.suggestion) &&
      (
        likelyTypoSignal ||
        (Number.isFinite(numericScore) && numericScore >= 76)
      );

    if (shouldAutoRedirect) {
      const targetUrl = `https://${data.suggestion}`;

      // Safety Check: Don't redirect if we are already there (or very close)
      if (!currentUrl.includes(data.suggestion) && !preventLoop(tabId, targetUrl)) {
        console.log(`[EagleSky] Auto-Redirecting threat ${currentUrl} to ${targetUrl}`);

        // Notify User via Notification API
        chrome.notifications.create({
          type: "basic",
          iconUrl: "logo192.png",
          title: "EagleSky Shield Active",
          message: `Malicious site blocked. Redirecting you to ${data.suggestion}`,
          priority: 2,
        });

        // EXECUTE REDIRECT
        chrome.tabs.update(tabId, { url: targetUrl });

        // Update Badge to Blue immediately (auto action)
        chrome.action.setBadgeText({ text: "PRO", tabId });
        chrome.action.setBadgeBackgroundColor({ color: "#3b82f6", tabId });
        return; // Stop further processing
      }
    }

    handleAnalysisResult(tabId, data);
  }
});

function handleAnalysisResult(tabId, data) {
  if (data.status === "suspicious") {
    // Inject Warning Overlay if not auto-redirected
    chrome.scripting
      .executeScript({
        target: { tabId },
        files: ["content.js"],
      })
      .then(() => {
        chrome.tabs.sendMessage(tabId, { action: "SHOW_WARNING", data });
      })
      .catch(() => {});

    chrome.action.setBadgeText({ text: "!", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444", tabId });
  } else if (data.status === "safe") {
    chrome.action.setBadgeText({ text: "OK", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#22c55e", tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
  }
}

// Communication Channel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ANALYZE_URL") {
    analyzeUrl(request.url).then((data) => sendResponse(data));
    return true;
  }

  if (request.action === "ADD_WHITELIST") {
    whitelist.add(request.domain);
    chrome.storage.local.set({ whitelist: Array.from(whitelist) });
    sendResponse({ success: true });
  }

  if (request.action === "TOGGLE_AUTO_REDIRECT") {
    isAutoRedirectEnabled = request.value;
    chrome.storage.local.set({ autoRedirect: request.value });
  }
});
