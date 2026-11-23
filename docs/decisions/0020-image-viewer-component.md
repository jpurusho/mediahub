# ADR 0020: Image Viewer Component with Keyboard Navigation

## Problem

When users clicked on image files in the Library:
1. **Wrong viewer:** Tried to open in video player → error message "This cannot be opened in the player"
2. **No preview:** No way to view images in-app (had to open externally)
3. **No navigation:** Couldn't browse through multiple images easily
4. **No zoom:** Couldn't zoom in to see details

This made images a second-class citizen compared to videos.

## Solution

Created a dedicated **ImageViewer** component with:
- ✅ Full-screen image display
- ✅ Keyboard navigation (arrow keys)
- ✅ Zoom in/out functionality
- ✅ Fit-to-screen and actual-size modes
- ✅ Multi-image browsing (navigates through all images in library)
- ✅ Dark background for focus
- ✅ Keyboard shortcuts displayed on-screen

## Implementation

### 1. ImageViewer Component

**File:** `frontend/components/ImageViewer/ImageViewer.tsx`

**Features:**
- Full-screen dialog with dark background
- Top toolbar: title, image counter, zoom controls, close button
- Main image display with fit-to-screen or actual-size modes
- Previous/Next navigation buttons (on-screen)
- Keyboard shortcuts overlay at bottom
- Click image to toggle fit/actual size

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `←` | Previous image |
| `→` | Next image |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Toggle fit-to-screen / actual size |
| `ESC` | Close viewer |

**Props:**
```typescript
{
  images: LibraryItem[];      // All images to browse
  currentIndex: number;        // Which image to show first
  onClose: () => void;         // Close handler
  onNavigate?: (index: number) => void;  // Navigation handler
}
```

### 2. Media Type Detection

Added `getItemMediaType()` helper in Library.tsx:

```typescript
function getItemMediaType(item: LibraryItem): 'video' | 'audio' | 'image' | 'unknown' {
  const ext = item.filePath?.split('.').pop()?.toLowerCase();
  
  // Check extension against known types
  if (imageExts.includes(ext)) return 'image';
  if (audioExts.includes(ext)) return 'audio';
  if (videoExts.includes(ext)) return 'video';
  
  return 'unknown';
}
```

**Supported Image Formats:**
- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)
- WebP (`.webp`)
- HEIC (`.heic`, `.heif`) - macOS native
- BMP (`.bmp`)
- SVG (`.svg`)
- TIFF (`.tiff`)

### 3. Smart Play Handler

Replaced direct `setPlayingItem()` calls with `handlePlayItem()`:

```typescript
function handlePlayItem(item: LibraryItem) {
  const itemType = getItemMediaType(item);
  
  if (itemType === 'image') {
    // Show ImageViewer with all images from current view
    const imageItems = sorted.filter(i => getItemMediaType(i) === 'image');
    setViewingImages({ images: imageItems, currentIndex });
  } else if (itemType === 'video' || itemType === 'audio') {
    // Show VideoPlayer
    setPlayingItem(item);
  } else {
    // Unsupported type
    setSnackbarMessage('This file type is not supported for preview');
  }
}
```

## User Experience

### Viewing Images

**Click any image in Library** → ImageViewer opens

**What you see:**
```
┌─────────────────────────────────────────────────────┐
│ 📸 vacation-photo.jpg          2 / 5   [-] [100%] [+] [⊡] [✕]
├─────────────────────────────────────────────────────┤
│                                                      │
│    [<]           📷 Image displayed here       [>]   │
│                      (full screen)                   │
│                                                      │
├─────────────────────────────────────────────────────┤
│  ← → Navigate  |  + - Zoom  |  0 Fit/Actual  |  ESC Close
└─────────────────────────────────────────────────────┘
```

### Navigation Flow

1. **Open image** → Shows first image
2. **Press `→`** → Next image (resets zoom to fit)
3. **Press `←`** → Previous image
4. **Press `+`** → Zoom in 25%
5. **Click image** → Toggle between fit-to-screen and actual size
6. **Press `ESC`** → Close viewer

### Smart Context

**Filters active?** ImageViewer only shows images matching current filters:
- **Source: Local** → Only browse local images
- **Type: Image** → All images (already filtered)
- **Text filter: "vacation"** → Only vacation images

This means arrow keys navigate through the visible/filtered list!

## Benefits

### 1. Native Image Experience ✅
- No external app needed
- Fast, smooth navigation
- Zoom for detail inspection

### 2. Keyboard-Driven ✅
- Arrow keys for quick browsing
- Zoom shortcuts
- No mouse needed for basic operations

### 3. Context-Aware ✅
- Respects current filters
- Shows image counter (2 / 5)
- Easy to find your place in the collection

### 4. Proper Media Type Handling ✅
- Images → ImageViewer
- Videos → VideoPlayer
- Audio → VideoPlayer (audio mode)
- Unknown → Error message

## Future Enhancements

Consider adding:
- **EXIF data display** - Show camera info, date taken, GPS location
- **Thumbnail strip** at bottom for quick jumping
- **Slideshow mode** - Auto-advance every N seconds
- **Rotation controls** - Rotate 90°
- **Pan when zoomed** - Drag to move around zoomed image
- **Comparison mode** - View 2 images side-by-side
- **Edit actions** - Rotate, crop, adjust (advanced)
- **Touch gestures** - Pinch-to-zoom, swipe navigation (tablet support)

## Testing

Verify:
- [ ] Click image in library → ImageViewer opens
- [ ] Click video → VideoPlayer opens (no change)
- [ ] Arrow keys navigate between images
- [ ] Zoom in/out with +/- keys
- [ ] Toggle fit/actual with 0 key
- [ ] ESC closes viewer
- [ ] On-screen prev/next buttons work
- [ ] Image counter shows correct position
- [ ] Click image toggles fit mode
- [ ] Filters affect which images are browsable
- [ ] HEIC images display correctly (macOS)

## Related Files

- `frontend/components/ImageViewer/ImageViewer.tsx` - New component
- `frontend/pages/Library.tsx` - Updated to use ImageViewer
- `shared/types.ts` - Uses existing LibraryItem type

## Migration Notes

**No breaking changes:**
- Videos still use VideoPlayer
- Audio still uses VideoPlayer
- Only images now use ImageViewer
- All existing functionality preserved
