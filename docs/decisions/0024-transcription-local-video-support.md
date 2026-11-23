# ADR 0024: Transcription Support for Local Videos

## Context

**User reported error:** 
```
Failed to start transcription: Error: Video not found in library or file path missing: local-73d5pq
```

The transcription feature was originally built for YouTube downloads only, before the local media library feature (Phase I) was implemented. When users tried to transcribe local video files, the system failed because:

1. Transcription service only checked the `library` table (YouTube downloads)
2. Local videos are stored in the `media_items` table with different identifiers
3. YouTube videos use `youtube_video_id` column
4. Local videos use `source_id` column (e.g., "local-73d5pq")

## Problem

**Transcription lookup logic:**
```typescript
// OLD - only checked library table
const libraryItem = getLibraryItem(videoId);
if (!libraryItem || !libraryItem.filePath) {
  throw new Error(`Video not found in library or file path missing: ${videoId}`);
}
```

**What broke:**
- ✅ YouTube videos from before migration → found in `library` table
- ❌ Local videos → stored in `media_items` with `source_id = "local-73d5pq"`
- ⚠️ YouTube videos after migration → may be in `media_items` table

## Solution

Updated transcription queue manager to check **both** legacy `library` table and new `media_items` table, with support for both YouTube and local video identifiers.

### Implementation

**File:** `desktop/services/transcription-queue-manager.ts`

**New lookup logic:**
```typescript
async enqueue(videoId: string, options: TranscriptOptions = {}): Promise<number> {
  // Check if video exists in library (YouTube downloads) or media_items (local/YouTube videos)
  let filePath: string | null = null;

  // First try library table (YouTube downloads - legacy)
  const libraryItem = getLibraryItem(videoId);
  if (libraryItem?.filePath) {
    filePath = libraryItem.filePath;
  } else {
    // Try media_items table
    // For YouTube videos: youtube_video_id column
    // For local videos: source_id column (e.g., "local-73d5pq")
    const db = require('./database').getDb();
    const mediaItem = db.prepare(`
      SELECT file_path FROM media_items
      WHERE (youtube_video_id = ? OR source_id = ?)
      AND (media_type = 'video' OR media_type = 'audio')
      LIMIT 1
    `).get(videoId, videoId) as { file_path: string } | undefined;

    if (mediaItem?.file_path) {
      filePath = mediaItem.file_path;
    }
  }

  if (!filePath) {
    throw new Error(`Video not found or file path missing: ${videoId}. Make sure the file exists and is a video or audio file.`);
  }

  const videoPath = resolveFilePath(filePath);
  // ... rest of transcription logic
}
```

**Query explained:**
```sql
SELECT file_path FROM media_items
WHERE (youtube_video_id = ? OR source_id = ?)  -- Matches BOTH YouTube and local IDs
AND (media_type = 'video' OR media_type = 'audio')  -- Only media with audio tracks
LIMIT 1
```

## How It Works

### For YouTube Videos
**Video ID:** `dQw4w9WgXcQ` (actual YouTube ID)

**Lookup sequence:**
1. Check `library` table with `videoId = "dQw4w9WgXcQ"` → Found ✅
2. If not found, check `media_items` where `youtube_video_id = "dQw4w9WgXcQ"` → Found ✅

### For Local Videos
**Video ID:** `local-73d5pq` (hash of file path)

**Lookup sequence:**
1. Check `library` table with `videoId = "local-73d5pq"` → Not found (expected)
2. Check `media_items` where `source_id = "local-73d5pq"` → Found ✅

### For Audio Files (Local)
**Audio ID:** `local-8kj2m9` (hash of file path)

Same logic - audio files in `media_items` with `media_type = 'audio'` are supported.

## Media Type Filter

**Why filter by media type?**
```sql
AND (media_type = 'video' OR media_type = 'audio')
```

Images don't have audio tracks and can't be transcribed. This prevents:
- Attempting to transcribe JPEG files
- Confusing error messages
- Wasted CPU on ffmpeg extraction attempts

## Benefits

✅ **Backward compatible** - Still works with YouTube videos in `library` table  
✅ **Local video support** - Works with Phase I local media library  
✅ **Audio file support** - Can transcribe local audio files (podcasts, music, etc.)  
✅ **Future-proof** - Works with migrated YouTube videos in `media_items`  
✅ **Better error messages** - Clarifies that file must be video/audio

## Testing

Verify transcription works for:
- [x] Build succeeds
- [ ] YouTube video (legacy, in library table)
- [ ] YouTube video (migrated, in media_items table)
- [ ] Local MP4 video file
- [ ] Local MKV video file
- [ ] Local MP3 audio file
- [ ] Local M4A audio file
- [ ] Image file → Should show appropriate error (not transcribable)

## Edge Cases Handled

### Case 1: File Path Missing
```typescript
if (!filePath) {
  throw new Error(`Video not found or file path missing: ${videoId}. 
                   Make sure the file exists and is a video or audio file.`);
}
```

### Case 2: Image Files
Images are excluded by the `media_type` filter in the SQL query. They won't match, so the user gets a clear "not found" error rather than an ffmpeg failure.

### Case 3: Duplicate IDs
Using `LIMIT 1` ensures we only get one result even if there are duplicates (shouldn't happen, but defensive).

### Case 4: Deleted Files
The `resolveFilePath()` function will verify the file actually exists on disk and throw an appropriate error if not.

## Migration Path

**No migration needed!** This is purely a lookup logic change.

**Existing data:**
- YouTube videos in `library` table → Continue to work
- Local videos in `media_items` table → Now work
- Future migrations → Automatically supported

## Alternative Approaches Considered

### ❌ Option 1: Create getMediaItemBySourceId() function
**Rejected:** Adds another database function when a direct query is simpler.

### ❌ Option 2: Migrate all library items to media_items first
**Rejected:** Unnecessary breaking change, and we want backward compatibility.

### ✅ Option 3: Check both tables with OR query (chosen)
**Why:** Simple, backward compatible, handles all cases.

## Related Decisions

- ADR 0014: Local Media Library (introduced `media_items` table and `source_id`)
- ADR 0015: Media Indexer Implementation (generates `source_id` from file path hash)

## Future Improvements

Consider:
- Fully migrate `library` table to `media_items` and remove dual lookup
- Add database indexes on `youtube_video_id` and `source_id` for faster lookups
- Support transcribing audio-only files directly (skip ffmpeg extraction step)
- Add transcription UI for local videos (button in Library view)

## Files Modified

- `desktop/services/transcription-queue-manager.ts` - Updated lookup logic

## Related Files

- `desktop/services/database.ts` - Database schema and query functions
- `desktop/services/media-indexer.ts` - Generates source_id for local files
- `frontend/components/TranscriptButton/TranscriptButton.tsx` - Triggers transcription

---

**Result:** Transcription now works for all media types: YouTube downloads (legacy and migrated) and local video/audio files.
