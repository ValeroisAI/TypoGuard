const HISTORY_KEY = "scanHistory";
const API_ENDPOINTS = [
  "http://localhost:8001/api",
  "https://safedomain.preview.emergentagent.com/api",
];

const hasChromeApi =
  typeof chrome !== "undefined" &&
  !!chrome.runtime &&
  !!chrome.storage &&
  !!chrome.tabs;

const shell = document.getElementById("popup-shell");
const root = document.getElementById("root");

const form = document.getElementById("scan-form");
const input = document.getElementById("url-input");
const scanButton = document.getElementById("scan-btn");
const scanTabButton = document.getElementById("scan-tab-btn");
const autoToggle = document.getElementById("auto-toggle");

const resultCard = document.getElementById("result-card");
const statusText = document.getElementById("status-text");
const domainText = document.getElementById("domain-text");
const scoreText = document.getElementById("score-text");
const suggestionText = document.getElementById("suggestion-text");
const descriptionText = document.getElementById("desc-text");
const goSafeButton = document.getElementById("go-safe-btn");
const historyList = document.getElementById("history-list");

let currentSuggestion = null;

function normalizeInputToUrl(rawValue) {
  const trimmed = (rawValue || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function extractDomain(rawValue) {
  try {
    const host = new URL(normalizeInputToUrl(rawValue)).hostname;
    return host.replace(/^www\./i, "");
  } catch (_error) {
    return rawValue.trim();
  }
}

function isLikelyDomain(value) {
  return typeof value === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
}

function setBusy(isBusy) {
  scanButton.disabled = isBusy;
  scanTabButton.disabled = isBusy;
  scanButton.textContent = isBusy ? "Analyzing..." : "Analyze";
}

function styleResultCard(status) {
  resultCard.classList.remove("safe", "suspicious");
  if (status === "safe") resultCard.classList.add("safe");
  if (status === "suspicious") resultCard.classList.add("suspicious");
}

function renderResult(result) {
  const status = result?.status || "unknown";
  const score = typeof result?.score === "number" ? result.score : "-";
  currentSuggestion = result?.suggestion || null;

  styleResultCard(status);
  resultCard.classList.remove("hidden");

  statusText.textContent = status.toUpperCase();
  domainText.textContent = result?.domain || extractDomain(input.value) || "-";
  scoreText.textContent = String(score);
  suggestionText.textContent = currentSuggestion || "-";
  descriptionText.textContent = result?.description || "";

  if (currentSuggestion && status === "suspicious") {
    goSafeButton.classList.remove("hidden");
    goSafeButton.textContent = `Safe Redirect -> ${currentSuggestion}`;
  } else {
    goSafeButton.classList.add("hidden");
  }
}

function upsertHistory(entry) {
  if (!hasChromeApi) return;
  chrome.storage.local.get([HISTORY_KEY], (stored) => {
    const prev = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
    const withoutDup = prev.filter((item) => item.domain !== entry.domain);
    const next = [entry, ...withoutDup].slice(0, 12);
    chrome.storage.local.set({ [HISTORY_KEY]: next }, renderHistory);
  });
}

function renderHistory() {
  if (!hasChromeApi) {
    historyList.innerHTML = "";
    return;
  }
  chrome.storage.local.get([HISTORY_KEY], (stored) => {
    const rows = Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
    historyList.innerHTML = "";

    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.style.color = "#71717a";
      empty.style.fontSize = "12px";
      empty.textContent = "No scans yet.";
      historyList.appendChild(empty);
      return;
    }

    rows.forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "history-item";
      row.innerHTML = `
        <span class="dot ${item.status || "unknown"}"></span>
        <code>${item.domain}</code>
      `;
      row.addEventListener("click", () => {
        input.value = item.domain;
        analyze(item.domain);
      });
      historyList.appendChild(row);
    });
  });
}

function analyzeWithApiFallback(url) {
  const payload = JSON.stringify({ url });
  const headers = { "Content-Type": "application/json" };

  return API_ENDPOINTS.reduce((chain, apiBase) => {
    return chain.catch(() =>
      fetch(`${apiBase.replace(/\/+$/, "")}/analyze`, {
        method: "POST",
        headers,
        body: payload,
      }).then((res) => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      }),
    );
  }, Promise.reject(new Error("no-endpoint")));
}

function analyzeWithBackground(url) {
  if (!hasChromeApi) {
    return Promise.reject(new Error("Extension runtime not available"));
  }
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "ANALYZE_URL", url }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error("No response from background"));
        return;
      }
      resolve(response);
    });
  });
}

async function analyze(rawInput) {
  const normalizedUrl = normalizeInputToUrl(rawInput);
  if (!normalizedUrl) return;

  setBusy(true);
  try {
    let result;
    if (hasChromeApi) {
      try {
        result = await analyzeWithBackground(normalizedUrl);
      } catch (_bgError) {
        result = await analyzeWithApiFallback(normalizedUrl);
      }
    } else {
      result = await analyzeWithApiFallback(normalizedUrl);
    }

    renderResult(result);
    upsertHistory({
      domain: result?.domain || extractDomain(normalizedUrl),
      status: result?.status || "unknown",
      timestamp: Date.now(),
    });
  } catch (_error) {
    renderResult({
      status: "error",
      domain: extractDomain(normalizedUrl),
      score: 0,
      suggestion: null,
      description: "Analyze service unreachable.",
    });
  } finally {
    setBusy(false);
  }
}

function loadAutoRedirectToggle() {
  if (!hasChromeApi) return;
  chrome.storage.local.get(["autoRedirect"], (stored) => {
    autoToggle.checked = stored.autoRedirect !== false;
  });
}

function initAutoRedirectToggle() {
  if (!hasChromeApi) return;
  autoToggle.addEventListener("change", () => {
    const enabled = autoToggle.checked;
    chrome.storage.local.set({ autoRedirect: enabled });
    chrome.runtime.sendMessage({ action: "TOGGLE_AUTO_REDIRECT", value: enabled });
  });
}

function scanActiveTab() {
  if (!hasChromeApi) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeUrl = tabs?.[0]?.url;
    if (!activeUrl || !/^https?:\/\//i.test(activeUrl)) return;
    input.value = activeUrl;
    analyze(activeUrl);
  });
}

function hideStaticPopupIfReactMounted() {
  setTimeout(() => {
    if (root && root.childElementCount > 0) {
      shell.classList.add("hidden");
    }
  }, 300);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  analyze(input.value);
});

scanTabButton.addEventListener("click", scanActiveTab);

goSafeButton.addEventListener("click", () => {
  if (!currentSuggestion || !isLikelyDomain(currentSuggestion)) return;
  const target = `https://${currentSuggestion}`;
  if (hasChromeApi) {
    chrome.tabs.create({ url: target });
  } else {
    window.open(target, "_blank", "noopener,noreferrer");
  }
});

if (hasChromeApi) {
  loadAutoRedirectToggle();
  initAutoRedirectToggle();
  renderHistory();
  scanActiveTab();
  hideStaticPopupIfReactMounted();
} else {
  autoToggle.closest(".switch-wrap")?.classList.add("hidden");
  scanTabButton.classList.add("hidden");
  historyList.innerHTML = "";
}
