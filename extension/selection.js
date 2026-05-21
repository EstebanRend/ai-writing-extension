const INPUT_TYPES = ["text", "search", "url", "tel", "email", "password"];

const MIRROR_STYLE_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "textTransform",
  "paddingLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "borderLeftWidth",
  "borderTopWidth",
  "lineHeight",
  "boxSizing"
];

let selectedState = null;

function getSelectedState() {
  return selectedState;
}

function setSelectedState(state) {
  selectedState = state;
}

function clearSelectedState() {
  selectedState = null;
}

function getInputSelectionDetails() {
  const activeEl = document.activeElement;
  const isTextArea = activeEl instanceof HTMLTextAreaElement;
  const isTextInput =
    activeEl instanceof HTMLInputElement && INPUT_TYPES.includes(activeEl.type);

  if (!isTextArea && !isTextInput) {
    return null;
  }

  const start = activeEl.selectionStart;
  const end = activeEl.selectionEnd;
  if (typeof start !== "number" || typeof end !== "number" || start === end) {
    return null;
  }

  const text = activeEl.value.slice(start, end).trim();
  if (!text) {
    return null;
  }

  return {
    text,
    rect: activeEl.getBoundingClientRect(),
    mode: "input",
    element: activeEl,
    start,
    end
  };
}

function getRangeSelectionDetails() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) {
    return null;
  }

  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  return {
    text,
    rect,
    mode: "range",
    range: range.cloneRange()
  };
}

function getSelectionDetails() {
  return getInputSelectionDetails() || getRangeSelectionDetails();
}

function getInputEndAnchorRect(element, end) {
  const div = document.createElement("div");
  const style = div.style;
  const computed = window.getComputedStyle(element);
  style.position = "absolute";
  style.left = "-9999px";
  style.visibility = "hidden";
  style.whiteSpace = element instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
  style.wordWrap = "break-word";

  for (const prop of MIRROR_STYLE_PROPS) {
    style[prop] = computed[prop];
  }
  style.width = `${element.offsetWidth}px`;

  const value = element.value;
  div.textContent = value.slice(0, end);
  const marker = document.createElement("span");
  marker.textContent = value.slice(end) || ".";
  div.appendChild(marker);
  document.body.appendChild(div);

  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(div);
  return { left: markerRect.left, bottom: markerRect.bottom };
}

function getRangeEndAnchorRect(range) {
  const endRange = range.cloneRange();
  endRange.collapse(false);
  const rect = endRange.getBoundingClientRect();
  const rects = range.getClientRects();

  if (rects.length > 0 && (rect.width === 0 || rect.height === 0)) {
    const last = rects[rects.length - 1];
    return { left: last.right, bottom: last.bottom };
  }

  return {
    left: rect.width === 0 ? rect.left : rect.right,
    bottom: rect.bottom
  };
}

function getSelectionAnchorRect(details) {
  if (details.mode === "input" && details.element) {
    return getInputEndAnchorRect(details.element, details.end);
  }
  if (details.mode === "range" && details.range) {
    return getRangeEndAnchorRect(details.range);
  }
  return { left: details.rect.left, bottom: details.rect.bottom };
}

function replaceSelectionWithText(newText) {
  const state = getSelectedState();
  if (!state) {
    return false;
  }

  if (state.mode === "input") {
    const { element, start, end } = state;
    if (!element?.isConnected) {
      return false;
    }
    element.focus();
    element.setSelectionRange(start, end);
    element.setRangeText(newText, start, end, "end");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const range = state.range;
  if (!range) {
    return false;
  }

  const targetRange = range.cloneRange();
  if (!targetRange.commonAncestorContainer?.isConnected) {
    return false;
  }

  targetRange.deleteContents();
  targetRange.insertNode(document.createTextNode(newText));
  return true;
}
