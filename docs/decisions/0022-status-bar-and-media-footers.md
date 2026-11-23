# ADR 0022: Status Bar + Media Footers (Combo A Implementation)

## Context

**User feedback:** "Right now it kind of looks chopped off at the bottom because there is no footer frame. I think you have a header frame because I see traffic lights on the top left but then I would like to see a footer frame, which can also indicate what I'm currently viewing and whether it's a local or YouTube video (or maybe the title of the video, or maybe something like that: some useful information)."

The app lacked persistent context indicators:
- No indication of current view/page
- No visibility into background operations (indexing, downloads)
- Media players (video/audio/image) didn't show metadata (source, format, path)
- User couldn't easily tell if they were viewing local vs YouTube content

## Decision

Implemented **Combo A: Persistent Status Bar + Media Footers**

### 1. Persistent Status Bar (Main Window)

**Component:** `frontend/components/StatusBar/StatusBar.tsx` (NEW)

Always visible at the very bottom of the main window, showing:

**Left Side:**
- Current page name (Dashboard, Library, Downloads, etc.)
- Media item count with breakdown (e.g., "38 items (15 YouTube, 23 Local)")
- Active background operations:
  - Indexing progress: "🔄 Indexing: 5/120"
  - Active downloads: "⬇ 2 downloads active"

**Right Side:**
- Storage used: "💾 12.4 GB"

**Behavior:**
- Updates in real-time via IPC event listeners
- Shows indexing progress while scanning folders
- Shows download queue when downloads are active
- Collapses/hides sections when not relevant (no media = no count)

**Example states:**
```
Library • 38 items (15 YouTube, 23 Local) │ 🔄 Indexing: 5/120 │ 💾 12.4 GB
```

```
Downloads │ ⬇ 3 downloads active │ 💾 8.2 GB
```

```
Dashboard │ Total: 42 media items │ 💾 15.1 GB
```

### 2. VideoPlayer Footer (Inside Player Dialog)

**File:** `frontend/components/VideoPlayer/VideoPlayer.tsx`

Added footer at the bottom of the player showing:
- **Source indicator:** Green dot + "Local" or Red dot + "YouTube"
- **File name:** Truncated to 250px max width
- **Format:** MP4, MP3, WEBM, etc.
- **Resolution:** 1080p, 720p, etc. (video only)
- **File size:** 245 MB, 1.2 GB, etc.
- **Copy Path button:** For local files only (with tooltip showing full path)

**Example:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🟢 Local • vacation-vlog.mp4 • MP4 • 1080p • 245 MB   [Copy Path]
└─────────────────────────────────────────────────────────────┘
```

**Example (Audio):**
```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 YouTube • podcast-episode.mp3 • MP3 • 45 MB
└─────────────────────────────────────────────────────────────┘
```

### 3. ImageViewer Footer (Inside Image Viewer Dialog)

**File:** `frontend/components/ImageViewer/ImageViewer.tsx`

Added footer above keyboard hints showing:
- **Source indicator:** Green dot + "Local Image"
- **File name:** Truncated to 300px max width
- **Format:** JPEG, PNG, HEIC, etc. (extracted from file extension)
- **Copy Path button:** With tooltip showing full path

**Positioned at `bottom: 60px`** to sit above keyboard hints at `bottom: 16px`

**Example:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🟢 Local Image • vacation-photo.jpg • JPG           [Copy Path]
└─────────────────────────────────────────────────────────────┘
```

### 4. Layout Update

**File:** `frontend/pages/Dashboard.tsx`

Updated main layout structure:
- **Before:** Horizontal flex (Sidebar + Content)
- **After:** Vertical flex (Content Row + StatusBar)

```tsx
<Box display="flex" flexDirection="column" height="100vh">
  <Box display="flex" flex={1} overflow="hidden">
    <Sidebar ... />
    <Box flex={1} overflow="hidden" pt="52px">
      {renderPage()}
    </Box>
  </Box>
  <StatusBar />
</Box>
```

## Benefits

### Clear Context ✅
- Always know what page you're on
- See media library size at a glance
- Understand background activity without navigating

### Media Metadata Visibility ✅
- **Source clarity:** Instantly know if content is local or YouTube
- **Format info:** See codec, resolution, file size without opening properties
- **Path access:** Copy file path for scripting/automation

### Real-Time Updates ✅
- Indexing progress updates live
- Download queue reflects active transfers
- Storage indicator updates after adding media

### Multi-Media Support ✅
- Works for videos, audio, and images
- Each media type shows relevant metadata
- Consistent design across all viewers

## Implementation Details

### StatusBar Component Features

**Event Listeners:**
- `media:indexingProgress` → Updates indexing count
- `media:indexingCompleted` → Hides indexing, refreshes stats
- `downloads:queueUpdate` → Updates active download count

**Auto-refresh:**
- Loads stats on mount
- Refreshes after indexing completes
- Uses `Promise.all()` for parallel loading

**Responsive:**
- Uses flexbox with `gap` for spacing
- Dividers auto-collapse when sections hidden
- Right-aligned storage indicator

### Footer Styling

**Consistent design:**
- Border top: 1px divider
- Background: `background.paper` (VideoPlayer) / semi-transparent black (ImageViewer)
- Height: ~28px (compact)
- Font size: 0.75rem (caption)
- Padding: 0.75rem vertical, 2rem horizontal

**Source indicator:**
- 6px circular dot
- Green (`success.main`) for Local
- Red (`#FF0000`) for YouTube
- Label: "Local" / "YouTube" / "Local Image"

**Copy Path button:**
- Only shows for local files
- Uses `navigator.clipboard.writeText()`
- Tooltip shows full path on hover
- Compact icon + text design

## Why Combo A vs. Other Options?

### ❌ Option 2: Smart Context-Switching Status Bar
- Loses app context when playing media
- Can't see Library while watching video
- More confusing UX

### ❌ Option 3: Expandable Info Panel
- Requires extra click to see metadata
- Hidden by default = easy to miss
- Not always-visible context

### ✅ Combo A (Chosen)
- **Best of both worlds:** App context + media context
- **Always visible:** No clicking required
- **Clear hierarchy:** App-level vs. content-level info
- **Scalable:** Easy to add more indicators (sync status, transcription progress)

## User Experience Flows

### Scenario 1: Browsing Library
**What you see:**
- **Status Bar:** "Library • 38 items (15 YouTube, 23 Local) │ 💾 12.4 GB"
- User knows: current page, total items, source breakdown, storage used

### Scenario 2: Playing Local Video
**What you see:**
- **Status Bar:** Still shows "Library • 38 items..."
- **VideoPlayer Footer:** "🟢 Local • vacation.mp4 • MP4 • 1080p • 245 MB [Copy Path]"
- User knows: app context + video metadata

### Scenario 3: Viewing Image
**What you see:**
- **Status Bar:** "Library • 38 items..."
- **ImageViewer Footer:** "🟢 Local Image • photo.jpg • JPG [Copy Path]"
- **Keyboard Hints:** Still visible below footer
- User knows: app context + image metadata + controls

### Scenario 4: Active Indexing
**What you see:**
- **Status Bar:** "Library • 38 items │ 🔄 Indexing: 45/120 │ 💾 12.4 GB"
- User knows: indexing in progress, can continue browsing

### Scenario 5: Active Downloads
**What you see:**
- **Status Bar:** "Downloads │ ⬇ 3 downloads active │ 💾 8.2 GB"
- User knows: download progress without checking queue

## Future Enhancements

### Status Bar Additions
- **Sync status:** "🔄 Syncing with Device-A"
- **Transcription progress:** "📝 Transcribing: 2/5"
- **Filter indicators:** "Filtered: Local Videos" when filters active
- **Clickable sections:** Click "Library • 38 items" to open Library

### Media Footer Additions
- **Resolution for images:** "1920×1080" or "4K"
- **EXIF data:** "📷 iPhone 13 Pro" for photos
- **Codec info:** "H.264 / AAC" for videos
- **Bitrate:** "5.2 Mbps" for videos/audio
- **"Open in Finder" button:** Quick access to file location

### Advanced Features
- **Status bar themes:** Match app theme (light/dark)
- **Collapsible sections:** Hide storage, hide background tasks
- **Mini-player in status bar:** Control playback from status bar
- **Progress bars:** Show download/indexing as progress bar

## Testing

Verify:
- [x] Status bar appears at bottom of main window
- [ ] Status bar shows correct page name
- [ ] Media count updates when adding/removing items
- [ ] Indexing progress updates in real-time
- [ ] Download queue count updates
- [ ] Storage indicator shows correct value
- [ ] VideoPlayer footer shows correct metadata
- [ ] ImageViewer footer shows correct metadata
- [ ] Copy Path button works for local files
- [ ] Tooltips show full file paths
- [ ] Source indicators (green/red dots) display correctly
- [ ] Footer styling is consistent across viewers
- [ ] Layout doesn't break on small screens

## Related Files

- `frontend/components/StatusBar/StatusBar.tsx` - NEW persistent status bar
- `frontend/pages/Dashboard.tsx` - Layout updated to include status bar
- `frontend/components/VideoPlayer/VideoPlayer.tsx` - Added footer
- `frontend/components/ImageViewer/ImageViewer.tsx` - Added footer

## Related Decisions

- ADR 0019: Dashboard Media Library Statistics (shows stats in cards)
- ADR 0020: Image Viewer Component (viewer existed, now has footer)
- ADR 0021: HTTP-Based Image Serving (enables image viewing)

## Migration Notes

**No breaking changes:**
- ✅ All existing functionality preserved
- ✅ Footer adds context, doesn't replace controls
- ✅ Status bar is purely additive
- ✅ Main content area height automatically adjusted (flexbox)
