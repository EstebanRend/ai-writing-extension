export const DEFAULT_ACTION_ID = "improve-writing";

export const ACTIONS = [
  {
    id: "improve-writing",
    label: "Improve writing",
    template:
      "You are a writing assistant for software engineers communicating in Slack.\n\nRewrite the text to be clear, concise, and professional while preserving exact meaning.\nRules:\n- Keep technical details accurate (ticket IDs, links, versions, error text, commands, code blocks, @mentions, names, dates, timezones).\n- Do not invent facts.\n- Keep it short and actionable.\n- If the text is a request, make the ask explicit.\n- If the text looks like a status update, format as:\n  - Done:\n  - Doing:\n  - Blocked:\nReturn only the rewritten text.\n\nText:\n{{selection}}"
  },
  {
    id: "daily-report",
    label: "Daily report",
    template:
      "You are helping a software engineer write a daily status update for Slack.\n\nRewrite the text into concise status format.\nRules:\n- Preserve facts exactly; do not invent work.\n- Keep technical details intact (ticket IDs, links, branch names, errors, blockers).\n- Output in this structure:\n  - Done:\n  - Doing:\n  - Blocked:\n- If a section is missing, keep it but write 'None'.\nReturn only the rewritten text.\n\nText:\n{{selection}}"
  },
  {
    id: "ask-help",
    label: "Ask help",
    template:
      "You are helping a software engineer ask teammates for help in Slack.\n\nRewrite the text into a clear and actionable help request.\nRules:\n- Keep context short, include expected outcome, and mention urgency if present.\n- Preserve technical details exactly (errors, logs, ticket IDs, links, versions).\n- End with a direct ask.\n- Professional and friendly tone.\nReturn only the rewritten text.\n\nText:\n{{selection}}"
  },
  {
    id: "request-review",
    label: "Request review",
    template:
      "You are helping a software engineer request code review in Slack.\n\nRewrite the text so reviewers can quickly act.\nRules:\n- Preserve exact technical context (PR link, branch, scope, risk, testing notes).\n- Include what changed, what feedback is needed, and desired review timeline.\n- Keep concise and professional.\nReturn only the rewritten text.\n\nText:\n{{selection}}"
  }
];

const actionMap = new Map(ACTIONS.map((action) => [action.id, action]));

export function resolveAction(actionId) {
  return actionMap.get(actionId) || actionMap.get(DEFAULT_ACTION_ID);
}

