// Content Script - Warning UI + SERP signal badges

const SAFE_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path fill-rule="evenodd" d="M12.516 2.17a.75.75 0 00-1.032 0 11.209 11.209 0 01-7.877 3.08.75.75 0 00-.722.515A12.74 12.74 0 002.25 12c0 5.61 4.23 10.41 9.603 11.663a.75.75 0 00.294 0C17.52 22.41 21.75 17.61 21.75 12c0-1.81-.269-3.532-.763-5.16a.75.75 0 00-.722-.515 11.209 11.209 0 01-7.877-3.08zM12 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" clip-rule="evenodd" />
</svg>`;

const SUSPICIOUS_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
</svg>`;

const LOADING_ICON = `
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
  <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"></path>
</svg>`;

chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "SHOW_WARNING") {
    createWarningOverlay(request.data || {});
  }
});

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isLikelyDomain(value) {
  return typeof value === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value);
}

function createWarningOverlay(data) {
  if (document.getElementById("domain-guard-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "domain-guard-overlay";
  const shadow = overlay.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = `
    .overlay-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.84);
      backdrop-filter: blur(6px);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, sans-serif;
    }
    .modal-card {
      width: min(92vw, 480px);
      background: #111;
      color: #fff;
      border: 1px solid #333;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 0 50px rgba(220, 38, 38, 0.2);
      text-align: center;
    }
    .icon {
      width: 52px;
      height: 52px;
      margin: 0 auto 14px;
      border-radius: 999px;
      background: #ef4444;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
    }
    h2 {
      margin: 0 0 10px;
      color: #ef4444;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.3px;
    }
    p {
      margin: 0 0 20px;
      color: #9ca3af;
      line-height: 1.5;
    }
    .domain-tag {
      color: #ef4444;
      font-family: monospace;
      background: #2a1111;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .reason-box, .suggestion-box {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      text-align: left;
    }
    .reason-label, .suggestion-label {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .reason-text {
      font-size: 13px;
      color: #e2e8f0;
      line-height: 1.45;
    }
    .suggestion-value {
      font-size: 18px;
      font-weight: 700;
      color: #22c55e;
    }
    .btn {
      width: 100%;
      display: block;
      border: 0;
      border-radius: 8px;
      padding: 13px;
      cursor: pointer;
      font-weight: 600;
      margin-top: 8px;
    }
    .btn-primary {
      background: #fff;
      color: #111;
    }
    .btn-ghost {
      background: transparent;
      color: #9ca3af;
      border: 1px solid #3f3f46;
    }
  `;

  const safeDomain = escapeHtml(data.domain || "unknown");
  const safeDescription = escapeHtml(data.description || "");
  const safeSuggestion = escapeHtml(data.suggestion || "");
  const safeScore = typeof data.score === "number" ? data.score : null;
  const scoreSuffix = safeScore !== null ? ` (score: ${safeScore})` : "";
  const reasonSection = data.description
    ? `
      <div class="reason-box">
        <div class="reason-label">Why risky?</div>
        <div class="reason-text">${safeDescription}${scoreSuffix}</div>
      </div>`
    : "";

  const suggestionSection = data.suggestion
    ? `
      <div class="suggestion-box">
        <div class="suggestion-label">Did you mean?</div>
        <div class="suggestion-value">${safeSuggestion}</div>
      </div>
      <button class="btn btn-primary" id="goSafeBtn">Safe Redirect (${safeSuggestion})</button>`
    : "";

  const container = document.createElement("div");
  container.className = "overlay-backdrop";
  container.innerHTML = `
    <div class="modal-card">
      <span class="icon">!</span>
      <h2>EAGLESKY SECURITY</h2>
      <p>
        Connection blocked. The site
        <span class="domain-tag">${safeDomain}</span>
        has been flagged as high risk.
      </p>
      ${reasonSection}
      ${suggestionSection}
      <button class="btn btn-ghost" id="ignoreBtn">Unsafe Proceed (Not Recommended)</button>
    </div>
  `;

  shadow.appendChild(style);
  shadow.appendChild(container);
  document.body.appendChild(overlay);

  shadow.getElementById("ignoreBtn")?.addEventListener("click", () => overlay.remove());
  if (data.suggestion && isLikelyDomain(data.suggestion)) {
    shadow.getElementById("goSafeBtn")?.addEventListener("click", () => {
      window.location.href = `https://${data.suggestion}`;
    });
  }
}

function injectSearchIcons() {
  if (!window.location.hostname.includes("google")) return;

  const results = document.querySelectorAll(".g");
  results.forEach((result) => {
    const linkAnchor = result.querySelector("a");
    if (!linkAnchor) return;

    if (result.getAttribute("data-eaglesky-processed")) return;
    result.setAttribute("data-eaglesky-processed", "true");

    const title = result.querySelector("h3");
    if (!title) return;

    const badge = document.createElement("span");
    badge.style.marginLeft = "8px";
    badge.style.display = "inline-flex";
    badge.style.verticalAlign = "middle";
    badge.style.width = "16px";
    badge.style.height = "16px";
    badge.style.color = "#9ca3af";
    badge.innerHTML = LOADING_ICON;
    title.appendChild(badge);

    chrome.runtime.sendMessage(
      { action: "ANALYZE_URL", url: linkAnchor.href },
      (response) => {
        if (!response) return;

        if (response.status === "safe") {
          badge.innerHTML = SAFE_ICON;
          badge.style.color = "#22c55e";
          badge.title = "EagleSky Verified: Safe";
        } else if (response.status === "suspicious") {
          badge.innerHTML = SUSPICIOUS_ICON;
          badge.style.color = "#ef4444";
          badge.title = `Warning: ${response.description || "Suspicious site"}`;
          result.style.borderLeft = "3px solid #ef4444";
          result.style.paddingLeft = "10px";
        } else {
          badge.remove();
        }
      },
    );
  });
}

if (window.location.hostname.includes("google")) {
  setInterval(injectSearchIcons, 1000);
}
