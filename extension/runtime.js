function getExtensionRuntime() {
  if (typeof chrome !== "undefined" && chrome?.runtime?.sendMessage) {
    return chrome.runtime;
  }
  if (typeof browser !== "undefined" && browser?.runtime?.sendMessage) {
    return browser.runtime;
  }
  return null;
}

function sendRuntimeMessage(runtime, payload) {
  return new Promise((resolve, reject) => {
    try {
      runtime.sendMessage(payload, (response) => {
        if (runtime.lastError) {
          reject(new Error(runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function isContextInvalidatedError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.toLowerCase().includes("extension context invalidated");
}
