# ADR 0021: HTTP-Based Image Serving (Avoiding file:// Protocol)

## Context

After implementing the ImageViewer component (ADR 0020), images weren't displaying. The component tried to use `file://${filePath}` directly in `<img>` tags, which doesn't work in Electron due to security restrictions.

**User feedback:** "When I view that, it opens a pop-up window but then I only see the name of the image in the center of the screen... the picture itself is not seen."

**Key insight from user:** "Do you recall that the file protocol always had a problem and we decided to serve everything over HTTP? I'm not sure how it works for the local images and local videos but I think we still need to continue to use the same protocol instead of using the file column protocol (which we ran into several issues with before)."

## Prior Art

The app **already** uses HTTP-based serving for videos:
- **Development:** Vite middleware at `http://localhost:5173/video?path={filePath}`
- **Production:** Node HTTP server at `http://localhost:{port}/video?path={filePath}`

This pattern was adopted after custom protocols (`local-media://`) had security conflicts with Electron (seekable: 0-0 issue). HTTP-based serving is more reliable and follows web standards.

## Decision

**Extend the existing HTTP pattern to images:**

### 1. Add `/image` Endpoint to HTTP Server

**File:** `desktop/index.ts` (production server)

Added endpoint alongside `/video`:

```typescript
// Image serving endpoint
if (url.pathname === '/image') {
  const imagePath = url.searchParams.get('path');
  if (!imagePath || !fs.existsSync(imagePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const stat = fs.statSync(imagePath);
  const fileSize = stat.size;
  const ext = path.extname(imagePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'image/jpeg';

  res.writeHead(200, {
    'Content-Length': fileSize,
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600', // Cache images for 1 hour
  });
  fs.createReadStream(imagePath).pipe(res);
  return;
}
```

**Supported MIME types:**
- `.png` → image/png
- `.jpg`, `.jpeg` → image/jpeg
- `.gif` → image/gif
- `.webp` → image/webp
- `.heic`, `.heif` → image/heic, image/heif
- `.bmp` → image/bmp
- `.tiff`, `.tif` → image/tiff

### 2. Add Vite Middleware for Development

**File:** `vite.config.ts`

Renamed plugin from `video-streaming` to `media-streaming` and added `/image` handler:

```typescript
// Image serving endpoint
if (req.url?.startsWith('/image?')) {
  const url = new URL(req.url, 'http://localhost');
  const imagePath = url.searchParams.get('path');
  // ... same logic as production server
}
```

### 3. Add IPC Handler

**File:** `desktop/ipc-handlers.ts`

Added `app:getImageFileUrl` handler (mirrors `app:getVideoFileUrl`):

```typescript
ipcMain.handle('app:getImageFileUrl', (_event, filePath: string) => {
  const fs = require('fs');
  if (!path.isAbsolute(filePath)) {
    const outputDir = getOutputDir();
    filePath = path.join(outputDir, filePath);
  }
  if (!fs.existsSync(filePath)) {
    return { error: 'File not found. It may have been moved or deleted.' };
  }
  const isDev = !require('electron').app.isPackaged;
  const port = isDev ? '5173' : require('./index').getProdServerPort();
  return { url: `http://localhost:${port}/image?path=${encodeURIComponent(filePath)}` };
});
```

### 4. Expose in Preload

**File:** `desktop/preload.ts`

```typescript
getImageFileUrl: (filePath: string) => ipcRenderer.invoke('app:getImageFileUrl', filePath),
```

### 5. Update TypeScript Types

**File:** `shared/types.ts`

Added to ElectronAPI.app:

```typescript
getImageFileUrl: (filePath: string) => Promise<{ url?: string; error?: string }>;
```

### 6. Update ImageViewer Component

**File:** `frontend/components/ImageViewer/ImageViewer.tsx`

**Before (broken):**
```typescript
const getImageSrc = (image) => {
  if (image.filePath) {
    return `file://${image.filePath}`; // ❌ Doesn't work in Electron
  }
  return image.thumbnailUrl || '';
};
```

**After (working):**
```typescript
useEffect(() => {
  async function loadImage() {
    setLoading(true);
    setError('');

    try {
      if (currentImage.filePath) {
        const result = await window.api.app.getImageFileUrl(currentImage.filePath);
        if (result.error) {
          setError(result.error);
        } else if (result.url) {
          setImageSrc(result.url); // ✅ HTTP URL
        }
      }
    } catch (err) {
      setError('Failed to load image');
    } finally {
      setLoading(false);
    }
  }

  loadImage();
}, [currentImage]);
```

## Benefits

### Consistency ✅
- **Same pattern for all media types:** Videos, audio, and images all use HTTP serving
- **One mental model:** Always get URL via IPC, never use `file://` directly
- **Unified endpoint structure:** `/video?path=...`, `/image?path=...`

### Security ✅
- **No direct file access from renderer:** Renderer never touches file paths directly
- **Sandboxing maintained:** Electron's security model preserved
- **Path validation:** Backend validates file existence before serving

### Reliability ✅
- **No protocol conflicts:** Avoids issues with custom protocols (seekable: 0-0)
- **Standard HTTP:** Follows web standards, works in all browsers
- **Proper error handling:** 404 for missing files, proper MIME types

### Performance ✅
- **Caching:** `Cache-Control: public, max-age=3600` for images (videos already streamed)
- **Efficient streaming:** `fs.createReadStream().pipe(res)` for large images
- **No base64 overhead:** No need to encode/decode images

## Why NOT Other Approaches?

### ❌ Option 1: Direct `file://` protocol
- Blocked by Electron security
- User confirmed: "we ran into several issues with before"
- Would break in future Electron versions

### ❌ Option 2: Custom protocol (`image://`)
- Same issues as `local-media://` (seekable: 0-0)
- Adds complexity vs. HTTP
- Inconsistent with video pattern

### ❌ Option 3: Base64 data URLs
- Requires reading entire file into memory
- IPC overhead for large images
- No caching benefits
- Slower for HEIC/large files

### ✅ Option 4: HTTP endpoints (chosen)
- Already proven with videos
- Standard, reliable, cacheable
- Minimal code changes

## Testing

Verify:
- [x] Images display in ImageViewer (dev mode)
- [ ] Images display in ImageViewer (production build)
- [ ] All formats work (JPEG, PNG, HEIC, GIF, WebP)
- [ ] Error handling: missing files show error message
- [ ] Navigation between images works smoothly
- [ ] Zoom controls work with loaded images
- [ ] Caching headers reduce server load on repeated views
- [ ] Dev server (Vite) and prod server handle `/image` identically

## Related Files

- `desktop/index.ts` - Production HTTP server with `/image` endpoint
- `vite.config.ts` - Dev HTTP server (Vite middleware)
- `desktop/ipc-handlers.ts` - IPC handler for `app:getImageFileUrl`
- `desktop/preload.ts` - Exposes API to renderer
- `shared/types.ts` - TypeScript types
- `frontend/components/ImageViewer/ImageViewer.tsx` - Uses new API

## Related Decisions

- ADR 0020: Image Viewer Component (created the viewer, but images didn't load)
- Original decision to use HTTP for videos (mentioned in desktop/index.ts comments)

## Migration Notes

**No breaking changes:**
- ✅ Videos still work the same way
- ✅ Audio still works the same way
- ✅ Only images now use the new `/image` endpoint
- ✅ All existing functionality preserved
