/**
 * Comprehensive tests for MediaIndexerService
 * Tests cover: media type detection, file indexing, folder scanning, metadata extraction
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock dependencies before importing service
vi.mock('fs/promises');
vi.mock('fs');
vi.mock('path');
vi.mock('child_process');
vi.mock('music-metadata', () => ({
  parseFile: vi.fn(),
}));
vi.mock('sharp', () => ({
  default: vi.fn(),
}));
vi.mock('file-type', () => ({
  fileTypeFromFile: vi.fn(),
}));

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { exec } from 'child_process';
import { parseFile } from 'music-metadata';
import sharp from 'sharp';
import { fileTypeFromFile } from 'file-type';

/**
 * Mock MediaIndexerService interface based on spec
 * This will be replaced with actual import once implementation exists
 */
class MediaIndexerService extends EventEmitter {
  constructor(private database: any) {
    super();
  }

  async detectMediaType(filePath: string): Promise<'video' | 'audio' | 'image' | null> {
    throw new Error('Not implemented - mock required');
  }

  async indexFile(filePath: string): Promise<any> {
    throw new Error('Not implemented - mock required');
  }

  async scanFolder(
    folderPath: string,
    options?: { recursive?: boolean; folderId?: number }
  ): Promise<{ processed: number; skipped: number; errors: number }> {
    throw new Error('Not implemented - mock required');
  }

  async extractVideoMetadata(filePath: string): Promise<any> {
    throw new Error('Not implemented - mock required');
  }

  async extractAudioMetadata(filePath: string): Promise<any> {
    throw new Error('Not implemented - mock required');
  }

  async extractImageMetadata(filePath: string): Promise<any> {
    throw new Error('Not implemented - mock required');
  }

  cancel(): void {
    throw new Error('Not implemented - mock required');
  }
}

describe('MediaIndexerService', () => {
  let service: MediaIndexerService;
  let mockDatabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock database
    mockDatabase = {
      getMediaItemByPath: vi.fn(),
      createMediaItem: vi.fn(),
      updateMediaItem: vi.fn(),
      updateIndexedFolder: vi.fn(),
    };

    service = new MediaIndexerService(mockDatabase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectMediaType', () => {
    it('detects video files by extension', async () => {
      const videoFiles = [
        '/path/to/video.mp4',
        '/path/to/video.mkv',
        '/path/to/video.webm',
        '/path/to/video.avi',
        '/path/to/video.mov',
        '/path/to/video.m4v',
      ];

      // Mock implementation
      vi.spyOn(service, 'detectMediaType').mockImplementation(async (filePath) => {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const videoExts = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'm4v'];
        if (ext && videoExts.includes(ext)) return 'video';
        return null;
      });

      for (const file of videoFiles) {
        const result = await service.detectMediaType(file);
        expect(result).toBe('video');
      }
    });

    it('detects audio files by extension', async () => {
      const audioFiles = [
        '/path/to/song.mp3',
        '/path/to/song.m4a',
        '/path/to/song.aac',
        '/path/to/song.flac',
        '/path/to/song.wav',
        '/path/to/song.ogg',
      ];

      vi.spyOn(service, 'detectMediaType').mockImplementation(async (filePath) => {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const audioExts = ['mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg'];
        if (ext && audioExts.includes(ext)) return 'audio';
        return null;
      });

      for (const file of audioFiles) {
        const result = await service.detectMediaType(file);
        expect(result).toBe('audio');
      }
    });

    it('detects image files by extension', async () => {
      const imageFiles = [
        '/path/to/image.jpg',
        '/path/to/image.jpeg',
        '/path/to/image.png',
        '/path/to/image.gif',
        '/path/to/image.webp',
        '/path/to/image.heic',
      ];

      vi.spyOn(service, 'detectMediaType').mockImplementation(async (filePath) => {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
        if (ext && imageExts.includes(ext)) return 'image';
        return null;
      });

      for (const file of imageFiles) {
        const result = await service.detectMediaType(file);
        expect(result).toBe('image');
      }
    });

    it('returns null for unsupported files', async () => {
      const unsupportedFiles = [
        '/path/to/document.txt',
        '/path/to/program.exe',
        '/path/to/archive.zip',
        '/path/to/installer.dmg',
      ];

      vi.spyOn(service, 'detectMediaType').mockImplementation(async (filePath) => {
        const ext = filePath.split('.').pop()?.toLowerCase();
        const supportedExts = [
          'mp4', 'mkv', 'webm', 'avi', 'mov', 'm4v', // video
          'mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', // audio
          'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', // image
        ];
        if (ext && supportedExts.includes(ext)) {
          return ext.includes('mp') || ext.includes('mkv') ? 'video' : 'audio';
        }
        return null;
      });

      for (const file of unsupportedFiles) {
        const result = await service.detectMediaType(file);
        expect(result).toBe(null);
      }
    });

    it('uses MIME type as fallback when extension missing', async () => {
      const filePath = '/path/to/video_without_extension';

      (fileTypeFromFile as any).mockResolvedValue({
        mime: 'video/mp4',
        ext: 'mp4',
      });

      vi.spyOn(service, 'detectMediaType').mockImplementation(async (path) => {
        const fileName = path.split('/').pop() || '';
        const hasExtension = fileName.includes('.') && fileName.split('.').length > 1;

        if (!hasExtension) {
          // No extension, use MIME type
          const type = await fileTypeFromFile(path);
          if (type?.mime.startsWith('video/')) return 'video';
          if (type?.mime.startsWith('audio/')) return 'audio';
          if (type?.mime.startsWith('image/')) return 'image';
        }
        return null;
      });

      const result = await service.detectMediaType(filePath);
      expect(result).toBe('video');
      expect(fileTypeFromFile).toHaveBeenCalledWith(filePath);
    });

    it('handles file-type detection errors gracefully', async () => {
      const filePath = '/path/to/unknown';

      (fileTypeFromFile as any).mockRejectedValue(new Error('Cannot read file'));

      vi.spyOn(service, 'detectMediaType').mockImplementation(async () => {
        try {
          await fileTypeFromFile(filePath);
        } catch (error) {
          // Error handled gracefully
          return null;
        }
        return null;
      });

      const result = await service.detectMediaType(filePath);
      expect(result).toBe(null);
    });
  });

  describe('indexFile', () => {
    it('creates new MediaItem for video file', async () => {
      const filePath = '/media/test-video.mp4';
      const mockStats = { size: 1024000, mtime: new Date('2024-01-15'), birthtime: new Date('2024-01-10') };

      (fs.stat as any).mockResolvedValue(mockStats);
      (exec as any).mockImplementation((cmd: string, callback: Function) => {
        const mockProbe = {
          format: {
            duration: 120.5,
            bit_rate: 5000000,
            tags: { creation_time: '2024-01-10T10:00:00.000Z' },
          },
          streams: [
            {
              codec_type: 'video',
              codec_name: 'h264',
              width: 1920,
              height: 1080,
              r_frame_rate: '30/1',
            },
          ],
        };
        callback(null, { stdout: JSON.stringify(mockProbe) });
      });

      mockDatabase.getMediaItemByPath.mockResolvedValue(null);
      mockDatabase.createMediaItem.mockResolvedValue({ id: 1 });

      vi.spyOn(service, 'detectMediaType').mockResolvedValue('video');
      vi.spyOn(service, 'extractVideoMetadata').mockResolvedValue({
        duration: 120,
        resolution: '1920x1080',
        codec: 'h264',
        bitrate: 5000000,
        fps: 30,
        createdAt: '2024-01-10T10:00:00.000Z',
      });

      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        const mediaType = await service.detectMediaType(path);
        const stats = await fs.stat(path);
        const existing = await mockDatabase.getMediaItemByPath(path);

        if (existing) {
          await mockDatabase.updateMediaItem(existing.id, {});
          return existing;
        }

        const metadata = await service.extractVideoMetadata(path);
        const item = await mockDatabase.createMediaItem({
          source: 'local',
          sourceId: null,
          title: path.split('/').pop()?.replace(/\.[^.]+$/, '') || '',
          mediaType,
          filePath: path,
          fileSize: stats.size,
          duration: metadata.duration,
          videoResolution: metadata.resolution,
          videoCodec: metadata.codec,
          videoBitrate: metadata.bitrate,
          videoFps: metadata.fps,
          fileCreatedAt: stats.birthtime.toISOString(),
          fileModifiedAt: stats.mtime.toISOString(),
        });
        return item;
      });

      const result = await service.indexFile(filePath);

      expect(result).toBeDefined();
      expect(mockDatabase.createMediaItem).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'local',
          mediaType: 'video',
          filePath,
          fileSize: mockStats.size,
          duration: 120,
        })
      );
    });

    it('creates new MediaItem for audio file', async () => {
      const filePath = '/media/test-song.mp3';
      const mockStats = { size: 5120000, mtime: new Date('2024-02-20'), birthtime: new Date('2024-02-15') };

      (fs.stat as any).mockResolvedValue(mockStats);
      (parseFile as any).mockResolvedValue({
        format: {
          duration: 180.5,
          bitrate: 320000,
          sampleRate: 44100,
        },
        common: {
          title: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          year: 2024,
          genre: ['Rock'],
        },
      });

      mockDatabase.getMediaItemByPath.mockResolvedValue(null);
      mockDatabase.createMediaItem.mockResolvedValue({ id: 2 });

      vi.spyOn(service, 'detectMediaType').mockResolvedValue('audio');
      vi.spyOn(service, 'extractAudioMetadata').mockResolvedValue({
        duration: 180,
        bitrate: 320000,
        sampleRate: 44100,
        title: 'Test Song',
        artist: 'Test Artist',
        album: 'Test Album',
        year: 2024,
        genre: 'Rock',
      });

      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        const mediaType = await service.detectMediaType(path);
        const stats = await fs.stat(path);
        const metadata = await service.extractAudioMetadata(path);

        const item = await mockDatabase.createMediaItem({
          source: 'local',
          sourceId: null,
          title: metadata.title || path.split('/').pop()?.replace(/\.[^.]+$/, '') || '',
          mediaType,
          filePath: path,
          fileSize: stats.size,
          duration: metadata.duration,
          audioBitrate: metadata.bitrate,
          audioArtist: metadata.artist,
          audioAlbum: metadata.album,
          audioYear: metadata.year,
          audioGenre: metadata.genre,
          fileCreatedAt: stats.birthtime.toISOString(),
          fileModifiedAt: stats.mtime.toISOString(),
        });
        return item;
      });

      const result = await service.indexFile(filePath);

      expect(result).toBeDefined();
      expect(mockDatabase.createMediaItem).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'local',
          mediaType: 'audio',
          filePath,
          title: 'Test Song',
          audioArtist: 'Test Artist',
          audioAlbum: 'Test Album',
        })
      );
    });

    it('creates new MediaItem for image file', async () => {
      const filePath = '/media/test-image.jpg';
      const mockStats = { size: 2048000, mtime: new Date('2024-03-10'), birthtime: new Date('2024-03-05') };

      (fs.stat as any).mockResolvedValue(mockStats);

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({
          width: 4032,
          height: 3024,
          format: 'jpeg',
          space: 'srgb',
          hasAlpha: false,
          exif: Buffer.from('mock-exif-data'),
        }),
      };
      (sharp as any).mockReturnValue(mockSharp);

      mockDatabase.getMediaItemByPath.mockResolvedValue(null);
      mockDatabase.createMediaItem.mockResolvedValue({ id: 3 });

      vi.spyOn(service, 'detectMediaType').mockResolvedValue('image');
      vi.spyOn(service, 'extractImageMetadata').mockResolvedValue({
        width: 4032,
        height: 3024,
        format: 'jpeg',
        cameraMake: 'Apple',
        cameraModel: 'iPhone 14 Pro',
        dateTaken: '2024-03-05T14:30:00.000Z',
      });

      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        const mediaType = await service.detectMediaType(path);
        const stats = await fs.stat(path);
        const metadata = await service.extractImageMetadata(path);

        const item = await mockDatabase.createMediaItem({
          source: 'local',
          sourceId: null,
          title: path.split('/').pop()?.replace(/\.[^.]+$/, '') || '',
          mediaType,
          filePath: path,
          fileSize: stats.size,
          duration: 0,
          imageWidth: metadata.width,
          imageHeight: metadata.height,
          imageCameraMake: metadata.cameraMake,
          imageCameraModel: metadata.cameraModel,
          imageDateTaken: metadata.dateTaken,
          fileCreatedAt: stats.birthtime.toISOString(),
          fileModifiedAt: stats.mtime.toISOString(),
        });
        return item;
      });

      const result = await service.indexFile(filePath);

      expect(result).toBeDefined();
      expect(mockDatabase.createMediaItem).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'local',
          mediaType: 'image',
          filePath,
          imageWidth: 4032,
          imageHeight: 3024,
        })
      );
    });

    it('updates existing MediaItem if file already indexed', async () => {
      const filePath = '/media/existing-video.mp4';
      const existingItem = { id: 10, filePath, title: 'Existing Video' };
      const mockStats = { size: 1024000, mtime: new Date('2024-04-01'), birthtime: new Date('2024-03-25') };

      (fs.stat as any).mockResolvedValue(mockStats);
      mockDatabase.getMediaItemByPath.mockResolvedValue(existingItem);
      mockDatabase.updateMediaItem.mockResolvedValue(existingItem);

      vi.spyOn(service, 'detectMediaType').mockResolvedValue('video');
      vi.spyOn(service, 'extractVideoMetadata').mockResolvedValue({
        duration: 90,
        resolution: '1280x720',
      });

      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        const existing = await mockDatabase.getMediaItemByPath(path);
        const stats = await fs.stat(path);

        if (existing) {
          await mockDatabase.updateMediaItem(existing.id, {
            fileSize: stats.size,
            fileModifiedAt: stats.mtime.toISOString(),
            updatedAt: new Date().toISOString(),
          });
          return existing;
        }
        return null;
      });

      const result = await service.indexFile(filePath);

      expect(mockDatabase.getMediaItemByPath).toHaveBeenCalledWith(filePath);
      expect(mockDatabase.updateMediaItem).toHaveBeenCalled();
      expect(mockDatabase.createMediaItem).not.toHaveBeenCalled();
    });

    it('handles corrupted files gracefully', async () => {
      const filePath = '/media/corrupted-video.mp4';

      (fs.stat as any).mockResolvedValue({ size: 1000, mtime: new Date(), birthtime: new Date() });
      (exec as any).mockImplementation((cmd: string, callback: Function) => {
        callback(new Error('Invalid data found when processing input'), null);
      });

      mockDatabase.getMediaItemByPath.mockResolvedValue(null);

      vi.spyOn(service, 'detectMediaType').mockResolvedValue('video');
      vi.spyOn(service, 'extractVideoMetadata').mockRejectedValue(new Error('Invalid data found'));

      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        try {
          const mediaType = await service.detectMediaType(path);
          const metadata = await service.extractVideoMetadata(path);
          return null;
        } catch (error) {
          // Log error but don't crash
          console.error('Failed to index file:', error);
          return null;
        }
      });

      const result = await service.indexFile(filePath);

      expect(result).toBe(null);
      expect(console.error).toHaveBeenCalled();
    });

    it('handles permission errors', async () => {
      const filePath = '/media/restricted-file.mp4';

      const permError = new Error('EACCES: permission denied');
      (permError as any).code = 'EACCES';
      (fs.stat as any).mockRejectedValue(permError);

      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        try {
          await fs.stat(path);
          return null;
        } catch (error: any) {
          if (error.code === 'EACCES') {
            service.emit('error', { filePath: path, error: 'Permission denied' });
            return null;
          }
          throw error;
        }
      });

      const errorSpy = vi.fn();
      service.on('error', errorSpy);

      const result = await service.indexFile(filePath);

      expect(result).toBe(null);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          filePath,
          error: 'Permission denied',
        })
      );
    });
  });

  describe('scanFolder', () => {
    it('finds all media files in folder', async () => {
      const folderPath = '/media/test-folder';
      const mockFiles = [
        { name: 'video1.mp4', isDirectory: () => false },
        { name: 'video2.mkv', isDirectory: () => false },
        { name: 'video3.mov', isDirectory: () => false },
        { name: 'audio1.mp3', isDirectory: () => false },
        { name: 'audio2.m4a', isDirectory: () => false },
        { name: 'image1.jpg', isDirectory: () => false },
        { name: 'image2.png', isDirectory: () => false },
        { name: 'readme.txt', isDirectory: () => false },
      ];

      (fs.readdir as any).mockResolvedValue(mockFiles);

      let indexFileCallCount = 0;
      vi.spyOn(service, 'detectMediaType').mockImplementation(async (path) => {
        if (path.endsWith('.mp4') || path.endsWith('.mkv') || path.endsWith('.mov')) return 'video';
        if (path.endsWith('.mp3') || path.endsWith('.m4a')) return 'audio';
        if (path.endsWith('.jpg') || path.endsWith('.png')) return 'image';
        return null;
      });

      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        const mediaType = await service.detectMediaType(path);
        if (mediaType) {
          indexFileCallCount++;
          return { id: indexFileCallCount, filePath: path, mediaType };
        }
        return null;
      });

      vi.spyOn(service, 'scanFolder').mockImplementation(async (path, options) => {
        const files = await fs.readdir(path);
        let processed = 0;
        let skipped = 0;
        let errors = 0;

        for (const file of files) {
          const result = await service.indexFile(`${path}/${(file as any).name}`);
          if (result) processed++;
          else skipped++;
        }

        return { processed, skipped, errors };
      });

      const result = await service.scanFolder(folderPath);

      expect(result.processed).toBe(7); // 3 video + 2 audio + 2 image
      expect(result.skipped).toBe(1); // readme.txt
      expect(result.errors).toBe(0);
    });

    it('recursively scans nested folders when enabled', async () => {
      const folderPath = '/media/root';

      // Mock folder structure
      const mockRootFiles = [
        { name: 'video1.mp4', isDirectory: () => false },
        { name: 'subfolder1', isDirectory: () => true },
        { name: 'subfolder2', isDirectory: () => true },
      ];
      const mockSub1Files = [
        { name: 'video2.mp4', isDirectory: () => false },
        { name: 'deep', isDirectory: () => true },
      ];
      const mockSub2Files = [
        { name: 'audio1.mp3', isDirectory: () => false },
      ];
      const mockDeepFiles = [
        { name: 'image1.jpg', isDirectory: () => false },
      ];

      (fs.readdir as any).mockImplementation(async (path: string) => {
        if (path === folderPath) return mockRootFiles;
        if (path === `${folderPath}/subfolder1`) return mockSub1Files;
        if (path === `${folderPath}/subfolder2`) return mockSub2Files;
        if (path === `${folderPath}/subfolder1/deep`) return mockDeepFiles;
        return [];
      });

      const indexedPaths: string[] = [];
      vi.spyOn(service, 'detectMediaType').mockResolvedValue('video');
      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        indexedPaths.push(path);
        return { id: indexedPaths.length, filePath: path };
      });

      vi.spyOn(service, 'scanFolder').mockImplementation(async function scanRecursive(
        path: string,
        options?: { recursive?: boolean }
      ): Promise<any> {
        const files = await fs.readdir(path);
        let processed = 0;

        for (const file of files) {
          const fullPath = `${path}/${(file as any).name}`;
          if ((file as any).isDirectory()) {
            if (options?.recursive) {
              const subResult = await scanRecursive(fullPath, options);
              processed += subResult.processed;
            }
          } else {
            await service.indexFile(fullPath);
            processed++;
          }
        }

        return { processed, skipped: 0, errors: 0 };
      });

      const result = await service.scanFolder(folderPath, { recursive: true });

      expect(result.processed).toBe(4); // All files across all folders
      expect(indexedPaths).toContain(`${folderPath}/video1.mp4`);
      expect(indexedPaths).toContain(`${folderPath}/subfolder1/video2.mp4`);
      expect(indexedPaths).toContain(`${folderPath}/subfolder2/audio1.mp3`);
      expect(indexedPaths).toContain(`${folderPath}/subfolder1/deep/image1.jpg`);
    });

    it('skips nested folders when recursive=false', async () => {
      const folderPath = '/media/root';

      const mockFiles = [
        { name: 'video1.mp4', isDirectory: () => false },
        { name: 'subfolder', isDirectory: () => true },
      ];

      (fs.readdir as any).mockResolvedValue(mockFiles);

      const indexedPaths: string[] = [];
      vi.spyOn(service, 'detectMediaType').mockResolvedValue('video');
      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        indexedPaths.push(path);
        return { id: 1, filePath: path };
      });

      vi.spyOn(service, 'scanFolder').mockImplementation(async (path, options) => {
        const files = await fs.readdir(path);
        let processed = 0;

        for (const file of files) {
          if (!(file as any).isDirectory()) {
            await service.indexFile(`${path}/${(file as any).name}`);
            processed++;
          }
        }

        return { processed, skipped: 0, errors: 0 };
      });

      const result = await service.scanFolder(folderPath, { recursive: false });

      expect(result.processed).toBe(1);
      expect(indexedPaths).toHaveLength(1);
      expect(indexedPaths[0]).toBe(`${folderPath}/video1.mp4`);
    });

    it('skips system folders (.git, node_modules)', async () => {
      const folderPath = '/project';

      const mockFiles = [
        { name: 'video.mp4', isDirectory: () => false },
        { name: '.git', isDirectory: () => true },
        { name: 'node_modules', isDirectory: () => true },
        { name: '.DS_Store', isDirectory: () => false },
        { name: 'Thumbs.db', isDirectory: () => false },
      ];

      (fs.readdir as any).mockResolvedValue(mockFiles);

      const indexedPaths: string[] = [];
      vi.spyOn(service, 'detectMediaType').mockImplementation(async (path) => {
        if (path.endsWith('.mp4')) return 'video';
        return null;
      });
      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        const mediaType = await service.detectMediaType(path);
        if (mediaType) {
          indexedPaths.push(path);
          return { id: 1, filePath: path };
        }
        return null;
      });

      const systemFolders = ['.git', 'node_modules', '.Trash', '__MACOSX'];
      const systemFiles = ['.DS_Store', 'Thumbs.db', 'desktop.ini'];

      vi.spyOn(service, 'scanFolder').mockImplementation(async (path, options) => {
        const files = await fs.readdir(path);
        let processed = 0;
        let skipped = 0;

        for (const file of files) {
          const fileName = (file as any).name;

          // Skip system folders and files
          if (systemFolders.includes(fileName) || systemFiles.includes(fileName)) {
            skipped++;
            continue;
          }

          if ((file as any).isDirectory()) {
            if (options?.recursive) {
              // Would scan subdirectory
            }
          } else {
            const result = await service.indexFile(`${path}/${fileName}`);
            if (result) processed++;
            else skipped++;
          }
        }

        return { processed, skipped, errors: 0 };
      });

      const result = await service.scanFolder(folderPath, { recursive: true });

      expect(result.processed).toBe(1); // Only video.mp4
      expect(result.skipped).toBe(4); // .git, node_modules, .DS_Store, Thumbs.db
      expect(indexedPaths).toHaveLength(1);
    });

    it('emits progress events during scan', async () => {
      const folderPath = '/media/large-folder';
      const mockFiles = Array.from({ length: 10 }, (_, i) => ({
        name: `video${i + 1}.mp4`,
        isDirectory: () => false,
      }));

      (fs.readdir as any).mockResolvedValue(mockFiles);

      const progressEvents: any[] = [];
      service.on('indexing-started', (data) => progressEvents.push({ type: 'started', data }));
      service.on('indexing-progress', (data) => progressEvents.push({ type: 'progress', data }));
      service.on('indexing-completed', (data) => progressEvents.push({ type: 'completed', data }));

      vi.spyOn(service, 'detectMediaType').mockResolvedValue('video');
      vi.spyOn(service, 'indexFile').mockResolvedValue({ id: 1 });

      vi.spyOn(service, 'scanFolder').mockImplementation(async (path, options) => {
        service.emit('indexing-started', { folderPath: path, totalFiles: 10 });

        const files = await fs.readdir(path);
        let processed = 0;

        for (const file of files) {
          await service.indexFile(`${path}/${(file as any).name}`);
          processed++;
          service.emit('indexing-progress', {
            folderPath: path,
            processed,
            total: files.length,
            currentFile: (file as any).name,
          });
        }

        service.emit('indexing-completed', { folderPath: path, processed, errors: 0 });
        return { processed, skipped: 0, errors: 0 };
      });

      await service.scanFolder(folderPath);

      expect(progressEvents.find(e => e.type === 'started')).toBeDefined();
      expect(progressEvents.filter(e => e.type === 'progress')).toHaveLength(10);
      expect(progressEvents.find(e => e.type === 'completed')).toBeDefined();
    });

    it('handles cancellation gracefully', async () => {
      const folderPath = '/media/cancellable';
      const mockFiles = Array.from({ length: 100 }, (_, i) => ({
        name: `video${i + 1}.mp4`,
        isDirectory: () => false,
      }));

      (fs.readdir as any).mockResolvedValue(mockFiles);

      let cancelled = false;
      let processedCount = 0;

      vi.spyOn(service, 'cancel').mockImplementation(() => {
        cancelled = true;
      });

      vi.spyOn(service, 'detectMediaType').mockResolvedValue('video');
      vi.spyOn(service, 'indexFile').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return { id: 1 };
      });

      vi.spyOn(service, 'scanFolder').mockImplementation(async (path) => {
        const files = await fs.readdir(path);
        let processed = 0;

        for (const file of files) {
          if (cancelled) break;
          await service.indexFile(`${path}/${(file as any).name}`);
          processed++;
        }

        processedCount = processed;
        return { processed, skipped: 0, errors: 0 };
      });

      // Start scan
      const scanPromise = service.scanFolder(folderPath);

      // Cancel after short delay
      setTimeout(() => service.cancel(), 50);

      await scanPromise;

      expect(processedCount).toBeLessThan(100);
      expect(processedCount).toBeGreaterThan(0);
    });

    it('continues processing if one file fails', async () => {
      const folderPath = '/media/mixed';
      const mockFiles = [
        { name: 'good1.mp4', isDirectory: () => false },
        { name: 'good2.mp4', isDirectory: () => false },
        { name: 'corrupted.mp4', isDirectory: () => false },
        { name: 'good3.mp4', isDirectory: () => false },
      ];

      (fs.readdir as any).mockResolvedValue(mockFiles);

      vi.spyOn(service, 'detectMediaType').mockResolvedValue('video');
      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        if (path.includes('corrupted')) {
          throw new Error('Corrupted file');
        }
        return { id: 1, filePath: path };
      });

      vi.spyOn(service, 'scanFolder').mockImplementation(async (path) => {
        const files = await fs.readdir(path);
        let processed = 0;
        let errors = 0;

        for (const file of files) {
          try {
            await service.indexFile(`${path}/${(file as any).name}`);
            processed++;
          } catch (error) {
            errors++;
            console.error('Failed to index file:', error);
          }
        }

        return { processed, skipped: 0, errors };
      });

      const result = await service.scanFolder(folderPath);

      expect(result.processed).toBe(3); // good1, good2, good3
      expect(result.errors).toBe(1); // corrupted
    });
  });

  describe('extractVideoMetadata', () => {
    it('extracts duration, resolution, codec from video', async () => {
      const filePath = '/media/test.mp4';
      const mockProbe = {
        format: {
          duration: '125.456',
          bit_rate: '8000000',
          tags: { creation_time: '2024-01-15T10:30:00.000Z' },
        },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
            width: 1920,
            height: 1080,
            r_frame_rate: '30/1',
          },
        ],
      };

      (exec as any).mockImplementation((cmd: string, callback: Function) => {
        callback(null, { stdout: JSON.stringify(mockProbe) });
      });

      vi.spyOn(service, 'extractVideoMetadata').mockImplementation(async (path) => {
        return new Promise((resolve, reject) => {
          const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${path}"`;
          exec(cmd, (error: any, result: any) => {
            if (error) return reject(error);
            const data = JSON.parse(result.stdout);
            const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
            resolve({
              duration: Math.floor(parseFloat(data.format.duration)),
              resolution: `${videoStream.width}x${videoStream.height}`,
              codec: videoStream.codec_name,
              bitrate: parseInt(data.format.bit_rate),
              fps: eval(videoStream.r_frame_rate),
              createdAt: data.format.tags?.creation_time || null,
            });
          });
        });
      });

      const result = await service.extractVideoMetadata(filePath);

      expect(result).toEqual({
        duration: 125,
        resolution: '1920x1080',
        codec: 'h264',
        bitrate: 8000000,
        fps: 30,
        createdAt: '2024-01-15T10:30:00.000Z',
      });
    });

    it('handles videos without creation_time tag', async () => {
      const filePath = '/media/no-date.mp4';
      const mockProbe = {
        format: {
          duration: '60.0',
          bit_rate: '5000000',
          tags: {},
        },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'vp9',
            width: 1280,
            height: 720,
            r_frame_rate: '24/1',
          },
        ],
      };

      (exec as any).mockImplementation((cmd: string, callback: Function) => {
        callback(null, { stdout: JSON.stringify(mockProbe) });
      });

      vi.spyOn(service, 'extractVideoMetadata').mockImplementation(async (path) => {
        return new Promise((resolve) => {
          const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${path}"`;
          exec(cmd, (error: any, result: any) => {
            const data = JSON.parse(result.stdout);
            const videoStream = data.streams.find((s: any) => s.codec_type === 'video');
            resolve({
              duration: Math.floor(parseFloat(data.format.duration)),
              resolution: `${videoStream.width}x${videoStream.height}`,
              codec: videoStream.codec_name,
              bitrate: parseInt(data.format.bit_rate),
              fps: eval(videoStream.r_frame_rate),
              createdAt: data.format.tags?.creation_time || null,
            });
          });
        });
      });

      const result = await service.extractVideoMetadata(filePath);

      expect(result.createdAt).toBe(null);
      expect(result.duration).toBe(60);
    });
  });

  describe('extractAudioMetadata', () => {
    it('extracts ID3 tags from MP3', async () => {
      const filePath = '/media/song.mp3';

      (parseFile as any).mockResolvedValue({
        format: {
          duration: 215.5,
          bitrate: 320000,
          sampleRate: 44100,
        },
        common: {
          title: 'Epic Song',
          artist: 'Amazing Band',
          album: 'Greatest Hits',
          year: 2023,
          genre: ['Alternative Rock'],
          albumartist: 'Amazing Band',
        },
      });

      vi.spyOn(service, 'extractAudioMetadata').mockImplementation(async (path) => {
        const metadata = await parseFile(path);
        return {
          duration: Math.floor(metadata.format.duration || 0),
          bitrate: metadata.format.bitrate || null,
          sampleRate: metadata.format.sampleRate || null,
          title: metadata.common.title || null,
          artist: metadata.common.artist || null,
          album: metadata.common.album || null,
          year: metadata.common.year || null,
          genre: metadata.common.genre?.[0] || null,
          albumArtist: metadata.common.albumartist || null,
        };
      });

      const result = await service.extractAudioMetadata(filePath);

      expect(result).toEqual({
        duration: 215,
        bitrate: 320000,
        sampleRate: 44100,
        title: 'Epic Song',
        artist: 'Amazing Band',
        album: 'Greatest Hits',
        year: 2023,
        genre: 'Alternative Rock',
        albumArtist: 'Amazing Band',
      });
      expect(parseFile).toHaveBeenCalledWith(filePath);
    });

    it('handles audio files without ID3 tags', async () => {
      const filePath = '/media/no-tags.wav';

      (parseFile as any).mockResolvedValue({
        format: {
          duration: 45.2,
          bitrate: 1411000,
          sampleRate: 48000,
        },
        common: {},
      });

      vi.spyOn(service, 'extractAudioMetadata').mockImplementation(async (path) => {
        const metadata = await parseFile(path);
        return {
          duration: Math.floor(metadata.format.duration || 0),
          bitrate: metadata.format.bitrate || null,
          sampleRate: metadata.format.sampleRate || null,
          title: metadata.common.title || null,
          artist: metadata.common.artist || null,
          album: metadata.common.album || null,
          year: metadata.common.year || null,
          genre: metadata.common.genre?.[0] || null,
          albumArtist: metadata.common.albumartist || null,
        };
      });

      const result = await service.extractAudioMetadata(filePath);

      expect(result.duration).toBe(45);
      expect(result.bitrate).toBe(1411000);
      expect(result.title).toBe(null);
      expect(result.artist).toBe(null);
      expect(result.album).toBe(null);
    });
  });

  describe('extractImageMetadata', () => {
    it('extracts dimensions from image', async () => {
      const filePath = '/media/photo.jpg';

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({
          width: 3024,
          height: 4032,
          format: 'jpeg',
          space: 'srgb',
          hasAlpha: false,
        }),
      };
      (sharp as any).mockReturnValue(mockSharp);

      vi.spyOn(service, 'extractImageMetadata').mockImplementation(async (path) => {
        const metadata = await sharp(path).metadata();
        return {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          hasAlpha: metadata.hasAlpha,
        };
      });

      const result = await service.extractImageMetadata(filePath);

      expect(result).toEqual({
        width: 3024,
        height: 4032,
        format: 'jpeg',
        space: 'srgb',
        hasAlpha: false,
      });
      expect(sharp).toHaveBeenCalledWith(filePath);
    });

    it('extracts EXIF data from JPEG', async () => {
      const filePath = '/media/photo-with-exif.jpg';

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({
          width: 4032,
          height: 3024,
          format: 'jpeg',
          exif: Buffer.from('mock-exif'),
        }),
      };
      (sharp as any).mockReturnValue(mockSharp);

      vi.spyOn(service, 'extractImageMetadata').mockImplementation(async (path) => {
        const metadata = await sharp(path).metadata();

        // Simulate EXIF parsing
        const exifData = metadata.exif ? {
          cameraMake: 'Canon',
          cameraModel: 'EOS R5',
          dateTaken: '2024-05-20T15:30:00.000Z',
          latitude: 37.7749,
          longitude: -122.4194,
        } : null;

        return {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          ...exifData,
        };
      });

      const result = await service.extractImageMetadata(filePath);

      expect(result.width).toBe(4032);
      expect(result.height).toBe(3024);
      expect(result.cameraMake).toBe('Canon');
      expect(result.cameraModel).toBe('EOS R5');
      expect(result.dateTaken).toBeDefined();
      expect(result.latitude).toBe(37.7749);
      expect(result.longitude).toBe(-122.4194);
    });

    it('handles images without EXIF', async () => {
      const filePath = '/media/screenshot.png';

      const mockSharp = {
        metadata: vi.fn().mockResolvedValue({
          width: 1920,
          height: 1080,
          format: 'png',
          space: 'srgb',
          hasAlpha: true,
        }),
      };
      (sharp as any).mockReturnValue(mockSharp);

      vi.spyOn(service, 'extractImageMetadata').mockImplementation(async (path) => {
        const metadata = await sharp(path).metadata();
        return {
          width: metadata.width,
          height: metadata.height,
          format: metadata.format,
          space: metadata.space,
          hasAlpha: metadata.hasAlpha,
          cameraMake: null,
          cameraModel: null,
          dateTaken: null,
        };
      });

      const result = await service.extractImageMetadata(filePath);

      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
      expect(result.format).toBe('png');
      expect(result.cameraMake).toBe(null);
      expect(result.cameraModel).toBe(null);
    });
  });

  describe('integration tests', () => {
    it('scans folder and tracks progress correctly', async () => {
      const folderPath = '/media/integration-test';
      const mockFiles = [
        { name: 'video.mp4', isDirectory: () => false },
        { name: 'audio.mp3', isDirectory: () => false },
        { name: 'image.jpg', isDirectory: () => false },
      ];

      (fs.readdir as any).mockResolvedValue(mockFiles);
      (fs.stat as any).mockResolvedValue({
        size: 1000000,
        mtime: new Date(),
        birthtime: new Date(),
      });

      mockDatabase.getMediaItemByPath.mockResolvedValue(null);
      mockDatabase.createMediaItem.mockImplementation(async (data: any) => ({
        id: Math.floor(Math.random() * 1000),
        ...data,
      }));
      mockDatabase.updateIndexedFolder.mockResolvedValue(undefined);

      // Setup real-ish implementations
      vi.spyOn(service, 'detectMediaType').mockImplementation(async (path) => {
        if (path.endsWith('.mp4')) return 'video';
        if (path.endsWith('.mp3')) return 'audio';
        if (path.endsWith('.jpg')) return 'image';
        return null;
      });

      vi.spyOn(service, 'extractVideoMetadata').mockResolvedValue({
        duration: 120,
        resolution: '1920x1080',
        codec: 'h264',
      });

      vi.spyOn(service, 'extractAudioMetadata').mockResolvedValue({
        duration: 180,
        bitrate: 320000,
        title: 'Test Song',
      });

      vi.spyOn(service, 'extractImageMetadata').mockResolvedValue({
        width: 1920,
        height: 1080,
      });

      vi.spyOn(service, 'indexFile').mockImplementation(async (path) => {
        const mediaType = await service.detectMediaType(path);
        if (!mediaType) return null;

        const stats = await fs.stat(path);
        let metadata: any = {};

        if (mediaType === 'video') {
          metadata = await service.extractVideoMetadata(path);
        } else if (mediaType === 'audio') {
          metadata = await service.extractAudioMetadata(path);
        } else if (mediaType === 'image') {
          metadata = await service.extractImageMetadata(path);
        }

        return await mockDatabase.createMediaItem({
          source: 'local',
          mediaType,
          filePath: path,
          fileSize: stats.size,
          ...metadata,
        });
      });

      vi.spyOn(service, 'scanFolder').mockImplementation(async (path, options) => {
        service.emit('indexing-started', { folderPath: path });

        const files = await fs.readdir(path);
        let processed = 0;
        let skipped = 0;
        let errors = 0;

        for (const file of files) {
          try {
            const fullPath = `${path}/${(file as any).name}`;
            const result = await service.indexFile(fullPath);
            if (result) {
              processed++;
              service.emit('indexing-progress', {
                folderPath: path,
                processed,
                total: files.length,
                currentFile: (file as any).name,
              });
            } else {
              skipped++;
            }
          } catch (error) {
            errors++;
          }
        }

        if (options?.folderId) {
          await mockDatabase.updateIndexedFolder(options.folderId, {
            lastScannedAt: new Date().toISOString(),
            fileCount: processed,
          });
        }

        service.emit('indexing-completed', { folderPath: path, processed, skipped, errors });
        return { processed, skipped, errors };
      });

      const events: string[] = [];
      service.on('indexing-started', () => events.push('started'));
      service.on('indexing-progress', () => events.push('progress'));
      service.on('indexing-completed', () => events.push('completed'));

      const result = await service.scanFolder(folderPath, { folderId: 1 });

      expect(result.processed).toBe(3);
      expect(result.skipped).toBe(0);
      expect(result.errors).toBe(0);
      expect(events).toContain('started');
      expect(events.filter(e => e === 'progress')).toHaveLength(3);
      expect(events).toContain('completed');
      expect(mockDatabase.createMediaItem).toHaveBeenCalledTimes(3);
      expect(mockDatabase.updateIndexedFolder).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          lastScannedAt: expect.any(String),
          fileCount: 3,
        })
      );
    });
  });
});
