# 0013 — Atomic update downloads with integrity verification

**Status:** accepted  
**Date:** 2026-11-17  
**Supersedes:** 0012 (enhances the fallback download mechanism)

## Context

The in-app update downloader (fallback for electron-updater code-signing failures) had a critical bug: when network connections dropped mid-download, partial files could survive integrity checks and appear in ~/Downloads as "complete" downloads. Users attempting to extract these corrupted files would get "error 94: bad zipfile structure".

The original implementation (v1.9.6) added:
- Byte count verification (downloaded === Content-Length)
- Zip magic number validation (PK signature check)

But it had three flaws:
1. **Non-atomic writes**: Downloaded directly to final path, not a temp file
2. **Race condition**: `file.on('finish')` could fire before response ended
3. **Incomplete cleanup**: Validation failures didn't always remove partial files

This created a bootstrap problem: users couldn't use the buggy updater to download the fix.

## Decision

Implement atomic downloads with robust connection tracking (v1.9.9):

```typescript
const tempPath = `${destPath}.download`;  // Write to temp file first

res.on('end', () => { responseEnded = true; });  // Track response lifecycle

file.on('finish', () => {
  // 1. Check response ended cleanly
  if (!responseEnded) return reject('Connection closed before completion');
  
  // 2. Verify byte count
  if (downloaded !== totalBytes) { cleanup(); return reject(...); }
  
  // 3. Verify zip magic number
  const isZip = header[0] === 0x50 && header[1] === 0x4B;
  if (!isZip) { cleanup(); return reject(...); }
  
  // 4. All checks passed - atomic move
  fs.renameSync(tempPath, destPath);
});
```

**Key changes:**
- Temp file (`.download` suffix) during download
- Track `response.on('end')` to detect premature closes
- Cleanup helper always removes temp files on failure
- Atomic rename only on success

## Consequences

**Positive:**
- Corrupted files never appear in ~/Downloads
- Users can't accidentally extract partial downloads
- Atomic rename is filesystem-guaranteed
- Bootstrap problem solved: once installed, updater is reliable

**Negative:**
- Requires 2× disk space during download (temp + final)
- Extra I/O for rename operation (negligible for 200 MB files)

**Patterns established:**
- For critical downloads: always use temp files + atomic rename
- Always track response lifecycle, not just stream events
- Validation must happen before finalizing file location

**Related:**
- See 0012 for the original fallback download mechanism
- See 0003 for dependency update strategy (yt-dlp updates)
