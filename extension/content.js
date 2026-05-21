/**
 * Content script entry — document listeners only.
 * Loaded after: config, runtime, selection, request, tooltip.
 */
document.addEventListener("mouseup", (event) => {
  if (!shouldRefreshTooltipFromEvent(event)) {
    return;
  }
  window.setTimeout(refreshTooltip, 0);
});

document.addEventListener("keyup", (event) => {
  if (event.key === "Escape" && handleEscapeKey()) {
    return;
  }
  window.setTimeout(refreshTooltip, 0);
});

document.addEventListener("mousedown", (event) => {
  const tooltip = getTooltipElement();
  if (!tooltip) {
    return;
  }
  if (event.target instanceof Node && tooltip.contains(event.target)) {
    return;
  }
  removeTooltip();
});

window.addEventListener("scroll", removeTooltip);
