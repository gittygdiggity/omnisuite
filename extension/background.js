// OmniSuite — Background Service Worker
// Handles extension lifecycle events

chrome.runtime.onInstalled.addListener(() => {
  console.log('OmniSuite installed');
});

// Listen for messages from popup or content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'OPEN_DASHBOARD') {
    chrome.tabs.create({ url: chrome.runtime.getURL('index.html') });
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === 'GET_STATUS') {
    sendResponse({ active: true, version: '1.0.0' });
    return true;
  }
});
