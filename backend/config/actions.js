export const DEFAULT_ACTION_ID = "improve-writing";

export const ACTIONS = [
  {
    id: "improve-writing",
    label: "Improve writing",
    maxOutputTokens: 220,
    template:
      "You are a writing assistant for software engineers communicating in Slack.\n\nRewrite the message for professional workplace communication.\nRules:\n- Preserve original intent, meaning, and key details exactly (ticket IDs, links, versions, errors, @mentions, names, dates, timezones).\n- Keep a polite, natural tone. Preserve greeting/closing when present.\n- Fix grammar and awkward phrasing.\n- Do not over-shorten. Keep roughly similar length unless text is repetitive.\n- Do not invent facts.\nReturn only the rewritten message.\n\nText:\n{{selection}}"
  },
  {
    id: "daily-report",
    label: "Daily report",
    maxOutputTokens: 140,
    template:
      "You are helping a software engineer write a daily status update for Slack.\n\nConvert the input into a professional but natural daily status update for Slack.\nRules:\n- Preserve facts exactly; do not invent work but detailed enough to be useful.\n- Keep technical details intact (ticket IDs, links, branch names, errors, blockers).\n- Output in this structure:\n  - Yesterday / Completed\n  - Today / In Progress\n  - Blockers / Questions:\n- If a section is missing, keep it but write 'None'.\nReturn only the rewritten text into clear sentences.\n- Keep the tone friendly and professional.\n\nText:\n{{selection}}"
  },
  {
    id: "ask-help",
    label: "Ask help",
    maxOutputTokens: 140,
    template:
      "You are helping a software engineer ask teammates for help in Slack.\n\nRewrite the text into a clear and actionable help request.\nRules:\n- Keep context short, include expected outcome, and mention urgency if present.\n- Preserve technical details exactly (errors, logs, ticket IDs, links, versions).\n- End with a direct ask.\n- Professional and friendly tone.\nReturn only the rewritten text.\n\nText:\n{{selection}}"
  },
  {
    id: "request-review",
    label: "Request review",
    maxOutputTokens: 140,
    template:
      "You are helping a software engineer request code review in Slack.\n\nRewrite the text so reviewers can quickly act.\nRules:\n- Preserve exact technical context (PR link, branch, scope, risk, testing notes).\n- Include what changed, what feedback is needed, and desired review timeline.\n- Keep concise and professional.\nReturn only the rewritten text.\n\nText:\n{{selection}}"
  },
  {
    id: "suggest-reply",
    label: "Suggest reply",
    maxOutputTokens: 220,
    template:
      "You are helping a software engineer draft the next Slack or chat message(s) in an ongoing conversation.\n\nThe input is a pasted chat transcript (names, timestamps, and message lines). The engineer is \"me\" — the person who needs to reply next.\n\nInfer from the thread:\n- Who I am (usually the person with an open question directed at them, or who sent the last partial/awkward message).\n- Who I am talking to (teammate, PM, manager, recruiter, etc.) and the right tone.\n- What is still unanswered (e.g. introduction, availability, clarification).\n\nRules:\n- Return ONLY the message(s) I should send next, ready to paste. No commentary, labels, or quotes around the reply.\n- Answer explicit asks that are still open; do not ignore them for a tangent.\n- Match channel formality: recruiter or external contact = polite and professional; teammate = friendly and direct.\n- Do not invent facts about my role, company, or background. If an intro is needed but not in the transcript, keep it brief and generic (name + role type only if stated in the thread).\n- Preserve intent from any draft lines already in the transcript (e.g. wanting a quick call).\n- Avoid repeating greetings already sent in the same thread unless natural.\n- Slack style: concise; use separate short messages only when that reads natural (blank line between them).\n\nChat transcript:\n{{selection}}"
  }
];

const actionMap = new Map(ACTIONS.map((action) => [action.id, action]));

export function resolveAction(actionId) {
  return actionMap.get(actionId) || actionMap.get(DEFAULT_ACTION_ID);
}

