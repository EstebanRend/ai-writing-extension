const DEFAULT_BACKEND_URL = "http://localhost:3000";

const DEFAULT_ACTIONS = [
  {
    id: "improve-writing",
    label: "Improve writing",
    template:
      "You are a professional writing assistant. Improve clarity, grammar, and flow while preserving meaning.\n\nText:\n{{selection}}"
  }
];

async function getSettings() {
  const data = await chrome.storage.sync.get({
    backendUrl: DEFAULT_BACKEND_URL,
    actions: DEFAULT_ACTIONS
  });
  return data;
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(["actions", "backendUrl"]);

  if (!existing.actions) {
    await chrome.storage.sync.set({ actions: DEFAULT_ACTIONS });
  }
  if (!existing.backendUrl) {
    await chrome.storage.sync.set({ backendUrl: DEFAULT_BACKEND_URL });
  }
});

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
      const action = settings.actions.find((item) => item.id === message.actionId) ?? settings.actions[0];
      const prompt = action.template.replace("{{selection}}", selectedText);

      const response = await fetch(`${settings.backendUrl}/api/improve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedText,
          prompt
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
