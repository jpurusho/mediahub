import { EventEmitter } from 'events';
import path from 'path';
import { indexer } from './media-indexer';
import {
  getIndexedFolders,
  getMediaItemByPath,
  deleteMediaItems,
  type IndexedFolderRow,
} from './database';

// Dynamic import for ES module
let chokidar: any;

// Supported file extensions (must match media-indexer)
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.flv', '.wmv', '.mpg', '.mpeg', '.3gp'];
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.flac', '.wav', '.ogg', '.opus', '.wma', '.alac'];
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp', '.tiff'];
const HTML_EXTENSIONS = ['.html', '.htm'];
const JSON_EXTENSIONS = ['.json'];
const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];
const PDF_EXTENSIONS = ['.pdf'];
const TEXT_EXTENSIONS = ['.txt', '.log'];

const ALL_MEDIA_EXTENSIONS = new Set([
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...IMAGE_EXTENSIONS,
  ...HTML_EXTENSIONS,
  ...JSON_EXTENSIONS,
  ...MARKDOWN_EXTENSIONS,
  ...PDF_EXTENSIONS,
  ...TEXT_EXTENSIONS,
]);

/**
 * FileWatcher - Monitors indexed folders for file changes
 *
 * Events:
 * - 'file-added': { filePath: string, folderId: number }
 * - 'file-changed': { filePath: string, folderId: number }
 * - 'file-removed': { filePath: string, folderId: number }
 * - 'watcher-started': { folderId: number, folderPath: string }
 * - 'watcher-stopped': { folderId: number }
 * - 'watcher-error': { folderId: number, error: string }
 */
export class FileWatcher extends EventEmitter {
  private watchers: Map<number, any> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private folderPaths: Map<number, string> = new Map();
  private isInitialized = false;
  private maxWatchers = 10; // Performance limit

  /**
   * Initialize chokidar ES module
   */
  private async ensureChokidar(): Promise<void> {
    if (chokidar) return;

    try {
      chokidar = (await import('chokidar')).default;
    } catch (error: any) {
      console.error('[FileWatcher] Failed to load chokidar:', error.message);
      throw error;
    }
  }

  /**
   * Initialize all watchers from database on app startup
   */
  async initializeWatchers(): Promise<void> {
    if (this.isInitialized) {
      console.log('[FileWatcher] Already initialized');
      return;
    }

    try {
      console.log('[FileWatcher] Initializing watchers...');

      // Load chokidar module
      await this.ensureChokidar();

      const folders = getIndexedFolders();
      const enabledFolders = folders.filter((f) => f.enabled);

      if (enabledFolders.length > this.maxWatchers) {
        console.warn(
          `[FileWatcher] Found ${enabledFolders.length} enabled folders, but limit is ${this.maxWatchers}. Only watching first ${this.maxWatchers}.`
        );
      }

      let started = 0;
      for (const folder of enabledFolders.slice(0, this.maxWatchers)) {
        try {
          await this.watchFolder(folder.id, folder.path, folder.recursive);
          started++;
        } catch (error: any) {
          console.error(`[FileWatcher] Failed to watch folder ${folder.id}:`, error.message);
          this.emit('watcher-error', { folderId: folder.id, error: error.message });
        }
      }

      this.isInitialized = true;
      console.log(`[FileWatcher] Initialized ${started}/${enabledFolders.length} watchers`);
    } catch (error: any) {
      console.error('[FileWatcher] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start watching a folder for file changes
   */
  async watchFolder(folderId: number, folderPath: string, recursive: boolean): Promise<void> {
    // Ensure chokidar is loaded
    await this.ensureChokidar();

    // Stop existing watcher if any
    if (this.watchers.has(folderId)) {
      console.log(`[FileWatcher] Stopping existing watcher for folder ${folderId}`);
      await this.unwatchFolder(folderId);
    }

    // Check watcher limit
    if (this.watchers.size >= this.maxWatchers) {
      throw new Error(
        `Cannot watch more than ${this.maxWatchers} folders simultaneously. Stop some watchers first.`
      );
    }

    console.log(`[FileWatcher] Starting watcher for: ${folderPath} (recursive: ${recursive})`);

    try {
      const watcher = chokidar.watch(folderPath, {
        ignored: [
          /(^|[\/\\])\../, // ignore dotfiles
          /node_modules/,
          /.git/,
          /Library/,
          /System/,
          /$RECYCLE.BIN/,
        ],
        persistent: true,
        ignoreInitial: true, // don't trigger for existing files
        depth: recursive ? undefined : 0, // limit depth if not recursive
        awaitWriteFinish: {
          stabilityThreshold: 1000, // wait 1s after write stops
          pollInterval: 100,
        },
        followSymlinks: false,
      });

      // Store folder info
      this.folderPaths.set(folderId, folderPath);

      // Handle new files
      watcher.on('add', (filePath) => {
        this.handleFileAdd(folderId, filePath);
      });

      // Handle file changes
      watcher.on('change', (filePath) => {
        this.handleFileChange(folderId, filePath);
      });

      // Handle file deletions
      watcher.on('unlink', (filePath) => {
        this.handleFileRemove(folderId, filePath);
      });

      // Handle errors
      watcher.on('error', (error: any) => {
        console.error(`[FileWatcher] Error in folder ${folderId}:`, error);
        this.emit('watcher-error', { folderId, error: error?.message || String(error) });
      });

      // Wait for watcher to be ready
      await new Promise<void>((resolve, reject) => {
        watcher.on('ready', () => {
          console.log(`[FileWatcher] Watcher ready for folder ${folderId}`);
          resolve();
        });
        watcher.on('error', reject);
        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('Watcher initialization timeout')), 10000);
      });

      this.watchers.set(folderId, watcher);
      this.emit('watcher-started', { folderId, folderPath });
    } catch (error: any) {
      console.error(`[FileWatcher] Failed to create watcher for ${folderPath}:`, error);
      throw error;
    }
  }

  /**
   * Stop watching a folder
   */
  async unwatchFolder(folderId: number): Promise<void> {
    const watcher = this.watchers.get(folderId);
    if (!watcher) {
      console.log(`[FileWatcher] No watcher found for folder ${folderId}`);
      return;
    }

    console.log(`[FileWatcher] Stopping watcher for folder ${folderId}`);

    try {
      await watcher.close();
      this.watchers.delete(folderId);
      this.folderPaths.delete(folderId);

      // Clear any pending debounce timers for this folder
      const folderPath = this.folderPaths.get(folderId);
      if (folderPath) {
        for (const [key, timer] of this.debounceTimers.entries()) {
          if (key.startsWith(`${folderId}:`)) {
            clearTimeout(timer);
            this.debounceTimers.delete(key);
          }
        }
      }

      this.emit('watcher-stopped', { folderId });
    } catch (error: any) {
      console.error(`[FileWatcher] Error stopping watcher for folder ${folderId}:`, error);
      throw error;
    }
  }

  /**
   * Stop all watchers (e.g., before app quit)
   */
  async stopAll(): Promise<void> {
    console.log('[FileWatcher] Stopping all watchers...');

    const folderIds = Array.from(this.watchers.keys());
    await Promise.all(folderIds.map((id) => this.unwatchFolder(id)));

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    this.isInitialized = false;
    console.log('[FileWatcher] All watchers stopped');
  }

  /**
   * Enable watching for a folder (called when folder is enabled)
   */
  async enableFolder(folderId: number, folderPath: string, recursive: boolean): Promise<void> {
    if (!this.watchers.has(folderId)) {
      await this.watchFolder(folderId, folderPath, recursive);
    }
  }

  /**
   * Disable watching for a folder (called when folder is disabled)
   */
  async disableFolder(folderId: number): Promise<void> {
    if (this.watchers.has(folderId)) {
      await this.unwatchFolder(folderId);
    }
  }

  /**
   * Get list of currently watched folder IDs
   */
  getWatchedFolders(): number[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Check if a folder is currently being watched
   */
  isWatching(folderId: number): boolean {
    return this.watchers.has(folderId);
  }

  /**
   * Handle file added event
   */
  private handleFileAdd(folderId: number, filePath: string): void {
    // Check if it's a media file
    if (!this.isMediaFile(filePath)) {
      return;
    }

    console.log(`[FileWatcher] File added: ${path.basename(filePath)}`);

    // Debounce to avoid rapid-fire indexing
    this.debounce(`${folderId}:add:${filePath}`, async () => {
      try {
        const mediaItem = await indexer.indexFile(filePath);
        if (mediaItem) {
          this.emit('file-added', { filePath, folderId });
          console.log(`[FileWatcher] Successfully indexed new file: ${path.basename(filePath)}`);
        }
      } catch (error: any) {
        console.error(`[FileWatcher] Failed to index new file ${filePath}:`, error.message);
      }
    }, 1000);
  }

  /**
   * Handle file changed event
   */
  private handleFileChange(folderId: number, filePath: string): void {
    // Check if it's a media file
    if (!this.isMediaFile(filePath)) {
      return;
    }

    console.log(`[FileWatcher] File changed: ${path.basename(filePath)}`);

    // Debounce to avoid rapid-fire re-indexing
    this.debounce(`${folderId}:change:${filePath}`, async () => {
      try {
        // Re-index the file (indexer will update existing entry)
        const mediaItem = await indexer.indexFile(filePath);
        if (mediaItem) {
          this.emit('file-changed', { filePath, folderId });
          console.log(`[FileWatcher] Successfully re-indexed changed file: ${path.basename(filePath)}`);
        }
      } catch (error: any) {
        console.error(`[FileWatcher] Failed to re-index changed file ${filePath}:`, error.message);
      }
    }, 1000);
  }

  /**
   * Handle file removed event
   */
  private handleFileRemove(folderId: number, filePath: string): void {
    // Check if it's a media file
    if (!this.isMediaFile(filePath)) {
      return;
    }

    console.log(`[FileWatcher] File removed: ${path.basename(filePath)}`);

    // Debounce to avoid rapid-fire deletions
    this.debounce(`${folderId}:remove:${filePath}`, async () => {
      try {
        // Check if file is in database
        const mediaItem = await getMediaItemByPath(filePath);
        if (mediaItem) {
          // Delete from database
          deleteMediaItems([mediaItem.id]);
          this.emit('file-removed', { filePath, folderId });
          console.log(`[FileWatcher] Removed deleted file from database: ${path.basename(filePath)}`);
        }
      } catch (error: any) {
        console.error(`[FileWatcher] Failed to remove deleted file ${filePath}:`, error.message);
      }
    }, 1000);
  }

  /**
   * Check if a file is a supported media file
   */
  private isMediaFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ALL_MEDIA_EXTENSIONS.has(ext);
  }

  /**
   * Debounce a callback to avoid rapid-fire execution
   */
  private debounce(key: string, callback: () => void, delay: number): void {
    const existing = this.debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      callback();
    }, delay);

    this.debounceTimers.set(key, timer);
  }

  /**
   * Set maximum number of concurrent watchers (for testing/performance tuning)
   */
  setMaxWatchers(max: number): void {
    if (max < 1) {
      throw new Error('maxWatchers must be at least 1');
    }
    this.maxWatchers = max;
    console.log(`[FileWatcher] Max watchers set to ${max}`);
  }

  /**
   * Get current max watchers limit
   */
  getMaxWatchers(): number {
    return this.maxWatchers;
  }
}

// Export singleton instance
export const fileWatcher = new FileWatcher();
