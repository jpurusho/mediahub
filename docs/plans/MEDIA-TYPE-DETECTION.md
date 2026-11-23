# Media Type Detection Reference

## Phase I Supported Types

### Video Formats
```typescript
const VIDEO_EXTENSIONS = [
  '.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v',
  '.flv', '.wmv', '.mpg', '.mpeg', '.3gp'
];

const VIDEO_MIME_TYPES = [
  'video/mp4', 'video/x-matroska', 'video/webm',
  'video/x-msvideo', 'video/quicktime', 'video/x-m4v'
];
```

**Metadata to extract (using ffprobe):**
```bash
ffprobe -v quiet -print_format json -show_format -show_streams "file.mp4"
```
- Duration (seconds)
- Resolution (width x height)
- Codec (h264, vp9, etc.)
- Bitrate
- Frame rate
- Creation date (`creation_time` tag)

### Audio Formats
```typescript
const AUDIO_EXTENSIONS = [
  '.mp3', '.m4a', '.aac', '.flac', '.wav',
  '.ogg', '.opus', '.wma', '.alac'
];

const AUDIO_MIME_TYPES = [
  'audio/mpeg', 'audio/mp4', 'audio/aac',
  'audio/flac', 'audio/wav', 'audio/ogg'
];
```

**Metadata to extract (using music-metadata):**
```typescript
import { parseFile } from 'music-metadata';

const metadata = await parseFile(filePath);
// Extract:
// - duration (metadata.format.duration)
// - bitrate (metadata.format.bitrate)
// - sampleRate (metadata.format.sampleRate)
// - ID3 tags:
//   - title (metadata.common.title)
//   - artist (metadata.common.artist)
//   - album (metadata.common.album)
//   - year (metadata.common.year)
//   - genre (metadata.common.genre)
//   - albumArtist (metadata.common.albumartist)
```

### Image Formats
```typescript
const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.heic', '.heif', '.bmp', '.tiff', '.svg'
];

const IMAGE_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif',
  'image/webp', 'image/heic', 'image/heif'
];
```

**Metadata to extract (using sharp + exif-parser):**
```typescript
import sharp from 'sharp';
import ExifParser from 'exif-parser';

// Basic image info
const sharpMeta = await sharp(filePath).metadata();
// - width (sharpMeta.width)
// - height (sharpMeta.height)
// - format (sharpMeta.format)
// - space (sharpMeta.space) - color space
// - hasAlpha (sharpMeta.hasAlpha)

// EXIF data (for JPEG)
const buffer = await fs.readFile(filePath);
const parser = ExifParser.create(buffer);
const exif = parser.parse();
// - DateTimeOriginal (when photo taken)
// - Make, Model (camera info)
// - GPSLatitude, GPSLongitude (location)
// - FNumber, ExposureTime, ISO (camera settings)
// - Orientation (rotation)
```

**HEIC Handling:**
- macOS: Use `sips` command or CoreImage APIs
- Cross-platform: Convert to JPEG using `sharp` (requires libvips with HEIC support)
```bash
# Install sharp with HEIC support
npm install sharp --platform=darwin --arch=arm64
```

## Detection Algorithm

```typescript
async function detectMediaType(filePath: string): Promise<'video' | 'audio' | 'image' | null> {
  const ext = path.extname(filePath).toLowerCase();
  
  // Quick extension check first
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  
  // Fallback: Use file-type library (reads file header)
  try {
    const { fileTypeFromFile } = await import('file-type');
    const type = await fileTypeFromFile(filePath);
    
    if (!type) return null;
    
    if (type.mime.startsWith('video/')) return 'video';
    if (type.mime.startsWith('audio/')) return 'audio';
    if (type.mime.startsWith('image/')) return 'image';
  } catch (error) {
    console.error('Failed to detect file type:', error);
  }
  
  return null;
}
```

## Metadata Extraction Strategy

### Video Metadata Extraction
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

async function extractVideoMetadata(filePath: string) {
  const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
  const { stdout } = await execAsync(cmd);
  const data = JSON.parse(stdout);
  
  const videoStream = data.streams.find(s => s.codec_type === 'video');
  
  return {
    duration: Math.floor(parseFloat(data.format.duration || 0)),
    resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : null,
    codec: videoStream?.codec_name,
    bitrate: parseInt(data.format.bit_rate || 0),
    createdAt: data.format.tags?.creation_time || null,
  };
}
```

### Audio Metadata Extraction
```typescript
import { parseFile } from 'music-metadata';

async function extractAudioMetadata(filePath: string) {
  const metadata = await parseFile(filePath);
  
  return {
    duration: Math.floor(metadata.format.duration || 0),
    bitrate: metadata.format.bitrate || null,
    sampleRate: metadata.format.sampleRate || null,
    // ID3 tags
    title: metadata.common.title || null,
    artist: metadata.common.artist || null,
    album: metadata.common.album || null,
    year: metadata.common.year || null,
    genre: metadata.common.genre?.[0] || null,
    albumArtist: metadata.common.albumartist || null,
  };
}
```

### Image Metadata Extraction
```typescript
import sharp from 'sharp';

async function extractImageMetadata(filePath: string) {
  const metadata = await sharp(filePath).metadata();
  
  // TODO: Add EXIF extraction using exif-parser for JPEG files
  
  return {
    width: metadata.width,
    height: metadata.height,
    format: metadata.format,
    space: metadata.space,
    hasAlpha: metadata.hasAlpha,
    // EXIF data (if available)
    exif: metadata.exif ? parseExif(metadata.exif) : null,
  };
}
```

## Error Handling

### Common Issues

1. **File is locked/in use:**
   - Skip file, log warning
   - Retry on next scan

2. **Corrupted file:**
   - ffprobe/sharp/music-metadata will throw
   - Catch error, mark file as "unreadable"
   - Store error message in database

3. **Unsupported format:**
   - Extension recognized but metadata extraction fails
   - Store basic info (path, size, dates) but no media-specific metadata

4. **Permission denied:**
   - Log error with file path
   - Show in UI as "Access denied"

### Graceful Degradation
```typescript
async function safeExtractMetadata(filePath: string, mediaType: string) {
  try {
    switch (mediaType) {
      case 'video': return await extractVideoMetadata(filePath);
      case 'audio': return await extractAudioMetadata(filePath);
      case 'image': return await extractImageMetadata(filePath);
    }
  } catch (error) {
    console.error(`Failed to extract ${mediaType} metadata:`, error);
    return {
      error: error.message,
      duration: null,
      resolution: null,
      // ... null for all fields
    };
  }
}
```

## Performance Considerations

1. **Batch processing:**
   - Process 5-10 files concurrently
   - Don't block UI thread

2. **Caching:**
   - Hash file path + mtime + size
   - If unchanged, reuse metadata from database

3. **Progress reporting:**
   - Emit event every 10 files or every 500ms
   - Show: files found, processed, skipped, current file

4. **Interruption:**
   - Allow user to cancel indexing
   - Resume from last processed file on next scan

## Testing Checklist

- [ ] Detect video files correctly
- [ ] Detect audio files correctly  
- [ ] Detect image files correctly
- [ ] Extract duration for video/audio
- [ ] Extract resolution for video
- [ ] Extract ID3 tags for audio
- [ ] Extract EXIF for images
- [ ] Handle corrupted files gracefully
- [ ] Handle permission errors
- [ ] Handle HEIC images on macOS
- [ ] Process nested folders recursively
- [ ] Report progress accurately
- [ ] Support cancellation
- [ ] Handle 1,000+ files without freezing UI
