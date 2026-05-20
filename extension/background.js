const DEFAULT_BACKEND_URL = "http://localhost:3000";
const DEFAULT_ACTION_ID = "improve-writing";

async function ensureDefaults() {
  const existing = await chrome.storage.sync.get(["backendUrl", "defaultActionId"]);

  if (!existing.backendUrl) {
    await chrome.storage.sync.set({ backendUrl: DEFAULT_BACKEND_URL });
  }
  if (!existing.defaultActionId) {
    await chrome.storage.sync.set({ defaultActionId: DEFAULT_ACTION_ID });
  }
}

async function getSettings() {
  await ensureDefaults();
  const data = await chrome.storage.sync.get({
    backendUrl: DEFAULT_BACKEND_URL,
    defaultActionId: DEFAULT_ACTION_ID
  });
  return data;
}

chrome.runtime.onInstalled.addListener(ensureDefaults);
chrome.runtime.onStartup.addListener(ensureDefaults);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "AI_IMPROVE") {
    return false;
  }

  (async () => {
    try {
      const { selectedText = "" } = message;
      if (!selectedText.trim()) {
        throw new Error("No selected text was provided.");
      }

      const settings = await getSettings();
      const actionId = message.actionId || settings.defaultActionId || DEFAULT_ACTION_ID;

      const response = await fetch(`${settings.backendUrl}/api/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText,
          actionId
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "AI request failed.");
      }

      sendResponse({ ok: true, result: payload.result });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  })();

  return true;
});
