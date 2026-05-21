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

function getEditableRoot(node) {
  if (!node) {
    return null;
  }
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  return element.closest("[contenteditable=''], [contenteditable='true']");
}

function getRangeBoundingRect(range) {
  const rect = range.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return rect;
  }

  const rects = range.getClientRects();
  if (rects.length === 0) {
    return rect;
  }

  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const clientRect of rects) {
    left = Math.min(left, clientRect.left);
    top = Math.min(top, clientRect.top);
    right = Math.max(right, clientRect.right);
    bottom = Math.max(bottom, clientRect.bottom);
  }

  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

function isMeaningfulSelection(selection) {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return false;
  }

  const range = selection.getRangeAt(0);
  if (range.collapsed) {
    return false;
  }

  if (!selection.toString().trim()) {
    return false;
  }

  if (
    selection.anchorNode === selection.focusNode &&
    selection.anchorOffset === selection.focusOffset
  ) {
    return false;
  }

  return true;
}

function hasVisibleRangeHighlight(range) {
  for (const clientRect of range.getClientRects()) {
    if (clientRect.width > 0 || clientRect.height > 0) {
      return true;
    }
  }

  const bounding = range.getBoundingClientRect();
  return bounding.width > 0 || bounding.height > 0;
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
  if (!isMeaningfulSelection(selection)) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!hasVisibleRangeHighlight(range)) {
    return null;
  }

  const text = selection.toString().trim();
  const rect = getRangeBoundingRect(range);

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
  const endRect = getRangeBoundingRect(endRange);
  const rects = range.getClientRects();

  if (rects.length > 0 && (endRect.width === 0 || endRect.height === 0)) {
    const last = rects[rects.length - 1];
    return { left: last.right, bottom: last.bottom };
  }

  return {
    left: endRect.width === 0 ? endRect.left : endRect.right,
    bottom: endRect.bottom
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

  const editable = getEditableRoot(targetRange.commonAncestorContainer);
  if (editable) {
    editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
  }

  return true;
}
