# ADR 0026: HTML File Viewer with Full JavaScript Support

## Context

**User request:** "Include an HTML file viewer. If I have some nice HTML with JavaScript and other things, I should be able to view them just like in the browser. Because it's an Electron framework, which has all browser components, it should be easy to do that as well."

The media library supports video, audio, and images. Adding HTML support allows users to view:
- Interactive HTML documents
- Data visualizations (D3.js, Chart.js, etc.)
- Documentation pages
- Web-based reports
- Standalone web applications

## Solution

### 1. **Media Type Detection**

Added HTML as a recognized media type throughout the system:

**media-indexer.ts:**
```typescript
const HTML_EXTENSIONS = ['.html', '.htm'];

async detectMediaType(filePath: string): Promise<'video' | 'audio' | 'image' | 'html' | null> {
  const ext = path.extname(filePath).toLowerCase();
  if (HTML_EXTENSIONS.includes(ext)) return 'html';
  // ... other types
}
```

**Database schema:**
```sql
media_type TEXT NOT NULL CHECK(media_type IN ('video', 'audio', 'image', 'html', 'document'))
```

### 2. **IPC Handler for HTML Files**

Added handler to serve HTML via `file://` protocol (not HTTP):

**ipc-handlers.ts:**
```typescript
ipcMain.handle('app:getHTMLFileUrl', (_event, filePath: string) => {
  const fs = require('fs');
  if (!fs.existsSync(filePath)) {
    return { error: 'File not found. It may have been moved or deleted.' };
  }
  // Use file:// protocol so relative resources (CSS, JS, images) work
  const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
  return { url: fileUrl };
});
```

**Why file:// instead of HTTP:**
- Relative paths in HTML (`./styles.css`, `../images/logo.png`) work correctly
- JavaScript imports work
- Same-origin policy allows resources in the same folder
- No need for a custom HTTP endpoint

### 3. **HTMLViewer Component**

Created full-screen viewer similar to ImageViewer:

**Key features:**
```typescript
<iframe
  src={htmlUrl}
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
  style={{ width: '100%', height: '100%', border: 'none' }}
/>
```

**Sandbox attributes:**
- `allow-scripts` - Execute JavaScript
- `allow-same-origin` - Access localStorage, fetch resources
- `allow-forms` - Submit forms
- `allow-popups` - Open new windows (for external links)
- `allow-modals` - alert(), confirm(), prompt()

**Toolbar features:**
- **Close button** (X) - ESC key also works
- **Refresh button** - Reload HTML (Cmd+R shortcut)
- **Open in browser** - Opens in system default browser for full browser DevTools

**Electron window drag fix:**
- Added `WebkitAppRegion: 'no-drag'` to toolbar
- Same fix as ImageViewer (ADR 0025)

### 4. **Library Integration**

**Updated Library.tsx:**
```typescript
const [viewingHTML, setViewingHTML] = useState<LibraryItem | null>(null);

function handlePlayItem(item: LibraryItem) {
  const itemType = getItemMediaType(item);
  
  if (itemType === 'html') {
    setViewingHTML(item);
  }
  // ... other types
}

{viewingHTML && (
  <HTMLViewer
    filePath={viewingHTML.filePath}
    title={viewingHTML.title}
    onClose={() => setViewingHTML(null)}
  />
)}
```

**Media type filter:**
- Added "HTML" option to filter dropdown
- HTML files appear in library grid/list view

---

## Security Considerations

### **Sandbox Restrictions**

The iframe sandbox prevents:
- ❌ Top-level navigation (can't redirect parent window)
- ❌ Plugin execution (no Flash, Java applets)
- ❌ Pointer lock API
- ❌ Presentation API
- ❌ Automatic downloads (without user interaction)

### **What's Allowed**

✅ **JavaScript execution** - Full ES6+ support, async/await, modules  
✅ **Fetch/XHR** - Can load external resources (APIs, CDNs)  
✅ **LocalStorage/SessionStorage** - Per-origin storage  
✅ **Canvas/WebGL** - Graphics rendering  
✅ **Web Workers** - Background JavaScript threads  
✅ **External scripts** - Can load from CDN (jQuery, React, etc.)

### **file:// Protocol Implications**

**Security trade-off:**
- Each `file://` document has its own origin
- Cross-document access is restricted
- Local file access is limited to same-directory resources

**Why this is safe:**
- User is viewing their own files (not untrusted content)
- Sandbox prevents malicious scripts from escaping iframe
- No access to Electron's Node.js APIs from iframe

---

## Use Cases

### **1. Data Visualizations**
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://d3js.org/d3.v7.min.js"></script>
</head>
<body>
  <div id="chart"></div>
  <script>
    // D3.js visualization code
    const data = [30, 86, 168, 281, 303, 365];
    d3.select("#chart")
      .selectAll("div")
      .data(data)
      .enter()
      .append("div")
      .style("width", d => d + "px")
      .text(d => d);
  </script>
</body>
</html>
```

### **2. Documentation**
- Local documentation sites (MkDocs, Sphinx, Docusaurus output)
- HTML exports from Google Docs
- Saved web pages (File → Save As → Web Page Complete)

### **3. Interactive Reports**
- Business dashboards
- Analytics reports
- Survey results visualizations

### **4. Single-page Applications**
- React/Vue/Angular apps (built, not dev server)
- Web-based tools and utilities
- Games built with Phaser, PixiJS, etc.

---

## Technical Details

### **File Structure**
```
frontend/components/HTMLViewer/
  └── HTMLViewer.tsx          (new)

desktop/
  ├── ipc-handlers.ts         (added getHTMLFileUrl)
  ├── preload.ts              (added getHTMLFileUrl)
  └── services/
      ├── media-indexer.ts    (added HTML detection)
      └── database.ts         (updated schema + types)

shared/types.ts               (updated MediaItem type)
frontend/pages/Library.tsx    (added HTML viewer integration)
```

### **Type Changes**
```typescript
// Before
mediaType: 'video' | 'audio' | 'image' | 'document'

// After
mediaType: 'video' | 'audio' | 'image' | 'html' | 'document'
```

---

## Testing

### **Manual Test Cases**
- [ ] Scan folder with .html files
- [ ] HTML files appear in Library with correct media type
- [ ] Filter by "HTML" shows only HTML files
- [ ] Click HTML file opens HTMLViewer in fullscreen
- [ ] JavaScript executes (test with `alert()`)
- [ ] External resources load (CDN scripts, images)
- [ ] Relative resources load (`./style.css`, `../img/logo.png`)
- [ ] Refresh button (top toolbar) reloads HTML
- [ ] Close button (X) closes viewer
- [ ] ESC key closes viewer
- [ ] Cmd+R refreshes HTML
- [ ] "Open in browser" button launches system browser

### **Example Test Files**

**simple.html:**
```html
<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body>
  <h1>Hello World</h1>
  <button onclick="alert('JavaScript works!')">Click Me</button>
</body>
</html>
```

**with-cdn.html:**
```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
  <canvas id="myChart"></canvas>
  <script>
    new Chart(document.getElementById('myChart'), {
      type: 'bar',
      data: { labels: ['A', 'B', 'C'], datasets: [{ data: [12, 19, 3] }] }
    });
  </script>
</body>
</html>
```

---

## Limitations

### **Current Limitations**
1. **No browser DevTools** - Use "Open in browser" button to debug
2. **No URL bar** - Can't navigate to other pages (single-document viewer)
3. **No multi-page navigation** - Clicking links with `target="_blank"` opens in system browser
4. **No browser extensions** - No ad blockers, password managers, etc.

### **Not Supported**
- ❌ WASM debugging (use browser)
- ❌ Service Workers (requires HTTPS or localhost)
- ❌ Notifications API (would require Electron permissions)
- ❌ Geolocation (no GPS access)
- ❌ Camera/Microphone (no hardware access)

### **Workarounds**
- **Debugging:** Click "Open in browser" → Full browser DevTools
- **Multi-page sites:** Open index.html, navigation works if relative links
- **Advanced features:** Most web APIs work, but browser is better for development

---

## Future Enhancements

Consider:
- **Browser-style navigation** - Back/forward buttons, URL bar
- **Developer console** - Embedded mini-console for console.log output
- **Network inspector** - Show fetch/XHR requests
- **Multiple tabs** - Open multiple HTML files side-by-side
- **PDF viewer** - Render PDFs using pdf.js (similar approach)
- **Markdown viewer** - Render .md files as HTML

---

## Alternative Approaches Considered

### ❌ Option 1: HTTP Endpoint (like images)
**Rejected:** Breaks relative paths. HTML with `<img src="./logo.png">` wouldn't work because HTTP endpoint serves single file.

### ❌ Option 2: BrowserView API
**Rejected:** More complex, requires Electron APIs, harder to integrate with React.

### ✅ Option 3: iframe with file:// (chosen)
**Why:** Simple, works with relative paths, sandboxed for security, full JavaScript support.

---

## Related Decisions

- ADR 0025: Remove MUI Dialog from Image Viewer (Electron window drag fix)
- ADR 0021: HTTP-Based Image Serving (similar pattern, but file:// for HTML)

---

## Files Modified

**New files:**
- `frontend/components/HTMLViewer/HTMLViewer.tsx`
- `docs/decisions/0026-html-file-viewer.md`

**Modified files:**
- `desktop/services/media-indexer.ts` - HTML detection
- `desktop/services/database.ts` - Schema + types
- `desktop/ipc-handlers.ts` - getHTMLFileUrl handler
- `desktop/preload.ts` - Expose getHTMLFileUrl to renderer
- `shared/types.ts` - MediaItem type
- `frontend/pages/Library.tsx` - HTML viewer integration

---

**Result:** Full-featured HTML viewer with JavaScript support, sandboxed security, and seamless integration with the media library. Users can view interactive HTML documents just like in a browser.
