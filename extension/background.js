/** Keep in sync with `extension/config.js` → AIW_CONFIG.messageType */
const MESSAGE_TYPE = Object.freeze({
  GET_ACTIONS: "GET_ACTIONS",
  AI_IMPROVE: "AI_IMPROVE",
  AI_CANCEL: "AI_CANCEL"
});

const DEFAULT_BACKEND_URL = "http://localhost:3847";
const LEGACY_BACKEND_URL = "http://localhost:3000";

let activeImproveAbort = null;

async function ensureDefaults() {
  const existing = await chrome.storage.sync.get(["backendUrl"]);
  if (!existing.backendUrl || existing.backendUrl === LEGACY_BACKEND_URL) {
    await chrome.storage.sync.set({ backendUrl: DEFAULT_BACKEND_URL });
  }
}

async function getSettings() {
  await ensureDefaults();
  return chrome.storage.sync.get({ backendUrl: DEFAULT_BACKEND_URL });
}

function normalizeFetchError(error, backendUrl) {
  const message = error instanceof Error ? error.message : "Unknown error";
  if (message.toLowerCase().includes("failed to fetch")) {
    return `Cannot reach backend at ${backendUrl}. Make sure server is running.`;
  }
  return message;
}

async function fetchBackend(path, options = {}) {
  const settings = await getSettings();
  const response = await fetch(`${settings.backendUrl}${path}`, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed.");
  }
  return payload;
}

async function handleGetActions(sendResponse) {
  try {
    const payload = await fetchBackend("/api/actions");
    sendResponse({ ok: true, ...payload });
  } catch (error) {
    const settings = await getSettings();
    sendResponse({ ok: false, error: normalizeFetchError(error, settings.backendUrl) });
  }
}

async function handleImprove(message, sendResponse) {
  activeImproveAbort?.abort();
  const abortController = new AbortController();
  activeImproveAbort = abortController;

  let backendUrl = DEFAULT_BACKEND_URL;
  try {
    const { selectedText = "" } = message;
    if (!selectedText.trim()) {
      throw new Error("No selected text was provided.");
    }

    const settings = await getSettings();
    backendUrl = settings.backendUrl;
    const actionId = typeof message.actionId === "string" ? message.actionId : undefined;

    const response = await fetch(`${backendUrl}/api/improve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        selectedText,
        ...(actionId ? { actionId } : {})
      }),
      signal: abortController.signal
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error ?? "AI request failed.");
    }

    sendResponse({ ok: true, result: payload.result });
  } catch (error) {
    if (error?.name === "AbortError") {
      sendResponse({ ok: false, cancelled: true });
      return;
    }
    sendResponse({ ok: false, error: normalizeFetchError(error, backendUrl) });
  } finally {
    if (activeImproveAbort === abortController) {
      activeImproveAbort = null;
    }
  }
}

chrome.runtime.onInstalled.addListener(ensureDefaults);
chrome.runtime.onStartup.addListener(ensureDefaults);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPE.GET_ACTIONS) {
    void handleGetActions(sendResponse);
    return true;
  }

  if (message?.type === MESSAGE_TYPE.AI_CANCEL) {
    activeImproveAbort?.abort();
    activeImproveAbort = null;
    sendResponse({ ok: true, cancelled: true });
    return true;
  }

  if (message?.type === MESSAGE_TYPE.AI_IMPROVE) {
    void handleImprove(message, sendResponse);
    return true;
  }

  return false;
});
