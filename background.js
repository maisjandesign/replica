chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    preferences: {
      target: "React",
      styling: "Tailwind CSS",
      mode: "UI + behavior",
      captureKind: "exact",
      responsive: true,
      accessibility: true,
      assets: true
    }
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "SHOW_CODEX_LAUNCHER" });
  } catch (_) {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      await chrome.tabs.sendMessage(tab.id, { type: "SHOW_CODEX_LAUNCHER" });
    } catch (_) {
      // Chrome internal pages cannot host extension content scripts.
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "OPEN_CAPTURE_POPUP") {
    if (typeof chrome.action.openPopup !== "function") {
      sendResponse({ ok: false, error: "Automatic popup opening is not supported by this Chrome version." });
      return;
    }
    chrome.action.openPopup({ windowId: sender.tab?.windowId }).then(
      () => sendResponse({ ok: true }),
      (error) => sendResponse({ ok: false, error: error.message })
    );
    return true;
  }

  if (message.type !== "CAPTURE_VISIBLE_TAB") return;

  chrome.tabs.captureVisibleTab(sender.tab?.windowId, { format: "png" }, (dataUrl) => {
    if (chrome.runtime.lastError) {
      sendResponse({ ok: false, error: chrome.runtime.lastError.message });
      return;
    }
    sendResponse({ ok: true, dataUrl });
  });
  return true;
});
