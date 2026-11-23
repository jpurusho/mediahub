# ADR 0019: Dashboard Media Library Statistics

## Context

After Phase I implementation, the dashboard didn't reflect local media at all. Users couldn't see:
- How many local files they've added
- Breakdown between YouTube vs Local content
- Distribution of media types (video, audio, image)

The dashboard only showed YouTube-centric stats (downloads, storage), making local media invisible at a glance.

## Decision

Add a **"Media Library"** section to the dashboard showing:

### 1. Source Breakdown (WHERE media comes from)
- YouTube downloads (with YouTube icon)
- Local files (with computer icon)
- Total count

### 2. Type Breakdown (WHAT kind of media)
- Videos (with video icon)
- Audio (with audio icon)
- Images (with image icon)
- Future: PDF, Markdown, PowerPoint, Word

## Implementation

### Data Source

Uses the existing `media:getStats` IPC handler which returns:
```typescript
{
  total: number,
  youtube: number,
  local: number,
  byType: {
    video: number,
    audio: number,
    image: number,
    // Future: pdf, markdown, powerpoint, word
  }
}
```

### UI Design

**Two-column layout:**

```
┌─────────────────────────────────────────────────────┐
│ Media Library                                        │
├─────────────────────────┬───────────────────────────┤
│ BY SOURCE              │ BY TYPE                    │
│                        │                            │
│ 🔴 YouTube      15     │ 📹 Videos        18       │
│ 💻 Local Files  8      │ 🎵 Audio         3        │
│ ─────────────────      │ 🖼️  Images        2       │
│ Total           23     │                            │
└─────────────────────────┴───────────────────────────┘
```

### Visual Features

- **Icons with color coding:**
  - YouTube → Red (#FF0000)
  - Local → Primary theme color
  - Videos → Secondary theme color
  - Audio → Success green
  - Images → Warning orange

- **Conditional rendering:**
  - Only shows "Media Library" section if `mediaStats.total > 0`
  - Only shows media types that have content (e.g., no "Images: 0" if you have no images)
  - Graceful fallback if API fails

- **Responsive:**
  - Desktop: 2 columns side-by-side
  - Mobile: Stacks vertically (xs={12} sm={6})

## Benefits

### User Visibility ✅
- See local media stats at a glance
- Understand content distribution
- Quick overview without navigating to Library

### Scalability ✅
- Easy to add new media types (Phase II: PDF, Markdown)
- Just add new items to byType object
- UI automatically shows them with appropriate icons

### Consistency ✅
- Matches filter terminology (Source + Type)
- Same color coding as Library filters
- Familiar icons from Library page

## Future Enhancements

### Phase II (Documents)
When adding PDF and Markdown support:

```typescript
{mediaStats.byType.pdf > 0 && (
  <Box display="flex" alignItems="center" justifyContent="space-between">
    <Box display="flex" alignItems="center" gap={1}>
      <PictureAsPdfIcon sx={{ fontSize: 18, color: 'error.main' }} />
      <Typography variant="body2">PDFs</Typography>
    </Box>
    <Typography variant="body2" fontWeight={600}>{mediaStats.byType.pdf}</Typography>
  </Box>
)}
```

### Possible Enhancements
- **Click to filter:** Click "Videos" → navigate to Library filtered by videos
- **Storage by type:** Show how much space each type uses
- **Recent additions:** "5 videos added today"
- **Percentage breakdown:** Show pie chart or bar chart
- **Trends:** "↑ 3 more than last week"

## Example Scenarios

### Scenario 1: Pure YouTube User
```
BY SOURCE              BY TYPE
🔴 YouTube      42     📹 Videos        42
💻 Local Files   0     
─────────────────      
Total           42     
```

### Scenario 2: Mixed Content User
```
BY SOURCE              BY TYPE
🔴 YouTube      15     📹 Videos        18
💻 Local Files  23     🎵 Audio         15
─────────────────      🖼️  Images         5
Total           38     
```

### Scenario 3: Local-Only User (your use case)
```
BY SOURCE              BY TYPE
🔴 YouTube       0     📹 Videos        12
💻 Local Files  12     
─────────────────      
Total           12     
```

### Scenario 4: Diverse Media Library (Phase III)
```
BY SOURCE              BY TYPE
🔴 YouTube      20     📹 Videos        25
💻 Local Files  45     🎵 Audio         15
─────────────────      🖼️  Images        10
Total           65     📄 PDFs          8
                       📝 Markdown      5
                       📊 PowerPoint    2
```

## Implementation Details

**File:** `frontend/pages/DashboardPage.tsx`

**Changes:**
- Added icons: VideoLibraryIcon, AudiotrackIcon, ImageIcon, YouTubeIcon, ComputerIcon
- Added `mediaStats` state with proper typing
- Loaded `media.getStats()` in parallel with existing data
- Added conditional "Media Library" section with 2-column grid
- Source breakdown shows YouTube vs Local with total
- Type breakdown shows only types with content > 0

**Error Handling:**
- `.catch(() => ({ total: 0, ... }))` if API fails
- Section hidden if `total === 0` (new users)
- Graceful rendering if some types are 0

## Testing

Verify:
- [ ] Dashboard shows "Media Library" section after adding local media
- [ ] Source counts are correct (YouTube vs Local)
- [ ] Type counts are correct (Video, Audio, Image)
- [ ] Only non-zero types are shown
- [ ] Icons and colors display correctly
- [ ] Responsive layout works on mobile
- [ ] Section hidden when no media exists
- [ ] API errors don't crash dashboard

## Related Files

- `frontend/pages/DashboardPage.tsx` - Updated
- `desktop/ipc-handlers.ts` - Provides `media:getStats` handler
- `desktop/services/database.ts` - Implements `getMediaItemStats()`
- `shared/types.ts` - Type definitions
