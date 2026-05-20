const DEFAULT_BACKEND_URL = "http://localhost:3000";

async function ensureDefaults() {
  const existing = await chrome.storage.sync.get(["backendUrl"]);

  if (!existing.backendUrl) {
    await chrome.storage.sync.set({ backendUrl: DEFAULT_BACKEND_URL });
  }
}

async function getSettings() {
  await ensureDefaults();
  const data = await chrome.storage.sync.get({
    backendUrl: DEFAULT_BACKEND_URL
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
    let settings = { backendUrl: DEFAULT_BACKEND_URL };
    try {
      const { selectedText = "" } = message;
      if (!selectedText.trim()) {
        throw new Error("No selected text was provided.");
      }

      settings = await getSettings();
      const actionId = typeof message.actionId === "string" ? message.actionId : undefined;

      const response = await fetch(`${settings.backendUrl}/api/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText,
          ...(actionId ? { actionId } : {})
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "AI request failed.");
      }

      sendResponse({ ok: true, result: payload.result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const normalizedMessage =
        message.toLowerCase().includes("failed to fetch")
          ? `Cannot reach backend at ${settings.backendUrl || DEFAULT_BACKEND_URL}. Make sure server is running.`
          : message;
      sendResponse({
        ok: false,
        error: normalizedMessage
      });
    }
  })();

  return true;
});
