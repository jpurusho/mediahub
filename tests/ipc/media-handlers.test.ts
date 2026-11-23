/**
 * Integration tests for IPC handlers
 * Tests all media-related IPC communication between renderer and main process
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BrowserWindow } from 'electron';

// Mock Electron modules
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(),
  },
  dialog: {},
  shell: {},
  app: {},
}));

// Mock database functions
vi.mock('../../desktop/services/database', () => ({
  getMediaItems: vi.fn(),
  getMediaItem: vi.fn(),
  getMediaItemByPath: vi.fn(),
  getMediaItemByYoutubeId: vi.fn(),
  deleteMediaItems: vi.fn(),
  getMediaItemStats: vi.fn(),
  getIndexedFolders: vi.fn(),
  getIndexedFolder: vi.fn(),
  addIndexedFolder: vi.fn(),
  updateIndexedFolder: vi.fn(),
  deleteIndexedFolder: vi.fn(),
  getDataDir: vi.fn(),
  setDataDir: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  getDownloadHistory: vi.fn(),
  deleteDownloadRecords: vi.fn(),
  clearDownloadHistory: vi.fn(),
  getStats: vi.fn(),
  updateDownloadFilePath: vi.fn(),
  createLocalPlaylist: vi.fn(),
  getLocalPlaylists: vi.fn(),
  getLocalPlaylist: vi.fn(),
  updateLocalPlaylist: vi.fn(),
  deleteLocalPlaylist: vi.fn(),
  addPlaylistItem: vi.fn(),
  removePlaylistItem: vi.fn(),
  getPlaylistItems: vi.fn(),
  reorderPlaylistItem: vi.fn(),
  getLibraryItems: vi.fn(),
  getLibraryItem: vi.fn(),
  deleteLibraryItems: vi.fn(),
  getRecentLibraryItems: vi.fn(),
  getLibraryStats: vi.fn(),
  upsertLibraryItem: vi.fn(),
  toRelativePath: vi.fn(),
  getTranscript: vi.fn(),
  searchTranscripts: vi.fn(),
  getAllTranscripts: vi.fn(),
  deleteTranscript: vi.fn(),
}));

// Mock services
vi.mock('../../desktop/services/google-auth');
vi.mock('../../desktop/services/youtube-api');
vi.mock('../../desktop/services/queue-manager');
vi.mock('../../desktop/services/download-engine');
vi.mock('../../desktop/services/tool-paths');
vi.mock('../../desktop/services/logger');
vi.mock('../../desktop/services/sync/sync-manager');
vi.mock('../../desktop/services/transcription-queue-manager');
vi.mock('../../desktop/services/claude-analysis');

// Mock media indexer
vi.mock('../../desktop/services/media-indexer', () => ({
  indexer: {
    scanFolder: vi.fn(),
    indexFile: vi.fn(),
    cancel: vi.fn(),
    getProgress: vi.fn(),
    on: vi.fn(),
  },
}));

// Mock file watcher
vi.mock('../../desktop/services/file-watcher', () => ({
  fileWatcher: {
    watchFolder: vi.fn(),
    unwatchFolder: vi.fn(),
    enableFolder: vi.fn(),
    disableFolder: vi.fn(),
    getWatchedFolders: vi.fn(),
    isWatching: vi.fn(),
    getMaxWatchers: vi.fn(),
    setMaxWatchers: vi.fn(),
    on: vi.fn(),
  },
}));

// Mock electron-updater
vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    forceDevUpdateConfig: false,
    on: vi.fn(),
    once: vi.fn(),
  },
}));

import { ipcMain } from 'electron';
import { registerIpcHandlers } from '../../desktop/ipc-handlers';
import * as database from '../../desktop/services/database';
import { indexer } from '../../desktop/services/media-indexer';
import { fileWatcher } from '../../desktop/services/file-watcher';

describe('IPC Handlers - Media', () => {
  let handlers: Map<string, Function>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = new Map();

    // Capture IPC handlers when they're registered
    vi.mocked(ipcMain.handle).mockImplementation((channel: string, handler: Function) => {
      handlers.set(channel, handler);
      return undefined as any;
    });

    // Register all IPC handlers
    registerIpcHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to invoke a handler
  const invokeHandler = async (channel: string, ...args: any[]) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`Handler not registered: ${channel}`);
    }
    return handler({} as any, ...args);
  };

  describe('media:getAll', () => {
    it('returns all media items', async () => {
      const mockItems = [
        { id: 1, title: 'Video 1', source: 'local', mediaType: 'video' },
        { id: 2, title: 'Audio 1', source: 'local', mediaType: 'audio' },
      ];

      vi.mocked(database.getMediaItems).mockReturnValue(mockItems as any);

      const result = await invokeHandler('media:getAll');

      expect(database.getMediaItems).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockItems);
    });

    it('filters by source (youtube/local)', async () => {
      const mockItems = [
        { id: 1, title: 'Video 1', source: 'local', mediaType: 'video' },
      ];

      vi.mocked(database.getMediaItems).mockReturnValue(mockItems as any);

      const result = await invokeHandler('media:getAll', { source: 'local' });

      expect(database.getMediaItems).toHaveBeenCalledWith({ source: 'local' });
      expect(result).toEqual(mockItems);
    });

    it('filters by mediaType (video/audio/image)', async () => {
      const mockItems = [
        { id: 1, title: 'Video 1', source: 'local', mediaType: 'video' },
      ];

      vi.mocked(database.getMediaItems).mockReturnValue(mockItems as any);

      const result = await invokeHandler('media:getAll', { mediaType: 'video' });

      expect(database.getMediaItems).toHaveBeenCalledWith({ mediaType: 'video' });
      expect(result).toEqual(mockItems);
    });

    it('supports pagination (limit/offset)', async () => {
      const mockItems = [
        { id: 11, title: 'Video 11', source: 'local', mediaType: 'video' },
      ];

      vi.mocked(database.getMediaItems).mockReturnValue(mockItems as any);

      const result = await invokeHandler('media:getAll', { limit: 10, offset: 10 });

      expect(database.getMediaItems).toHaveBeenCalledWith({ limit: 10, offset: 10 });
      expect(result).toEqual(mockItems);
    });

    it('supports sorting (sortBy/sortOrder)', async () => {
      const mockItems = [
        { id: 1, title: 'A Video', source: 'local', mediaType: 'video' },
      ];

      vi.mocked(database.getMediaItems).mockReturnValue(mockItems as any);

      const result = await invokeHandler('media:getAll', { sortBy: 'title', sortOrder: 'asc' });

      expect(database.getMediaItems).toHaveBeenCalledWith({ sortBy: 'title', sortOrder: 'asc' });
      expect(result).toEqual(mockItems);
    });

    it('combines multiple filters', async () => {
      const mockItems = [
        { id: 1, title: 'Local Video', source: 'local', mediaType: 'video' },
      ];

      vi.mocked(database.getMediaItems).mockReturnValue(mockItems as any);

      const result = await invokeHandler('media:getAll', {
        source: 'local',
        mediaType: 'video',
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(database.getMediaItems).toHaveBeenCalledWith({
        source: 'local',
        mediaType: 'video',
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      expect(result).toEqual(mockItems);
    });
  });

  describe('media:get', () => {
    it('returns media item by ID', async () => {
      const mockItem = { id: 1, title: 'Test Video', source: 'local', mediaType: 'video' };

      vi.mocked(database.getMediaItem).mockReturnValue(mockItem as any);

      const result = await invokeHandler('media:get', 1);

      expect(database.getMediaItem).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockItem);
    });

    it('returns null for non-existent ID', async () => {
      vi.mocked(database.getMediaItem).mockReturnValue(null);

      const result = await invokeHandler('media:get', 9999);

      expect(database.getMediaItem).toHaveBeenCalledWith(9999);
      expect(result).toBeNull();
    });
  });

  describe('media:getByPath', () => {
    it('finds media item by file path', async () => {
      const mockItem = { id: 1, filePath: '/media/test.mp4', title: 'Test' };

      vi.mocked(database.getMediaItemByPath).mockReturnValue(mockItem as any);

      const result = await invokeHandler('media:getByPath', '/media/test.mp4');

      expect(database.getMediaItemByPath).toHaveBeenCalledWith('/media/test.mp4');
      expect(result).toEqual(mockItem);
    });

    it('returns null for non-existent path', async () => {
      vi.mocked(database.getMediaItemByPath).mockReturnValue(null);

      const result = await invokeHandler('media:getByPath', '/media/nonexistent.mp4');

      expect(result).toBeNull();
    });
  });

  describe('media:getByYoutubeId', () => {
    it('finds YouTube media by video ID', async () => {
      const mockItem = {
        id: 1,
        youtubeVideoId: 'dQw4w9WgXcQ',
        title: 'Test Video',
        source: 'youtube',
      };

      vi.mocked(database.getMediaItemByYoutubeId).mockReturnValue(mockItem as any);

      const result = await invokeHandler('media:getByYoutubeId', 'dQw4w9WgXcQ');

      expect(database.getMediaItemByYoutubeId).toHaveBeenCalledWith('dQw4w9WgXcQ');
      expect(result).toEqual(mockItem);
    });

    it('returns null for non-existent YouTube ID', async () => {
      vi.mocked(database.getMediaItemByYoutubeId).mockReturnValue(null);

      const result = await invokeHandler('media:getByYoutubeId', 'invalid_id');

      expect(result).toBeNull();
    });
  });

  describe('media:delete', () => {
    it('deletes multiple media items', async () => {
      vi.mocked(database.deleteMediaItems).mockReturnValue(undefined);

      await invokeHandler('media:delete', [1, 2, 3]);

      expect(database.deleteMediaItems).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('deletes single media item', async () => {
      vi.mocked(database.deleteMediaItems).mockReturnValue(undefined);

      await invokeHandler('media:delete', [1]);

      expect(database.deleteMediaItems).toHaveBeenCalledWith([1]);
    });

    it('handles empty array', async () => {
      vi.mocked(database.deleteMediaItems).mockReturnValue(undefined);

      await invokeHandler('media:delete', []);

      expect(database.deleteMediaItems).toHaveBeenCalledWith([]);
    });
  });

  describe('media:getStats', () => {
    it('returns statistics (total, by source, by type)', async () => {
      const mockStats = {
        total: 150,
        bySource: { youtube: 50, local: 100 },
        byType: { video: 80, audio: 50, image: 20 },
        totalSize: 50000000000,
      };

      vi.mocked(database.getMediaItemStats).mockReturnValue(mockStats as any);

      const result = await invokeHandler('media:getStats');

      expect(database.getMediaItemStats).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it('handles empty database', async () => {
      const mockStats = {
        total: 0,
        bySource: { youtube: 0, local: 0 },
        byType: { video: 0, audio: 0, image: 0 },
        totalSize: 0,
      };

      vi.mocked(database.getMediaItemStats).mockReturnValue(mockStats as any);

      const result = await invokeHandler('media:getStats');

      expect(result.total).toBe(0);
    });
  });

  describe('indexedFolders:add', () => {
    it('adds new folder to index', async () => {
      const folderId = 1;
      const folderPath = '/media/test-folder';

      vi.mocked(database.addIndexedFolder).mockReturnValue(folderId);
      vi.mocked(fileWatcher.watchFolder).mockResolvedValue(undefined);

      const result = await invokeHandler('indexedFolders:add', folderPath);

      expect(database.addIndexedFolder).toHaveBeenCalledWith(folderPath, undefined);
      expect(fileWatcher.watchFolder).toHaveBeenCalledWith(folderId, folderPath, true);
      expect(result).toBe(folderId);
    });

    it('starts watching folder after adding', async () => {
      const folderId = 2;
      const folderPath = '/media/videos';

      vi.mocked(database.addIndexedFolder).mockReturnValue(folderId);
      vi.mocked(fileWatcher.watchFolder).mockResolvedValue(undefined);

      await invokeHandler('indexedFolders:add', folderPath, true);

      expect(fileWatcher.watchFolder).toHaveBeenCalledWith(folderId, folderPath, true);
    });

    it('handles file watcher error gracefully', async () => {
      const folderId = 3;
      const folderPath = '/media/protected';

      vi.mocked(database.addIndexedFolder).mockReturnValue(folderId);
      vi.mocked(fileWatcher.watchFolder).mockRejectedValue(new Error('Permission denied'));

      // Should not throw - error is logged
      const result = await invokeHandler('indexedFolders:add', folderPath);

      expect(result).toBe(folderId);
      expect(fileWatcher.watchFolder).toHaveBeenCalled();
    });

    it('supports recursive option', async () => {
      const folderId = 4;
      const folderPath = '/media/nested';

      vi.mocked(database.addIndexedFolder).mockReturnValue(folderId);
      vi.mocked(fileWatcher.watchFolder).mockResolvedValue(undefined);

      await invokeHandler('indexedFolders:add', folderPath, false);

      expect(database.addIndexedFolder).toHaveBeenCalledWith(folderPath, false);
      expect(fileWatcher.watchFolder).toHaveBeenCalledWith(folderId, folderPath, false);
    });
  });

  describe('indexedFolders:getAll', () => {
    it('returns all indexed folders', async () => {
      const mockFolders = [
        { id: 1, path: '/media/folder1', recursive: true, enabled: true },
        { id: 2, path: '/media/folder2', recursive: false, enabled: true },
      ];

      vi.mocked(database.getIndexedFolders).mockReturnValue(mockFolders as any);

      const result = await invokeHandler('indexedFolders:getAll');

      expect(database.getIndexedFolders).toHaveBeenCalled();
      expect(result).toEqual(mockFolders);
    });

    it('returns empty array when no folders indexed', async () => {
      vi.mocked(database.getIndexedFolders).mockReturnValue([]);

      const result = await invokeHandler('indexedFolders:getAll');

      expect(result).toEqual([]);
    });
  });

  describe('indexedFolders:get', () => {
    it('returns folder by ID', async () => {
      const mockFolder = { id: 1, path: '/media/test', recursive: true };

      vi.mocked(database.getIndexedFolder).mockReturnValue(mockFolder as any);

      const result = await invokeHandler('indexedFolders:get', 1);

      expect(database.getIndexedFolder).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockFolder);
    });

    it('returns null for non-existent ID', async () => {
      vi.mocked(database.getIndexedFolder).mockReturnValue(null);

      const result = await invokeHandler('indexedFolders:get', 999);

      expect(result).toBeNull();
    });
  });

  describe('indexedFolders:update', () => {
    it('updates folder metadata', async () => {
      const updates = {
        lastScannedAt: '2024-11-20T10:00:00Z',
        fileCount: 42,
        totalSize: 1024000,
      };

      vi.mocked(database.updateIndexedFolder).mockReturnValue(undefined);

      await invokeHandler('indexedFolders:update', 1, updates);

      expect(database.updateIndexedFolder).toHaveBeenCalledWith(1, updates);
    });

    it('starts watcher when enabled=true', async () => {
      const mockFolder = { id: 1, path: '/media/test', recursive: true };

      vi.mocked(database.getIndexedFolder).mockReturnValue(mockFolder as any);
      vi.mocked(database.updateIndexedFolder).mockReturnValue(undefined);
      vi.mocked(fileWatcher.enableFolder).mockResolvedValue(undefined);

      await invokeHandler('indexedFolders:update', 1, { enabled: true });

      expect(fileWatcher.enableFolder).toHaveBeenCalledWith(1, '/media/test', true);
    });

    it('stops watcher when enabled=false', async () => {
      const mockFolder = { id: 1, path: '/media/test', recursive: true };

      vi.mocked(database.getIndexedFolder).mockReturnValue(mockFolder as any);
      vi.mocked(database.updateIndexedFolder).mockReturnValue(undefined);
      vi.mocked(fileWatcher.disableFolder).mockResolvedValue(undefined);

      await invokeHandler('indexedFolders:update', 1, { enabled: false });

      expect(fileWatcher.disableFolder).toHaveBeenCalledWith(1);
    });

    it('handles watcher errors gracefully', async () => {
      const mockFolder = { id: 1, path: '/media/test', recursive: true };

      vi.mocked(database.getIndexedFolder).mockReturnValue(mockFolder as any);
      vi.mocked(database.updateIndexedFolder).mockReturnValue(undefined);
      vi.mocked(fileWatcher.enableFolder).mockRejectedValue(new Error('Watcher failed'));

      // Should not throw
      await invokeHandler('indexedFolders:update', 1, { enabled: true });

      expect(fileWatcher.enableFolder).toHaveBeenCalled();
    });
  });

  describe('indexedFolders:delete', () => {
    it('removes folder and stops watching', async () => {
      vi.mocked(fileWatcher.unwatchFolder).mockResolvedValue(undefined);
      vi.mocked(database.deleteIndexedFolder).mockReturnValue(undefined);

      await invokeHandler('indexedFolders:delete', 1);

      expect(fileWatcher.unwatchFolder).toHaveBeenCalledWith(1);
      expect(database.deleteIndexedFolder).toHaveBeenCalledWith(1);
    });

    it('deletes folder even if unwatching fails', async () => {
      vi.mocked(fileWatcher.unwatchFolder).mockRejectedValue(new Error('Already unwatched'));
      vi.mocked(database.deleteIndexedFolder).mockReturnValue(undefined);

      await invokeHandler('indexedFolders:delete', 1);

      expect(fileWatcher.unwatchFolder).toHaveBeenCalledWith(1);
      expect(database.deleteIndexedFolder).toHaveBeenCalledWith(1);
    });
  });

  describe('media:scanFolder', () => {
    it('starts folder scan', async () => {
      vi.mocked(indexer.scanFolder).mockResolvedValue(undefined);

      const result = await invokeHandler('media:scanFolder', '/media/test');

      expect(indexer.scanFolder).toHaveBeenCalledWith('/media/test', true);
      expect(result).toEqual({ success: true });
    });

    it('supports recursive option', async () => {
      vi.mocked(indexer.scanFolder).mockResolvedValue(undefined);

      await invokeHandler('media:scanFolder', '/media/test', false);

      expect(indexer.scanFolder).toHaveBeenCalledWith('/media/test', false);
    });

    it('defaults recursive to true', async () => {
      vi.mocked(indexer.scanFolder).mockResolvedValue(undefined);

      await invokeHandler('media:scanFolder', '/media/test');

      expect(indexer.scanFolder).toHaveBeenCalledWith('/media/test', true);
    });
  });

  describe('media:indexFile', () => {
    it('indexes single file', async () => {
      const mockItem = { id: 1, filePath: '/media/video.mp4', title: 'Video' };

      vi.mocked(indexer.indexFile).mockResolvedValue(mockItem as any);

      const result = await invokeHandler('media:indexFile', '/media/video.mp4');

      expect(indexer.indexFile).toHaveBeenCalledWith('/media/video.mp4');
      expect(result).toEqual(mockItem);
    });

    it('returns null for unsupported file', async () => {
      vi.mocked(indexer.indexFile).mockResolvedValue(null);

      const result = await invokeHandler('media:indexFile', '/media/document.txt');

      expect(result).toBeNull();
    });
  });

  describe('media:cancelIndexing', () => {
    it('cancels in-progress indexing', async () => {
      vi.mocked(indexer.cancel).mockReturnValue(undefined);

      const result = await invokeHandler('media:cancelIndexing');

      expect(indexer.cancel).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('media:getIndexingProgress', () => {
    it('returns current progress', async () => {
      const mockProgress = {
        filesFound: 100,
        filesProcessed: 42,
        currentFile: '/media/video42.mp4',
        isIndexing: true,
      };

      vi.mocked(indexer.getProgress).mockReturnValue(mockProgress as any);

      const result = await invokeHandler('media:getIndexingProgress');

      expect(indexer.getProgress).toHaveBeenCalled();
      expect(result).toEqual(mockProgress);
    });

    it('returns idle state when not indexing', async () => {
      const mockProgress = {
        filesFound: 0,
        filesProcessed: 0,
        currentFile: null,
        isIndexing: false,
      };

      vi.mocked(indexer.getProgress).mockReturnValue(mockProgress as any);

      const result = await invokeHandler('media:getIndexingProgress');

      expect(result.isIndexing).toBe(false);
    });
  });

  describe('fileWatcher:getWatchedFolders', () => {
    it('returns list of watched folders', async () => {
      const mockFolders = [
        { id: 1, path: '/media/folder1', recursive: true },
        { id: 2, path: '/media/folder2', recursive: false },
      ];

      vi.mocked(fileWatcher.getWatchedFolders).mockReturnValue(mockFolders as any);

      const result = await invokeHandler('fileWatcher:getWatchedFolders');

      expect(fileWatcher.getWatchedFolders).toHaveBeenCalled();
      expect(result).toEqual(mockFolders);
    });
  });

  describe('fileWatcher:isWatching', () => {
    it('returns true for watched folder', async () => {
      vi.mocked(fileWatcher.isWatching).mockReturnValue(true);

      const result = await invokeHandler('fileWatcher:isWatching', 1);

      expect(fileWatcher.isWatching).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('returns false for unwatched folder', async () => {
      vi.mocked(fileWatcher.isWatching).mockReturnValue(false);

      const result = await invokeHandler('fileWatcher:isWatching', 999);

      expect(result).toBe(false);
    });
  });

  describe('fileWatcher:getMaxWatchers', () => {
    it('returns max watchers limit', async () => {
      vi.mocked(fileWatcher.getMaxWatchers).mockReturnValue(100);

      const result = await invokeHandler('fileWatcher:getMaxWatchers');

      expect(fileWatcher.getMaxWatchers).toHaveBeenCalled();
      expect(result).toBe(100);
    });
  });

  describe('fileWatcher:setMaxWatchers', () => {
    it('sets max watchers limit', async () => {
      vi.mocked(fileWatcher.setMaxWatchers).mockReturnValue(undefined);

      const result = await invokeHandler('fileWatcher:setMaxWatchers', 200);

      expect(fileWatcher.setMaxWatchers).toHaveBeenCalledWith(200);
      expect(result).toEqual({ success: true });
    });
  });

  describe('Event Forwarding - Media Indexer', () => {
    let mockWindow: any;

    beforeEach(() => {
      mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: {
          send: vi.fn(),
        },
      };

      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow]);
    });

    it('forwards indexing-started event to renderer', () => {
      // Get the event listener that was registered
      const onCall = vi.mocked(indexer.on).mock.calls.find(
        (call) => call[0] === 'indexing-started'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = { folderPath: '/media/test', totalFiles: 100 };

      // Simulate event emission
      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'media:indexing-started',
        eventData
      );
    });

    it('forwards indexing-progress event', () => {
      const onCall = vi.mocked(indexer.on).mock.calls.find(
        (call) => call[0] === 'indexing-progress'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        filesFound: 100,
        filesProcessed: 50,
        currentFile: '/media/video50.mp4',
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'media:indexing-progress',
        eventData
      );
    });

    it('forwards indexing-completed event', () => {
      const onCall = vi.mocked(indexer.on).mock.calls.find(
        (call) => call[0] === 'indexing-completed'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        folderPath: '/media/test',
        processed: 95,
        skipped: 3,
        errors: 2,
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'media:indexing-completed',
        eventData
      );
    });

    it('forwards indexing-error event', () => {
      const onCall = vi.mocked(indexer.on).mock.calls.find(
        (call) => call[0] === 'indexing-error'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        folderPath: '/media/test',
        error: 'Permission denied',
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'media:indexing-error',
        eventData
      );
    });

    it('forwards file-indexed event', () => {
      const onCall = vi.mocked(indexer.on).mock.calls.find(
        (call) => call[0] === 'file-indexed'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        filePath: '/media/video.mp4',
        mediaItem: { id: 1, title: 'Video', mediaType: 'video' },
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'media:file-indexed',
        eventData
      );
    });

    it('forwards file-failed event', () => {
      const onCall = vi.mocked(indexer.on).mock.calls.find(
        (call) => call[0] === 'file-failed'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        filePath: '/media/corrupted.mp4',
        error: 'Invalid format',
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'media:file-failed',
        eventData
      );
    });

    it('skips destroyed windows', () => {
      mockWindow.isDestroyed.mockReturnValue(true);

      const onCall = vi.mocked(indexer.on).mock.calls.find(
        (call) => call[0] === 'indexing-started'
      );
      const listener = onCall![1];

      listener({ folderPath: '/media/test' });

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('forwards to multiple windows', () => {
      const mockWindow2 = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: {
          send: vi.fn(),
        },
      };

      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow, mockWindow2]);

      const onCall = vi.mocked(indexer.on).mock.calls.find(
        (call) => call[0] === 'indexing-started'
      );
      const listener = onCall![1];
      const eventData = { folderPath: '/media/test' };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'media:indexing-started',
        eventData
      );
      expect(mockWindow2.webContents.send).toHaveBeenCalledWith(
        'media:indexing-started',
        eventData
      );
    });
  });

  describe('Event Forwarding - File Watcher', () => {
    let mockWindow: any;

    beforeEach(() => {
      mockWindow = {
        isDestroyed: vi.fn().mockReturnValue(false),
        webContents: {
          send: vi.fn(),
        },
      };

      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow]);
    });

    it('forwards file-added event', () => {
      const onCall = vi.mocked(fileWatcher.on).mock.calls.find(
        (call) => call[0] === 'file-added'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        folderId: 1,
        filePath: '/media/new-video.mp4',
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'fileWatcher:file-added',
        eventData
      );
    });

    it('forwards file-changed event', () => {
      const onCall = vi.mocked(fileWatcher.on).mock.calls.find(
        (call) => call[0] === 'file-changed'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        folderId: 1,
        filePath: '/media/video.mp4',
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'fileWatcher:file-changed',
        eventData
      );
    });

    it('forwards file-removed event', () => {
      const onCall = vi.mocked(fileWatcher.on).mock.calls.find(
        (call) => call[0] === 'file-removed'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        folderId: 1,
        filePath: '/media/deleted.mp4',
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'fileWatcher:file-removed',
        eventData
      );
    });

    it('forwards watcher-started event', () => {
      const onCall = vi.mocked(fileWatcher.on).mock.calls.find(
        (call) => call[0] === 'watcher-started'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        folderId: 1,
        folderPath: '/media/test',
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'fileWatcher:watcher-started',
        eventData
      );
    });

    it('forwards watcher-stopped event', () => {
      const onCall = vi.mocked(fileWatcher.on).mock.calls.find(
        (call) => call[0] === 'watcher-stopped'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        folderId: 1,
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'fileWatcher:watcher-stopped',
        eventData
      );
    });

    it('forwards watcher-error event', () => {
      const onCall = vi.mocked(fileWatcher.on).mock.calls.find(
        (call) => call[0] === 'watcher-error'
      );
      expect(onCall).toBeDefined();

      const listener = onCall![1];
      const eventData = {
        folderId: 1,
        error: 'Too many open files',
      };

      listener(eventData);

      expect(mockWindow.webContents.send).toHaveBeenCalledWith(
        'fileWatcher:watcher-error',
        eventData
      );
    });
  });

  describe('Error Handling', () => {
    it('handles database errors in media:getAll', async () => {
      vi.mocked(database.getMediaItems).mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      await expect(invokeHandler('media:getAll')).rejects.toThrow('Database connection failed');
    });

    it('handles indexer errors in media:scanFolder', async () => {
      vi.mocked(indexer.scanFolder).mockRejectedValue(new Error('Folder not found'));

      await expect(invokeHandler('media:scanFolder', '/invalid/path')).rejects.toThrow(
        'Folder not found'
      );
    });

    it('handles database errors in indexedFolders:add', async () => {
      vi.mocked(database.addIndexedFolder).mockImplementation(() => {
        throw new Error('Duplicate folder');
      });

      await expect(invokeHandler('indexedFolders:add', '/media/test')).rejects.toThrow(
        'Duplicate folder'
      );
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined options in media:getAll', async () => {
      vi.mocked(database.getMediaItems).mockReturnValue([]);

      await invokeHandler('media:getAll', undefined);

      expect(database.getMediaItems).toHaveBeenCalledWith(undefined);
    });

    it('handles empty string paths', async () => {
      vi.mocked(indexer.scanFolder).mockResolvedValue(undefined);

      await invokeHandler('media:scanFolder', '');

      expect(indexer.scanFolder).toHaveBeenCalledWith('', true);
    });

    it('handles negative IDs gracefully', async () => {
      vi.mocked(database.getMediaItem).mockReturnValue(null);

      const result = await invokeHandler('media:get', -1);

      expect(result).toBeNull();
    });

    it('handles very large arrays in media:delete', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      vi.mocked(database.deleteMediaItems).mockReturnValue(undefined);

      await invokeHandler('media:delete', largeArray);

      expect(database.deleteMediaItems).toHaveBeenCalledWith(largeArray);
    });
  });
});
