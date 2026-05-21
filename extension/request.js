const requestState = {
  actionsCache: null,
  currentActionId: aiwGetDefaultActionId(),
  activeRequest: null
};

function isImproveInFlight() {
  return requestState.activeRequest !== null;
}

function getCurrentActionId() {
  return requestState.currentActionId;
}

function setCurrentActionId(actionId) {
  requestState.currentActionId = actionId;
}

function loadActions() {
  if (!requestState.actionsCache) {
    requestState.actionsCache = aiwGetMenuActions();
    requestState.currentActionId = aiwGetDefaultActionId();
  }
  return requestState.actionsCache;
}

function getActionLabel(actionId) {
  const actions = requestState.actionsCache || aiwGetMenuActions();
  const action = actions.find((item) => item.id === actionId);
  return action?.label ?? "Improve writing";
}

function stopImprove() {
  if (!requestState.activeRequest) {
    return;
  }

  requestState.activeRequest.cancelled = true;
  const runtime = getExtensionRuntime();
  if (runtime) {
    void sendRuntimeMessage(runtime, { type: AIW_CONFIG.messageType.AI_CANCEL }).catch(() => {});
  }
  setLoading(false);
}

async function runImprove(actionId = requestState.currentActionId) {
  const selection = getSelectedState();
  if (!selection?.text || requestState.activeRequest) {
    return;
  }

  const leaf = aiwResolveLeaf(actionId);
  if (!leaf) {
    console.error("[AI Writing] Unknown action:", actionId);
    return;
  }

  const request = { cancelled: false };
  requestState.activeRequest = request;
  requestState.currentActionId = leaf.id;
  setLoading(true);

  try {
    const runtime = getExtensionRuntime();
    if (!runtime) {
      throw new Error("Extension runtime unavailable. Reload extension and refresh the page.");
    }

    const response = await sendRuntimeMessage(runtime, {
      type: AIW_CONFIG.messageType.AI_IMPROVE,
      prompt: aiwBuildPrompt(leaf, selection.text),
      maxOutputTokens: leaf.maxOutputTokens
    });

    if (request.cancelled || response?.cancelled) {
      return;
    }

    if (!response?.ok) {
      throw new Error(response?.error ?? "AI request failed.");
    }

    const result = response.result || "";
    if (result) {
      replaceSelectionWithText(result);
    }
    removeTooltip();
  } catch (error) {
    if (request.cancelled) {
      return;
    }
    if (isContextInvalidatedError(error)) {
      console.error("[AI Writing] Extension context invalidated. Reload extension and refresh the page.");
      return;
    }
    console.error("[AI Writing] Improve failed:", error);
  } finally {
    if (requestState.activeRequest === request) {
      requestState.activeRequest = null;
    }
    if (!request.cancelled) {
      setLoading(false);
    }
  }
}
