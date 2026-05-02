// Options page - loads and saves settings, handles data management

const $ = (sel) => document.querySelector(sel);

const DEFAULTS = {
  saveInterval: 5,
  resumeOffset: 5,
  autoResume: true,
  speedMemory: true,
  toastEnabled: true,
  blacklist: []
};

let saveTimer = null;

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => t.classList.add('hidden'), 2500);
}

function showSaveStatus() {
  const el = $('#saveStatus');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2000);
}

async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  const s = { ...DEFAULTS, ...(result.settings || {}) };

  $('#autoResume').checked = s.autoResume;
  $('#speedMemory').checked = s.speedMemory;
  $('#toastEnabled').checked = s.toastEnabled;

  $('#saveInterval').value = s.saveInterval;
  $('#saveIntervalVal').textContent = `${s.saveInterval}s`;

  $('#resumeOffset').value = s.resumeOffset;
  $('#resumeOffsetVal').textContent = `${s.resumeOffset}s`;

  $('#blacklist').value = (s.blacklist || []).join('\n');
}

async function saveSettings() {
  const blacklistRaw = $('#blacklist').value.trim();
  const blacklist = blacklistRaw
    ? blacklistRaw.split('\n').map(l => l.trim()).filter(Boolean)
    : [];

  const settings = {
    autoResume: $('#autoResume').checked,
    speedMemory: $('#speedMemory').checked,
    toastEnabled: $('#toastEnabled').checked,
    saveInterval: parseInt($('#saveInterval').value),
    resumeOffset: parseInt($('#resumeOffset').value),
    blacklist
  };

  await chrome.storage.local.set({ settings });
  showSaveStatus();
}

// Auto-save on any input change
function bindAutoSave() {
  const inputs = document.querySelectorAll('input, textarea');
  inputs.forEach(el => el.addEventListener('change', saveSettings));

  // textarea also auto-saves on blur
  $('#blacklist').addEventListener('blur', saveSettings);

  // range sliders update display immediately
  $('#saveInterval').addEventListener('input', () => {
    $('#saveIntervalVal').textContent = `${$('#saveInterval').value}s`;
  });
  $('#resumeOffset').addEventListener('input', () => {
    $('#resumeOffsetVal').textContent = `${$('#resumeOffset').value}s`;
  });
}

// Storage usage estimation
async function loadStorageInfo() {
  const all = await chrome.storage.local.get(null);
  const json = JSON.stringify(all);
  const bytes = new TextEncoder().encode(json).length;
  const kb = (bytes / 1024).toFixed(1);
  const maxKb = 10240; // chrome.storage.local quota is ~10MB
  const percent = Math.min((bytes / (maxKb * 1024)) * 100, 100);

  $('#storageFill').style.width = `${percent}%`;
  $('#storageText').textContent = `${kb} KB / 10 MB`;
}

// Export all progress as JSON
$('#exportBtn').addEventListener('click', async () => {
  const all = await chrome.storage.local.get(null);
  const videos = Object.fromEntries(
    Object.entries(all).filter(([k]) => k.startsWith('video_') || k.startsWith('speed_'))
  );

  const blob = new Blob([JSON.stringify(videos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ytresume-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Progress exported successfully');
});

// Import from JSON file
$('#importBtn').addEventListener('click', () => $('#importFile').click());

$('#importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      // only allow video_ and speed_ keys
      const safe = Object.fromEntries(
        Object.entries(data).filter(([k]) => k.startsWith('video_') || k.startsWith('speed_'))
      );
      await chrome.storage.local.set(safe);
      showToast(`Imported ${Object.keys(safe).length} entries`);
      loadStorageInfo();
    } catch {
      showToast('Invalid file - import failed');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// Clear all progress data
$('#clearBtn').addEventListener('click', async () => {
  const confirmed = confirm('This will delete all saved progress and bookmarks. This cannot be undone. Continue?');
  if (!confirmed) return;

  const all = await chrome.storage.local.get(null);
  const keysToRemove = Object.keys(all).filter(k =>
    k.startsWith('video_') || k.startsWith('speed_')
  );

  await chrome.storage.local.remove(keysToRemove);
  showToast(`Cleared ${keysToRemove.length} entries`);
  loadStorageInfo();
});

loadSettings();
bindAutoSave();
loadStorageInfo();
