# Image Viewer Debug Instructions

## ⚠️ IMPORTANT: Open Browser Console FIRST

**Before testing anything:**
1. Restart the app: `npm start`
2. **Open Developer Tools:** `View > Developer > Developer Tools` (or `Cmd+Option+I` on Mac)
3. Click the **Console** tab
4. Keep it open while testing

---

## 🧪 Test Each Action and Copy Console Output

### Test 1: Open Image Viewer
**Action:** Click any image in Library

**Expected console output:**
```
[ImageViewer] Component mounted/updated
[ImageViewer] Setting up wheel listener...
[ImageViewer] ✅ Container ref exists: ...
[ImageViewer] Container dimensions: 1920 x 1080
[ImageViewer] ✅ Attaching wheel listener with { passive: false }
```

**❌ If you see:**
```
[ImageViewer] ❌ Container ref is NULL! Cannot attach wheel listener
```
→ **This is the problem!** Copy the full console output.

---

### Test 2: Scroll to Zoom
**Action:** Move mouse over the image and scroll your mouse wheel

**Expected console output:**
```
[ImageViewer] ===== WHEEL EVENT FIRED =====
[ImageViewer] deltaY: -53 deltaMode: 0
[ImageViewer] Zoom: 1.000000 -> 1.106000
[ImageViewer] ===== WHEEL EVENT FIRED =====
[ImageViewer] deltaY: 42 deltaMode: 0
[ImageViewer] Zoom: 1.106000 -> 1.022000
```

**❌ If you see NOTHING:**
→ Wheel events are not reaching the container. Copy what you DO see.

---

### Test 3: Click X Button
**Action:** Click the X button in top-right corner

**Expected console output:**
```
[ImageViewer] ===== CLOSE BUTTON CLICKED =====
[ImageViewer] Event target: ...
[ImageViewer] Event currentTarget: ...
[ImageViewer] ===== CLOSE HANDLER CALLED =====
```

**❌ If you see the first line but NOT "CLOSE HANDLER CALLED":**
→ handleClose is not being called. Copy the full output.

**❌ If you see NOTHING:**
→ Click event is not firing. Copy what you DO see.

---

### Test 4: Zoom Buttons (+/-)
**Action:** Click the + button

**Expected console output:**
```
[ImageViewer] ===== ZOOM IN BUTTON CLICKED =====
[ImageViewer] Zoom: 1 -> 1.25
```

**Action:** Click the - button

**Expected console output:**
```
[ImageViewer] ===== ZOOM OUT BUTTON CLICKED =====
[ImageViewer] Zoom: 1.25 -> 1
```

**❌ If zooms jump to max/min:**
→ Check the zoom values in console. If you see `1 -> 5` or `1 -> 0.5`, that's the bug.

---

### Test 5: ESC Key
**Action:** Press ESC key

**Expected console output:**
```
[ImageViewer] Key pressed: Escape
[ImageViewer] ===== ESC KEY PRESSED =====
[ImageViewer] ===== CLOSE HANDLER CALLED =====
```

---

## 📋 What to Copy-Paste

**After running ALL 5 tests above, copy the ENTIRE console output and paste it.**

Include:
- ✅ All `[ImageViewer]` messages
- ✅ Any error messages in red
- ✅ Any warnings in yellow

**Don't include:**
- ❌ React DevTools suggestions
- ❌ Electron window warnings (we already saw those)

---

## 🔍 Common Issues and What They Mean

| Problem | What Console Shows | Root Cause |
|---------|-------------------|------------|
| **Scroll doesn't zoom** | No "WHEEL EVENT FIRED" messages | Wheel listener not attached OR Dialog blocking events |
| **X button doesn't work** | "CLOSE BUTTON CLICKED" but no "CLOSE HANDLER CALLED" | Event handler issue |
| **X button does nothing** | No console output at all | Click being blocked by something else |
| **Zoom jumps to max/min** | Zoom values jump (1 -> 5 or 1 -> 0.5) | Wrong calculation (should be 0.25 increments) |

---

## ⚡ Quick Check

**If you see this setup message:**
```
[ImageViewer] ✅ Container ref exists
[ImageViewer] ✅ Attaching wheel listener
```

**But NO wheel events when you scroll:**
→ The issue is MUI Dialog or browser capturing scroll events

**If you don't even see the setup message:**
→ The component isn't rendering properly

---

## 🎯 Next Steps

1. Run ALL 5 tests above
2. Copy the ENTIRE console output
3. Paste it in your reply
4. I'll diagnose the exact issue from the logs

This comprehensive debugging will pinpoint the problem immediately.
