# Milestone 3: Local Media Library Support

## Overview

Transform ytd into **MediaVault** - a comprehensive media library manager that can index, preview, and organize local media files alongside YouTube content.

**App Name:** MediaVault (or MediaHub)  
**Timeline:** 8-12 weeks (varies by scope)  
**Prerequisites:** Current v1.9.x functionality working (✅)  
**Reference:** ADR-0014, Explorer project patterns, modern media player UX (Netflix, Spotify, Plex)

## User Requirements Summary

**Priority 1 (Phase I):** Video, audio, images  
**Priority 2 (Phase II):** PDF, Markdown  
**Priority 3 (Phase III):** PowerPoint, Word (in-app rendering, no external dependencies)

**Scale:** 1,000 - 10,000 local media files  
**Key features:**
- Recursive nested folder scanning
- File path display with right-click "Copy Path"
- Sorting: timestamp, size, date created, metadata
- Resizable player frames
- Modern media player UX patterns (Netflix/Spotify/Apple TV inspired)

## Modern UX Patterns to Implement

Based on research of Netflix, Spotify, Apple TV, and Plex:

| Pattern | MediaVault Implementation |
|---------|---------------------------|
| **Hero section** | Featured/Recently Added at top with large preview |
| **Horizontal rows** | "Recently Added", "Videos", "Audio", "Images", "Continue Watching" |
| **Hover states** | Enlarge thumbnail, show quick actions (play, add to playlist) |
| **Continue watching** | Track playback position, resume functionality |
| **Minimal controls** | Player controls fade out after 3 seconds |
| **Progress indicators** | Show progress bar on thumbnails for partial playback |
| **Responsive grid** | 3-6 columns adapt to window width |
| **Keyboard first** | All actions accessible via keyboard |
| **Context menus** | Right-click for Copy Path, Show in Finder, etc. |
| **Smart sorting** | Multiple sort criteria with visual indicators |
| **Breadcrumb navigation** | Show folder hierarchy for nested folders |
| **Loading states** | Skeleton screens (not spinners) |
| **Drag and drop** | Add to playlist, reorder queue |

## Phases

### Phase 1: Foundation - Database & File Indexing (2-3 weeks)

**Goal:** Scan local folders, identify media files, store in database

#### 1.1 Database Schema (3 days)
- [ ] Create migration script for new tables
  - `media_items` (unified table for YouTube + local)
  - `indexed_folders` (track scanned directories)
  - Add `media_item_id` to `transcripts` table
- [ ] Write migration to populate `media_items` from existing `library` table
- [ ] Update TypeScript types in `shared/types.ts`
- [ ] Add database indexes for performance
  ```sql
  CREATE INDEX idx_media_items_source ON media_items(source);
  CREATE INDEX idx_media_items_type ON media_items(media_type);
  CREATE INDEX idx_media_items_path ON media_items(file_path);
  ```

#### 1.2 Media Indexer Service (7 days)
Create `desktop/services/media-indexer.ts`:
- [ ] Implement folder scanner
  - **Recursive directory walk** (handle nested folders fully)
  - Filter by supported extensions (Phase I: video, audio, image only)
  - Respect .gitignore patterns and system folders (.git, node_modules, etc.)
  - Store full file path for each item
- [ ] Media type detection
  - **Video:** `.mp4`, `.mkv`, `.webm`, `.avi`, `.mov`, `.m4v`
  - **Audio:** `.mp3`, `.m4a`, `.aac`, `.flac`, `.wav`, `.ogg`
  - **Images:** `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.heic`, `.heif`
  - By MIME type using `file-type` npm package as fallback
  - Categorize: video, audio, image
- [ ] Metadata extraction
  - **Video:** duration, resolution, codec, bitrate, creation date (use ffprobe)
  - **Audio:** duration, bitrate, ID3 tags (artist, album, year), creation date (use `music-metadata`)
  - **Images:** dimensions, EXIF (camera, date taken, location), creation date (use `sharp` + `exif-parser`)
  - **All:** file size, modified date, created date
- [ ] Database operations
  - Insert/update `media_items` with full file path
  - Handle duplicates (by file path)
  - Update folder scan timestamps
  - Store metadata for sorting (size, dates, duration, resolution)
- [ ] Progress reporting
  - Emit events: `indexing-started`, `indexing-progress`, `indexing-completed`
  - Track: files found, processed, skipped, errors
  - Show current folder path being scanned

#### 1.3 File Watcher (3 days)
- [ ] Integrate `chokidar` for file watching
- [ ] Watch indexed folders for changes
  - New files: add to index
  - Modified files: update metadata, regenerate thumbnail
  - Deleted files: mark as missing or remove
- [ ] Debounce rapid changes (1 second)
- [ ] Settings to enable/disable watching per folder

#### 1.4 IPC Handlers (2 days)
Create Electron IPC handlers:
- [ ] `add-local-folder` - Add folder to index (returns folder id)
- [ ] `remove-local-folder` - Remove folder from index
- [ ] `rescan-folder` - Force rescan of folder
- [ ] `get-indexed-folders` - List all indexed folders with stats
- [ ] `get-media-items` - Query media items with filters (source, type, folder)
- [ ] `get-folder-hierarchy` - Get folder tree for breadcrumb navigation
- [ ] `get-media-item-by-path` - Retrieve single item by file path

#### 1.5 Simple UI for Testing (2 days)
Basic UI to verify Phase I functionality:
- [ ] "Add Folder" button that opens folder picker
- [ ] Simple list view showing indexed files with paths
- [ ] Display: filename, full path, media type, file size, date
- [ ] Show indexing progress (files processed, current file)
- [ ] Basic sorting dropdown (name, date, size)
- [ ] Filter by media type (video/audio/image)

**Deliverable:** Backend can scan folders, populate `media_items` table, and basic UI displays the indexed files

---

### Phase 2: Thumbnails & Preview System (3-4 weeks)

**Goal:** Generate thumbnails and display rich previews for all media types

#### 2.1 Thumbnail Generation Service (7 days)
Create `desktop/services/thumbnail-generator.ts`:
- [ ] Install dependencies: `sharp`, `fluent-ffmpeg`
- [ ] Implement generators by media type:
  - **Video:** Extract frame at 10% duration
    ```bash
    ffmpeg -i input.mp4 -ss 5 -vframes 1 -vf scale=320:-1 thumb.jpg
    ```
  - **Image:** Resize with `sharp`
    ```javascript
    await sharp(path).resize(320, 320, { fit: 'inside' }).toFile(outPath)
    ```
  - **Audio:** Generate waveform SVG or use generic icon
  - **PDF:** Render first page with `pdfjs-dist`
  - **Documents:** Use generic icons (for now)
- [ ] Thumbnail storage
  - Path: `~/.ytd/thumbnails/<sha256-hash>.jpg`
  - Hash input: `${filePath}:${mtime}:${size}`
  - Cleanup: LRU eviction if cache > 1GB
- [ ] Batch processing with queue
  - Process 5 thumbnails concurrently
  - Prioritize visible items
- [ ] IPC handler: `generate-thumbnail`

#### 2.2 Frontend Thumbnail Cache (2 days)
Create `frontend/src/lib/thumbnailCache.ts`:
- [ ] In-memory LRU cache (500 entries)
- [ ] Request thumbnail via IPC, cache result
- [ ] Handle errors gracefully (show placeholder)
- [ ] Preload thumbnails for next page (when scrolling)

#### 2.3 Preview Components (10 days)
Port from Explorer, adapt to Electron:

Create `frontend/src/components/preview/` directory:

- [ ] **PreviewPanel.tsx** (2 days)
  - Main container component
  - Route to specific preview by media type
  - Loading states, error boundaries
  - Keyboard navigation (prev/next)

- [ ] **VideoPreview.tsx** (1 day)
  - Enhance existing video player
  - Support local files via IPC or custom protocol
  - Scrubbing, volume, fullscreen, speed controls
  
- [ ] **AudioPreview.tsx** (2 days)
  - HTML5 audio player with custom UI
  - Show waveform (if generated)
  - Display ID3 metadata (title, artist, album)
  - Seek bar, volume, loop controls

- [ ] **ImagePreview.tsx** (2 days)
  - Display image with zoom/pan
  - Show EXIF metadata panel
  - Gallery navigation (arrow keys)
  - Rotation controls

- [ ] **PdfPreview.tsx** (2 days)
  - Integrate `react-pdf` or `pdfjs-dist`
  - Page navigation
  - Zoom controls
  - Search within PDF

- [ ] **MarkdownPreview.tsx** (2 days)
  - Render markdown with `react-markdown`
  - Syntax highlighting with `prism.js`
  - Support mermaid diagrams
  - GitHub-flavored markdown

- [ ] **DocumentPreview.tsx** (1 day)
  - Placeholder for PowerPoint, Word
  - Option 1: Convert to PDF and use PdfPreview
  - Option 2: Use macOS Quick Look (open in external viewer)
  - Show "Preview not available, open externally" button

#### 2.4 Custom File Protocol (Optional, 2 days)
If direct file access is problematic:
- [ ] Register `media://` protocol in Electron
- [ ] Serve files with proper MIME types
- [ ] Support range requests (for video streaming)
- [ ] Security: validate paths, prevent directory traversal

**Deliverable:** All media types have thumbnails and previews

---

### Phase 3: UI Integration (2-3 weeks)

**Goal:** Unified interface for YouTube and local media

#### 3.1 Library View Updates (5 days)
- [ ] Update grid/list components to handle `media_items`
- [ ] Add "Source" badge: YouTube icon vs folder icon
- [ ] Media type icons (video, audio, image)
- [ ] **Display file paths:**
  - Show full path in list view (truncate in grid)
  - Tooltip shows full path on hover
  - Metadata panel shows full path
- [ ] **Right-click context menu:**
  - Copy Path (copy full file path to clipboard)
  - Copy File (copy actual file to clipboard)
  - Show in Finder/Explorer
  - Add to Playlist
  - Generate Transcript (for video/audio)
  - Delete from Library
- [ ] Filters:
  - Source: All / YouTube / Local
  - Type: All / Video / Audio / Image
- [ ] **Sort options:**
  - Name (A-Z, Z-A)
  - Date Added (newest/oldest)
  - Date Modified (newest/oldest)
  - Date Created / Published (newest/oldest)
  - File Size (largest/smallest)
  - Duration (longest/shortest, for video/audio)
  - Media Type
- [ ] Update search to work across YouTube and local
- [ ] **Responsive grid:** 3-6 columns based on window width

#### 3.2 Add Folder UI (3 days)
- [ ] "Add Local Folder" button in sidebar or toolbar
- [ ] Folder picker dialog
- [ ] Indexing progress modal
  - Show: files found, processed, errors
  - Cancel button
  - Progress bar
- [ ] List of indexed folders in settings
  - Path, file count, last scanned
  - Rescan, remove buttons

#### 3.3 Unified Player (5 days)
- [ ] **Resizable player frame:**
  - Drag edge to resize (remember last size in localStorage)
  - Preset sizes: Small (480p), Medium (720p), Large (1080p), Fullscreen
  - Maintain aspect ratio
- [ ] Update existing video player to handle all media types
- [ ] **Modern video player controls** (inspired by Netflix/YouTube):
  - Auto-hide controls after 3 seconds of inactivity
  - Hover seek bar to show thumbnail preview (future enhancement)
  - Playback speed: 0.25x, 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x
  - Picture-in-Picture support (browser native API)
  - Volume slider (persist to localStorage)
  - Timestamp display (current / total)
  - Buffer progress indicator
- [ ] **Audio player** (inspired by Spotify):
  - Waveform or progress bar
  - Album art display (from ID3 tags)
  - Artist, album, year metadata
  - Volume, shuffle, repeat controls
- [ ] **Image viewer:**
  - Zoom in/out (pinch or +/- keys)
  - Pan when zoomed
  - Fit to window vs actual size
  - EXIF metadata panel
- [ ] Playlist playback across mixed media
  - Auto-advance: video → audio → video
  - Handle images: show for 5 seconds with fade transition, or skip
- [ ] Mini player mode (bottom-right corner, always on top)
- [ ] **Keyboard shortcuts:**
  - Space: play/pause
  - ← / →: seek backward/forward 10 seconds
  - ↑ / ↓: volume up/down
  - F: fullscreen
  - M: mute/unmute
  - 0-9: seek to 0%-90% of duration
  - [ / ]: decrease/increase playback speed
  - P: picture-in-picture
- [ ] **Resume playback:** Track last position in database, offer to resume

#### 3.4 Settings Panel (2 days)
- [ ] Add "Local Media" section
- [ ] Options:
  - Enable file watching (per folder)
  - Thumbnail cache size limit
  - Thumbnail quality (low/medium/high)
  - Supported file types (checkboxes)
  - Indexing batch size

**Deliverable:** Cohesive UI for browsing and playing all media

---

### Phase 4: Advanced Features (2-3 weeks)

**Goal:** Transcription, playlists, search

#### 4.1 Local Media Transcription (5 days)
- [ ] Update `desktop/services/transcription.ts`
  - Accept `media_item_id` instead of `video_id`
  - For local audio: use file directly
  - For local video: extract audio with ffmpeg
- [ ] UI: "Transcribe" button on local audio/video items
- [ ] Show transcription status and progress
- [ ] Search transcripts for local media

#### 4.2 Mixed Playlists (5 days)
- [ ] Update database schema
  - Change `local_playlist_items.video_id` to `media_item_id`
  - Migrate existing playlists
- [ ] UI: Add local media to playlists (drag-and-drop)
- [ ] Playlist playback handles media type transitions
- [ ] Smart playlists (auto-generated by filters)

#### 4.3 Global Search (3 days)
- [ ] Update search to include local media
- [ ] Search by:
  - Filename
  - Metadata (artist, album for audio)
  - Transcripts (if available)
- [ ] Filter search results by source and type
- [ ] Search results show thumbnails and metadata

#### 4.4 Bulk Operations (2 days)
- [ ] Multi-select media items
- [ ] Bulk actions:
  - Add to playlist
  - Generate transcripts
  - Move/copy files
  - Delete from library (keep/remove files)

**Deliverable:** Feature parity with YouTube content

---

### Phase 5: Polish & Testing (1-2 weeks)

#### 5.1 Performance Optimization (4 days)
- [ ] Lazy loading for large libraries
- [ ] Virtual scrolling (already have, optimize)
- [ ] Thumbnail lazy loading
- [ ] Database query optimization (explain query plans)
- [ ] Debounce search input

#### 5.2 Error Handling (3 days)
- [ ] Handle missing files gracefully
- [ ] Corrupted/unsupported media files
- [ ] Permission errors (unreadable folders)
- [ ] Show user-friendly error messages
- [ ] Retry logic for transient failures

#### 5.3 Migration & Backward Compatibility (2 days)
- [ ] Test migration from v1.9.x to v2.0.0
- [ ] Ensure existing YouTube library works
- [ ] Data validation after migration
- [ ] Rollback script (if needed)

#### 5.4 Testing (5 days)
- [ ] Unit tests for indexer, thumbnail generator
- [ ] Integration tests for IPC handlers
- [ ] E2E tests for main workflows:
  - Add folder → scan → view → preview
  - Create playlist with mixed content
  - Search across YouTube + local
- [ ] Test on macOS, Windows, Linux
- [ ] Performance testing (10k+ media items)

**Deliverable:** Stable v2.0.0 release candidate

---

## Dependencies to Add

```json
{
  "dependencies": {
    "chokidar": "^4.0.1",          // File watching
    "music-metadata": "^10.3.1",   // Audio metadata
    "sharp": "^0.34.1",            // Image processing
    "file-type": "^19.8.0"         // MIME detection
  },
  "devDependencies": {
    "react-pdf": "^10.0.0",        // PDF rendering
    "react-markdown": "^10.0.0",   // Markdown rendering
    "prismjs": "^1.29.0"           // Code syntax highlighting
  }
}
```

## Risks & Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Large folder scans slow down app | High | High | Incremental indexing, progress UI, cancellation |
| Thumbnail generation is resource-intensive | Medium | High | Queue with concurrency limit, low-priority background task |
| File watcher causes high CPU usage | Medium | Medium | Debounce events, option to disable per folder |
| HEIC support on Windows | Low | Medium | Convert HEIC to JPEG during thumbnail generation |
| Explorer patterns don't translate to Electron | Medium | Low | Adapt rather than port directly; use IPC instead of Tauri commands |

## Success Metrics

- [ ] Can index 1000+ files in < 30 seconds
- [ ] UI remains responsive during indexing
- [ ] All supported media types have working previews
- [ ] Mixed playlists play smoothly
- [ ] Transcription works for local audio/video
- [ ] Search finds results across YouTube and local in < 500ms

## Questions for User

Before starting implementation:

1. **Scope prioritization:** Which media types are most important?
   - Core: video, audio, images
   - Nice-to-have: PDF, Markdown
   - Future: PowerPoint, Word

2. **Naming:** Keep "ytd" or rebrand? Suggestions:
   - MediaVault
   - MediaHub
   - ytd (rebranded as "Your Total Downloader")

3. **Explorer integration:** Should we:
   - Port components from Explorer (more work, more control)
   - Keep Explorer separate (less duplication)
   - Merge projects (significant refactor)

4. **Phase breakdown:** Prefer:
   - Incremental releases (ship Phase 1, then Phase 2, etc.)
   - One big v2.0.0 release (complete all phases)

5. **Performance targets:** How many local media files do you expect to manage?
   - < 1,000: optimize less aggressively
   - 1,000 - 10,000: need virtual scrolling, thumbnail caching
   - 10,000+: may need full-text search index, pagination
