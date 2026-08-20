chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    preferences: {
      target: "React",
      styling: "Tailwind CSS",
      mode: "UI + behavior",
      responsive: true,
      accessibility: true,
      assets: true
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
