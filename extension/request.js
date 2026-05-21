const requestState = {
  actionsCache: null,
  currentActionId: AIW_CONFIG.defaultActionId,
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

async function loadActions() {
  if (requestState.actionsCache) {
    return requestState.actionsCache;
  }

  const runtime = getExtensionRuntime();
  if (!runtime) {
    requestState.actionsCache = [...AIW_CONFIG.fallbackActions];
    return requestState.actionsCache;
  }

  try {
    const response = await sendRuntimeMessage(runtime, {
      type: AIW_CONFIG.messageType.GET_ACTIONS
    });
    if (response?.ok && Array.isArray(response.actions) && response.actions.length > 0) {
      requestState.actionsCache = response.actions;
      if (typeof response.defaultActionId === "string") {
        requestState.currentActionId = response.defaultActionId;
      }
      return requestState.actionsCache;
    }
  } catch (error) {
    if (!isContextInvalidatedError(error)) {
      console.warn("[AI Writing] Could not load actions from backend:", error);
    }
  }

  requestState.actionsCache = [...AIW_CONFIG.fallbackActions];
  return requestState.actionsCache;
}

function getActionLabel(actionId) {
  const actions = requestState.actionsCache || AIW_CONFIG.fallbackActions;
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

  const request = { cancelled: false };
  requestState.activeRequest = request;
  requestState.currentActionId = actionId;
  setLoading(true);

  try {
    const runtime = getExtensionRuntime();
    if (!runtime) {
      throw new Error("Extension runtime unavailable. Reload extension and refresh the page.");
    }

    const response = await sendRuntimeMessage(runtime, {
      type: AIW_CONFIG.messageType.AI_IMPROVE,
      selectedText: selection.text,
      actionId
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
