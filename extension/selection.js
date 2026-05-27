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

const EDITABLE_SELECTOR =
  ".ck-editor__editable, .ck-content[contenteditable], [contenteditable=''], [contenteditable='true'], [role='textbox'][contenteditable]";

function getEditableRoot(node) {
  if (!node) {
    return null;
  }
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  if (!(element instanceof HTMLElement)) {
    return null;
  }
  return element.closest(EDITABLE_SELECTOR);
}

/** Teams uses CKEditor; only the root editable exposes `ckeditorInstance`. */
function getCKEditorRootEditable(node) {
  const start = getEditableRoot(node);
  if (!(start instanceof HTMLElement)) {
    return null;
  }

  let current = start;
  let withInstance = null;
  while (current instanceof HTMLElement) {
    if (current.ckeditorInstance) {
      withInstance = current;
    }
    const parent = current.parentElement?.closest(EDITABLE_SELECTOR);
    if (!parent || parent === current) {
      break;
    }
    current = parent;
  }
  return withInstance || start;
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

  const rawText = selection.toString();
  const text = rawText.trim();
  const rect = getRangeBoundingRect(range);
  const editable = getCKEditorRootEditable(range.commonAncestorContainer);

  return {
    text,
    rawText,
    rect,
    mode: "range",
    range: range.cloneRange(),
    editable,
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

function isRangeConnected(range) {
  try {
    const container = range.commonAncestorContainer;
    const element =
      container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
    return Boolean(element?.isConnected);
  } catch {
    return false;
  }
}

function restoreDocumentSelection(range) {
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function dispatchEditableInput(editable, inputType) {
  editable.dispatchEvent(
    new InputEvent("input", { bubbles: true, cancelable: false, inputType })
  );
}

function findRangeForText(root, searchText) {
  if (!searchText || !(root instanceof HTMLElement)) {
    return null;
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments = [];
  let combined = "";
  let textNode = walker.nextNode();
  while (textNode) {
    const value = textNode.textContent || "";
    segments.push({ node: textNode, start: combined.length, length: value.length });
    combined += value;
    textNode = walker.nextNode();
  }

  const candidates = [searchText, searchText.trim()].filter(
    (value, index, list) => value && list.indexOf(value) === index
  );
  let startIndex = -1;
  let matchLength = 0;
  for (const candidate of candidates) {
    const index = combined.indexOf(candidate);
    if (index !== -1) {
      startIndex = index;
      matchLength = candidate.length;
      break;
    }
  }
  if (startIndex === -1) {
    return null;
  }

  function positionAt(globalOffset) {
    for (const segment of segments) {
      const segmentEnd = segment.start + segment.length;
      if (globalOffset <= segmentEnd) {
        return { node: segment.node, offset: Math.max(0, globalOffset - segment.start) };
      }
    }
    const last = segments[segments.length - 1];
    return last ? { node: last.node, offset: last.length } : null;
  }

  const start = positionAt(startIndex);
  const end = positionAt(startIndex + matchLength);
  if (!start || !end) {
    return null;
  }

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

function editorShowsText(editable, text) {
  if (!editable || !text) {
    return false;
  }
  const sample = text.slice(0, Math.min(80, text.length));
  const content = editable.innerText || editable.textContent || "";
  return content.includes(sample);
}

function syncCKEditorSelectionFromDom(editor) {
  const domSelection = document.getSelection();
  if (!domSelection || domSelection.rangeCount === 0) {
    return;
  }

  try {
    const viewRange = editor.editing.view.domConverter.domRangeToView(domSelection.getRangeAt(0));
    if (viewRange) {
      editor.editing.view.document.selection.setTo(viewRange);
    }
  } catch {
    // Converter API differs across CKEditor builds; focus + DOM selection may still be enough.
  }
}

function replaceViaCKEditor(editable, newText) {
  const editor = editable.ckeditorInstance;
  if (!editor) {
    return false;
  }

  try {
    editor.editing.view.focus();
    syncCKEditorSelectionFromDom(editor);
    editor.execute("insertText", { text: newText });
    return true;
  } catch {
    return false;
  }
}

function replaceViaPaste(editable, newText) {
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", newText);
    const paste = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    });
    editable.dispatchEvent(paste);
    return editorShowsText(editable, newText);
  } catch {
    return false;
  }
}

function replaceViaBeforeInput(editable, newText) {
  const beforeInput = new InputEvent("beforeinput", {
    bubbles: true,
    cancelable: true,
    inputType: "insertReplacementText",
    data: newText
  });
  editable.dispatchEvent(beforeInput);
  if (beforeInput.defaultPrevented) {
    dispatchEditableInput(editable, "insertReplacementText");
    return editorShowsText(editable, newText);
  }
  return false;
}

function replaceViaExecCommand(newText) {
  try {
    return document.execCommand("insertText", false, newText);
  } catch {
    return false;
  }
}

function replaceViaDom(range, editable, newText) {
  try {
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
    if (editable) {
      dispatchEditableInput(editable, "insertText");
    }
    return !editable || editorShowsText(editable, newText);
  } catch {
    return false;
  }
}

/** Rich editors (e.g. Teams / CKEditor) need editor APIs; DOM-only edits are reverted. */
function replaceRangeSelectionWithText(savedRange, editableHint, newText, originalText) {
  let editable = editableHint?.isConnected ? editableHint : null;
  if (!editable) {
    const anchor =
      savedRange.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? savedRange.commonAncestorContainer
        : savedRange.commonAncestorContainer.parentElement;
    editable = getCKEditorRootEditable(anchor);
  }
  if (!editable) {
    return false;
  }

  let targetRange = isRangeConnected(savedRange) ? savedRange.cloneRange() : null;
  if (!targetRange && originalText) {
    targetRange = findRangeForText(editable, originalText);
  }
  if (!targetRange) {
    return false;
  }

  editable.focus();
  if (!restoreDocumentSelection(targetRange)) {
    return false;
  }

  if (editable.ckeditorInstance && replaceViaCKEditor(editable, newText)) {
    return true;
  }
  if (replaceViaPaste(editable, newText)) {
    return true;
  }
  if (replaceViaBeforeInput(editable, newText)) {
    return true;
  }
  if (replaceViaExecCommand(newText)) {
    dispatchEditableInput(editable, "insertText");
    if (editorShowsText(editable, newText)) {
      return true;
    }
  }
  return replaceViaDom(targetRange, editable, newText);
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
    try {
      element.focus();
      element.setSelectionRange(start, end);
      element.setRangeText(newText, start, end, "end");
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  }

  const range = state.range;
  if (!range) {
    return false;
  }

  return replaceRangeSelectionWithText(
    range,
    state.editable,
    newText,
    state.rawText || state.text
  );
}
