export const DEFAULT_ACTION_ID = "improve-writing";

export const ACTIONS = [
  {
    id: "improve-writing",
    label: "Improve writing",
    template:
      "You are a writing assistant for software engineers communicating in Slack.\n\nRewrite the text to be clear, concise, and professional while preserving exact meaning.\nRules:\n- Keep technical details accurate (ticket IDs, links, versions, error text, commands, code blocks, @mentions, names, dates, timezones).\n- Do not invent facts.\n- Keep it short and actionable.\n- If the text is a request, make the ask explicit.\n- If the text looks like a status update, format as:\n  - Done:\n  - Doing:\n  - Blocked:\nReturn only the rewritten text.\n\nText:\n{{selection}}"
  }
];

const actionMap = new Map(ACTIONS.map((action) => [action.id, action]));

export function resolveAction(actionId) {
  return actionMap.get(actionId) || actionMap.get(DEFAULT_ACTION_ID);
}

