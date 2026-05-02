// Injected into every YouTube /watch page
// Handles saving, resuming, speed memory, bookmarks, toasts

let videoId = null;
let player = null;
let saveInterval = null;
let settings = {};
let initialized = false;

const DEFAULTS = {
  saveInterval: 5,
  resumeOffset: 5,
  autoResume: true,
  speedMemory: true,
  toastEnabled: true,
  blacklist: []
};

function getVideoId() {
  return new URLSearchParams(location.search).get('v');
}

function getPlaylistId() {
  return new URLSearchParams(location.search).get('list');
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showToast(message) {
  if (!settings.toastEnabled) return;

  const existing = document.getElementById('peekaboo-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'peekaboo-toast';
  toast.innerHTML = `
    <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff4444;margin-right:8px;flex-shrink:0;margin-top:2px;"></span>
    ${message}
  `;
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '80px',
    right: '20px',
    background: 'rgba(15,15,15,0.92)',
    color: '#f1f1f1',
    padding: '10px 16px',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: '"YouTube Sans", Roboto, sans-serif',
    zIndex: '2147483647',
    pointerEvents: 'none',
    opacity: '0',
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0',
    transition: 'opacity 0.25s ease, transform 0.25s ease',
    transform: 'translateY(6px)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.08)',
    maxWidth: '280px'
  });

  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  });
}

async function saveProgress(quiet = false) {
  if (!player || !videoId) return;
  if (!player.duration || player.duration === 0) return;
  const t = player.currentTime;
  if (t < 5) return;

  const key = `video_${videoId}`;
  const stored = await chrome.storage.local.get(key);
  const prev = stored[key] || {};

  const entry = {
    ...prev,
    videoId,
    currentTime: t,
    duration: player.duration,
    percent: Math.round((t / player.duration) * 100),
    lastUpdated: Date.now(),
    title: document.title.replace(' - YouTube', '').trim(),
    url: location.href,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    playlistId: getPlaylistId()
  };

  await chrome.storage.local.set({ [key]: entry });
  chrome.runtime.sendMessage({ type: 'progress_saved' });

  if (!quiet) showToast(`Saved at ${formatTime(t)}`);
}

async function applySpeed() {
  if (!settings.speedMemory || !videoId) return;
  const res = await chrome.storage.local.get(`speed_${videoId}`);
  const speed = res[`speed_${videoId}`];
  if (speed && speed !== 1 && player) {
    player.playbackRate = speed;
  }
}

async function resumeVideo() {
  if (!settings.autoResume || !videoId) return;

  const res = await chrome.storage.local.get(`video_${videoId}`);
  const data = res[`video_${videoId}`];
  if (!data || !data.currentTime || data.currentTime < 10) return;
  if (data.percent >= 97) return;

  const seekTo = Math.max(0, data.currentTime - (settings.resumeOffset || 5));

  const doSeek = () => {
    player.currentTime = seekTo;
    showToast(`Resumed from ${formatTime(seekTo)}`);
  };

  if (player.readyState >= 1 && player.duration > 0) {
    doSeek();
  } else {
    player.addEventListener('loadedmetadata', doSeek, { once: true });
  }
}

function isBlacklisted() {
  if (!settings.blacklist || settings.blacklist.length === 0) return false;
  const channelEl = document.querySelector('#channel-name a, ytd-channel-name a');
  const channelUrl = channelEl ? channelEl.href : '';
  return settings.blacklist.some(b =>
    location.href.includes(b) || channelUrl.includes(b)
  );
}

function injectBookmarkButton() {
  if (document.getElementById('peekaboo-bm-btn')) return;

  const btn = document.createElement('div');
  btn.id = 'peekaboo-bm-btn';
  btn.title = 'Add bookmark (Peekaboo)';
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <span>Bookmark</span>
  `;
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '130px',
    right: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(15,15,15,0.9)',
    color: '#f1f1f1',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '20px',
    padding: '7px 13px 7px 10px',
    fontSize: '13px',
    fontFamily: '"YouTube Sans", Roboto, sans-serif',
    fontWeight: '600',
    cursor: 'pointer',
    zIndex: '2147483646',
    backdropFilter: 'blur(10px)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    transition: 'background 0.15s, transform 0.15s, border-color 0.15s',
    userSelect: 'none',
    WebkitUserSelect: 'none'
  });

  btn.addEventListener('mouseenter', () => {
    btn.style.background = 'rgba(255,0,0,0.85)';
    btn.style.borderColor = 'rgba(255,0,0,0.4)';
    btn.style.transform = 'translateY(-2px)';
  });
  btn.addEventListener('mouseleave', () => {
    btn.style.background = 'rgba(15,15,15,0.9)';
    btn.style.borderColor = 'rgba(255,255,255,0.12)';
    btn.style.transform = 'translateY(0)';
  });

  btn.addEventListener('click', () => {
    if (!player || !videoId) return;
    showNotePrompt();
  });

  document.body.appendChild(btn);
}

function showNotePrompt() {
  const existing = document.getElementById('peekaboo-note-prompt');
  if (existing) { existing.remove(); return; }

  // pause while adding note
  const wasPlaying = !player.paused;
  if (wasPlaying) player.pause();

  const t = player.currentTime;

  const overlay = document.createElement('div');
  overlay.id = 'peekaboo-note-prompt';
  Object.assign(overlay.style, {
    position: 'fixed',
    bottom: '178px',
    right: '20px',
    background: 'rgba(18,18,18,0.97)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px',
    padding: '14px',
    width: '260px',
    zIndex: '2147483647',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    backdropFilter: 'blur(12px)',
    fontFamily: '"YouTube Sans", Roboto, sans-serif',
    opacity: '0',
    transform: 'translateY(8px)',
    transition: 'opacity 0.2s, transform 0.2s'
  });

  overlay.innerHTML = `
    <div style="font-size:11px;color:#909090;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">
      Bookmark at ${formatTime(t)}
    </div>
    <input id="ytresume-note-input" type="text" placeholder="Add a note (optional)…" maxlength="120"
      style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);
             border-radius:7px;color:#f1f1f1;font-size:13px;padding:8px 10px;outline:none;
             font-family:inherit;box-sizing:border-box;transition:border-color 0.15s;">
    <div style="display:flex;gap:6px;margin-top:10px;">
      <button id="ytresume-note-save"
        style="flex:1;background:#ff0000;color:#fff;border:none;border-radius:7px;
               padding:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;
               transition:background 0.15s;">
        Save
      </button>
      <button id="ytresume-note-cancel"
        style="background:rgba(255,255,255,0.08);color:#aaa;border:1px solid rgba(255,255,255,0.1);
               border-radius:7px;padding:8px 12px;font-size:13px;cursor:pointer;font-family:inherit;
               transition:background 0.15s;">
        Cancel
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    overlay.style.opacity = '1';
    overlay.style.transform = 'translateY(0)';
  });

  const input = document.getElementById('ytresume-note-input');
  input.focus();

  input.addEventListener('focus', () => input.style.borderColor = 'rgba(255,0,0,0.5)');
  input.addEventListener('blur', () => input.style.borderColor = 'rgba(255,255,255,0.1)');

  const dismiss = (resume) => {
    overlay.style.opacity = '0';
    overlay.style.transform = 'translateY(8px)';
    setTimeout(() => overlay.remove(), 200);
    if (resume && wasPlaying) player.play();
  };

  document.getElementById('ytresume-note-save').addEventListener('click', () => {
    const note = input.value.trim();
    const key = `video_${videoId}`;
    chrome.storage.local.get(key, (res) => {
      const data = res[key] || {};
      const bookmarks = data.bookmarks || [];
      bookmarks.push({ time: t, note, createdAt: Date.now() });
      chrome.storage.local.set({ [key]: { ...data, bookmarks } });
      showToast(`Bookmark saved at ${formatTime(t)}`);
    });
    dismiss(true);
  });

  document.getElementById('ytresume-note-cancel').addEventListener('click', () => dismiss(true));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('ytresume-note-save').click();
    if (e.key === 'Escape') dismiss(true);
  });
}

function teardown() {
  if (saveInterval) clearInterval(saveInterval);
  saveInterval = null;
  videoId = null;
  player = null;
  initialized = false;
  document.getElementById('ytresume-bm-btn')?.remove();
  document.getElementById('ytresume-note-prompt')?.remove();
}

function setupListeners() {
  const interval = (settings.saveInterval || 5) * 1000;
  if (saveInterval) clearInterval(saveInterval);

  // save on interval while playing
  saveInterval = setInterval(() => {
    if (!player.paused) saveProgress(true);
  }, interval);

  player.addEventListener('pause', () => saveProgress(true));
  player.addEventListener('seeked', () => saveProgress(true));
  player.addEventListener('ended', () => saveProgress(true));

  player.addEventListener('ratechange', () => {
    if (settings.speedMemory && videoId) {
      chrome.storage.local.set({ [`speed_${videoId}`]: player.playbackRate });
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveProgress(true);
  });

  window.addEventListener('beforeunload', () => saveProgress(true));
  window.addEventListener('pagehide', () => saveProgress(true));
}

async function init() {
  const vid = getVideoId();
  if (!vid || initialized) return;

  const settingsRes = await chrome.storage.local.get('settings');
  settings = { ...DEFAULTS, ...(settingsRes.settings || {}) };

  if (isBlacklisted()) return;

  videoId = vid;
  player = document.querySelector('video');

  if (!player) {
    setTimeout(init, 1000);
    return;
  }

  initialized = true;
  setupListeners();
  injectBookmarkButton();
  await resumeVideo();
  await applySpeed();
}

// YouTube is a SPA - navigate-finish fires on every video change
document.addEventListener('yt-navigate-finish', () => {
  teardown();
  setTimeout(init, 800);
});

// Handle external messages (e.g. from popup - add bookmark, get status)
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'add_bookmark') {
    if (!player || !videoId) return;
    const t = player.currentTime;
    const key = `video_${videoId}`;
    chrome.storage.local.get(key, (res) => {
      const data = res[key] || {};
      const bookmarks = data.bookmarks || [];
      bookmarks.push({ time: t, note: msg.note || '', createdAt: Date.now() });
      chrome.storage.local.set({ [key]: { ...data, bookmarks } });
      showToast(`Bookmark added at ${formatTime(t)}`);
      sendResponse({ ok: true, time: t });
    });
    return true;
  }

  if (msg.type === 'get_status') {
    sendResponse({
      videoId,
      currentTime: player ? player.currentTime : null,
      duration: player ? player.duration : null,
      playing: player ? !player.paused : false
    });
  }
});

// Kick off on initial page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
} else {
  setTimeout(init, 1000);
}
