# Peekaboo

A browser extension that saves your YouTube watch progress locally and resumes exactly where you left off — even after power cuts, browser crashes, or tab closures.

Built specifically for long-form content like courses, lectures, and multi-hour videos where YouTube's built-in history regularly falls short.

---

## Features

### Never Lose Progress Again
Progress is saved every few seconds automatically. It also saves when you pause, seek, switch tabs, or close the browser — so at worst you lose a few seconds, not hours.

### Auto Resume
When you return to a video, Peekaboo picks up from your last saved position. It rewinds a few seconds so you never miss a word. Both the interval and the rewind amount are configurable.

### Works Offline and Without a Login
Everything is stored in your browser's local storage. No account, no servers, no internet required. Works fine behind ad blockers, Brave shields, or on unstable connections.

### Playback Speed Memory
Your preferred speed (1.5x, 2x, etc.) is remembered per video and restored automatically.

### Timestamped Bookmarks
While watching, click the floating Bookmark button on the page to save any moment with an optional note. Bookmarks are listed in the popup and clicking one jumps straight to that timestamp.

### Progress Dashboard
The popup shows all your saved videos with thumbnails, progress bars, percentage watched, and when you last watched. You can search, sort by recency or progress, and resume any video with one click.

### Blacklist / Ignore List
Add channel URLs or keywords to the blacklist in settings. Videos matching any entry are skipped entirely — useful if you don't want to track short clips or entertainment content.

### Export and Import
Back up all your progress to a JSON file at any time. You can import it on another machine or browser. Handy if you're reinstalling or switching computers.

### Clean Notifications
Small unobtrusive toasts appear in the corner of the page confirming saves and resumes. You can turn them off completely in settings.

---

## Installation

### Chrome / Brave / Edge
1. Download or clone this repo
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked** and select the `peekaboo` folder
5. The Peekaboo icon will appear in your toolbar

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file inside the `peekaboo` folder

> Firefox loads extensions temporarily — they unload on browser restart. For a permanent install, sign the extension through [AMO](https://addons.mozilla.org/developers/).

---

## Settings

Open settings by clicking the gear icon in the popup, or going to your browser's extension settings and clicking "Options."

| Setting | Default | Description |
|---|---|---|
| Auto-resume | On | Seek to last saved position when a video opens |
| Save interval | 5 seconds | How often to record your position while playing |
| Resume seek-back | 5 seconds | Rewinds this many seconds on resume so you don't miss anything |
| Speed memory | On | Restores playback speed per video |
| Show toasts | On | Brief in-page notifications when saving or resuming |
| Blacklist | Empty | One URL or keyword per line — matching videos are ignored |

---

## Privacy

No data ever leaves your device. There are no analytics, no tracking, and no external network requests. All progress is stored in `chrome.storage.local` which is isolated to the extension and never synced unless you explicitly export it.

---

## How It Saves

Progress is captured on these events:
- Every N seconds while the video is playing (configurable)
- On pause
- On seek
- When the tab becomes hidden (you switch tabs)
- On page close or reload (`beforeunload` / `pagehide`)

This means even a sudden power cut will only cost you the last few seconds of the current interval.

---

## Folder Structure

```
peekaboo/
├── manifest.json        extension config (Manifest V3)
├── background.js        service worker, badge updates
├── content.js           injected into YouTube, handles all saving and resuming
├── popup.html/css/js    the toolbar popup dashboard
├── options.html/css/js  full settings page
└── icons/               extension icons
```

---

## Browser Compatibility

| Browser | Support |
|---|---|
| Chrome 102+ | Full (Manifest V3) |
| Brave | Full |
| Edge (Chromium) | Full |
| Firefox | Works via Manifest V3 compatibility layer |

---

## License

MIT :3
