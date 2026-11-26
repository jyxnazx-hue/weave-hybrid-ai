async function captureSelectionAndOpenPanel(tab) {
  if (!tab?.id || !tab?.windowId) return;

  // Open side panel immediately in response to user gesture
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});

  // Read highlighted text, title, and URL from the active webpage
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        text: window.getSelection()?.toString().trim() || "",
        title: document.title || "",
        url: window.location.href || ""
      })
    });

    const payload = results?.[0]?.result;
    if (payload && (payload.text || payload.url)) {
      await chrome.storage.local.set({
        weave_pending_clip: {
          ...payload,
          capturedAt: Date.now()
        }
      });
    }
  } catch (err) {
    // Restricted pages like chrome:// cannot be scripted; side panel still opens cleanly
    console.warn("Capture notice:", err);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "weave-capture",
    title: "Weave: Capture Selection",
    contexts: ["selection"]
  });
});

chrome.action.onClicked.addListener((tab) => {
  captureSelectionAndOpenPanel(tab);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "weave-capture") {
    captureSelectionAndOpenPanel(tab);
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "capture-selection") {
    captureSelectionAndOpenPanel(tab);
  }
});