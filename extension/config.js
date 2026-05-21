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
  }),
  icons: Object.freeze({
    wand: `<svg class="aiw-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="m17.8 11.8 1.2 1.2"/><path d="m17.8 6.2 1.2-1.2"/><path d="M3 21l9-9"/><path d="M12.2 6.2 11 5"/></svg>`,
    chevron: `<svg class="aiw-icon aiw-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>`,
    chevronRight: `<svg class="aiw-icon aiw-chevron-right" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`
  })
});
