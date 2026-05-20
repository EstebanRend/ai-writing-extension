const ROOT_ID = "ai-writing-assistant-root";
const BUTTON_ID = "ai-writing-assistant-improve";
const RESULT_ID = "ai-writing-assistant-result";
const ERROR_ID = "ai-writing-assistant-error";
const COPY_ID = "ai-writing-assistant-copy";
const CLOSE_ID = "ai-writing-assistant-close";
const ACTION_ID = "improve-writing";

let selectedText = "";
let tooltipEl = null;

function getExtensionRuntime() {
  if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
    return chrome.runtime;
  }
  if (typeof browser !== "undefined" && browser?.runtime?.sendMessage) {
    return browser.runtime;
  }
  return null;
}

function getWindowSelectedText() {
  const selection = window.getSelection();
  return selection ? selection.toString().trim() : "";
}

function getWindowSelectionRect() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0).cloneRange();
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }
  return rect;
}

function getInputSelection() {
  const activeEl = document.activeElement;
  const isTextArea = activeEl instanceof HTMLTextAreaElement;
  const isTextInput =
    activeEl instanceof HTMLInputElement &&
    ["text", "search", "url", "tel", "email", "password"].includes(activeEl.type);

  if (!isTextArea && !isTextInput) {
    return null;
  }

  const start = activeEl.selectionStart;
  const end = activeEl.selectionEnd;
  if (typeof start !== "number" || typeof end !== "number" || start === end) {
    return null;
  }

  const text = activeEl.value.slice(start, end).trim();
  if (!text) {
    return null;
  }

  const rect = activeEl.getBoundingClientRect();
  return { text, rect };
}

function getSelectionDetails() {
  const inputSelection = getInputSelection();
  if (inputSelection) {
    return inputSelection;
  }

  const text = getWindowSelectedText();
  if (!text) {
    return null;
  }

  const rect = getWindowSelectionRect();
  if (!rect) {
    return null;
  }

  return { text, rect };
}

function removeTooltip() {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

function setLoading(loading) {
  if (!tooltipEl) {
    return;
  }

  const btn = tooltipEl.querySelector(`#${BUTTON_ID}`);
  if (btn) {
    btn.disabled = loading;
    btn.textContent = loading ? "Improving..." : "Improve writing";
  }
}

function renderResult(text) {
  if (!tooltipEl) {
    return;
  }
  const result = tooltipEl.querySelector(`#${RESULT_ID}`);
  const error = tooltipEl.querySelector(`#${ERROR_ID}`);
  if (error) {
    error.textContent = "";
  }
  if (result) {
    result.textContent = text;
  }
}

function renderError(message) {
  if (!tooltipEl) {
    return;
  }
  const error = tooltipEl.querySelector(`#${ERROR_ID}`);
  if (error) {
    error.textContent = message;
  }
}

async function copyResult() {
  if (!tooltipEl) {
    return;
  }

  const result = tooltipEl.querySelector(`#${RESULT_ID}`);
  if (!result || !result.textContent.trim()) {
    return;
  }

  try {
    await navigator.clipboard.writeText(result.textContent.trim());
  } catch {
    renderError("Unable to copy. Please copy manually.");
  }
}

function createTooltip(rect) {
  removeTooltip();

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.top = `${window.scrollY + rect.bottom + 8}px`;
  root.style.left = `${window.scrollX + rect.left}px`;
  root.innerHTML = `
    <div class="aiw-header">
      <button id="${BUTTON_ID}" class="aiw-primary">Improve writing</button>
      <button id="${CLOSE_ID}" class="aiw-close" aria-label="Close">x</button>
    </div>
    <div id="${ERROR_ID}" class="aiw-error"></div>
    <div id="${RESULT_ID}" class="aiw-result"></div>
    <div class="aiw-actions">
      <button id="${COPY_ID}" class="aiw-secondary">Copy</button>
    </div>
  `;

  document.body.appendChild(root);
  tooltipEl = root;

  root.querySelector(`#${BUTTON_ID}`)?.addEventListener("click", async () => {
    setLoading(true);
    renderResult("");
    renderError("");

    const runtime = getExtensionRuntime();
    if (!runtime) {
      setLoading(false);
      renderError("Extension runtime unavailable. Reload extension and refresh this page.");
      console.error("[AI Writing] runtime.sendMessage is unavailable in this context.");
      return;
    }

    runtime.sendMessage(
      {
        type: "AI_IMPROVE",
        selectedText,
        actionId: ACTION_ID
      },
      (response) => {
        setLoading(false);
        if (runtime.lastError) {
          renderError("Could not reach extension background worker.");
          console.error("[AI Writing] background error:", runtime.lastError.message);
          return;
        }
        if (!response?.ok) {
          renderError(response?.error ?? "AI request failed.");
          return;
        }
        renderResult(response.result || "");
      }
    );
  });

  root.querySelector(`#${COPY_ID}`)?.addEventListener("click", copyResult);
  root.querySelector(`#${CLOSE_ID}`)?.addEventListener("click", removeTooltip);
}

function refreshTooltip() {
  const details = getSelectionDetails();
  if (!details) {
    selectedText = "";
    removeTooltip();
    return;
  }

  selectedText = details.text;
  createTooltip(details.rect);
}

document.addEventListener("mouseup", () => {
  window.setTimeout(refreshTooltip, 0);
});

document.addEventListener("keyup", (event) => {
  if (event.key === "Escape") {
    removeTooltip();
    return;
  }
  window.setTimeout(refreshTooltip, 0);
});

document.addEventListener("mousedown", (event) => {
  if (!tooltipEl) {
    return;
  }
  const target = event.target;
  if (target instanceof Node && tooltipEl.contains(target)) {
    return;
  }
  removeTooltip();
});

window.addEventListener("scroll", () => {
  if (tooltipEl) {
    removeTooltip();
  }
});
