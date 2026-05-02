// Service worker - handles badge text and inter-script messaging

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('settings', (result) => {
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          saveInterval: 5,
          resumeOffset: 5,
          autoResume: true,
          speedMemory: true,
          toastEnabled: true,
          blacklist: []
        }
      });
    }
  });
});

// Update badge with number of saved videos
function updateBadge() {
  chrome.storage.local.get(null, (items) => {
    const count = Object.keys(items).filter(k => k.startsWith('video_')).length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#ff0000' });
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'progress_saved') updateBadge();
});

updateBadge();
