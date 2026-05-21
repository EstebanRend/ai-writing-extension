const ROOT_ID = "ai-writing-assistant-root";
const BUTTON_ID = "ai-writing-assistant-improve";
const MENU_BUTTON_ID = "ai-writing-assistant-menu";
const MENU_ID = "ai-writing-assistant-menu-list";
const DEFAULT_ACTION_ID = "improve-writing";
const FALLBACK_ACTIONS = [
  { id: "improve-writing", label: "Improve writing" },
  { id: "daily-report", label: "Daily report" },
  { id: "ask-help", label: "Ask help" },
  { id: "request-review", label: "Request review" }
];

const TOOLTIP_GAP_PX = 8;

const ICON_WAND = `<svg class="aiw-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="m17.8 11.8 1.2 1.2"/><path d="m17.8 6.2 1.2-1.2"/><path d="M3 21l9-9"/><path d="M12.2 6.2 11 5"/></svg>`;
const ICON_CHEVRON = `<svg class="aiw-icon aiw-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>`;

let tooltipEl = null;
let selectedState = null;
let actionsCache = null;
let currentActionId = DEFAULT_ACTION_ID;
let menuOpen = false;

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

async function loadActions() {
  if (actionsCache) {
    return actionsCache;
  }

  const runtime = getExtensionRuntime();
  if (!runtime) {
    actionsCache = FALLBACK_ACTIONS;
    return actionsCache;
  }

  try {
    const response = await sendRuntimeMessage(runtime, { type: "GET_ACTIONS" });
    if (response?.ok && Array.isArray(response.actions) && response.actions.length > 0) {
      actionsCache = response.actions;
      if (typeof response.defaultActionId === "string") {
        currentActionId = response.defaultActionId;
      }
      return actionsCache;
    }
  } catch (error) {
    if (!isContextInvalidatedError(error)) {
      console.warn("[AI Writing] Could not load actions from backend:", error);
    }
  }

  actionsCache = FALLBACK_ACTIONS;
  return actionsCache;
}

function getActionLabel(actionId) {
  const action = (actionsCache || FALLBACK_ACTIONS).find((item) => item.id === actionId);
  return action?.label ?? "Improve writing";
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
  menuOpen = false;
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

function setMenuOpen(open) {
  menuOpen = open;
  if (!tooltipEl) {
    return;
  }
  const menuButton = tooltipEl.querySelector(`#${MENU_BUTTON_ID}`);
  const menu = tooltipEl.querySelector(`#${MENU_ID}`);
  if (menuButton) {
    menuButton.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (menu) {
    menu.hidden = !open;
  }
}

function renderMainButtonLabel() {
  const button = tooltipEl?.querySelector(`#${BUTTON_ID}`);
  if (!button) {
    return;
  }
  const label = getActionLabel(currentActionId);
  button.innerHTML = `${ICON_WAND}<span>${label}</span>`;
}

function setLoading(loading) {
  if (!tooltipEl) {
    return;
  }
  const button = tooltipEl.querySelector(`#${BUTTON_ID}`);
  const menuButton = tooltipEl.querySelector(`#${MENU_BUTTON_ID}`);
  if (!button) {
    return;
  }

  button.disabled = loading;
  if (menuButton) {
    menuButton.disabled = loading;
  }

  if (loading) {
    setMenuOpen(false);
    tooltipEl.classList.add("aiw-loading");
    button.innerHTML = '<span class="aiw-stop-indicator" aria-hidden="true"></span>';
    button.setAttribute("aria-label", "Improving");
  } else {
    tooltipEl.classList.remove("aiw-loading");
    renderMainButtonLabel();
    button.removeAttribute("aria-label");
  }
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

async function runImprove(actionId = currentActionId) {
  if (!selectedState?.text) {
    return;
  }

  currentActionId = actionId;
  setLoading(true);
  try {
    const runtime = getExtensionRuntime();
    if (!runtime) {
      throw new Error("Extension runtime unavailable. Reload extension and refresh the page.");
    }

    const response = await sendRuntimeMessage(runtime, {
      type: "AI_IMPROVE",
      selectedText: selectedState.text,
      actionId
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

function buildMenuHtml(actions) {
  return actions
    .map(
      (action) =>
        `<li role="none"><button type="button" class="aiw-menu-item" role="menuitem" data-action-id="${action.id}">${action.label}</button></li>`
    )
    .join("");
}

function bindTooltipEvents(root) {
  const mainButton = root.querySelector(`#${BUTTON_ID}`);
  const menuButton = root.querySelector(`#${MENU_BUTTON_ID}`);
  const menu = root.querySelector(`#${MENU_ID}`);

  const preventSelectionLoss = (event) => {
    event.preventDefault();
  };

  mainButton?.addEventListener("mousedown", preventSelectionLoss);
  menuButton?.addEventListener("mousedown", preventSelectionLoss);
  menu?.addEventListener("mousedown", preventSelectionLoss);

  mainButton?.addEventListener("click", () => {
    void runImprove(currentActionId);
  });

  menuButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    setMenuOpen(!menuOpen);
  });

  menu?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }
    const item = target.closest("[data-action-id]");
    if (!(item instanceof HTMLElement)) {
      return;
    }
    const actionId = item.dataset.actionId;
    if (!actionId) {
      return;
    }
    currentActionId = actionId;
    renderMainButtonLabel();
    setMenuOpen(false);
    void runImprove(actionId);
  });
}

function positionTooltip(root, rect) {
  root.style.left = `${window.scrollX + rect.left}px`;
  root.style.top = `${window.scrollY + rect.top}px`;
  root.style.transform = `translateY(calc(-100% - ${TOOLTIP_GAP_PX}px))`;
}

async function createTooltip(rect) {
  removeTooltip();

  const actions = await loadActions();
  const defaultAction = actions.find((action) => action.id === currentActionId) ?? actions[0];
  if (defaultAction) {
    currentActionId = defaultAction.id;
  }
  const mainLabel = getActionLabel(currentActionId);

  const root = document.createElement("div");
  root.id = ROOT_ID;
  positionTooltip(root, rect);
  root.innerHTML = `
    <div class="aiw-split">
      <button type="button" id="${BUTTON_ID}" class="aiw-split-main">
        ${ICON_WAND}
        <span>${mainLabel}</span>
      </button>
      <div class="aiw-split-divider" aria-hidden="true"></div>
      <button type="button" id="${MENU_BUTTON_ID}" class="aiw-split-menu" aria-haspopup="true" aria-expanded="false" aria-label="More actions">
        ${ICON_CHEVRON}
      </button>
    </div>
    <ul id="${MENU_ID}" class="aiw-menu" role="menu" hidden>
      ${buildMenuHtml(actions)}
    </ul>
  `;

  document.body.appendChild(root);
  tooltipEl = root;
  bindTooltipEvents(root);
}

function refreshTooltip() {
  const details = getSelectionDetails();
  if (!details) {
    selectedState = null;
    removeTooltip();
    return;
  }

  const unchanged =
    tooltipEl &&
    selectedState?.text === details.text &&
    selectedState?.mode === details.mode;

  selectedState = details;

  if (unchanged) {
    positionTooltip(tooltipEl, details.rect);
    return;
  }

  void createTooltip(details.rect);
}

function shouldRefreshTooltipFromEvent(event) {
  if (!tooltipEl || !(event.target instanceof Node)) {
    return true;
  }
  return !tooltipEl.contains(event.target);
}

document.addEventListener("mouseup", (event) => {
  if (!shouldRefreshTooltipFromEvent(event)) {
    return;
  }
  window.setTimeout(refreshTooltip, 0);
});

document.addEventListener("keyup", (event) => {
  if (event.key === "Escape") {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
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
