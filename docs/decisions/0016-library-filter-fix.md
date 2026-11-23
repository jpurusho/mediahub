# ADR 0016: Library Filter Bug Fix

## Issue

After Phase I implementation, users reported that switching filters in the Library page caused the view to go blank:

1. Adding local folder works, videos appear ✓
2. Switching to YouTube/Audio/Image filter → entire view goes blank ✗
3. Navigating away and back shows videos again ✓
4. Once blank, no way to get back to local videos ✗

## Root Cause

The `loadLibrary()` function had **two different code paths**:

```typescript
// OLD CODE (buggy)
if (source === 'youtube') {
  // Used OLD API (library.getAll) - only shows YouTube from old table
  const data = await window.api.library.getAll({ limit: 1000 });
} else {
  // Used NEW API (media.getAll) - shows both YouTube and local from unified table
  const mediaItems = await window.api.media.getAll(opts);
}
```

### Why This Caused Blanking

1. **Initial load** with `source='all'` used `media.getAll()` → showed local videos ✓
2. **Switch to 'youtube'** triggered `library.getAll()` → returned empty (no YouTube videos yet) → blank screen
3. **Switch to 'audio'/'image'** with local videos (but mediaType='video') → `media.getAll()` filtered out videos → blank screen
4. **Navigate away and back** reset `source='all'` → showed videos again

The bug was that it used **two different APIs** instead of always using the unified `media.getAll()`.

## Solution

**Always use the unified `media.getAll()` API** with appropriate filters:

```typescript
// NEW CODE (fixed)
async function loadLibrary() {
  try {
    const opts: any = {
      limit: 1000,
      sortBy: sortField,
      sortOrder: sortOrder,
    };

    // Apply source filter (youtube/local)
    if (source !== 'all') {
      opts.source = source;
    }

    // Apply media type filter (video/audio/image)
    if (mediaType !== 'all') {
      opts.mediaType = mediaType;
    }

    const mediaItems = await window.api.media.getAll(opts);
    // ... convert and set items
  } catch (error) {
    console.error('Failed to load library:', error);
    setItems([]);
  }
}
```

## Expected Behavior After Fix

1. **Add local folder** → videos appear ✓
2. **Filter by source:**
   - All → shows YouTube + local media ✓
   - YouTube → shows only YouTube videos (empty if none exist) ✓
   - Local → shows only local media ✓
3. **Filter by type:**
   - All → shows all media types ✓
   - Video → shows only videos ✓
   - Audio → shows only audio (empty if you only have videos) ✓
   - Image → shows only images (empty if you only have videos) ✓
4. **Combined filters work:** YouTube + Video, Local + Audio, etc. ✓
5. **Empty results show empty state** (not crash or blank unexpectedly) ✓

## Why Empty Is OK

When you filter by:
- **"Audio"** but only have videos → Empty is correct (no audio files)
- **"Image"** but only have videos → Empty is correct (no image files)
- **"YouTube"** but only have local media → Empty is correct (no YouTube videos)

The fix ensures:
- Filters work consistently
- Empty results are intentional, not bugs
- Switching back to "All" or appropriate filters shows your media again

## Migration Note

The database migration (v3) should have migrated existing YouTube videos from `library` table to `media_items` table with `source='youtube'`. If users have old YouTube videos:

1. They should appear when `source='youtube'` or `source='all'`
2. New YouTube downloads should also go to `media_items` (needs separate verification)

## Testing

After fix, verify:
- [ ] Add local folder with videos → videos appear
- [ ] Switch to "Local" → videos still visible
- [ ] Switch to "All" → videos still visible
- [ ] Switch to "Audio" → empty (correct, you have videos)
- [ ] Switch back to "All" → videos reappear
- [ ] Switch to "Video" → videos appear
- [ ] Add folder with audio files → audio appears when "Audio" selected
- [ ] Filters combine correctly (Local + Video, YouTube + Audio, etc.)

## Additional Fix: Filter UI Visibility

### Second Issue Discovered

After the first fix, users still reported that **filter buttons disappeared** when results were empty.

**Root cause:** The filter UI was conditionally rendered:
```typescript
{items.length > 0 && (
  // Filter buttons here
)}
```

When filters resulted in empty results, `items.length === 0` and the filter buttons **disappeared**, trapping users with no way to change filters back!

### Solution

**Always show filter buttons**, regardless of whether there are results:
```typescript
// OLD: Conditional rendering
{items.length > 0 && (<ToggleButtonGroup...>)}

// NEW: Always visible
<ToggleButtonGroup...>
```

Also improved the empty state message:
- Before: "Your library is empty. Download a video to get started."
- After: "Your library is empty. Download a video or add a local folder to get started."
- Added hint: "Try changing the filters above to see your content." (when filters are active)

## Related Files

- `frontend/pages/Library.tsx` - Fixed in this file (two fixes applied)
- `desktop/services/database.ts` - Provides `getMediaItems()` API
- `desktop/ipc-handlers.ts` - Exposes `media:getAll` handler
- `shared/types.ts` - Defines `MediaItem` interface
