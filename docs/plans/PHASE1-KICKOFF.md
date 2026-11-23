# Phase I Kickoff: Database & Indexing for MediaVault

## What We're Building

Transform **ytd** → **MediaVault**: Add local media file indexing alongside YouTube content.

## Phase I Scope (2-3 weeks)

### Media Types (Priority 1)
- ✅ **Video:** MP4, MKV, WebM, AVI, MOV, M4V
- ✅ **Audio:** MP3, M4A, AAC, FLAC, WAV, OGG
- ✅ **Images:** JPEG, PNG, GIF, WebP, HEIC, HEIF

_(PDF, Markdown in Phase II; PowerPoint, Word in Phase III)_

### Core Features

#### 1. Database Schema
- New `media_items` table (unified YouTube + local media)
- New `indexed_folders` table (track scanned directories)
- Link transcripts to `media_items` instead of just YouTube videos
- Migrate existing YouTube library to new schema

#### 2. Media Indexer
- **Recursive folder scanning** - handle nested directories fully
- **Metadata extraction:**
  - Video: duration, resolution, codec, creation date
  - Audio: ID3 tags (artist, album, year), duration, bitrate
  - Images: EXIF data, dimensions, camera info
  - All: file size, modified date, created date
- **Progress tracking:** files found, processed, skipped, errors
- Store full file path for each item

#### 3. File Watcher
- Detect new files, modifications, deletions
- Auto-update library when files change
- Debounced (1 second delay)

#### 4. Simple Test UI
Basic interface to verify backend works:
- "Add Folder" button → folder picker
- List view showing:
  - Filename
  - **Full file path** (primary requirement)
  - Media type (video/audio/image icon)
  - File size
  - Date created/modified
- **Right-click context menu:**
  - **Copy Path** (copy full path to clipboard)
  - Show in Finder/Explorer
  - Remove from library
- Sorting:
  - Name (A-Z, Z-A)
  - Date created (newest/oldest)
  - Date modified (newest/oldest)
  - File size (largest/smallest)
  - Duration (for audio/video)
- Filter by media type (All / Video / Audio / Image)
- Show indexing progress

## Technical Approach

### Backend Services
```
desktop/services/
├── media-indexer.ts       # Folder scanning, metadata extraction
├── thumbnail-generator.ts # (Phase II - placeholder for now)
└── database.ts            # Update with new schema
```

### Database Schema
```sql
CREATE TABLE media_items (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,  -- 'youtube' or 'local'
  source_id TEXT,        -- video_id for YouTube, hash for local
  title TEXT NOT NULL,
  media_type TEXT NOT NULL,  -- 'video', 'audio', 'image'
  file_path TEXT NOT NULL,   -- Full path on disk
  file_size INTEGER,
  duration INTEGER,
  mime_type TEXT,
  file_extension TEXT,
  
  -- Dates
  file_created_at TEXT,
  file_modified_at TEXT,
  added_at TEXT,
  updated_at TEXT,
  
  -- YouTube-specific (nullable)
  youtube_video_id TEXT,
  youtube_channel TEXT,
  
  -- Metadata (JSON or separate columns)
  metadata TEXT,  -- Store EXIF, ID3 tags as JSON
  
  UNIQUE(source, source_id)
);

CREATE TABLE indexed_folders (
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  recursive INTEGER DEFAULT 1,
  last_scanned_at TEXT,
  file_count INTEGER DEFAULT 0,
  added_at TEXT
);
```

### IPC Handlers (Electron)
- `add-local-folder` - User picks folder, start indexing
- `get-indexed-folders` - List all folders being indexed
- `rescan-folder` - Re-scan a folder (force refresh)
- `get-media-items` - Query with filters (type, source, sort)
- `get-folder-hierarchy` - For breadcrumb navigation (Phase III)

### Dependencies to Add
```bash
npm install --save chokidar music-metadata file-type
```

- **chokidar:** File system watching
- **music-metadata:** Extract audio metadata (ID3 tags)
- **file-type:** MIME type detection

_(Sharp for images, ffprobe for video - we already have ffmpeg)_

## Success Criteria

Phase I is complete when:

- [x] User can add a local folder (recursive scan)
- [x] All video, audio, image files are detected
- [x] Metadata extracted: duration, size, dates, EXIF/ID3
- [x] Database populated with full file paths
- [x] UI displays list of indexed files
- [x] **Right-click "Copy Path" works** (clipboard has full path)
- [x] Sorting works (name, date, size, duration)
- [x] Filter by media type works (video/audio/image)
- [x] File watcher detects new/modified/deleted files
- [x] Indexing progress shown to user
- [x] Performance: 1,000 files indexed in < 30 seconds

## What's NOT in Phase I

- ❌ Thumbnails (Phase II)
- ❌ Rich previews (Phase II)
- ❌ Transcription of local media (Phase IV)
- ❌ Mixed playlists (Phase IV)
- ❌ Resizable player (Phase III)
- ❌ Hero section / horizontal rows (Phase III)
- ❌ PDF/Markdown support (Phase II)

## Timeline

| Task | Duration | Status | Dependencies |
|------|----------|--------|--------------|
| 1.1 Database Schema | 3 days | ✅ DONE | - |
| 1.2 Media Indexer Service | 7 days | ✅ DONE | 1.1 |
| 1.3 File Watcher | 3 days | ✅ DONE | 1.2 |
| 1.4 IPC Handlers | 2 days | ✅ DONE | 1.2 |
| 1.5 Simple Test UI | 2 days | ✅ DONE | 1.4 |
| **Testing & Polish** | 2 days | 🚧 IN PROGRESS | All above |

**Total: ~19 days (3 weeks)**

## Completed Tasks

### Task #1: Database Schema ✅
- Created `media_items` table with full metadata support
- Created `indexed_folders` table
- Migrated existing YouTube library data
- See: `docs/decisions/0013-atomic-update-downloads.md`, `0014-local-media-library.md`

### Task #2: Media Indexer Service ✅
- Recursive folder scanning with skip logic
- Video metadata extraction (duration, resolution, codec, fps)
- Audio metadata extraction (ID3 tags, duration, bitrate)
- Image metadata extraction (EXIF, dimensions)
- Progress tracking with events
- See: `desktop/services/media-indexer.ts`, `docs/decisions/0015-media-indexer-implementation.md`

### Task #3: File Watcher ✅
- Chokidar integration for file system watching
- Debounced updates (1 second)
- Handles add, change, unlink events
- See: `desktop/services/file-watcher.ts`

### Task #4: IPC Handlers ✅
- `media:scanFolder` - Scan folder for media files
- `media:getAll` - Query media with filters
- `indexedFolders:*` - CRUD operations
- Event forwarding for real-time updates
- See: `desktop/ipc-handlers.ts` lines 428-560

### Task #5: Simple Test UI ✅
- Extended Library page with local media support
- "Add Local Folder" button with progress dialog
- Source filter (All/YouTube/Local)
- Media type filter (All/Video/Audio/Image)
- File path display and copy
- Real-time indexing progress
- See: `docs/plans/TASK5-COMPLETION-SUMMARY.md`

## Questions Before Starting

1. **App renaming:** Do you prefer "MediaVault" or "MediaHub"?
   - I'll update package.json, window titles, branding

2. **Migration:** Should I preserve the existing `library` table or migrate data to `media_items`?
   - Option A: Keep `library`, add `media_items` (dual tables)
   - Option B: Migrate all to `media_items` (cleaner, one migration)

3. **File watching:** Enable by default or opt-in per folder?
   - Watching can use CPU, but keeps library in sync

4. **Nested folders:** Show flat list or preserve folder hierarchy in UI?
   - Phase I: Flat list with full paths
   - Phase III: Add folder tree navigation

5. **Explorer project:** Should I reference Explorer code directly or port components?
   - I'll adapt patterns but write fresh code for Electron

## Next Steps

1. ✅ You approve this Phase I scope
2. ✅ Answer questions above
3. 🚀 I start implementation:
   - Database schema & migration
   - Media indexer service
   - File watcher
   - IPC handlers
   - Basic UI for testing

**Ready to start when you give the green light!** 🚀
