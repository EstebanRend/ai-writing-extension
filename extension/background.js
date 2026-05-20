const DEFAULT_BACKEND_URL = "http://localhost:3000";
const DEVELOPER_SLACK_TEMPLATE =
  "You are a writing assistant for software engineers communicating in Slack.\n\nRewrite the text to be clear, concise, and professional while preserving exact meaning.\nRules:\n- Keep technical details accurate (ticket IDs, links, versions, error text, commands, code blocks, @mentions, names, dates, timezones).\n- Do not invent facts.\n- Keep it short and actionable.\n- If the text is a request, make the ask explicit.\n- If the text looks like a status update, format as:\n  - Done:\n  - Doing:\n  - Blocked:\nReturn only the rewritten text.\n\nText:\n{{selection}}";

const DEFAULT_ACTIONS = [
  {
    id: "improve-writing",
    label: "Improve writing",
    template: DEVELOPER_SLACK_TEMPLATE
  }
];

const LEGACY_TEMPLATES = new Set([
  "Rewrite for clarity and grammar. Return only rewritten text.\n\nText:\n{{selection}}",
  "You are a professional writing assistant. Improve clarity, grammar, and flow while preserving meaning.\n\nText:\n{{selection}}"
]);

function shouldMigrateActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return true;
  }
  if (actions.length !== 1) {
    return false;
  }
  const [action] = actions;
  return action?.id === "improve-writing" && LEGACY_TEMPLATES.has(action.template);
}

async function ensureDefaults() {
  const existing = await chrome.storage.sync.get(["actions", "backendUrl"]);

  if (shouldMigrateActions(existing.actions)) {
    await chrome.storage.sync.set({ actions: DEFAULT_ACTIONS });
  }
  if (!existing.backendUrl) {
    await chrome.storage.sync.set({ backendUrl: DEFAULT_BACKEND_URL });
  }
}

async function getSettings() {
  await ensureDefaults();
  const data = await chrome.storage.sync.get({
    backendUrl: DEFAULT_BACKEND_URL,
    actions: DEFAULT_ACTIONS
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
