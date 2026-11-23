import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import type { AuthTokens, UserInfo, QueueItem, DownloadRecord, DownloadRequest, LibraryItem, MediaItem, IndexedFolder, Transcript, TranscriptOptions, TranscriptSearchResult } from '../../shared/types';

// Database row types (what SQLite returns)
interface DatabaseRow {
  [key: string]: string | number | null;
}

interface ColumnInfo {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
}

let db: Database.Database;

const CONFIG_DIR = path.join(os.homedir(), '.ytd');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

interface AppConfig {
  dataDir?: string;
}

function loadConfig(): AppConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch {}
  return {};
}

function saveConfig(config: AppConfig): void {
  try {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error('Failed to save config:', err);
  }
}

export function getDataDir(): string {
  const config = loadConfig();
  return config.dataDir || app.getPath('userData');
}

export function setDataDir(dir: string): void {
  const config = loadConfig();
  config.dataDir = dir;
  saveConfig(config);
}

function getDbPath(): string {
  return path.join(getDataDir(), 'ytd.db');
}

export function initDatabase(): void {
  const dbPath = getDbPath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_type TEXT,
      expiry_date INTEGER,
      scope TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_info (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      email TEXT NOT NULL,
      name TEXT,
      picture TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      title TEXT NOT NULL,
      channel TEXT,
      channel_id TEXT,
      thumbnail_url TEXT,
      url TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'mp4',
      quality TEXT DEFAULT 'best',
      resolution TEXT,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      start_time TEXT,
      end_time TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      error TEXT,
      downloaded_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      title TEXT NOT NULL,
      channel TEXT,
      thumbnail_url TEXT,
      url TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'mp4',
      quality TEXT DEFAULT 'best',
      resolution TEXT,
      start_time TEXT,
      end_time TEXT,
      priority INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL DEFAULT 0,
      downloaded_bytes INTEGER DEFAULT 0,
      total_bytes INTEGER DEFAULT 0,
      speed TEXT,
      eta TEXT,
      error TEXT,
      temp_file_path TEXT,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      next_retry_at TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS local_playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      youtube_playlist_id TEXT,
      last_synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS local_playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      video_id TEXT NOT NULL,
      title TEXT NOT NULL,
      channel TEXT,
      thumbnail_url TEXT,
      duration INTEGER DEFAULT 0,
      published_at TEXT,
      position INTEGER NOT NULL DEFAULT 0,
      added_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (playlist_id) REFERENCES local_playlists(id) ON DELETE CASCADE,
      UNIQUE(playlist_id, video_id)
    );

    CREATE TABLE IF NOT EXISTS library (
      video_id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      channel TEXT,
      channel_id TEXT,
      thumbnail_url TEXT,
      url TEXT NOT NULL,
      format TEXT,
      quality TEXT,
      resolution TEXT,
      file_path TEXT,
      file_size INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0,
      published_at TEXT,
      downloaded_at TEXT,
      added_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL,
      format TEXT NOT NULL DEFAULT 'json',
      language TEXT,
      transcript_text TEXT,
      transcript_json TEXT,
      word_count INTEGER,
      duration_seconds INTEGER,
      method TEXT,
      model TEXT,
      status TEXT DEFAULT 'pending',
      error TEXT,
      progress REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (video_id) REFERENCES library(video_id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_transcripts_video_id ON transcripts(video_id);
    CREATE INDEX IF NOT EXISTS idx_transcripts_status ON transcripts(status);

    CREATE VIRTUAL TABLE IF NOT EXISTS transcripts_fts USING fts5(
      video_id UNINDEXED,
      transcript_text,
      content=transcripts,
      content_rowid=id
    );
  `);

  // Migration: add published_at if missing
  const playlistItemCols = db.pragma('table_info(local_playlist_items)') as any[];
  const playlistItemColNames = new Set(playlistItemCols.map((c: ColumnInfo) => c.name));
  if (!playlistItemColNames.has('published_at')) {
    db.exec('ALTER TABLE local_playlist_items ADD COLUMN published_at TEXT');
  }

  // Migration: add retry columns to queue if missing
  const queueCols = db.pragma('table_info(queue)') as any[];
  const queueColNames = new Set(queueCols.map((c: ColumnInfo) => c.name));
  if (!queueColNames.has('retry_count')) {
    db.exec('ALTER TABLE queue ADD COLUMN retry_count INTEGER DEFAULT 0');
  }
  if (!queueColNames.has('max_retries')) {
    db.exec('ALTER TABLE queue ADD COLUMN max_retries INTEGER DEFAULT 3');
  }
  if (!queueColNames.has('next_retry_at')) {
    db.exec('ALTER TABLE queue ADD COLUMN next_retry_at TEXT');
  }

  runMigrations();
}

function runMigrations(): void {
  const version = getSetting('schema_version');
  const currentVersion = parseInt(version || '1', 10);

  if (currentVersion < 2) {
    migrateToV2();
  }
  if (currentVersion < 3) {
    migrateToV3();
  }
}

function migrateToV2(): void {
  console.log('[db] Running migration to schema v2 (library table)...');

  const outputDir = getSetting('output_dir') || path.join(os.homedir(), 'Downloads');

  const migrate = db.transaction(() => {
    // 1. Populate library from downloads (dedup: keep most recent per video_id)
    db.exec(`
      INSERT OR IGNORE INTO library (video_id, title, channel, channel_id, thumbnail_url, url, format, quality, resolution, file_path, file_size, duration, downloaded_at, added_at, updated_at)
      SELECT video_id, title, channel, channel_id, thumbnail_url, url, format, quality, resolution, file_path, file_size, duration, downloaded_at, downloaded_at, downloaded_at
      FROM downloads
      WHERE id IN (
        SELECT id FROM downloads d1
        WHERE d1.id = (SELECT MAX(d2.id) FROM downloads d2 WHERE d2.video_id = d1.video_id)
      )
    `);

    // 2. Populate library from playlist items not already there
    db.exec(`
      INSERT OR IGNORE INTO library (video_id, title, channel, thumbnail_url, url, duration, published_at, added_at, updated_at)
      SELECT video_id, title, channel, thumbnail_url,
             'https://www.youtube.com/watch?v=' || video_id,
             duration, published_at, added_at, added_at
      FROM local_playlist_items
      WHERE video_id NOT IN (SELECT video_id FROM library)
    `);

    // 3. Convert absolute paths to relative in library
    const items = db.prepare('SELECT video_id, file_path FROM library WHERE file_path IS NOT NULL').all() as any[];
    const updatePath = db.prepare('UPDATE library SET file_path = ? WHERE video_id = ?');
    for (const item of items) {
      if (item.file_path && item.file_path.startsWith(outputDir)) {
        const relative = item.file_path.slice(outputDir.length).replace(/^[\/\\]/, '');
        updatePath.run(relative, item.video_id);
      }
    }

    // 4. Set schema version
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '2', datetime('now'))").run();
  });

  migrate();
  console.log('[db] Migration to schema v2 complete.');
}

/**
 * Migration Strategy for v3: Unified Media Library
 *
 * This migration transforms ytd from a YouTube-only tool into MediaHub - a comprehensive
 * media library manager supporting both YouTube and local media files.
 *
 * Changes:
 * 1. Create media_items table (unified storage for YouTube + local media)
 * 2. Create indexed_folders table (track scanned local directories)
 * 3. Migrate existing library data to media_items with source='youtube'
 * 4. Add media_item_id column to transcripts for future local media support
 * 5. Add indexes for performance
 *
 * Idempotency: Safe to run multiple times - checks for existing tables/columns
 * Backward compatibility: Preserves library table and all existing data
 */
function migrateToV3(): void {
  console.log('[db] Running migration to schema v3 (unified media library)...');

  const migrate = db.transaction(() => {
    // Check if media_items table already exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name='media_items'
    `).get();

    if (!tableExists) {
      // 1. Create media_items table
      db.exec(`
        CREATE TABLE media_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,

          -- Source identification
          source TEXT NOT NULL CHECK(source IN ('youtube', 'local')),
          source_id TEXT,

          -- Common metadata
          title TEXT NOT NULL,
          media_type TEXT NOT NULL CHECK(media_type IN ('video', 'audio', 'image', 'document')),
          file_path TEXT NOT NULL,
          file_size INTEGER DEFAULT 0,
          duration INTEGER DEFAULT 0,

          -- Thumbnail
          thumbnail_path TEXT,
          thumbnail_url TEXT,
          thumbnail_generated_at TEXT,

          -- YouTube-specific (nullable for local files)
          youtube_video_id TEXT,
          youtube_channel TEXT,
          youtube_channel_id TEXT,
          youtube_url TEXT,
          youtube_format TEXT,
          youtube_quality TEXT,
          youtube_resolution TEXT,
          youtube_published_at TEXT,
          youtube_downloaded_at TEXT,

          -- Local file metadata (nullable for YouTube)
          mime_type TEXT,
          file_extension TEXT,
          file_modified_at TEXT,
          file_created_at TEXT,

          -- Audio metadata (ID3 tags)
          audio_artist TEXT,
          audio_album TEXT,
          audio_year INTEGER,
          audio_genre TEXT,
          audio_bitrate INTEGER,

          -- Image metadata (EXIF)
          image_width INTEGER,
          image_height INTEGER,
          image_camera_make TEXT,
          image_camera_model TEXT,
          image_date_taken TEXT,
          image_latitude REAL,
          image_longitude REAL,

          -- Video metadata
          video_resolution TEXT,
          video_codec TEXT,
          video_bitrate INTEGER,
          video_fps REAL,

          -- Common fields
          added_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          last_accessed_at TEXT,

          -- Indexing
          UNIQUE(source, source_id)
        );
      `);
      console.log('[db] Created media_items table');

      // 2. Create indexed_folders table
      db.exec(`
        CREATE TABLE indexed_folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          path TEXT NOT NULL UNIQUE,
          recursive INTEGER DEFAULT 1,
          last_scanned_at TEXT,
          file_count INTEGER DEFAULT 0,
          total_size INTEGER DEFAULT 0,
          enabled INTEGER DEFAULT 1,
          added_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now'))
        );
      `);
      console.log('[db] Created indexed_folders table');

      // 3. Create indexes for performance
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_media_items_source ON media_items(source);
        CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(media_type);
        CREATE INDEX IF NOT EXISTS idx_media_items_path ON media_items(file_path);
        CREATE INDEX IF NOT EXISTS idx_media_items_youtube_id ON media_items(youtube_video_id);
        CREATE INDEX IF NOT EXISTS idx_media_items_updated ON media_items(updated_at);
        CREATE INDEX IF NOT EXISTS idx_indexed_folders_path ON indexed_folders(path);
      `);
      console.log('[db] Created performance indexes');

      // 4. Migrate existing library data to media_items
      const libraryCount = (db.prepare('SELECT COUNT(*) as count FROM library').get() as any).count;
      if (libraryCount > 0) {
        db.exec(`
          INSERT INTO media_items (
            source,
            source_id,
            title,
            media_type,
            file_path,
            file_size,
            duration,
            thumbnail_url,
            youtube_video_id,
            youtube_channel,
            youtube_channel_id,
            youtube_url,
            youtube_format,
            youtube_quality,
            youtube_resolution,
            youtube_published_at,
            youtube_downloaded_at,
            added_at,
            updated_at
          )
          SELECT
            'youtube' as source,
            video_id as source_id,
            title,
            'video' as media_type,
            COALESCE(file_path, '') as file_path,
            file_size,
            duration,
            thumbnail_url,
            video_id as youtube_video_id,
            channel as youtube_channel,
            channel_id as youtube_channel_id,
            url as youtube_url,
            format as youtube_format,
            quality as youtube_quality,
            resolution as youtube_resolution,
            published_at as youtube_published_at,
            downloaded_at as youtube_downloaded_at,
            added_at,
            updated_at
          FROM library
          WHERE video_id NOT IN (
            SELECT source_id FROM media_items WHERE source = 'youtube'
          )
        `);
        const migratedCount = (db.prepare('SELECT changes()').get() as any)['changes()'];
        console.log(`[db] Migrated ${migratedCount} items from library to media_items`);
      }
    } else {
      console.log('[db] media_items table already exists, skipping creation');
    }

    // 5. Add media_item_id column to transcripts if it doesn't exist
    const transcriptCols = db.pragma('table_info(transcripts)') as any[];
    const transcriptColNames = new Set(transcriptCols.map((c: ColumnInfo) => c.name));

    if (!transcriptColNames.has('media_item_id')) {
      db.exec('ALTER TABLE transcripts ADD COLUMN media_item_id INTEGER');
      console.log('[db] Added media_item_id column to transcripts table');

      // Populate media_item_id for existing transcripts
      db.exec(`
        UPDATE transcripts
        SET media_item_id = (
          SELECT id FROM media_items
          WHERE media_items.youtube_video_id = transcripts.video_id
          AND media_items.source = 'youtube'
          LIMIT 1
        )
        WHERE media_item_id IS NULL
        AND video_id IN (SELECT youtube_video_id FROM media_items WHERE source = 'youtube')
      `);
      const linkedCount = (db.prepare('SELECT changes()').get() as any)['changes()'];
      console.log(`[db] Linked ${linkedCount} transcripts to media_items`);
    }

    // 6. Update schema version
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES ('schema_version', '3', datetime('now'))").run();
  });

  migrate();
  console.log('[db] Migration to schema v3 complete.');
}

export function getDb(): Database.Database {
  return db;
}

// ─── Token helpers ──────────────────────────────────────────────────────────

export function saveTokens(tokens: AuthTokens): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO auth_tokens (id, access_token, refresh_token, token_type, expiry_date, scope, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, datetime('now'))
  `);
  stmt.run(tokens.access_token, tokens.refresh_token ?? null, tokens.token_type ?? null, tokens.expiry_date ?? null, tokens.scope ?? null);
}

export function getTokens(): AuthTokens | null {
  const row = db.prepare('SELECT * FROM auth_tokens WHERE id = 1').get() as any;
  if (!row) return null;
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    token_type: row.token_type,
    expiry_date: row.expiry_date,
    scope: row.scope,
  };
}

export function clearTokens(): void {
  db.prepare('DELETE FROM auth_tokens').run();
}

// ─── User info helpers ──────────────────────────────────────────────────────

export function saveUserInfo(user: UserInfo): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO user_info (id, email, name, picture, updated_at)
    VALUES (1, ?, ?, ?, datetime('now'))
  `);
  stmt.run(user.email, user.name, user.picture);
}

export function getUserInfo(): UserInfo | null {
  const row = db.prepare('SELECT * FROM user_info WHERE id = 1').get() as any;
  if (!row) return null;
  return {
    email: row.email,
    name: row.name,
    picture: row.picture,
  };
}

export function clearUserInfo(): void {
  db.prepare('DELETE FROM user_info').run();
}

// ─── App settings helpers ──────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key) as any;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))").run(key, value);
}

// ─── Queue helpers ──────────────────────────────────────────────────────────

export function addToQueue(request: DownloadRequest): QueueItem {
  const stmt = db.prepare(`
    INSERT INTO queue (video_id, title, channel, thumbnail_url, url, format, quality, resolution, start_time, end_time, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);
  const result = stmt.run(
    request.videoId, request.title, request.channel, request.thumbnailUrl,
    request.url, request.format, request.quality, request.resolution ?? null,
    request.startTime ?? null, request.endTime ?? null
  );
  return getQueueItem(result.lastInsertRowid as number)!;
}

export function getQueueItem(id: number): QueueItem | null {
  const row = db.prepare('SELECT * FROM queue WHERE id = ?').get(id) as any;
  return row ? rowToQueueItem(row) : null;
}

export function getQueue(): QueueItem[] {
  const rows = db.prepare('SELECT * FROM queue WHERE status NOT IN (\'completed\', \'cancelled\') ORDER BY priority DESC, created_at ASC').all() as any[];
  return rows.map(rowToQueueItem);
}

export function updateQueueItem(id: number, updates: Partial<Record<string, any>>): void {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  // Map camelCase to snake_case for database columns
  const columnMap: Record<string, string> = {
    videoId: 'video_id',
    thumbnailUrl: 'thumbnail_url',
    startTime: 'start_time',
    endTime: 'end_time',
    downloadedBytes: 'downloaded_bytes',
    totalBytes: 'total_bytes',
    tempFilePath: 'temp_file_path',
    scheduledAt: 'scheduled_at',
    startedAt: 'started_at',
    completedAt: 'completed_at',
    createdAt: 'created_at',
    retryCount: 'retry_count',
    maxRetries: 'max_retries',
    nextRetryAt: 'next_retry_at',
  };

  for (const [key, value] of Object.entries(updates)) {
    const dbColumn = columnMap[key] || key;
    fields.push(`${dbColumn} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE queue SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteQueueItem(id: number): void {
  db.prepare('DELETE FROM queue WHERE id = ?').run(id);
}

export function getPendingQueueItems(): QueueItem[] {
  const rows = db.prepare("SELECT * FROM queue WHERE status = 'pending' ORDER BY priority DESC, created_at ASC").all() as any[];
  return rows.map(rowToQueueItem);
}

export function getActiveQueueItems(): QueueItem[] {
  const rows = db.prepare("SELECT * FROM queue WHERE status = 'downloading' ORDER BY started_at ASC").all() as any[];
  return rows.map(rowToQueueItem);
}

// ─── Download history helpers ───────────────────────────────────────────────

export function addDownloadRecord(item: QueueItem, filePath: string, fileSize: number): DownloadRecord {
  const stmt = db.prepare(`
    INSERT INTO downloads (video_id, title, channel, channel_id, thumbnail_url, url, format, quality, resolution, file_path, file_size, duration, start_time, end_time, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'completed')
  `);
  const result = stmt.run(
    item.videoId, item.title, item.channel, null, item.thumbnailUrl,
    item.url, item.format, item.quality, item.resolution ?? null,
    filePath, fileSize, item.startTime ?? null, item.endTime ?? null
  );
  return getDownloadRecord(result.lastInsertRowid as number)!;
}

export function getDownloadRecord(id: number): DownloadRecord | null {
  const row = db.prepare('SELECT * FROM downloads WHERE id = ?').get(id) as any;
  return row ? rowToDownloadRecord(row) : null;
}

export function getDownloadHistory(limit: number = 100): DownloadRecord[] {
  const rows = db.prepare('SELECT * FROM downloads ORDER BY downloaded_at DESC LIMIT ?').all(limit) as any[];
  return rows.map(rowToDownloadRecord);
}

export function deleteDownloadRecords(ids: number[]): void {
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM downloads WHERE id IN (${placeholders})`).run(...ids);
}

export function clearDownloadHistory(): void {
  db.prepare('DELETE FROM downloads').run();
}

export function updateDownloadFilePath(id: number, filePath: string): void {
  db.prepare('UPDATE downloads SET file_path = ? WHERE id = ?').run(filePath, id);
}

export function clearFailedQueue(): void {
  db.prepare("DELETE FROM queue WHERE status IN ('failed', 'cancelled')").run();
}

export function getStats(): { totalDownloads: number; totalSize: number; thisWeek: number } {
  const total = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM downloads').get() as any;
  const week = db.prepare("SELECT COUNT(*) as count FROM downloads WHERE downloaded_at >= datetime('now', '-7 days')").get() as any;
  return {
    totalDownloads: total.count,
    totalSize: total.size,
    thisWeek: week.count,
  };
}

// ─── Local playlist helpers ─────────────────────────────────────────────────

export interface LocalPlaylistRow {
  id: number;
  name: string;
  description: string;
  youtubePlaylistId: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LocalPlaylistItemRow {
  id: number;
  playlistId: number;
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  duration: number;
  publishedAt: string;
  position: number;
  addedAt: string;
}

export function createLocalPlaylist(name: string, description: string = ''): LocalPlaylistRow {
  const stmt = db.prepare("INSERT INTO local_playlists (name, description) VALUES (?, ?)");
  const result = stmt.run(name, description);
  return getLocalPlaylist(result.lastInsertRowid as number)!;
}

export function getLocalPlaylist(id: number): LocalPlaylistRow | null {
  const row = db.prepare('SELECT * FROM local_playlists WHERE id = ?').get(id) as any;
  return row ? rowToLocalPlaylist(row) : null;
}

export function getLocalPlaylists(): LocalPlaylistRow[] {
  const rows = db.prepare('SELECT * FROM local_playlists ORDER BY updated_at DESC').all() as any[];
  return rows.map(rowToLocalPlaylist);
}

export function updateLocalPlaylist(id: number, updates: { name?: string; description?: string; youtubePlaylistId?: string | null; lastSyncedAt?: string | null }): LocalPlaylistRow | null {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.youtubePlaylistId !== undefined) { fields.push('youtube_playlist_id = ?'); values.push(updates.youtubePlaylistId); }
  if (updates.lastSyncedAt !== undefined) { fields.push('last_synced_at = ?'); values.push(updates.lastSyncedAt); }

  if (fields.length === 0) return getLocalPlaylist(id);
  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE local_playlists SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getLocalPlaylist(id);
}

export function deleteLocalPlaylist(id: number): void {
  db.prepare('DELETE FROM local_playlists WHERE id = ?').run(id);
}

export function addPlaylistItem(playlistId: number, item: { videoId: string; title: string; channel: string; thumbnailUrl: string; duration: number; publishedAt?: string }): LocalPlaylistItemRow {
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), -1) as max FROM local_playlist_items WHERE playlist_id = ?').get(playlistId) as any;
  const position = (maxPos.max ?? -1) + 1;

  const stmt = db.prepare("INSERT OR IGNORE INTO local_playlist_items (playlist_id, video_id, title, channel, thumbnail_url, duration, published_at, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
  stmt.run(playlistId, item.videoId, item.title, item.channel, item.thumbnailUrl, item.duration, item.publishedAt ?? null, position);

  db.prepare("UPDATE local_playlists SET updated_at = datetime('now') WHERE id = ?").run(playlistId);

  const row = db.prepare('SELECT * FROM local_playlist_items WHERE playlist_id = ? AND video_id = ?').get(playlistId, item.videoId) as any;
  return rowToPlaylistItem(row);
}

export function removePlaylistItem(playlistId: number, videoId: string): void {
  db.prepare('DELETE FROM local_playlist_items WHERE playlist_id = ? AND video_id = ?').run(playlistId, videoId);
  db.prepare("UPDATE local_playlists SET updated_at = datetime('now') WHERE id = ?").run(playlistId);
}

export function getPlaylistItems(playlistId: number): LocalPlaylistItemRow[] {
  const rows = db.prepare('SELECT * FROM local_playlist_items WHERE playlist_id = ? ORDER BY position ASC').all(playlistId) as any[];
  return rows.map(rowToPlaylistItem);
}

export function reorderPlaylistItem(playlistId: number, videoId: string, newPosition: number): void {
  const current = db.prepare('SELECT position FROM local_playlist_items WHERE playlist_id = ? AND video_id = ?').get(playlistId, videoId) as any;
  if (!current) return;

  const oldPosition = current.position;
  if (oldPosition === newPosition) return;

  if (newPosition > oldPosition) {
    db.prepare('UPDATE local_playlist_items SET position = position - 1 WHERE playlist_id = ? AND position > ? AND position <= ?').run(playlistId, oldPosition, newPosition);
  } else {
    db.prepare('UPDATE local_playlist_items SET position = position + 1 WHERE playlist_id = ? AND position >= ? AND position < ?').run(playlistId, newPosition, oldPosition);
  }

  db.prepare('UPDATE local_playlist_items SET position = ? WHERE playlist_id = ? AND video_id = ?').run(newPosition, playlistId, videoId);
  db.prepare("UPDATE local_playlists SET updated_at = datetime('now') WHERE id = ?").run(playlistId);
}

function rowToLocalPlaylist(row: DatabaseRow): LocalPlaylistRow {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : '',
    youtubePlaylistId: row.youtube_playlist_id ? String(row.youtube_playlist_id) : null,
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function rowToPlaylistItem(row: DatabaseRow): LocalPlaylistItemRow {
  return {
    id: Number(row.id),
    playlistId: Number(row.playlist_id),
    videoId: String(row.video_id),
    title: String(row.title),
    channel: row.channel ? String(row.channel) : '',
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : '',
    duration: Number(row.duration),
    publishedAt: row.published_at ? String(row.published_at) : '',
    position: Number(row.position),
    addedAt: String(row.added_at),
  };
}

// ─── Row mappers ────────────────────────────────────────────────────────────

function rowToQueueItem(row: DatabaseRow): QueueItem {
  return {
    id: Number(row.id),
    videoId: String(row.video_id),
    title: String(row.title),
    channel: row.channel ? String(row.channel) : '',
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : '',
    url: String(row.url),
    format: String(row.format),
    quality: String(row.quality),
    resolution: row.resolution != null ? String(row.resolution) : undefined,
    startTime: row.start_time != null ? String(row.start_time) : undefined,
    endTime: row.end_time != null ? String(row.end_time) : undefined,
    priority: Number(row.priority),
    status: String(row.status) as QueueItem['status'],
    progress: Number(row.progress),
    downloadedBytes: Number(row.downloaded_bytes),
    totalBytes: Number(row.total_bytes),
    speed: row.speed ? String(row.speed) : '',
    eta: row.eta ? String(row.eta) : '',
    error: row.error != null ? String(row.error) : undefined,
    tempFilePath: row.temp_file_path != null ? String(row.temp_file_path) : undefined,
    scheduledAt: row.scheduled_at != null ? String(row.scheduled_at) : undefined,
    startedAt: row.started_at != null ? String(row.started_at) : undefined,
    completedAt: row.completed_at != null ? String(row.completed_at) : undefined,
    createdAt: String(row.created_at),
    retryCount: row.retry_count != null ? Number(row.retry_count) : undefined,
    maxRetries: row.max_retries != null ? Number(row.max_retries) : undefined,
    nextRetryAt: row.next_retry_at != null ? String(row.next_retry_at) : undefined,
  };
}

function rowToDownloadRecord(row: DatabaseRow): DownloadRecord {
  return {
    id: Number(row.id),
    videoId: String(row.video_id),
    title: String(row.title),
    channel: row.channel ? String(row.channel) : '',
    channelId: row.channel_id != null ? String(row.channel_id) : undefined,
    thumbnailUrl: row.thumbnail_url != null ? String(row.thumbnail_url) : undefined,
    url: String(row.url),
    format: String(row.format),
    quality: String(row.quality),
    resolution: row.resolution != null ? String(row.resolution) : undefined,
    filePath: row.file_path ? String(row.file_path) : '',
    fileSize: Number(row.file_size),
    duration: Number(row.duration),
    startTime: row.start_time != null ? String(row.start_time) : undefined,
    endTime: row.end_time != null ? String(row.end_time) : undefined,
    status: String(row.status),
    error: row.error != null ? String(row.error) : undefined,
    downloadedAt: String(row.downloaded_at),
  };
}

// ─── Path helpers ──────────────────────────────────────────────────────────

export function resolveFilePath(relativePath: string | null): string | null {
  if (!relativePath) return null;
  if (path.isAbsolute(relativePath)) return relativePath;
  const outputDir = getSetting('output_dir') || path.join(os.homedir(), 'Downloads');
  return path.join(outputDir, relativePath);
}

export function toRelativePath(absolutePath: string): string {
  const outputDir = getSetting('output_dir') || path.join(os.homedir(), 'Downloads');
  const normalized = absolutePath.replace(/\\/g, '/');
  const normalizedDir = outputDir.replace(/\\/g, '/').replace(/\/$/, '') + '/';
  if (normalized.startsWith(normalizedDir)) {
    return normalized.slice(normalizedDir.length);
  }
  return absolutePath;
}

// ─── Library helpers ──────────────────────────────────────────────────────

export function upsertLibraryItem(item: {
  videoId: string;
  title: string;
  channel?: string;
  channelId?: string;
  thumbnailUrl?: string;
  url: string;
  format?: string;
  quality?: string;
  resolution?: string;
  filePath?: string | null;
  fileSize?: number;
  duration?: number;
  publishedAt?: string;
  downloadedAt?: string;
}): void {
  db.prepare(`
    INSERT INTO library (video_id, title, channel, channel_id, thumbnail_url, url, format, quality, resolution, file_path, file_size, duration, published_at, downloaded_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(video_id) DO UPDATE SET
      title = COALESCE(excluded.title, title),
      channel = COALESCE(excluded.channel, channel),
      channel_id = COALESCE(excluded.channel_id, channel_id),
      thumbnail_url = COALESCE(excluded.thumbnail_url, thumbnail_url),
      format = COALESCE(excluded.format, format),
      quality = COALESCE(excluded.quality, quality),
      resolution = COALESCE(excluded.resolution, resolution),
      file_path = COALESCE(excluded.file_path, file_path),
      file_size = CASE WHEN excluded.file_size > 0 THEN excluded.file_size ELSE file_size END,
      duration = CASE WHEN excluded.duration > 0 THEN excluded.duration ELSE duration END,
      downloaded_at = COALESCE(excluded.downloaded_at, downloaded_at),
      updated_at = datetime('now')
  `).run(
    item.videoId, item.title, item.channel ?? null, item.channelId ?? null,
    item.thumbnailUrl ?? null, item.url, item.format ?? null, item.quality ?? null,
    item.resolution ?? null, item.filePath ?? null, item.fileSize ?? 0,
    item.duration ?? 0, item.publishedAt ?? null, item.downloadedAt ?? null
  );
}

export function getLibraryItem(videoId: string): LibraryItem | null {
  const row = db.prepare('SELECT * FROM library WHERE video_id = ?').get(videoId) as any;
  return row ? rowToLibraryItem(row) : null;
}

export function getLibraryItems(opts?: { limit?: number; offset?: number; search?: string; sort?: string; order?: 'asc' | 'desc' }): LibraryItem[] {
  const limit = opts?.limit || 500;
  const offset = opts?.offset || 0;
  const sort = opts?.sort || 'updated_at';
  const order = opts?.order || 'desc';

  const validSorts = ['title', 'channel', 'format', 'file_size', 'resolution', 'downloaded_at', 'added_at', 'updated_at'];
  const sortCol = validSorts.includes(sort) ? sort : 'updated_at';
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

  let query = `SELECT * FROM library`;
  const params: (string | number)[] = [];

  if (opts?.search) {
    query += ` WHERE title LIKE ? OR channel LIKE ?`;
    const term = `%${opts.search}%`;
    params.push(term, term);
  }

  query += ` ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(rowToLibraryItem);
}

export function getRecentLibraryItems(limit: number = 10): LibraryItem[] {
  const rows = db.prepare('SELECT * FROM library WHERE downloaded_at IS NOT NULL ORDER BY downloaded_at DESC LIMIT ?').all(limit) as any[];
  return rows.map(rowToLibraryItem);
}

export function deleteLibraryItems(videoIds: string[], deleteFiles: boolean = false): void {
  if (videoIds.length === 0) return;

  if (deleteFiles) {
    const outputDir = getSetting('output_dir') || path.join(os.homedir(), 'Downloads');
    for (const videoId of videoIds) {
      const item = db.prepare('SELECT file_path FROM library WHERE video_id = ?').get(videoId) as any;
      if (item?.file_path) {
        const absolute = path.isAbsolute(item.file_path) ? item.file_path : path.join(outputDir, item.file_path);
        try { if (fs.existsSync(absolute)) fs.unlinkSync(absolute); } catch {}
      }
    }
  }

  const placeholders = videoIds.map(() => '?').join(',');
  // CASCADE will handle local_playlist_items FK references
  db.prepare(`DELETE FROM library WHERE video_id IN (${placeholders})`).run(...videoIds);
}

export function getLibraryStats(): { totalItems: number; totalSize: number; downloadedCount: number } {
  const total = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(file_size), 0) as size FROM library').get() as any;
  const downloaded = db.prepare('SELECT COUNT(*) as count FROM library WHERE downloaded_at IS NOT NULL').get() as any;
  return {
    totalItems: total.count,
    totalSize: total.size,
    downloadedCount: downloaded.count,
  };
}

export function getPlaylistItemsWithLibrary(playlistId: number): LocalPlaylistItemRow[] {
  const rows = db.prepare(`
    SELECT pi.id, pi.playlist_id, pi.video_id, pi.position, pi.added_at,
           COALESCE(l.title, pi.title) as title,
           COALESCE(l.channel, pi.channel) as channel,
           COALESCE(l.thumbnail_url, pi.thumbnail_url) as thumbnail_url,
           COALESCE(l.duration, pi.duration) as duration,
           COALESCE(l.published_at, pi.published_at) as published_at
    FROM local_playlist_items pi
    LEFT JOIN library l ON l.video_id = pi.video_id
    WHERE pi.playlist_id = ?
    ORDER BY pi.position ASC
  `).all(playlistId) as any[];
  return rows.map(rowToPlaylistItem);
}

function rowToLibraryItem(row: DatabaseRow): LibraryItem {
  return {
    videoId: String(row.video_id),
    title: String(row.title),
    channel: row.channel ? String(row.channel) : '',
    channelId: row.channel_id ? String(row.channel_id) : undefined,
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : undefined,
    url: String(row.url),
    format: row.format ? String(row.format) : undefined,
    quality: row.quality ? String(row.quality) : undefined,
    resolution: row.resolution ? String(row.resolution) : undefined,
    filePath: row.file_path ? resolveFilePath(String(row.file_path)) : null,
    fileSize: Number(row.file_size) || 0,
    duration: Number(row.duration) || 0,
    publishedAt: row.published_at ? String(row.published_at) : undefined,
    downloadedAt: row.downloaded_at ? String(row.downloaded_at) : undefined,
    addedAt: String(row.added_at),
    updatedAt: String(row.updated_at),
  };
}

// ─── Transcript helpers ───────────────────────────────────────────────────

export function createTranscript(videoId: string, options?: TranscriptOptions): number {
  const result = db.prepare(`
    INSERT INTO transcripts (video_id, method, model, status, progress)
    VALUES (?, ?, ?, 'pending', 0)
  `).run(
    videoId,
    options?.method || 'whisper-local',
    options?.model || 'base'
  );
  return result.lastInsertRowid as number;
}

export function getTranscript(videoId: string): Transcript | null {
  const row = db.prepare('SELECT * FROM transcripts WHERE video_id = ? ORDER BY id DESC LIMIT 1').get(videoId) as DatabaseRow | undefined;
  if (!row) return null;
  return rowToTranscript(row);
}

export function getTranscriptById(id: number): Transcript | null {
  const row = db.prepare('SELECT * FROM transcripts WHERE id = ?').get(id) as DatabaseRow | undefined;
  if (!row) return null;
  return rowToTranscript(row);
}

export function updateTranscript(id: number, updates: {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  transcriptText?: string;
  transcriptJson?: string;
  language?: string;
  wordCount?: number;
  durationSeconds?: number;
  error?: string;
  completedAt?: string;
}): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.progress !== undefined) {
    fields.push('progress = ?');
    values.push(updates.progress);
  }
  if (updates.transcriptText !== undefined) {
    fields.push('transcript_text = ?');
    values.push(updates.transcriptText);
  }
  if (updates.transcriptJson !== undefined) {
    fields.push('transcript_json = ?');
    values.push(updates.transcriptJson);
  }
  if (updates.language !== undefined) {
    fields.push('language = ?');
    values.push(updates.language);
  }
  if (updates.wordCount !== undefined) {
    fields.push('word_count = ?');
    values.push(updates.wordCount);
  }
  if (updates.durationSeconds !== undefined) {
    fields.push('duration_seconds = ?');
    values.push(updates.durationSeconds);
  }
  if (updates.error !== undefined) {
    fields.push('error = ?');
    values.push(updates.error);
  }
  if (updates.completedAt !== undefined) {
    fields.push('completed_at = ?');
    values.push(updates.completedAt);
  }

  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE transcripts SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    // Update FTS index if transcript_text changed
    if (updates.transcriptText !== undefined && updates.status === 'completed') {
      const transcript = getTranscriptById(id);
      if (transcript) {
        try {
          // Delete existing FTS entry (if any) then insert new one
          // Virtual tables don't support UPSERT, so we use DELETE + INSERT
          db.prepare('DELETE FROM transcripts_fts WHERE rowid = ?').run(id);
          db.prepare(`
            INSERT INTO transcripts_fts(rowid, video_id, transcript_text)
            VALUES (?, ?, ?)
          `).run(id, transcript.videoId, updates.transcriptText);
        } catch (ftsError: any) {
          // FTS indexing failed, but don't fail the whole transaction
          // Log error and continue - transcript is still saved in main table
          console.error(`[Database] FTS index update failed for transcript ${id}:`, ftsError.message);

          // If FTS table is corrupted, try to rebuild it
          if (ftsError.message?.includes('CORRUPT') || ftsError.code === 'SQLITE_CORRUPT_VTAB') {
            console.warn(`[Database] FTS table appears corrupted, attempting rebuild...`);
            try {
              rebuildFtsIndex();
              // Retry the FTS insert after rebuild
              db.prepare('DELETE FROM transcripts_fts WHERE rowid = ?').run(id);
              db.prepare(`
                INSERT INTO transcripts_fts(rowid, video_id, transcript_text)
                VALUES (?, ?, ?)
              `).run(id, transcript.videoId, updates.transcriptText);
              console.log(`[Database] FTS index rebuilt and transcript ${id} indexed successfully`);
            } catch (rebuildError) {
              console.error(`[Database] FTS rebuild failed:`, rebuildError);
            }
          }
        }
      }
    }
  }
}

export function deleteTranscript(videoId: string): void {
  const transcript = getTranscript(videoId);
  if (transcript) {
    db.prepare('DELETE FROM transcripts_fts WHERE rowid = ?').run(transcript.id);
    db.prepare('DELETE FROM transcripts WHERE video_id = ?').run(videoId);
  }
}

/**
 * Rebuild the FTS index from scratch
 * Call this if the FTS table becomes corrupted
 */
export function rebuildFtsIndex(): void {
  try {
    console.log('[Database] Rebuilding FTS index...');

    // Drop and recreate the FTS table
    db.prepare('DROP TABLE IF EXISTS transcripts_fts').run();
    db.prepare(`
      CREATE VIRTUAL TABLE transcripts_fts USING fts5(
        video_id UNINDEXED,
        transcript_text,
        content='transcripts',
        content_rowid='id'
      )
    `).run();

    // Repopulate from completed transcripts
    const completedTranscripts = db.prepare(`
      SELECT id, video_id, transcript_text
      FROM transcripts
      WHERE status = 'completed' AND transcript_text IS NOT NULL
    `).all() as Array<{ id: number; video_id: string; transcript_text: string }>;

    const insertFts = db.prepare(`
      INSERT INTO transcripts_fts(rowid, video_id, transcript_text)
      VALUES (?, ?, ?)
    `);

    let indexed = 0;
    for (const transcript of completedTranscripts) {
      try {
        insertFts.run(transcript.id, transcript.video_id, transcript.transcript_text);
        indexed++;
      } catch (err) {
        console.error(`[Database] Failed to index transcript ${transcript.id}:`, err);
      }
    }

    console.log(`[Database] FTS index rebuilt successfully. Indexed ${indexed}/${completedTranscripts.length} transcripts`);
  } catch (error) {
    console.error('[Database] Failed to rebuild FTS index:', error);
    throw error;
  }
}

export function searchTranscripts(query: string, limit: number = 20): TranscriptSearchResult[] {
  const rows = db.prepare(`
    SELECT
      t.video_id,
      l.title,
      l.channel,
      l.thumbnail_url,
      snippet(transcripts_fts, 1, '<mark>', '</mark>', '...', 64) as snippet
    FROM transcripts_fts
    JOIN transcripts t ON transcripts_fts.rowid = t.id
    JOIN library l ON t.video_id = l.video_id
    WHERE transcripts_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit) as DatabaseRow[];

  return rows.map(row => ({
    videoId: String(row.video_id),
    title: String(row.title),
    channel: String(row.channel),
    thumbnailUrl: String(row.thumbnail_url),
    snippet: String(row.snippet),
  }));
}

export function getAllTranscripts(status?: string): Transcript[] {
  let sql = 'SELECT * FROM transcripts';
  const params: any[] = [];

  if (status) {
    sql += ' WHERE status = ?';
    params.push(status);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = db.prepare(sql).all(...params) as DatabaseRow[];
  return rows.map(rowToTranscript);
}

function rowToTranscript(row: DatabaseRow): Transcript {
  return {
    id: Number(row.id),
    videoId: String(row.video_id),
    format: String(row.format),
    language: row.language ? String(row.language) : null,
    transcriptText: String(row.transcript_text || ''),
    transcriptJson: String(row.transcript_json || ''),
    wordCount: Number(row.word_count || 0),
    durationSeconds: Number(row.duration_seconds || 0),
    method: row.method as 'whisper-local' | 'whisper-api' | 'youtube' | null,
    model: row.model ? String(row.model) : null,
    status: String(row.status) as 'pending' | 'processing' | 'completed' | 'failed',
    error: row.error ? String(row.error) : null,
    progress: Number(row.progress || 0),
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
    mediaItemId: row.media_item_id ? Number(row.media_item_id) : undefined,
  };
}

// ─── Media Items helpers ───────────────────────────────────────────────────

export interface MediaItemRow {
  id: number;
  source: 'youtube' | 'local';
  sourceId: string | null;
  title: string;
  mediaType: 'video' | 'audio' | 'image' | 'document';
  filePath: string;
  fileSize: number;
  duration: number;
  thumbnailPath: string | null;
  thumbnailUrl: string | null;
  thumbnailGeneratedAt: string | null;
  // YouTube-specific
  youtubeVideoId: string | null;
  youtubeChannel: string | null;
  youtubeChannelId: string | null;
  youtubeUrl: string | null;
  youtubeFormat: string | null;
  youtubeQuality: string | null;
  youtubeResolution: string | null;
  youtubePublishedAt: string | null;
  youtubeDownloadedAt: string | null;
  // Local file metadata
  mimeType: string | null;
  fileExtension: string | null;
  fileModifiedAt: string | null;
  fileCreatedAt: string | null;
  // Audio metadata
  audioArtist: string | null;
  audioAlbum: string | null;
  audioYear: number | null;
  audioGenre: string | null;
  audioBitrate: number | null;
  // Image metadata
  imageWidth: number | null;
  imageHeight: number | null;
  imageCameraMake: string | null;
  imageCameraModel: string | null;
  imageDateTaken: string | null;
  imageLatitude: number | null;
  imageLongitude: number | null;
  // Video metadata
  videoResolution: string | null;
  videoCodec: string | null;
  videoBitrate: number | null;
  videoFps: number | null;
  // Common
  addedAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
}

export interface IndexedFolderRow {
  id: number;
  path: string;
  recursive: boolean;
  lastScannedAt: string | null;
  fileCount: number;
  totalSize: number;
  enabled: boolean;
  addedAt: string;
  updatedAt: string;
}

export function createMediaItem(item: {
  source: 'youtube' | 'local';
  sourceId: string;
  title: string;
  mediaType: 'video' | 'audio' | 'image' | 'document';
  filePath: string;
  fileSize?: number;
  duration?: number;
  thumbnailUrl?: string;
  // YouTube-specific
  youtubeVideoId?: string;
  youtubeChannel?: string;
  youtubeChannelId?: string;
  youtubeUrl?: string;
  youtubeFormat?: string;
  youtubeQuality?: string;
  youtubeResolution?: string;
  youtubePublishedAt?: string;
  youtubeDownloadedAt?: string;
  // Local file metadata
  mimeType?: string;
  fileExtension?: string;
  fileModifiedAt?: string;
  fileCreatedAt?: string;
  // Audio metadata
  audioArtist?: string;
  audioAlbum?: string;
  audioYear?: number;
  audioGenre?: string;
  audioBitrate?: number;
  // Image metadata
  imageWidth?: number;
  imageHeight?: number;
  imageCameraMake?: string;
  imageCameraModel?: string;
  imageDateTaken?: string;
  imageLatitude?: number;
  imageLongitude?: number;
  // Video metadata
  videoResolution?: string;
  videoCodec?: string;
  videoBitrate?: number;
  videoFps?: number;
}): number {
  const stmt = db.prepare(`
    INSERT INTO media_items (
      source, source_id, title, media_type, file_path, file_size, duration,
      thumbnail_url,
      youtube_video_id, youtube_channel, youtube_channel_id, youtube_url,
      youtube_format, youtube_quality, youtube_resolution, youtube_published_at, youtube_downloaded_at,
      mime_type, file_extension, file_modified_at, file_created_at,
      audio_artist, audio_album, audio_year, audio_genre, audio_bitrate,
      image_width, image_height, image_camera_make, image_camera_model,
      image_date_taken, image_latitude, image_longitude,
      video_resolution, video_codec, video_bitrate, video_fps
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?
    )
  `);

  const result = stmt.run(
    item.source,
    item.sourceId,
    item.title,
    item.mediaType,
    item.filePath,
    item.fileSize ?? 0,
    item.duration ?? 0,
    item.thumbnailUrl ?? null,
    item.youtubeVideoId ?? null,
    item.youtubeChannel ?? null,
    item.youtubeChannelId ?? null,
    item.youtubeUrl ?? null,
    item.youtubeFormat ?? null,
    item.youtubeQuality ?? null,
    item.youtubeResolution ?? null,
    item.youtubePublishedAt ?? null,
    item.youtubeDownloadedAt ?? null,
    item.mimeType ?? null,
    item.fileExtension ?? null,
    item.fileModifiedAt ?? null,
    item.fileCreatedAt ?? null,
    item.audioArtist ?? null,
    item.audioAlbum ?? null,
    item.audioYear ?? null,
    item.audioGenre ?? null,
    item.audioBitrate ?? null,
    item.imageWidth ?? null,
    item.imageHeight ?? null,
    item.imageCameraMake ?? null,
    item.imageCameraModel ?? null,
    item.imageDateTaken ?? null,
    item.imageLatitude ?? null,
    item.imageLongitude ?? null,
    item.videoResolution ?? null,
    item.videoCodec ?? null,
    item.videoBitrate ?? null,
    item.videoFps ?? null
  );

  return result.lastInsertRowid as number;
}

export function getMediaItem(id: number): MediaItemRow | null {
  const row = db.prepare('SELECT * FROM media_items WHERE id = ?').get(id) as any;
  return row ? rowToMediaItem(row) : null;
}

export function getMediaItemByPath(filePath: string): MediaItemRow | null {
  const row = db.prepare('SELECT * FROM media_items WHERE file_path = ?').get(filePath) as any;
  return row ? rowToMediaItem(row) : null;
}

export function getMediaItemByYoutubeId(videoId: string): MediaItemRow | null {
  const row = db.prepare('SELECT * FROM media_items WHERE youtube_video_id = ? AND source = ?').get(videoId, 'youtube') as any;
  return row ? rowToMediaItem(row) : null;
}

export function getMediaItems(opts?: {
  source?: 'youtube' | 'local';
  mediaType?: 'video' | 'audio' | 'image' | 'document';
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): MediaItemRow[] {
  const limit = opts?.limit || 100;
  const offset = opts?.offset || 0;
  const sortBy = opts?.sortBy || 'updated_at';
  const sortOrder = opts?.sortOrder || 'desc';

  const validSorts = ['title', 'file_size', 'duration', 'added_at', 'updated_at', 'file_created_at', 'file_modified_at'];
  const sortCol = validSorts.includes(sortBy) ? sortBy : 'updated_at';
  const order = sortOrder === 'asc' ? 'ASC' : 'DESC';

  let query = 'SELECT * FROM media_items WHERE 1=1';
  const params: (string | number)[] = [];

  if (opts?.source) {
    query += ' AND source = ?';
    params.push(opts.source);
  }

  if (opts?.mediaType) {
    query += ' AND media_type = ?';
    params.push(opts.mediaType);
  }

  query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = db.prepare(query).all(...params) as any[];
  return rows.map(rowToMediaItem);
}

export function updateMediaItem(id: number, updates: Partial<Omit<MediaItemRow, 'id' | 'addedAt'>>): void {
  const fields: string[] = [];
  const values: any[] = [];

  const columnMap: Record<string, string> = {
    title: 'title',
    filePath: 'file_path',
    fileSize: 'file_size',
    duration: 'duration',
    thumbnailPath: 'thumbnail_path',
    thumbnailUrl: 'thumbnail_url',
    mimeType: 'mime_type',
    fileExtension: 'file_extension',
    fileModifiedAt: 'file_modified_at',
    fileCreatedAt: 'file_created_at',
    audioArtist: 'audio_artist',
    audioAlbum: 'audio_album',
    audioYear: 'audio_year',
    audioGenre: 'audio_genre',
    audioBitrate: 'audio_bitrate',
    imageWidth: 'image_width',
    imageHeight: 'image_height',
    imageCameraMake: 'image_camera_make',
    imageCameraModel: 'image_camera_model',
    imageDateTaken: 'image_date_taken',
    imageLatitude: 'image_latitude',
    imageLongitude: 'image_longitude',
    videoResolution: 'video_resolution',
    videoCodec: 'video_codec',
    videoBitrate: 'video_bitrate',
    videoFps: 'video_fps',
    lastAccessedAt: 'last_accessed_at',
  };

  for (const [key, value] of Object.entries(updates)) {
    const dbColumn = columnMap[key] || key;
    fields.push(`${dbColumn} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE media_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteMediaItems(ids: number[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`DELETE FROM media_items WHERE id IN (${placeholders})`).run(...ids);
}

export function getMediaItemStats(): { total: number; youtube: number; local: number; byType: Record<string, number> } {
  const total = (db.prepare('SELECT COUNT(*) as count FROM media_items').get() as any).count;
  const youtube = (db.prepare("SELECT COUNT(*) as count FROM media_items WHERE source = 'youtube'").get() as any).count;
  const local = (db.prepare("SELECT COUNT(*) as count FROM media_items WHERE source = 'local'").get() as any).count;

  const byTypeRows = db.prepare('SELECT media_type, COUNT(*) as count FROM media_items GROUP BY media_type').all() as any[];
  const byType: Record<string, number> = {};
  for (const row of byTypeRows) {
    byType[row.media_type] = row.count;
  }

  return { total, youtube, local, byType };
}

function rowToMediaItem(row: DatabaseRow): MediaItemRow {
  return {
    id: Number(row.id),
    source: String(row.source) as 'youtube' | 'local',
    sourceId: row.source_id ? String(row.source_id) : null,
    title: String(row.title),
    mediaType: String(row.media_type) as 'video' | 'audio' | 'image' | 'document',
    filePath: String(row.file_path),
    fileSize: Number(row.file_size) || 0,
    duration: Number(row.duration) || 0,
    thumbnailPath: row.thumbnail_path ? String(row.thumbnail_path) : null,
    thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
    thumbnailGeneratedAt: row.thumbnail_generated_at ? String(row.thumbnail_generated_at) : null,
    youtubeVideoId: row.youtube_video_id ? String(row.youtube_video_id) : null,
    youtubeChannel: row.youtube_channel ? String(row.youtube_channel) : null,
    youtubeChannelId: row.youtube_channel_id ? String(row.youtube_channel_id) : null,
    youtubeUrl: row.youtube_url ? String(row.youtube_url) : null,
    youtubeFormat: row.youtube_format ? String(row.youtube_format) : null,
    youtubeQuality: row.youtube_quality ? String(row.youtube_quality) : null,
    youtubeResolution: row.youtube_resolution ? String(row.youtube_resolution) : null,
    youtubePublishedAt: row.youtube_published_at ? String(row.youtube_published_at) : null,
    youtubeDownloadedAt: row.youtube_downloaded_at ? String(row.youtube_downloaded_at) : null,
    mimeType: row.mime_type ? String(row.mime_type) : null,
    fileExtension: row.file_extension ? String(row.file_extension) : null,
    fileModifiedAt: row.file_modified_at ? String(row.file_modified_at) : null,
    fileCreatedAt: row.file_created_at ? String(row.file_created_at) : null,
    audioArtist: row.audio_artist ? String(row.audio_artist) : null,
    audioAlbum: row.audio_album ? String(row.audio_album) : null,
    audioYear: row.audio_year ? Number(row.audio_year) : null,
    audioGenre: row.audio_genre ? String(row.audio_genre) : null,
    audioBitrate: row.audio_bitrate ? Number(row.audio_bitrate) : null,
    imageWidth: row.image_width ? Number(row.image_width) : null,
    imageHeight: row.image_height ? Number(row.image_height) : null,
    imageCameraMake: row.image_camera_make ? String(row.image_camera_make) : null,
    imageCameraModel: row.image_camera_model ? String(row.image_camera_model) : null,
    imageDateTaken: row.image_date_taken ? String(row.image_date_taken) : null,
    imageLatitude: row.image_latitude ? Number(row.image_latitude) : null,
    imageLongitude: row.image_longitude ? Number(row.image_longitude) : null,
    videoResolution: row.video_resolution ? String(row.video_resolution) : null,
    videoCodec: row.video_codec ? String(row.video_codec) : null,
    videoBitrate: row.video_bitrate ? Number(row.video_bitrate) : null,
    videoFps: row.video_fps ? Number(row.video_fps) : null,
    addedAt: String(row.added_at),
    updatedAt: String(row.updated_at),
    lastAccessedAt: row.last_accessed_at ? String(row.last_accessed_at) : null,
  };
}

// ─── Indexed Folders helpers ───────────────────────────────────────────────

export function addIndexedFolder(path: string, recursive: boolean = true): number {
  const stmt = db.prepare(`
    INSERT INTO indexed_folders (path, recursive)
    VALUES (?, ?)
  `);
  const result = stmt.run(path, recursive ? 1 : 0);
  return result.lastInsertRowid as number;
}

export function getIndexedFolder(id: number): IndexedFolderRow | null {
  const row = db.prepare('SELECT * FROM indexed_folders WHERE id = ?').get(id) as any;
  return row ? rowToIndexedFolder(row) : null;
}

export function getIndexedFolders(): IndexedFolderRow[] {
  const rows = db.prepare('SELECT * FROM indexed_folders ORDER BY added_at DESC').all() as any[];
  return rows.map(rowToIndexedFolder);
}

export function updateIndexedFolder(id: number, updates: {
  lastScannedAt?: string;
  fileCount?: number;
  totalSize?: number;
  enabled?: boolean;
}): void {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.lastScannedAt !== undefined) {
    fields.push('last_scanned_at = ?');
    values.push(updates.lastScannedAt);
  }
  if (updates.fileCount !== undefined) {
    fields.push('file_count = ?');
    values.push(updates.fileCount);
  }
  if (updates.totalSize !== undefined) {
    fields.push('total_size = ?');
    values.push(updates.totalSize);
  }
  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled ? 1 : 0);
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  db.prepare(`UPDATE indexed_folders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

export function deleteIndexedFolder(id: number): void {
  db.prepare('DELETE FROM indexed_folders WHERE id = ?').run(id);
}

function rowToIndexedFolder(row: DatabaseRow): IndexedFolderRow {
  return {
    id: Number(row.id),
    path: String(row.path),
    recursive: Boolean(row.recursive),
    lastScannedAt: row.last_scanned_at ? String(row.last_scanned_at) : null,
    fileCount: Number(row.file_count) || 0,
    totalSize: Number(row.total_size) || 0,
    enabled: Boolean(row.enabled),
    addedAt: String(row.added_at),
    updatedAt: String(row.updated_at),
  };
}
