import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';
import { createMediaItem, getMediaItemByPath, updateMediaItem } from './database';
import type { MediaItem } from '../../shared/types';

// Dynamic imports for ES modules
let parseFile: any;
let fileTypeFromFile: any;

const execAsync = promisify(exec);

// Supported file extensions
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.flv', '.wmv', '.mpg', '.mpeg', '.3gp'];
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus', '.wma', '.alac'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp', '.tiff'];
const HTML_EXTENSIONS = ['.html', '.htm'];
const JSON_EXTENSIONS = ['.json'];
const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];
const PDF_EXTENSIONS = ['.pdf'];

// Folders to skip during scanning
const SKIP_FOLDERS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  '$RECYCLE.BIN',
  'System Volume Information',
  '.Trashes',
  '.Spotlight-V100',
  '.fseventsd',
  '.TemporaryItems',
]);

export interface IndexProgress {
  filesFound: number;
  filesProcessed: number;
  filesFailed: number;
  currentFile: string;
  totalSize: number;
}

interface VideoMetadata {
  duration?: number;
  resolution?: string;
  codec?: string;
  bitrate?: number;
  fps?: number;
  createdAt?: string;
}

interface AudioMetadata {
  duration?: number;
  bitrate?: number;
  artist?: string;
  album?: string;
  year?: number;
  genre?: string;
}

interface ImageMetadata {
  width?: number;
  height?: number;
  format?: string;
  dateTaken?: string;
  cameraMake?: string;
  cameraModel?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * MediaIndexer - Scans local folders and indexes media files
 *
 * Events:
 * - 'indexing-started': { folderPath: string }
 * - 'indexing-progress': IndexProgress
 * - 'indexing-completed': { filesProcessed: number, filesFailed: number, duration: number }
 * - 'indexing-error': { error: string }
 * - 'file-indexed': { filePath: string, mediaItem: MediaItem }
 * - 'file-failed': { filePath: string, error: string }
 */
export class MediaIndexer extends EventEmitter {
  private cancelled = false;
  private initialized = false;
  private progress: IndexProgress = {
    filesFound: 0,
    filesProcessed: 0,
    filesFailed: 0,
    currentFile: '',
    totalSize: 0,
  };

  /**
   * Initialize ES module imports
   */
  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load music-metadata (ES module)
      const musicMetadata = await import('music-metadata');
      parseFile = musicMetadata.parseFile;

      // Load file-type (ES module)
      const fileType = await import('file-type');
      fileTypeFromFile = fileType.fileTypeFromFile;

      this.initialized = true;
    } catch (error: any) {
      console.error('[MediaIndexer] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Scan a folder for media files and index them
   */
  async scanFolder(folderPath: string, recursive = true): Promise<void> {
    // Initialize ES module imports
    await this.initialize();

    this.cancelled = false;
    this.progress = {
      filesFound: 0,
      filesProcessed: 0,
      filesFailed: 0,
      currentFile: '',
      totalSize: 0,
    };

    const startTime = Date.now();

    try {
      // Verify folder exists
      const stats = await fs.stat(folderPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${folderPath}`);
      }

      this.emit('indexing-started', { folderPath });

      // Find all media files
      const files = await this.findMediaFiles(folderPath, recursive);
      this.progress.filesFound = files.length;
      this.emitProgress();

      // Process files with concurrency limit (5 files at a time)
      const concurrency = 5;
      for (let i = 0; i < files.length; i += concurrency) {
        if (this.cancelled) {
          console.log('[MediaIndexer] Indexing cancelled by user');
          break;
        }

        const batch = files.slice(i, i + concurrency);
        await Promise.all(
          batch.map(async (filePath) => {
            try {
              this.progress.currentFile = path.basename(filePath);
              this.emitProgress();

              const mediaItem = await this.indexFile(filePath);
              if (mediaItem) {
                this.emit('file-indexed', { filePath, mediaItem });
              }
              this.progress.filesProcessed++;
            } catch (error: any) {
              console.error(`[MediaIndexer] Failed to index ${filePath}:`, error.message);
              this.emit('file-failed', { filePath, error: error.message });
              this.progress.filesFailed++;
            } finally {
              this.emitProgress();
            }
          })
        );
      }

      const duration = Date.now() - startTime;
      this.emit('indexing-completed', {
        filesProcessed: this.progress.filesProcessed,
        filesFailed: this.progress.filesFailed,
        duration,
      });
    } catch (error: any) {
      console.error('[MediaIndexer] Indexing error:', error);
      this.emit('indexing-error', { error: error.message });
      throw error;
    }
  }

  /**
   * Index a single file - detect type, extract metadata, store in database
   */
  async indexFile(filePath: string): Promise<MediaItem | null> {
    // Initialize ES module imports
    await this.initialize();

    try {
      // Get file stats
      const stats = await fs.stat(filePath);
      const fileSize = stats.size;
      const fileModifiedAt = stats.mtime.toISOString();
      const fileCreatedAt = stats.birthtime.toISOString();

      // Check if already indexed and unchanged
      const existing = await getMediaItemByPath(filePath);
      if (existing && existing.fileSize === fileSize && existing.fileModifiedAt === fileModifiedAt) {
        console.log(`[MediaIndexer] File unchanged, skipping: ${path.basename(filePath)}`);
        return existing as unknown as MediaItem;
      }

      // Detect media type
      const mediaType = await this.detectMediaType(filePath);
      if (!mediaType) {
        console.log(`[MediaIndexer] Unsupported file type: ${filePath}`);
        return null;
      }

      // Extract metadata based on type
      let metadata: VideoMetadata | AudioMetadata | ImageMetadata = {};
      let duration = 0;

      switch (mediaType) {
        case 'video':
          metadata = await this.extractVideoMetadata(filePath);
          duration = (metadata as VideoMetadata).duration || 0;
          break;
        case 'audio':
          metadata = await this.extractAudioMetadata(filePath);
          duration = (metadata as AudioMetadata).duration || 0;
          break;
        case 'image':
          metadata = await this.extractImageMetadata(filePath);
          break;
        case 'html':
        case 'document':
          // HTML and document files don't need metadata extraction
          // Title comes from filename, no duration/dimensions needed
          break;
      }

      // Generate source ID from file path hash
      const sourceId = this.generateSourceId(filePath);

      // Get title from filename (without extension)
      const title = path.basename(filePath, path.extname(filePath));

      // Create or update media item in database
      if (existing) {
        // Update existing item
        updateMediaItem(existing.id, {
          title,
          fileSize,
          duration,
          fileModifiedAt,
          fileCreatedAt,
          mimeType: await this.getMimeType(filePath),
          fileExtension: path.extname(filePath),
          // Video metadata
          ...(mediaType === 'video' && {
            videoResolution: (metadata as VideoMetadata).resolution || null,
            videoCodec: (metadata as VideoMetadata).codec || null,
            videoBitrate: (metadata as VideoMetadata).bitrate || null,
            videoFps: (metadata as VideoMetadata).fps || null,
          }),
          // Audio metadata
          ...(mediaType === 'audio' && {
            audioArtist: (metadata as AudioMetadata).artist || null,
            audioAlbum: (metadata as AudioMetadata).album || null,
            audioYear: (metadata as AudioMetadata).year || null,
            audioGenre: (metadata as AudioMetadata).genre || null,
            audioBitrate: (metadata as AudioMetadata).bitrate || null,
          }),
          // Image metadata
          ...(mediaType === 'image' && {
            imageWidth: (metadata as ImageMetadata).width || null,
            imageHeight: (metadata as ImageMetadata).height || null,
            imageCameraMake: (metadata as ImageMetadata).cameraMake || null,
            imageCameraModel: (metadata as ImageMetadata).cameraModel || null,
            imageDateTaken: (metadata as ImageMetadata).dateTaken || null,
            imageLatitude: (metadata as ImageMetadata).latitude || null,
            imageLongitude: (metadata as ImageMetadata).longitude || null,
          }),
        });

        console.log(`[MediaIndexer] Updated: ${path.basename(filePath)}`);
        return existing as unknown as MediaItem;
      } else {
        // Create new item
        const mediaItemId = createMediaItem({
          source: 'local',
          sourceId,
          title,
          mediaType,
          filePath,
          fileSize,
          duration,
          mimeType: await this.getMimeType(filePath),
          fileExtension: path.extname(filePath),
          fileModifiedAt,
          fileCreatedAt,
          // Video metadata
          ...(mediaType === 'video' && {
            videoResolution: (metadata as VideoMetadata).resolution || undefined,
            videoCodec: (metadata as VideoMetadata).codec || undefined,
            videoBitrate: (metadata as VideoMetadata).bitrate || undefined,
            videoFps: (metadata as VideoMetadata).fps || undefined,
          }),
          // Audio metadata
          ...(mediaType === 'audio' && {
            audioArtist: (metadata as AudioMetadata).artist || undefined,
            audioAlbum: (metadata as AudioMetadata).album || undefined,
            audioYear: (metadata as AudioMetadata).year || undefined,
            audioGenre: (metadata as AudioMetadata).genre || undefined,
            audioBitrate: (metadata as AudioMetadata).bitrate || undefined,
          }),
          // Image metadata
          ...(mediaType === 'image' && {
            imageWidth: (metadata as ImageMetadata).width || undefined,
            imageHeight: (metadata as ImageMetadata).height || undefined,
            imageCameraMake: (metadata as ImageMetadata).cameraMake || undefined,
            imageCameraModel: (metadata as ImageMetadata).cameraModel || undefined,
            imageDateTaken: (metadata as ImageMetadata).dateTaken || undefined,
            imageLatitude: (metadata as ImageMetadata).latitude || undefined,
            imageLongitude: (metadata as ImageMetadata).longitude || undefined,
          }),
        });

        console.log(`[MediaIndexer] Indexed: ${path.basename(filePath)} (ID: ${mediaItemId})`);

        // Return the created item (simplified - in production would fetch from DB)
        return {
          id: mediaItemId,
          source: 'local',
          sourceId,
          title,
          mediaType,
          filePath,
          fileSize,
          duration,
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as MediaItem;
      }
    } catch (error: any) {
      console.error(`[MediaIndexer] Error indexing file ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Detect media type from file extension and MIME type
   */
  async detectMediaType(filePath: string): Promise<'video' | 'audio' | 'image' | 'html' | 'document' | null> {
    const ext = path.extname(filePath).toLowerCase();

    // Quick extension check first (fast path)
    if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
    if (AUDIO_EXTENSIONS.includes(ext)) return 'audio';
    if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
    if (HTML_EXTENSIONS.includes(ext)) return 'html';
    if (JSON_EXTENSIONS.includes(ext)) return 'document';
    if (MARKDOWN_EXTENSIONS.includes(ext)) return 'document';
    if (PDF_EXTENSIONS.includes(ext)) return 'document';

    // Fallback: Use file-type library (reads file header)
    try {
      const type = await fileTypeFromFile(filePath);
      if (!type) return null;

      if (type.mime.startsWith('video/')) return 'video';
      if (type.mime.startsWith('audio/')) return 'audio';
      if (type.mime.startsWith('image/')) return 'image';
      if (type.mime === 'text/html') return 'html';
      if (type.mime === 'application/json') return 'document';
      if (type.mime === 'text/markdown') return 'document';
    } catch (error) {
      console.error(`[MediaIndexer] Failed to detect file type for ${filePath}:`, error);
    }

    return null;
  }

  /**
   * Extract video metadata using ffprobe
   */
  private async extractVideoMetadata(filePath: string): Promise<VideoMetadata> {
    try {
      const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`;
      const { stdout } = await execAsync(cmd, { timeout: 10000 });
      const data = JSON.parse(stdout);

      const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');
      const format = data.format || {};

      return {
        duration: format.duration ? Math.floor(parseFloat(format.duration)) : undefined,
        resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : undefined,
        codec: videoStream?.codec_name,
        bitrate: format.bit_rate ? parseInt(format.bit_rate) : undefined,
        fps: videoStream?.r_frame_rate ? this.parseFps(videoStream.r_frame_rate) : undefined,
        createdAt: format.tags?.creation_time || undefined,
      };
    } catch (error: any) {
      console.error(`[MediaIndexer] Failed to extract video metadata: ${error.message}`);
      return {};
    }
  }

  /**
   * Extract audio metadata using music-metadata
   */
  private async extractAudioMetadata(filePath: string): Promise<AudioMetadata> {
    try {
      const metadata = await parseFile(filePath);

      return {
        duration: metadata.format.duration ? Math.floor(metadata.format.duration) : undefined,
        bitrate: metadata.format.bitrate || undefined,
        artist: metadata.common.artist || undefined,
        album: metadata.common.album || undefined,
        year: metadata.common.year || undefined,
        genre: metadata.common.genre?.[0] || undefined,
      };
    } catch (error: any) {
      console.error(`[MediaIndexer] Failed to extract audio metadata: ${error.message}`);
      return {};
    }
  }

  /**
   * Extract image metadata using sharp
   */
  private async extractImageMetadata(filePath: string): Promise<ImageMetadata> {
    try {
      const metadata = await sharp(filePath).metadata();

      // Extract EXIF data if available
      let exifData: any = {};
      if (metadata.exif) {
        // Parse EXIF data from buffer
        try {
          // Sharp provides EXIF as a buffer - we'd need exif-parser for detailed extraction
          // For now, just extract basic dimensions
          exifData = {};
        } catch (exifError) {
          console.error('[MediaIndexer] Failed to parse EXIF:', exifError);
        }
      }

      return {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        dateTaken: exifData.DateTimeOriginal || undefined,
        cameraMake: exifData.Make || undefined,
        cameraModel: exifData.Model || undefined,
        latitude: exifData.GPSLatitude || undefined,
        longitude: exifData.GPSLongitude || undefined,
      };
    } catch (error: any) {
      console.error(`[MediaIndexer] Failed to extract image metadata: ${error.message}`);
      return {};
    }
  }

  /**
   * Recursively find all media files in a directory
   */
  private async findMediaFiles(dirPath: string, recursive: boolean): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        if (this.cancelled) break;

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip system folders
          if (SKIP_FOLDERS.has(entry.name)) {
            continue;
          }

          // Recurse into subdirectories if enabled
          if (recursive) {
            const subFiles = await this.findMediaFiles(fullPath, recursive);
            files.push(...subFiles);
          }
        } else if (entry.isFile()) {
          // Check if file has a supported extension
          const ext = path.extname(entry.name).toLowerCase();
          if (
            VIDEO_EXTENSIONS.includes(ext) ||
            AUDIO_EXTENSIONS.includes(ext) ||
            IMAGE_EXTENSIONS.includes(ext) ||
            HTML_EXTENSIONS.includes(ext) ||
            JSON_EXTENSIONS.includes(ext) ||
            MARKDOWN_EXTENSIONS.includes(ext) ||
            PDF_EXTENSIONS.includes(ext)
          ) {
            files.push(fullPath);
          }
        }
      }
    } catch (error: any) {
      // Handle permission errors gracefully
      if (error.code === 'EACCES' || error.code === 'EPERM') {
        console.warn(`[MediaIndexer] Permission denied: ${dirPath}`);
      } else {
        console.error(`[MediaIndexer] Error reading directory ${dirPath}:`, error.message);
      }
    }

    return files;
  }

  /**
   * Get MIME type for a file
   */
  private async getMimeType(filePath: string): Promise<string | null> {
    try {
      const type = await fileTypeFromFile(filePath);
      return type?.mime || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate a unique source ID from file path
   */
  private generateSourceId(filePath: string): string {
    // Simple hash function for source ID
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `local-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Parse frame rate from ffprobe format (e.g., "30/1" -> 30)
   */
  private parseFps(fpsString: string): number | undefined {
    try {
      const parts = fpsString.split('/');
      if (parts.length === 2) {
        const numerator = parseFloat(parts[0]);
        const denominator = parseFloat(parts[1]);
        return denominator !== 0 ? numerator / denominator : undefined;
      }
      return parseFloat(fpsString);
    } catch {
      return undefined;
    }
  }

  /**
   * Emit progress event (throttled to avoid excessive events)
   */
  private emitProgress(): void {
    this.emit('indexing-progress', { ...this.progress });
  }

  /**
   * Cancel ongoing indexing operation
   */
  cancel(): void {
    this.cancelled = true;
  }

  /**
   * Get current progress
   */
  getProgress(): IndexProgress {
    return { ...this.progress };
  }
}

// Export singleton instance
export const indexer = new MediaIndexer();
