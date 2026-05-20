const ROOT_ID = "ai-writing-assistant-root";
const BUTTON_ID = "ai-writing-assistant-improve";

let tooltipEl = null;
let selectedState = null;

function getExtensionRuntime() {
  if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
    return chrome.runtime;
  }
  if (typeof browser !== "undefined" && browser?.runtime?.sendMessage) {
    return browser.runtime;
  }
  return null;
}

function sendRuntimeMessage(runtime, payload) {
  return new Promise((resolve, reject) => {
    try {
      runtime.sendMessage(payload, (response) => {
        if (runtime.lastError) {
          reject(new Error(runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function isContextInvalidatedError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.toLowerCase().includes("extension context invalidated");
}

function getInputSelectionDetails() {
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

  return {
    text,
    rect: activeEl.getBoundingClientRect(),
    mode: "input",
    element: activeEl,
    start,
    end
  };
}

function getRangeSelectionDetails() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  return {
    text,
    rect,
    mode: "range",
    range: range.cloneRange()
  };
}

function getSelectionDetails() {
  return getInputSelectionDetails() || getRangeSelectionDetails();
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
  const button = tooltipEl.querySelector(`#${BUTTON_ID}`);
  if (!button) {
    return;
  }
  button.disabled = loading;
  button.textContent = loading ? "Improving..." : "Improve writing";
}

function replaceSelectionWithText(newText) {
  if (!selectedState) {
    return false;
  }

  if (selectedState.mode === "input") {
    const { element, start, end } = selectedState;
    if (!element || !element.isConnected) {
      return false;
    }
    element.focus();
    element.setSelectionRange(start, end);
    element.setRangeText(newText, start, end, "end");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const range = selectedState.range;
  if (!range) {
    return false;
  }

  const targetRange = range.cloneRange();
  if (!targetRange.commonAncestorContainer?.isConnected) {
    return false;
  }

  targetRange.deleteContents();
  targetRange.insertNode(document.createTextNode(newText));
  return true;
}

async function runImprove() {
  if (!selectedState?.text) {
    return;
  }

  setLoading(true);
  try {
    const runtime = getExtensionRuntime();
    if (!runtime) {
      throw new Error("Extension runtime unavailable. Reload extension and refresh the page.");
    }

    const response = await sendRuntimeMessage(runtime, {
      type: "AI_IMPROVE",
      selectedText: selectedState.text
    });
    if (!response?.ok) {
      throw new Error(response?.error ?? "AI request failed.");
    }

    const result = response.result || "";
    if (result) {
      replaceSelectionWithText(result);
    }
    removeTooltip();
  } catch (error) {
    if (isContextInvalidatedError(error)) {
      console.error("[AI Writing] Extension context invalidated. Reload extension and refresh Slack tab.");
      return;
    }
    console.error("[AI Writing] Improve failed:", error);
  } finally {
    setLoading(false);
  }
}

function createTooltip(rect) {
  removeTooltip();

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.top = `${window.scrollY + rect.bottom + 8}px`;
  root.style.left = `${window.scrollX + rect.left}px`;
  root.innerHTML = `<button id="${BUTTON_ID}" class="aiw-primary">Improve writing</button>`;

  document.body.appendChild(root);
  tooltipEl = root;
  root.querySelector(`#${BUTTON_ID}`)?.addEventListener("click", runImprove);
}

function refreshTooltip() {
  const details = getSelectionDetails();
  if (!details) {
    selectedState = null;
    removeTooltip();
    return;
  }

  selectedState = details;
  createTooltip(details.rect);
}

document.addEventListener("mouseup", () => {
  window.setTimeout(refreshTooltip, 0);
});

document.addEventListener("keyup", (event) => {
  if (event.key === "Escape") {
    selectedState = null;
    removeTooltip();
    return;
  }
  window.setTimeout(refreshTooltip, 0);
});

document.addEventListener("mousedown", (event) => {
  if (!tooltipEl) {
    return;
  }
  if (event.target instanceof Node && tooltipEl.contains(event.target)) {
    return;
  }
  removeTooltip();
});

window.addEventListener("scroll", removeTooltip);
