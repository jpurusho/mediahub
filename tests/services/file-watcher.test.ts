/**
 * Comprehensive tests for FileWatcher service
 * Tests cover: initialization, folder watching, file events, debouncing, error handling
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

// Create mock objects that can be accessed both in factory and tests
const mockWatcher = {
  on: vi.fn().mockReturnThis(),
  close: vi.fn(async () => {}),
};

const mockChokidar = {
  watch: vi.fn(() => mockWatcher),
};

// Mock chokidar module
vi.mock('chokidar', () => ({
  default: mockChokidar,
}));

// Mock indexer
vi.mock('../../desktop/services/media-indexer', () => ({
  indexer: {
    indexFile: vi.fn(async () => ({ id: 1, title: 'Test' })),
  },
}));

// Mock database
vi.mock('../../desktop/services/database', () => ({
  getIndexedFolders: vi.fn(() => [
    { id: 1, path: '/test/folder1', recursive: true, enabled: true },
    { id: 2, path: '/test/folder2', recursive: false, enabled: true },
    { id: 3, path: '/test/folder3', recursive: true, enabled: false },
  ]),
  getMediaItemByPath: vi.fn(async () => ({ id: 1, filePath: '/test/file.mp4' })),
  deleteMediaItems: vi.fn(async () => {}),
}));

import { FileWatcher } from '../../desktop/services/file-watcher';
import { indexer } from '../../desktop/services/media-indexer';
import {
  getIndexedFolders,
  getMediaItemByPath,
  deleteMediaItems,
} from '../../desktop/services/database';

describe('FileWatcher', () => {
  let fileWatcher: FileWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    fileWatcher = new FileWatcher();

    // Set up default mock implementation for watcher.on
    mockWatcher.on.mockImplementation((event: string, handler: Function) => {
      if (event === 'ready') {
        // Call ready handler asynchronously
        setTimeout(() => handler(), 0);
      }
      return mockWatcher;
    });

    // Reset close mock
    mockWatcher.close.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    await fileWatcher.stopAll();
  });

  describe('FileWatcher initialization', () => {
    it('creates FileWatcher instance', () => {
      expect(fileWatcher).toBeDefined();
      expect(fileWatcher).toBeInstanceOf(EventEmitter);
    });

    it('starts with empty watchers map', () => {
      expect(fileWatcher.getWatchedFolders()).toEqual([]);
    });

    it('initializes all enabled folders from database', async () => {
      await fileWatcher.initializeWatchers();

      // Should watch only enabled folders (folder 1 and 2, not 3)
      expect(mockChokidar.watch).toHaveBeenCalledTimes(2);
      expect(mockChokidar.watch).toHaveBeenCalledWith(
        '/test/folder1',
        expect.objectContaining({ depth: undefined }) // recursive: true
      );
      expect(mockChokidar.watch).toHaveBeenCalledWith(
        '/test/folder2',
        expect.objectContaining({ depth: 0 }) // recursive: false
      );
    });

    it('skips disabled folders during initialization', async () => {
      await fileWatcher.initializeWatchers();

      const watchedFolders = fileWatcher.getWatchedFolders();
      expect(watchedFolders).toHaveLength(2);
      expect(watchedFolders).toContain(1);
      expect(watchedFolders).toContain(2);
      expect(watchedFolders).not.toContain(3); // disabled folder
    });

    it('respects maxWatchers limit', async () => {
      // Mock 12 enabled folders but limit is 10
      (getIndexedFolders as any).mockReturnValueOnce(
        Array.from({ length: 12 }, (_, i) => ({
          id: i + 1,
          path: `/test/folder${i + 1}`,
          recursive: true,
          enabled: true,
        }))
      );

      await fileWatcher.initializeWatchers();

      // Should only start 10 watchers
      expect(mockChokidar.watch).toHaveBeenCalledTimes(10);
      expect(fileWatcher.getWatchedFolders()).toHaveLength(10);
    });

    it('does not re-initialize if already initialized', async () => {
      await fileWatcher.initializeWatchers();
      const firstCallCount = mockChokidar.watch.mock.calls.length;

      // Try to initialize again
      await fileWatcher.initializeWatchers();
      const secondCallCount = mockChokidar.watch.mock.calls.length;

      // Should not create more watchers
      expect(firstCallCount).toBe(secondCallCount);
    });
  });

  describe('watchFolder', () => {
    it('starts watching a folder', async () => {
      await fileWatcher.watchFolder(10, '/new/folder', true);

      expect(mockChokidar.watch).toHaveBeenCalledWith(
        '/new/folder',
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
          depth: undefined, // recursive: true
        })
      );
      expect(fileWatcher.isWatching(10)).toBe(true);
    });

    it('watches recursively when folder is recursive', async () => {
      await fileWatcher.watchFolder(11, '/recursive/folder', true);

      expect(mockChokidar.watch).toHaveBeenCalledWith(
        '/recursive/folder',
        expect.objectContaining({ depth: undefined })
      );
    });

    it('watches non-recursively when recursive is false', async () => {
      await fileWatcher.watchFolder(12, '/flat/folder', false);

      expect(mockChokidar.watch).toHaveBeenCalledWith(
        '/flat/folder',
        expect.objectContaining({ depth: 0 })
      );
    });

    it('emits watcher-started event', async () => {
      const listener = vi.fn();
      fileWatcher.on('watcher-started', listener);

      await fileWatcher.watchFolder(13, '/event/folder', true);

      expect(listener).toHaveBeenCalledWith({
        folderId: 13,
        folderPath: '/event/folder',
      });
    });

    it('rejects when max watchers reached', async () => {
      fileWatcher.setMaxWatchers(2);

      // Start 2 watchers
      await fileWatcher.watchFolder(1, '/folder1', true);
      await fileWatcher.watchFolder(2, '/folder2', true);

      // Try to start 3rd watcher
      await expect(fileWatcher.watchFolder(3, '/folder3', true)).rejects.toThrow(
        'Cannot watch more than 2 folders simultaneously'
      );
    });

    it('replaces existing watcher for same folder', async () => {
      await fileWatcher.watchFolder(20, '/duplicate/folder', true);
      const firstCallCount = mockChokidar.watch.mock.calls.length;

      // Watch same folder again (should stop existing and start new)
      await fileWatcher.watchFolder(20, '/duplicate/folder', true);
      const secondCallCount = mockChokidar.watch.mock.calls.length;

      // Should close old watcher and create new one
      expect(mockWatcher.close).toHaveBeenCalled();
      expect(secondCallCount).toBe(firstCallCount + 1);
      expect(fileWatcher.getWatchedFolders()).toHaveLength(1);
    });
  });

  describe('unwatchFolder', () => {
    it('stops watching and removes watcher', async () => {
      await fileWatcher.watchFolder(30, '/stop/folder', true);
      expect(fileWatcher.isWatching(30)).toBe(true);

      await fileWatcher.unwatchFolder(30);

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(fileWatcher.isWatching(30)).toBe(false);
    });

    it('emits watcher-stopped event', async () => {
      const listener = vi.fn();
      fileWatcher.on('watcher-stopped', listener);

      await fileWatcher.watchFolder(31, '/stop/event', true);
      await fileWatcher.unwatchFolder(31);

      expect(listener).toHaveBeenCalledWith({ folderId: 31 });
    });

    it('handles unwatching non-existent watcher gracefully', async () => {
      // Should not throw
      await expect(fileWatcher.unwatchFolder(999)).resolves.toBeUndefined();
    });
  });

  describe('file event handling', () => {
    it('indexes new file when add event fires', async () => {
      await fileWatcher.watchFolder(40, '/test', true);

      const addHandler = mockWatcher.on.mock.calls.find((c) => c[0] === 'add')?.[1];
      expect(addHandler).toBeDefined();

      // Trigger add event
      addHandler?.('/test/new-video.mp4');

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(indexer.indexFile).toHaveBeenCalledWith('/test/new-video.mp4');
    });

    it('emits file-added event after indexing', async () => {
      const listener = vi.fn();
      fileWatcher.on('file-added', listener);

      await fileWatcher.watchFolder(41, '/test', true);

      const addHandler = mockWatcher.on.mock.calls.find((c) => c[0] === 'add')?.[1];
      addHandler?.('/test/new-video.mp4');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(listener).toHaveBeenCalledWith({
        filePath: '/test/new-video.mp4',
        folderId: 41,
      });
    });

    it('re-indexes file when change event fires', async () => {
      await fileWatcher.watchFolder(42, '/test', true);

      const changeHandler = mockWatcher.on.mock.calls.find((c) => c[0] === 'change')?.[1];
      expect(changeHandler).toBeDefined();

      changeHandler?.('/test/changed-video.mp4');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(indexer.indexFile).toHaveBeenCalledWith('/test/changed-video.mp4');
    });

    it('removes file from database when unlink event fires', async () => {
      await fileWatcher.watchFolder(44, '/test', true);

      const unlinkHandler = mockWatcher.on.mock.calls.find((c) => c[0] === 'unlink')?.[1];
      expect(unlinkHandler).toBeDefined();

      unlinkHandler?.('/test/deleted-video.mp4');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      expect(getMediaItemByPath).toHaveBeenCalledWith('/test/deleted-video.mp4');
      expect(deleteMediaItems).toHaveBeenCalledWith([1]);
    });

    it('filters non-media files', async () => {
      await fileWatcher.watchFolder(47, '/test', true);

      const addHandler = mockWatcher.on.mock.calls.find((c) => c[0] === 'add')?.[1];

      // Trigger add for non-media files
      addHandler?.('/test/document.txt');
      addHandler?.('/test/readme.md');
      addHandler?.('/test/script.js');

      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should not index non-media files
      expect(indexer.indexFile).not.toHaveBeenCalled();
    });

    it('handles all supported media extensions', async () => {
      await fileWatcher.watchFolder(48, '/test', true);

      const addHandler = mockWatcher.on.mock.calls.find((c) => c[0] === 'add')?.[1];

      const mediaExts = ['.mp4', '.mkv', '.mp3', '.flac', '.jpg', '.png'];

      for (const ext of mediaExts) {
        (indexer.indexFile as any).mockClear();
        addHandler?.(`/test/media${ext}`);
        await new Promise((resolve) => setTimeout(resolve, 1100));
        expect(indexer.indexFile).toHaveBeenCalledWith(`/test/media${ext}`);
      }
    });
  });

  describe('error handling', () => {
    it('emits watcher-error when chokidar errors', async () => {
      const errorListener = vi.fn();
      fileWatcher.on('watcher-error', errorListener);

      await fileWatcher.watchFolder(60, '/test', true);

      // Trigger error event
      const errorHandler = mockWatcher.on.mock.calls.find((c) => c[0] === 'error')?.[1];
      errorHandler?.(new Error('Watch error'));

      expect(errorListener).toHaveBeenCalledWith({
        folderId: 60,
        error: 'Watch error',
      });
    });
  });

  describe('stopAll', () => {
    it('stops all active watchers', async () => {
      // Start 3 watchers
      await fileWatcher.watchFolder(70, '/folder1', true);
      await fileWatcher.watchFolder(71, '/folder2', true);
      await fileWatcher.watchFolder(72, '/folder3', true);

      expect(fileWatcher.getWatchedFolders()).toHaveLength(3);

      mockWatcher.close.mockClear();
      await fileWatcher.stopAll();

      expect(mockWatcher.close).toHaveBeenCalledTimes(3);
      expect(fileWatcher.getWatchedFolders()).toHaveLength(0);
    });

    it('handles empty watchers list', async () => {
      // Should not throw
      await expect(fileWatcher.stopAll()).resolves.toBeUndefined();
    });
  });

  describe('isWatching', () => {
    it('returns true for watched folder', async () => {
      await fileWatcher.watchFolder(80, '/test', true);
      expect(fileWatcher.isWatching(80)).toBe(true);
    });

    it('returns false for unwatched folder', () => {
      expect(fileWatcher.isWatching(999)).toBe(false);
    });

    it('returns false after unwatching', async () => {
      await fileWatcher.watchFolder(81, '/test', true);
      expect(fileWatcher.isWatching(81)).toBe(true);

      await fileWatcher.unwatchFolder(81);
      expect(fileWatcher.isWatching(81)).toBe(false);
    });
  });

  describe('getWatchedFolders', () => {
    it('returns array of watched folder IDs', async () => {
      await fileWatcher.watchFolder(90, '/folder1', true);
      await fileWatcher.watchFolder(91, '/folder2', true);
      await fileWatcher.watchFolder(92, '/folder3', true);

      const watched = fileWatcher.getWatchedFolders();
      expect(watched).toEqual([90, 91, 92]);
    });

    it('returns empty array when no folders watched', () => {
      expect(fileWatcher.getWatchedFolders()).toEqual([]);
    });

    it('updates after unwatching', async () => {
      await fileWatcher.watchFolder(93, '/folder1', true);
      await fileWatcher.watchFolder(94, '/folder2', true);

      expect(fileWatcher.getWatchedFolders()).toEqual([93, 94]);

      await fileWatcher.unwatchFolder(93);

      expect(fileWatcher.getWatchedFolders()).toEqual([94]);
    });
  });

  describe('maxWatchers', () => {
    it('gets current max watchers limit', () => {
      expect(fileWatcher.getMaxWatchers()).toBe(10); // Default
    });

    it('sets new max watchers limit', () => {
      fileWatcher.setMaxWatchers(5);
      expect(fileWatcher.getMaxWatchers()).toBe(5);
    });

    it('rejects invalid max watchers value', () => {
      expect(() => fileWatcher.setMaxWatchers(0)).toThrow('maxWatchers must be at least 1');
      expect(() => fileWatcher.setMaxWatchers(-1)).toThrow('maxWatchers must be at least 1');
    });

    it('allows setting max watchers to 1', () => {
      expect(() => fileWatcher.setMaxWatchers(1)).not.toThrow();
      expect(fileWatcher.getMaxWatchers()).toBe(1);
    });
  });

  describe('enableFolder and disableFolder', () => {
    it('enableFolder starts watching if not already watching', async () => {
      await fileWatcher.enableFolder(100, '/enabled', true);
      expect(fileWatcher.isWatching(100)).toBe(true);
    });

    it('disableFolder stops watching if watching', async () => {
      await fileWatcher.watchFolder(102, '/test', true);
      expect(fileWatcher.isWatching(102)).toBe(true);

      await fileWatcher.disableFolder(102);
      expect(fileWatcher.isWatching(102)).toBe(false);
    });

    it('disableFolder does nothing if not watching', async () => {
      // Should not throw
      await expect(fileWatcher.disableFolder(999)).resolves.toBeUndefined();
    });
  });

  describe('chokidar configuration', () => {
    it('configures chokidar with correct options', async () => {
      await fileWatcher.watchFolder(110, '/test', true);

      expect(mockChokidar.watch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          persistent: true,
          ignoreInitial: true,
          followSymlinks: false,
          awaitWriteFinish: {
            stabilityThreshold: 1000,
            pollInterval: 100,
          },
        })
      );
    });

    it('ignores system folders and files', async () => {
      await fileWatcher.watchFolder(111, '/test', true);

      const config = mockChokidar.watch.mock.calls[0][1];
      expect(config.ignored).toEqual(
        expect.arrayContaining([
          expect.any(RegExp), // dotfiles
          /node_modules/,
          /.git/,
        ])
      );
    });
  });
});
