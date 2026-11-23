# 0015: Media Indexer Implementation

**Date:** 2026-11-20  
**Status:** Accepted

## Context

We need a service to scan local folders for media files (video, audio, images), extract metadata, and store them in the database. This is Task #2 of the Local Media Library milestone (M3).

## Decision

Implemented `desktop/services/media-indexer.ts` as an EventEmitter-based service with the following characteristics:

### Architecture Choices

1. **EventEmitter Pattern**
   - Chose Node.js EventEmitter over polling for progress updates
   - Allows frontend to subscribe to real-time indexing events
   - Events: `indexing-started`, `indexing-progress`, `indexing-completed`, `indexing-error`, `file-indexed`, `file-failed`

2. **Concurrency Control**
   - Process 5 files concurrently (not all at once)
   - Prevents overwhelming the system with I/O operations
   - Uses Promise.all() with batching for clean concurrency

3. **Two-Stage File Type Detection**
   - Fast path: Check file extension first (no I/O)
   - Fallback: Use file-type library to read file header (accurate MIME type)
   - Handles edge cases where extension doesn't match content

4. **Metadata Extraction Strategy**
   - **Video:** ffprobe (already available) - extracts duration, resolution, codec, bitrate, fps
   - **Audio:** music-metadata (installed) - extracts ID3 tags (artist, album, genre, year)
   - **Image:** sharp (newly installed) - extracts dimensions and format (EXIF extraction deferred to Phase II)

5. **ES Module Imports**
   - `music-metadata` and `file-type` are ES modules
   - Project uses CommonJS (TypeScript compiles to CommonJS)
   - Solution: Dynamic imports in `initialize()` method
   - Lazy-loaded on first use to avoid startup overhead

6. **Database Integration**
   - Check if file already indexed using `getMediaItemByPath()`
   - Skip re-indexing if file size and mtime unchanged (performance optimization)
   - Use `createMediaItem()` for new files, `updateMediaItem()` for changed files
   - Store full absolute file paths (not relative) for local media

7. **Error Handling**
   - Per-file error catching - one corrupt file doesn't stop entire scan
   - Gracefully handle permission errors (EACCES/EPERM)
   - Skip system folders (.git, node_modules, etc.)
   - Log errors with file path for debugging

8. **Cancellation Support**
   - Simple boolean flag checked in scan loop
   - Allows user to stop long-running scans
   - No Promise cancellation tokens (not needed for this use case)

## Consequences

### Positive

- **Performance:** Concurrent processing speeds up large scans
- **Robustness:** Per-file error handling prevents cascading failures
- **Extensibility:** EventEmitter pattern makes it easy to add UI progress indicators
- **Accuracy:** Two-stage detection catches files with wrong extensions
- **Memory efficient:** Streaming approach, processes files in batches

### Negative

- **EXIF support incomplete:** Sharp provides basic metadata only; full EXIF extraction (GPS, camera settings) deferred
- **HEIC support platform-dependent:** Requires libvips with HEIC support on the system
- **No file watching yet:** Changes to indexed files not automatically detected (planned for Phase II)
- **ES module complexity:** Dynamic imports add initialization step (minor DX cost)

### Trade-offs

- **Concurrency limit (5 files):** Balances speed vs. system load; may need tuning for SSDs
- **Full path storage:** Uses more DB space than relative paths, but safer for multi-folder support
- **Eager indexing:** Indexes all files at once rather than on-demand (faster for browsing, slower for initial scan)

## Implementation Notes

- **Dependencies added:** sharp@0.35.5
- **IPC handlers added:** `media:*`, `indexedFolders:*`, `media:scanFolder`, `media:indexFile`
- **Database functions used:** createMediaItem, getMediaItemByPath, updateMediaItem
- **Supported formats:**
  - Video: .mp4, .mkv, .webm, .avi, .mov, .m4v, .flv, .wmv, .mpg, .mpeg, .3gp
  - Audio: .mp3, .m4a, .aac, .flac, .wav, .ogg, .opus, .wma, .alac
  - Images: .jpg, .jpeg, .png, .gif, .webp, .heic, .heif, .bmp, .tiff

## Future Enhancements (Phase II)

1. Add file system watching (chokidar) for automatic re-indexing
2. Full EXIF extraction for images (GPS, camera settings)
3. Thumbnail generation for videos
4. Duplicate detection using file hashing
5. Background indexing on app startup
6. Progress persistence (resume interrupted scans)
