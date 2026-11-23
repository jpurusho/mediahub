# Changelog

All notable changes to MediaHub will be documented in this file.

## [2.0.0] - 2026-11-23

### 🎉 Major Release: YouTube Downloader → MediaHub

**Breaking Changes:**
- Renamed from "YTD" to "MediaHub"
- Unified media library replaces YouTube-only focus
- Database schema v4 (automatic migration)

### ✨ New Features

#### Local Media Library
- **Multi-format support:** Videos (MP4, MKV, AVI, etc.), Audio (MP3, M4A, FLAC, etc.), Images (JPG, PNG, GIF, etc.), HTML files
- **Folder management:** Add/remove local folders with automatic indexing
- **File watching:** Real-time updates when files are added/removed
- **Media type filtering:** Filter by video, audio, image, or HTML
- **Source filtering:** Filter by YouTube downloads or local files

#### Image Viewer
- **Smooth zoom:** Mouse wheel for continuous zoom (0.5x - 5x)
- **Pan support:** Drag to explore zoomed images
- **Click to zoom:** Click image to toggle 2x zoom
- **Keyboard shortcuts:** ESC (close), +/- (zoom), 0 (reset), arrows (navigate)
- **Gallery navigation:** Previous/next buttons for image collections
- **CSS transform-based:** GPU-accelerated, buttery smooth performance

#### HTML Viewer
- **Full JavaScript support:** Execute scripts, load external resources
- **Sandboxed iframe:** Secure execution with controlled permissions
- **Relative paths:** CSS, JS, and images load correctly via base tag
- **Interactive content:** Data visualizations, documentation, reports, SPAs
- **Keyboard shortcuts:** ESC (close), Cmd+R (refresh)
- **Open in browser:** Launch system browser for full DevTools

#### Folder & File Management
- **Manage Folders UI:** View all indexed folders with paths and scan timestamps
- **Cascade delete:** Removing folder deletes all media items from library
- **Individual delete:** Select and delete specific items
- **Optional disk deletion:** Choose whether to delete physical files
- **Playlist cleanup:** Automatic removal from playlists when items deleted
- **Physical files protected:** Never deleted unless explicitly requested

#### Transcription
- **Local video support:** Transcribe local videos, not just YouTube
- **Dual table lookup:** Checks both legacy and new media tables

### 🐛 Bug Fixes

#### Image Viewer
- Fixed Electron window drag region intercepting clicks
- Fixed close button (X) not responding
- Fixed zoom buttons jumping to extremes instead of gradual steps
- Fixed scroll-to-zoom requiring Ctrl/Cmd modifier
- Removed preventDefault warnings from wheel events

#### HTML Viewer  
- Fixed "Not allowed to load local resource" error
- Uses srcdoc instead of file:// URLs for security
- Relative resource paths now work correctly

#### Database & Indexing
- Fixed HTML files failing CHECK constraint
- Added migration v4 for HTML media type support
- Fixed column count mismatch in migration
- Fixed HTML files not being indexed (missing switch case)

#### Delete Operations
- Fixed delete button only working for YouTube videos
- Now works for all media types (HTML, images, local videos, etc.)
- Both "Delete selected" and "Remove folder" work consistently

### 🏗️ Technical Improvements

#### Architecture
- Database schema v4 with HTML support
- Unified media_items table for all media types
- Automatic migrations with transaction safety
- MediaItem type extended with HTML support

#### UI/UX
- Removed MUI Dialog dependency for viewers (simpler, faster)
- WebkitAppRegion: 'no-drag' fixes for all toolbars
- Improved confirmation dialogs with clear explanations
- Item count feedback on delete operations
- Better snackbar messages

#### Performance
- CSS transforms for zoom (GPU-accelerated)
- Smooth transitions with ease-out curves
- No layout reflows during zoom/pan
- Efficient iframe srcdoc rendering

### 📝 Documentation
- ADR 0023: Smooth Image Zoom with Pan Support
- ADR 0024: Transcription Local Video Support
- ADR 0025: Remove MUI Dialog from Image Viewer
- ADR 0026: HTML File Viewer with Full JavaScript Support

### 🔄 Migration Notes

**From v1.x to v2.0:**
- Database automatically migrates to v4 on first launch
- All existing YouTube downloads preserved
- Local folders need to be added manually
- No data loss, fully backward compatible

**What's Preserved:**
- YouTube download history
- Library items
- Playlists
- Transcripts
- Settings

**What's New:**
- media_items table (replaces library for new content)
- indexed_folders table (tracks local folder sources)
- HTML media type support

---

## [1.9.9] - Previous Release

YouTube-focused downloader with library management.

---

**Legend:**
- ✨ New Features
- 🐛 Bug Fixes
- 🏗️ Technical Improvements
- 📝 Documentation
- 🔄 Migration Notes
