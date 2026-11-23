# ADR 0018: Scalable Type Filter with Dropdown

## Problem

The media type filter used horizontal toggle buttons which doesn't scale:

**Current (Phase I):**
```
Type: [All] [Video] [Audio] [Image]
```

**Future (Phase II + III):**
```
Type: [All] [Video] [Audio] [Image] [PDF] [Markdown] [PowerPoint] [Word] [...]
```

This becomes too wide and cluttered as we add more media types in future phases.

## Solution

**Convert Type filter from Toggle Buttons to Dropdown Select:**

**Before:**
```typescript
<ToggleButtonGroup value={mediaType} ...>
  <ToggleButton value="all">All</ToggleButton>
  <ToggleButton value="video">Video</ToggleButton>
  <ToggleButton value="audio">Audio</ToggleButton>
  <ToggleButton value="image">Image</ToggleButton>
</ToggleButtonGroup>
```

**After:**
```typescript
<Select value={mediaType} ...>
  <MenuItem value="all">All Types</MenuItem>
  <MenuItem value="video">Video</MenuItem>
  <MenuItem value="audio">Audio</MenuItem>
  <MenuItem value="image">Image</MenuItem>
  {/* Future: PDF, Markdown, PowerPoint, Word */}
</Select>
```

## Benefits

### Scalability ✅
- Can add unlimited media types without UI crowding
- Dropdown automatically handles 10+ items with scrolling
- Maintains clean, compact layout

### Consistency ✅
- Source filter (3 options) → Toggle buttons (good for few options)
- Type filter (4+ options, growing) → Dropdown (good for many options)
- View mode (2 options) → Toggle buttons (good for binary choice)

### Future-Proof ✅
Easy to add new types in future phases:

**Phase II (Documents):**
```typescript
<MenuItem value="pdf">PDF</MenuItem>
<MenuItem value="markdown">Markdown</MenuItem>
```

**Phase III (Office):**
```typescript
<MenuItem value="powerpoint">PowerPoint</MenuItem>
<MenuItem value="word">Word</MenuItem>
<MenuItem value="excel">Excel</MenuItem>
```

**Beyond:**
```typescript
<MenuItem value="spreadsheet">Spreadsheet</MenuItem>
<MenuItem value="presentation">Presentation</MenuItem>
<MenuItem value="ebook">eBook</MenuItem>
// ... any future types
```

## Design Decisions

### Why Keep Source as Toggle Buttons?

**Source has only 3 options (fixed):**
- All
- YouTube
- Local

This won't grow, so toggle buttons are appropriate. They provide:
- Quick visual scanning
- One-click selection
- Clear indication of current choice

### Why Change Type to Dropdown?

**Type will grow significantly:**
- Phase I: 4 options (All, Video, Audio, Image)
- Phase II: +2 options (PDF, Markdown) = 6 total
- Phase III: +3 options (PowerPoint, Word, Excel) = 9 total
- Future: Could reach 10-15+ types

Dropdown provides:
- Compact footprint (same size regardless of option count)
- Scrollable list when needed
- Professional appearance
- Standard UI pattern for "select one from many"

## UI Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Search box................................]                 │
│                                                               │
│ Source: [All] [YouTube] [Local]                              │
│                                                               │
│ Type: [All Types ▼]              |    [List] [Grid]         │
└─────────────────────────────────────────────────────────────┘

When dropdown is clicked:
┌──────────────┐
│ All Types    │
│ Video       │
│ Audio       │
│ Image       │
│ PDF         │ ← Future
│ Markdown    │ ← Future
└──────────────┘
```

## Playlist Behavior (Clarification)

### Library View (Filters Active)
When viewing **Library**, filters work:
- **Source filter:** All / YouTube / Local
- **Type filter:** All / Video / Audio / Image / etc.
- These combine to narrow results

### Playlist View (Filters Ignored)
When viewing **a specific Playlist**:
- Show **all items in that playlist**
- Ignore source/type filters (or hide them)
- Playlists can contain mixed types:
  - YouTube videos
  - Local videos
  - Audio files
  - Images (brief display or skip)
  - Future: PDFs, documents

### Playlist Playback
When playing a playlist:
- Play items in sequence
- Videos → play normally
- Audio → play audio (show album art if available)
- Images → display for 3-5 seconds, then next
- Documents → skip or show preview

### Why Mixed Types Are OK
Playlists are **user-curated collections**:
- User decides what goes together
- Example use cases:
  - "Learning Materials" → videos + PDFs + audio lectures
  - "Music Videos" → YouTube videos + local music videos + audio tracks
  - "Vacation Photos" → images + video clips
  - "Presentations" → PowerPoint + videos + images

**The user controls content, not automatic filtering.**

## Implementation

**File:** `frontend/pages/Library.tsx`

**Changes:**
- Added `Select` and `FormControl` to MUI imports
- Replaced `ToggleButtonGroup` with `FormControl + Select`
- Changed "All" → "All Types" for clarity
- Added comment indicating where future types will be added
- Maintained exact same functionality (only UI changed)
- Kept Source filter as toggle buttons (only 3 options)

## Migration Path

### Adding New Types (Phase II Example)

When adding PDF support:

1. **Update database:** Add 'pdf' to mediaType enum
2. **Update types:** Add to MediaType union in shared/types.ts
3. **Update UI:** Add one line to Library.tsx:
   ```typescript
   <MenuItem value="pdf">PDF</MenuItem>
   ```

That's it! The dropdown scales automatically.

### Backward Compatibility

Existing behavior unchanged:
- ✅ Same filter logic
- ✅ Same state management
- ✅ Same URL/localStorage persistence
- ✅ Only UI presentation changed

## Testing

Verify:
- [ ] Dropdown appears with "All Types" selected by default
- [ ] Clicking dropdown shows all 4 options (All Types, Video, Audio, Image)
- [ ] Selecting an option filters correctly
- [ ] Filters still combine (Source + Type)
- [ ] Selected value displays in dropdown
- [ ] Dropdown styling matches theme
- [ ] Responsive on smaller screens

## Future Enhancements

Consider:
- **Icons in dropdown items** (video icon, audio icon, etc.)
- **Type counts** (e.g., "Video (24)", "Audio (8)")
- **Recently used types** at top of list
- **Search within dropdown** if types exceed 20+
- **Multi-select** for "show video AND audio" (advanced feature)

## Related Decisions

- ADR-0017: Filter UI Clarity (added Source/Type labels)
- ADR-0014: Local Media Library (original Phase I design)
- M3 Plan: Phase II and III media type roadmap
