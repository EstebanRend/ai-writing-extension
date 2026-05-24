/**
 * Shared extension configuration (classic script — no export).
 * Background message types must stay in sync with `MESSAGE_TYPE` here.
 */
const AIW_CONFIG = Object.freeze({
  defaultActionId: "improve-writing",
  /** Vertical space between the selection focus (mouse endpoint) and the bar edge. */
  tooltipGapPx: 20,
  /** Vertical space between the bar and the overflow dropdown (always opens upward). */
  menuGapPx: 6,
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
