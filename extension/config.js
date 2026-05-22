/**
 * Shared extension configuration (classic script — no export).
 * Background message types must stay in sync with `MESSAGE_TYPE` here.
 */
const AIW_CONFIG = Object.freeze({
  defaultActionId: "improve-writing",
  tooltipGapPx: 8,
  dom: Object.freeze({
    root: "ai-writing-assistant-root",
    mainButton: "ai-writing-assistant-improve",
    menuButton: "ai-writing-assistant-menu",
    menu: "ai-writing-assistant-menu-list"
  }),
  messageType: Object.freeze({
    AI_IMPROVE: "AI_IMPROVE",
    AI_CANCEL: "AI_CANCEL"
  })
});
