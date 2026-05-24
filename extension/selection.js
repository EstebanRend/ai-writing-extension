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

  const direction = activeEl.selectionDirection === "backward" ? "backward" : "forward";

  return {
    text,
    rect: activeEl.getBoundingClientRect(),
    mode: "input",
    element: activeEl,
    start,
    end,
    direction
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
    range: range.cloneRange(),
    direction: getRangeSelectionDirection(selection)
  };
}

/** "forward" = left-to-right drag; "backward" = right-to-left. Focus is always the drag endpoint. */
function getRangeSelectionDirection(selection) {
  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (!anchorNode || !focusNode) {
    return "forward";
  }

  const anchorOffset = selection.anchorOffset;
  const focusOffset = selection.focusOffset;

  if (anchorNode === focusNode) {
    return anchorOffset <= focusOffset ? "forward" : "backward";
  }

  const position = anchorNode.compareDocumentPosition(focusNode);
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
    return "forward";
  }
  if (position & Node.DOCUMENT_POSITION_PRECEDING) {
    return "backward";
  }

  return "forward";
}

function getSelectionDetails() {
  return getInputSelectionDetails() || getRangeSelectionDetails();
}

function caretRectToFocusPoint(rect) {
  const centerX = rect.width > 0 ? rect.left + rect.width / 2 : rect.left;
  return {
    left: rect.left,
    top: rect.top,
    bottom: rect.bottom,
    centerX
  };
}

function getInputCaretRect(element, offset) {
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
  div.textContent = value.slice(0, offset);
  const marker = document.createElement("span");
  marker.textContent = value.slice(offset) || ".";
  div.appendChild(marker);
  document.body.appendChild(div);

  const markerRect = marker.getBoundingClientRect();
  document.body.removeChild(div);
  return caretRectToFocusPoint(markerRect);
}

function getRangeFocusAnchorRect(range, backward) {
  const focusRange = range.cloneRange();
  focusRange.collapse(backward);
  const focusRect = getRangeBoundingRect(focusRange);
  const rects = range.getClientRects();

  if (rects.length > 0 && (focusRect.width === 0 || focusRect.height === 0)) {
    const lineRect = backward ? rects[0] : rects[rects.length - 1];
    const x = backward ? lineRect.left : lineRect.right;
    return caretRectToFocusPoint(
      new DOMRect(x, lineRect.top, 0, Math.max(0, lineRect.bottom - lineRect.top))
    );
  }

  const x = focusRect.width === 0 ? focusRect.left : backward ? focusRect.left : focusRect.right;
  return caretRectToFocusPoint(
    new DOMRect(x, focusRect.top, 0, Math.max(0, focusRect.bottom - focusRect.top))
  );
}

/** Viewport coordinates for the selection focus (where the user released), plus centerX. */
function getSelectionFocusPoint(details) {
  const backward = details.direction === "backward";

  if (details.mode === "input" && details.element) {
    const focusOffset = backward ? details.start : details.end;
    return getInputCaretRect(details.element, focusOffset);
  }
  if (details.mode === "range" && details.range) {
    return getRangeFocusAnchorRect(details.range, backward);
  }

  const rect = details.rect;
  const centerX = rect.left + rect.width / 2;
  return { left: rect.left, top: rect.top, bottom: rect.bottom, centerX };
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
