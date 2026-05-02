// Popup controller - loads data, renders cards, handles tab switching

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let allVideos = [];
let activeTab = 'videos';

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

function formatTime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatWatchTime(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m > 0 ? m + 'm' : ''}`.trim();
}

function openVideo(url, time) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const ytUrl = url || `https://www.youtube.com/watch?v=${url}`;
    chrome.tabs.update(tabs[0].id, { url: ytUrl });
    window.close();
  });
}

function createVideoCard(video) {
  const card = document.createElement('div');
  card.className = 'video-card';

  const percent = video.percent || 0;
  const timeStr = formatTime(video.currentTime || 0);
  const durStr = video.duration ? formatTime(video.duration) : '';

  card.innerHTML = `
    <div class="video-thumb-wrap">
      <img class="video-thumb" src="${video.thumbnail || ''}" alt="" loading="lazy" onerror="this.style.opacity='0'">
      <div class="thumb-progress">
        <div class="thumb-progress-fill" style="width:${percent}%"></div>
      </div>
      <div class="thumb-time">${timeStr}${durStr ? ' / ' + durStr : ''}</div>
    </div>
    <div class="video-info">
      <div class="video-title">${escapeHtml(video.title || 'Untitled')}</div>
      <div class="video-meta">
        <span class="video-percent">${percent}%</span>
        <span class="video-date">${timeAgo(video.lastUpdated)}</span>
      </div>
      <div class="video-actions">
        <button class="btn-resume">Resume</button>
        <button class="btn-delete">Delete</button>
      </div>
    </div>
  `;

  card.querySelector('.btn-resume').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.update(tabs[0].id, { url: video.url });
    });
    window.close();
  });

  card.querySelector('.btn-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.storage.local.remove(`video_${video.videoId}`, () => {
      card.style.transition = 'opacity 0.2s, transform 0.2s';
      card.style.opacity = '0';
      card.style.transform = 'translateX(8px)';
      setTimeout(() => {
        card.remove();
        loadData();
      }, 200);
    });
  });

  return card;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderVideos(videos) {
  const list = $('#videoList');
  const empty = $('#emptyVideos');
  list.innerHTML = '';

  if (videos.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  videos.forEach(v => list.appendChild(createVideoCard(v)));
}

function renderBookmarks(videos) {
  const list = $('#bookmarkList');
  const empty = $('#emptyBookmarks');
  list.innerHTML = '';

  const withBookmarks = videos.filter(v => v.bookmarks && v.bookmarks.length > 0);

  if (withBookmarks.length === 0) {
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');

  withBookmarks.forEach(video => {
    const group = document.createElement('div');
    group.className = 'bookmark-group';

    const title = document.createElement('div');
    title.className = 'bookmark-group-title';
    title.textContent = video.title || 'Untitled';
    group.appendChild(title);

    video.bookmarks.forEach((bm, idx) => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <span class="bookmark-time-chip">${formatTime(bm.time)}</span>
        <span class="bookmark-note ${bm.note ? '' : 'empty'}">${escapeHtml(bm.note || 'No note')}</span>
        <button class="bookmark-del" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;

      // jump to this bookmark's video at timestamp
      item.addEventListener('click', (e) => {
        if (e.target.closest('.bookmark-del')) return;
        const url = `${video.url}&t=${Math.floor(bm.time)}`;
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.update(tabs[0].id, { url });
        });
        window.close();
      });

      item.querySelector('.bookmark-del').addEventListener('click', () => {
        const key = `video_${video.videoId}`;
        chrome.storage.local.get(key, (res) => {
          const data = res[key];
          if (!data) return;
          data.bookmarks.splice(idx, 1);
          chrome.storage.local.set({ [key]: data }, () => loadData());
        });
      });

      group.appendChild(item);
    });

    list.appendChild(group);
  });
}

function sortVideos(videos, by) {
  return [...videos].sort((a, b) => {
    if (by === 'recent') return (b.lastUpdated || 0) - (a.lastUpdated || 0);
    if (by === 'percent') return (b.percent || 0) - (a.percent || 0);
    if (by === 'duration') return (b.duration || 0) - (a.duration || 0);
    return 0;
  });
}

function filterVideos(videos, query) {
  if (!query) return videos;
  const q = query.toLowerCase();
  return videos.filter(v => (v.title || '').toLowerCase().includes(q));
}

function updateStats(videos) {
  const totalTime = videos.reduce((acc, v) => acc + (v.currentTime || 0), 0);
  const totalBookmarks = videos.reduce((acc, v) => acc + (v.bookmarks ? v.bookmarks.length : 0), 0);

  $('#totalVideos').textContent = videos.length;
  $('#totalTime').textContent = formatWatchTime(totalTime);
  $('#totalBookmarks').textContent = totalBookmarks;
}

async function loadData() {
  const all = await chrome.storage.local.get(null);

  allVideos = Object.entries(all)
    .filter(([k]) => k.startsWith('video_'))
    .map(([, v]) => v)
    .filter(v => v && v.videoId);

  updateStats(allVideos);

  const query = $('#searchInput').value;
  const sortBy = $('#sortSelect').value;
  const filtered = filterVideos(sortVideos(allVideos, sortBy), query);

  renderVideos(filtered);
  renderBookmarks(allVideos);
}

// Tab switching
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    const id = tab.dataset.tab;
    $(`#tab-${id}`).classList.add('active');
    $('#searchRow').style.display = id === 'videos' ? 'flex' : 'none';
  });
});

$('#searchInput').addEventListener('input', () => loadData());
$('#sortSelect').addEventListener('change', () => loadData());

$('#openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

loadData();
