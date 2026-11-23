# ADR 0014: Transform ytd into Comprehensive Media Library Manager

## Context

The ytd app currently excels at YouTube video management (download, transcribe, organize, play). User wants to extend it to handle local media files that aren't from YouTube:

**Supported media types:**
- Videos (local, non-YouTube)
- Audio files (MP3, AAC, WAV, FLAC, etc.)
- Images (JPEG, PNG, HEIC, WebP, etc.)
- Documents (PDF, Markdown, PowerPoint, Word, etc.)

**Key requirements:**
- Add local folders to scan and index
- Show thumbnails/list view for all media (tagged as "local" vs "YouTube")
- Preview/view capabilities for each media type
- Transcribe local audio/video files
- Create playlists that can mix YouTube and local content
- Relocate files and reindex seamlessly

**Reference implementation:** The Explorer project (`/Users/jpurshot/experimental/explorer`) has similar functionality - it's a Tauri (Rust + React) media browser with:
- Rich preview components for all media types
- Thumbnail generation and caching
- SQLite search with trigram indexing
- Gallery and list views
- Tag system

## Decision

Evolve ytd from "YouTube Downloader" to "Media Library Manager" by:

### 1. Database Schema Extension

Add new tables while preserving existing YouTube-focused schema:

```sql
-- New: media_items table (generalizes beyond YouTube)
CREATE TABLE media_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Source identification
  source TEXT NOT NULL CHECK(source IN ('youtube', 'local')),
  source_id TEXT,  -- video_id for YouTube, file path hash for local
  
  -- Common metadata
  title TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK(media_type IN ('video', 'audio', 'image', 'document')),
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  duration INTEGER DEFAULT 0,  -- for audio/video
  
  -- Thumbnail
  thumbnail_path TEXT,
  thumbnail_generated_at TEXT,
  
  -- YouTube-specific (nullable for local files)
  youtube_video_id TEXT,
  youtube_channel TEXT,
  youtube_channel_id TEXT,
  youtube_url TEXT,
  
  -- Local file metadata (nullable for YouTube)
  mime_type TEXT,
  file_extension TEXT,
  file_modified_at TEXT,
  file_created_at TEXT,
  
  -- Common fields
  added_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  last_accessed_at TEXT,
  
  -- Indexing
  UNIQUE(source, source_id)
);

-- Track indexed local folders
CREATE TABLE indexed_folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  path TEXT NOT NULL UNIQUE,
  recursive INTEGER DEFAULT 1,  -- scan subdirectories
  last_scanned_at TEXT,
  file_count INTEGER DEFAULT 0,
  added_at TEXT DEFAULT (datetime('now'))
);

-- Link transcripts to media_items instead of just video_id
ALTER TABLE transcripts ADD COLUMN media_item_id INTEGER;
ALTER TABLE transcripts ADD FOREIGN KEY (media_item_id) REFERENCES media_items(id);

-- Migrate existing data
-- Create media_items from existing library entries with source='youtube'
```

### 2. File Discovery & Indexing Service

Create `desktop/services/media-indexer.ts`:
- Scan folders recursively
- Identify file types by extension and MIME type
- Extract metadata (EXIF for images, ID3 for audio, video metadata)
- Generate thumbnails (see below)
- Update database
- File watcher to detect changes

### 3. Thumbnail Generation

Adapt Explorer's thumbnail logic to Node.js/Electron:

**For videos:** Use ffmpeg (already have for transcription)
```bash
ffmpeg -i input.mp4 -ss 00:00:01 -vframes 1 -vf scale=320:-1 thumb.jpg
```

**For images:** Use `sharp` library (Node.js image processing)
```javascript
await sharp(imagePath).resize(320, 320, { fit: 'inside' }).toFile(thumbPath);
```

**For audio:** Generate waveform or use generic audio icon

**For PDF:** Use `pdf-poppler` or `pdfjs-dist` to render first page

**For PowerPoint/docs:** Use generic icons or QuickLook on macOS

**Storage:** `~/.ytd/thumbnails/<hash>.jpg` (hash from file path + mtime)

### 4. Preview System Architecture

Port Explorer's preview components to ytd:

```
frontend/src/components/preview/
  ├── PreviewPanel.tsx        # Main container, routes by media type
  ├── VideoPreview.tsx        # Video player (already exists, enhance)
  ├── AudioPreview.tsx        # Audio player with waveform
  ├── ImagePreview.tsx        # Image viewer with EXIF, zoom, pan
  ├── PdfPreview.tsx          # PDF.js renderer
  ├── MarkdownPreview.tsx     # Markdown with syntax highlighting, diagrams
  ├── DocumentPreview.tsx     # PowerPoint, Word (iframe or external)
  └── previewTypes.ts         # Type definitions
```

**Key pattern from Explorer:**
- Each preview component receives `FileEntry` with media type
- PreviewPanel switches based on `media_type` and `file_extension`
- Use custom protocol or IPC to stream files securely

### 5. UI Changes

**Main library view:**
- Add "Source" filter: All / YouTube / Local
- Tag items with icon: YouTube logo vs folder icon
- Keep existing grid/list views

**New: "Add Local Folder" button**
- Opens folder picker
- Shows indexing progress
- Saves to `indexed_folders` table

**Media type filters:**
- All Media
- Videos (YouTube + local)
- Audio
- Images
- Documents

**Unified player:**
- PreviewPanel adapts to media type
- Navigation: prev/next in current view/playlist
- Keyboard shortcuts (space = play/pause, arrows = navigate)

### 6. Transcription Extension

Extend `desktop/services/transcription.ts`:
- Accept `media_item_id` instead of just YouTube `video_id`
- For local audio: extract audio directly
- For local video: extract audio track with ffmpeg
- Use existing whisper.cpp pipeline
- Store in `transcripts` table with `media_item_id` reference

### 7. Playlist Enhancement

Extend `local_playlists` and `local_playlist_items`:
- Change `video_id` to `media_item_id`
- Support mixed playlists (YouTube videos, local videos, audio)
- Handle playback transitions (skip images in auto-play mode, or show briefly)

### 8. Application Rename

Consider renaming:
- **Current:** "ytd" (YouTube Downloader)
- **Proposed:** "MediaVault" or "MediaHub" or keep "ytd" but rebrand as "Your Total Downloader"
- Update package.json, app name, window titles
- Keep command-line binary as `ytd` for continuity

## Consequences

**Pros:**
- Transforms single-purpose tool into comprehensive media manager
- Reuses proven patterns from Explorer project
- Maintains backward compatibility (existing YouTube library unchanged)
- Leverages existing infrastructure (transcription, playback, database)
- User can manage all media in one app

**Cons:**
- Significant development effort (8-12 weeks estimated)
- Database migration complexity
- Must handle large file scans gracefully (progress, cancellation)
- Thumbnail generation can be resource-intensive
- Increased app complexity and testing surface

**Technical risks:**
- Electron performance with large media libraries (thousands of files)
- Thumbnail cache management (disk space)
- File watcher reliability on different OS
- HEIC support on Windows/Linux (may need conversion)

**Mitigation:**
- Implement incremental indexing (batch of 100 files, show progress)
- Virtual scrolling for large libraries (already have with react-window)
- Thumbnail cache limit + LRU eviction
- Graceful fallbacks for unsupported formats (show generic icon)

## Implementation Notes

See `docs/plans/M3-local-media-library.md` for phased implementation plan.

Key dependencies to add:
- `sharp` - Image processing
- `pdf-poppler` or `pdfjs-dist` - PDF rendering
- `music-metadata` - Audio metadata extraction
- `chokidar` - File watching

Reusable code from Explorer:
- React preview components (adapt Tauri commands to Electron IPC)
- UI patterns for gallery/list views
- Thumbnail caching strategy
- Media type detection logic

**Next steps:**
1. Review and approve this ADR
2. Create detailed implementation plan (milestone 3)
3. Start with Phase 1: Database + indexing backend
4. Then Phase 2: Preview components + UI
5. Finally Phase 3: Polish + transcription + playlists
