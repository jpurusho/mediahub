import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, IconButton, Button, TextField, InputAdornment,
  Chip, Checkbox, TableSortLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, FormControlLabel, Menu, MenuItem, ListItemIcon, ListItemText,
  Popover, Grid, Paper, ToggleButtonGroup, ToggleButton, Snackbar, Divider,
  LinearProgress, CircularProgress, Select, FormControl,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ViewListIcon from '@mui/icons-material/ViewList';
import GridViewIcon from '@mui/icons-material/GridView';
import EditIcon from '@mui/icons-material/Edit';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenWithIcon from '@mui/icons-material/OpenWith';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import VideoPlayer from '../components/VideoPlayer/VideoPlayer';
import ImageViewer from '../components/ImageViewer/ImageViewer';
import HTMLViewer from '../components/HTMLViewer/HTMLViewer';
import JSONViewer from '../components/JSONViewer/JSONViewer';
import MarkdownViewer from '../components/MarkdownViewer/MarkdownViewer';
import PDFViewer from '../components/PDFViewer/PDFViewer';
import TextViewer from '../components/TextViewer/TextViewer';
import AddToPlaylistDialog from '../components/AddToPlaylistDialog/AddToPlaylistDialog';
import type { LibraryItem, DownloadRecord, VideoInfo, MediaItem } from '@shared/types';

type SortField = 'title' | 'channel' | 'format' | 'fileSize' | 'resolution' | 'downloadedAt' | 'addedAt' | 'duration' | 'filePath';
type SortOrder = 'asc' | 'desc';

interface ColumnDef {
  id: SortField;
  label: string;
  defaultVisible: boolean;
}

const ALL_COLUMNS: ColumnDef[] = [
  { id: 'title', label: 'Title', defaultVisible: true },
  { id: 'channel', label: 'Channel', defaultVisible: true },
  { id: 'format', label: 'Format', defaultVisible: true },
  { id: 'resolution', label: 'Quality', defaultVisible: true },
  { id: 'fileSize', label: 'Size', defaultVisible: true },
  { id: 'duration', label: 'Duration', defaultVisible: false },
  { id: 'downloadedAt', label: 'Downloaded', defaultVisible: true },
  { id: 'addedAt', label: 'Added', defaultVisible: false },
  { id: 'filePath', label: 'Path', defaultVisible: false },
];

function loadVisibleColumns(): Set<SortField> {
  try {
    const saved = localStorage.getItem('ytd-library-columns');
    if (saved) return new Set(JSON.parse(saved));
  } catch (error) {
    // Failed to parse localStorage, use defaults
    console.warn('Failed to load column preferences:', error);
  }
  return new Set(ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
}

export default function Library() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [filter, setFilter] = useState('');
  const [playingItem, setPlayingItem] = useState<LibraryItem | null>(null);
  const [sortField, setSortField] = useState<SortField>('downloadedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [converting, setConverting] = useState<Set<string>>(new Set());
  const [addToPlaylistVideo, setAddToPlaylistVideo] = useState<VideoInfo | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteFiles, setDeleteFiles] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuItem, setMenuItem] = useState<LibraryItem | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<Set<SortField>>(loadVisibleColumns);
  const [columnAnchor, setColumnAnchor] = useState<null | HTMLElement>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => (localStorage.getItem('ytd-library-view') as any) || 'list');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState<Record<string, boolean>>({});
  const [source, setSource] = useState<'all' | 'youtube' | 'local'>('all');
  const [mediaType, setMediaType] = useState<'all' | 'video' | 'audio' | 'image' | 'html' | 'document'>('all');
  const [indexingInProgress, setIndexingInProgress] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState({ filesFound: 0, filesProcessed: 0, filesFailed: 0, currentFile: '', totalSize: 0 });
  const [viewingImages, setViewingImages] = useState<{ images: LibraryItem[], currentIndex: number } | null>(null);
  const [viewingHTML, setViewingHTML] = useState<LibraryItem | null>(null);
  const [viewingJSON, setViewingJSON] = useState<LibraryItem | null>(null);
  const [viewingMarkdown, setViewingMarkdown] = useState<LibraryItem | null>(null);
  const [viewingPDF, setViewingPDF] = useState<LibraryItem | null>(null);
  const [viewingText, setViewingText] = useState<LibraryItem | null>(null);
  const [manageFoldersOpen, setManageFoldersOpen] = useState(false);
  const [indexedFolders, setIndexedFolders] = useState<Array<{ id: number; path: string; lastScannedAt: string }>>([]);
  const [rescanning, setRescanning] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadLibrary();
  }, []);

  useEffect(() => {
    loadLibrary();
  }, [source, mediaType]);

  useEffect(() => {
    // Check transcript status for all items
    async function checkTranscripts() {
      const status: Record<string, boolean> = {};
      for (const item of items) {
        try {
          const transcript = await window.api.transcripts.get(item.videoId);
          status[item.videoId] = transcript?.status === 'completed';
        } catch {
          status[item.videoId] = false;
        }
      }
      setTranscriptStatus(status);
    }
    if (items.length > 0) {
      checkTranscripts();
    }
  }, [items]);

  useEffect(() => {
    // Set up media indexing event listeners
    const cleanupStarted = window.api.media.onIndexingStarted((data) => {
      setIndexingInProgress(true);
      setSnackbarMessage(`Indexing started: ${data.folderPath}`);
    });

    const cleanupProgress = window.api.media.onIndexingProgress((progress) => {
      setIndexingProgress(progress);
    });

    const cleanupCompleted = window.api.media.onIndexingCompleted((data) => {
      setIndexingInProgress(false);
      setSnackbarMessage(`Indexing completed: ${data.filesProcessed} files processed, ${data.filesFailed} failed`);
      loadLibrary(); // Refresh list
    });

    const cleanupError = window.api.media.onIndexingError((data) => {
      setIndexingInProgress(false);
      setSnackbarMessage(`Indexing error: ${data.error}`);
    });

    return () => {
      cleanupStarted();
      cleanupProgress();
      cleanupCompleted();
      cleanupError();
    };
  }, []);

  async function loadLibrary() {
    try {
      // Always use the unified media API
      const opts: any = {
        limit: 1000,
        sortBy: sortField,
        sortOrder: sortOrder,
      };

      // Apply source filter (youtube/local)
      if (source !== 'all') {
        opts.source = source;
      }

      // Apply media type filter (video/audio/image)
      if (mediaType !== 'all') {
        opts.mediaType = mediaType;
      }

      const mediaItems = await window.api.media.getAll(opts);

      // Convert MediaItem[] to LibraryItem[] format for compatibility
      const libraryItems: LibraryItem[] = mediaItems.map(m => ({
        videoId: m.youtubeVideoId || m.sourceId || `local-${m.id}`,
        mediaItemId: m.id, // Store numeric ID for deletion
        title: m.title,
        channel: m.youtubeChannel || 'Local File',
        channelId: m.youtubeChannelId,
        thumbnailUrl: m.thumbnailUrl || m.thumbnailPath,
        url: m.youtubeUrl || `file://${m.filePath}`,
        format: m.youtubeFormat || m.fileExtension?.replace('.', ''),
        quality: m.youtubeQuality,
        resolution: m.youtubeResolution || m.videoResolution,
        filePath: m.filePath,
        fileSize: m.fileSize,
        duration: m.duration,
        publishedAt: m.youtubePublishedAt,
        downloadedAt: m.youtubeDownloadedAt,
        addedAt: m.addedAt,
        updatedAt: m.updatedAt,
      }));

      setItems(libraryItems);
      setSelected(new Set());
    } catch (error) {
      console.error('Failed to load library:', error);
      setSnackbarMessage('Failed to load library');
      setItems([]);
    }
  }

  async function loadIndexedFolders() {
    try {
      const folders = await window.api.indexedFolders.getAll();
      setIndexedFolders(folders);
    } catch (error) {
      console.error('Failed to load indexed folders:', error);
    }
  }

  async function handleAddLocalFolder() {
    try {
      const folderPath = await window.api.app.selectDirectory();
      if (!folderPath) return;

      // Add to indexed folders
      await window.api.indexedFolders.add(folderPath, true);

      // Start scanning
      setIndexingInProgress(true);
      await window.api.media.scanFolder(folderPath, true);

      // Reload folders list
      loadIndexedFolders();
    } catch (error) {
      setSnackbarMessage(`Failed to add folder: ${(error as Error).message}`);
    }
  }

  async function handleRemoveFolder(folderId: number, folderPath: string) {
    try {
      // Delete returns count of items removed
      const result = await window.api.indexedFolders.delete(folderId);
      const itemCount = result?.itemsDeleted || 0;

      setSnackbarMessage(
        itemCount > 0
          ? `Folder removed. ${itemCount} media item${itemCount === 1 ? '' : 's'} deleted from library.`
          : 'Folder removed.'
      );

      loadIndexedFolders();
      loadLibrary(); // Refresh library
    } catch (error) {
      setSnackbarMessage(`Failed to remove folder: ${(error as Error).message}`);
    }
  }

  async function handleRescanFolder(folderId: number, folderPath: string) {
    try {
      // Add to rescanning set
      setRescanning(prev => new Set(prev).add(folderId));
      setSnackbarMessage(`Rescanning folder: ${folderPath}`);

      const result = await window.api.indexedFolders.rescan(folderId);

      setSnackbarMessage(
        `Rescan complete! Found ${result.filesFound} files, indexed ${result.filesIndexed} files.` +
        (result.filesFailed > 0 ? ` ${result.filesFailed} failed.` : '')
      );

      loadIndexedFolders();
      loadLibrary(); // Refresh library
    } catch (error) {
      setSnackbarMessage(`Failed to rescan folder: ${(error as Error).message}`);
    } finally {
      // Remove from rescanning set
      setRescanning(prev => {
        const next = new Set(prev);
        next.delete(folderId);
        return next;
      });
    }
  }

  function handleDeleteClick() {
    if (selected.size === 0) return;
    setDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    // Get media item IDs for selected items
    const selectedItems = items.filter(item => selected.has(item.videoId));
    const mediaItemIds = selectedItems
      .map(item => item.mediaItemId)
      .filter((id): id is number => id !== undefined);

    // Delete from media_items table
    if (mediaItemIds.length > 0) {
      await window.api.media.delete(mediaItemIds, deleteFiles);
    }

    // Also try legacy library delete for any old YouTube-only items
    const videoIds = Array.from(selected);
    if (videoIds.length > 0) {
      try {
        await window.api.library.delete(videoIds, deleteFiles);
      } catch (e) {
        // Ignore errors from legacy delete
      }
    }

    setDeleteDialogOpen(false);
    setDeleteFiles(false);
    setSelected(new Set());
    loadLibrary();
  }

  function openInYouTube(videoId: string) {
    window.api.app.openExternal(`https://www.youtube.com/watch?v=${videoId}`);
  }

  function openInFinder(filePath: string) {
    window.api.app.showInFinder(filePath);
  }

  function openInSystemPlayer(filePath: string) {
    window.api.app.openInSystemPlayer(filePath);
  }

  async function handleRename() {
    if (!menuItem || !renameValue.trim()) return;
    // TODO: Implement rename API
    // For now, just show message that it's not implemented yet
    setSnackbarMessage('Rename feature coming soon!');
    setRenameDialogOpen(false);
    setMenuAnchor(null);
  }

  // Helper to detect media type from file extension or format
  function getItemMediaType(item: LibraryItem): 'video' | 'audio' | 'image' | 'html' | 'json' | 'markdown' | 'pdf' | 'text' | 'unknown' {
    const ext = item.filePath ? item.filePath.split('.').pop()?.toLowerCase() : '';
    const format = item.format?.toLowerCase();

    // Check for image extensions
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'svg', 'tiff'];
    if (ext && imageExts.includes(ext)) return 'image';

    // Check for HTML extensions
    const htmlExts = ['html', 'htm'];
    if (ext && htmlExts.includes(ext)) return 'html';

    // Check for JSON extensions
    const jsonExts = ['json'];
    if (ext && jsonExts.includes(ext)) return 'json';

    // Check for Markdown extensions
    const markdownExts = ['md', 'markdown'];
    if (ext && markdownExts.includes(ext)) return 'markdown';

    // Check for PDF extensions
    const pdfExts = ['pdf'];
    if (ext && pdfExts.includes(ext)) return 'pdf';

    // Check for text extensions
    const textExts = ['txt', 'log'];
    if (ext && textExts.includes(ext)) return 'text';

    // Check for audio extensions/formats
    const audioExts = ['mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'opus', 'wma'];
    if (ext && audioExts.includes(ext)) return 'audio';
    if (format && audioExts.includes(format)) return 'audio';

    // Check for video extensions/formats
    const videoExts = ['mp4', 'mkv', 'webm', 'avi', 'mov', 'm4v', 'flv', 'wmv', 'mpg', 'mpeg'];
    if (ext && videoExts.includes(ext)) return 'video';
    if (format && videoExts.includes(format)) return 'video';

    return 'unknown';
  }

  // Handle playing an item (shows appropriate viewer based on media type)
  function handlePlayItem(item: LibraryItem) {
    if (!item.filePath) {
      setSnackbarMessage('File path not available');
      return;
    }

    const itemType = getItemMediaType(item);

    if (itemType === 'image') {
      // Find all images in current filtered view
      const imageItems = sorted.filter(i => getItemMediaType(i) === 'image');
      const currentIndex = imageItems.findIndex(i => i.videoId === item.videoId);
      setViewingImages({ images: imageItems, currentIndex: Math.max(0, currentIndex) });
    } else if (itemType === 'html') {
      setViewingHTML(item);
    } else if (itemType === 'json') {
      setViewingJSON(item);
    } else if (itemType === 'markdown') {
      setViewingMarkdown(item);
    } else if (itemType === 'pdf') {
      setViewingPDF(item);
    } else if (itemType === 'text') {
      setViewingText(item);
    } else if (itemType === 'video' || itemType === 'audio') {
      setPlayingItem(item);
    } else {
      setSnackbarMessage('This file type is not supported for preview');
    }
  }

  function handleCopyURL() {
    if (!menuItem) return;

    // Don't try to copy YouTube URL for local files
    if (menuItem.videoId.startsWith('local-')) {
      setSnackbarMessage('This is a local file, not a YouTube video');
      setMenuAnchor(null);
      return;
    }

    const url = `https://www.youtube.com/watch?v=${menuItem.videoId}`;
    navigator.clipboard.writeText(url);
    setSnackbarMessage('Video URL copied to clipboard');
    setMenuAnchor(null);
  }

  async function handleTranscribe() {
    if (!menuItem) return;
    setMenuAnchor(null);
    try {
      // Check availability first
      const availability = await window.api.transcripts.checkAvailability();
      if (!availability.whisperLocal && !availability.whisperAPI) {
        setSnackbarMessage('Transcription requires Whisper (brew install openai-whisper) or OpenAI API key');
        return;
      }

      // Start transcription with default settings
      await window.api.transcripts.start(menuItem.videoId, { method: 'auto', model: 'base' });
      setSnackbarMessage('Transcription started');

      // Refresh transcript status after a delay
      setTimeout(async () => {
        try {
          const transcript = await window.api.transcripts.get(menuItem.videoId);
          setTranscriptStatus(prev => ({ ...prev, [menuItem.videoId]: transcript?.status === 'completed' }));
        } catch {}
      }, 2000);
    } catch (error) {
      setSnackbarMessage(`Failed to start transcription: ${(error as Error).message}`);
    }
  }

  function openRenameDialog() {
    if (!menuItem) return;
    setRenameValue(menuItem.title);
    setRenameDialogOpen(true);
    setMenuAnchor(null);
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'downloadedAt' ? 'desc' : 'asc');
    }
  }

  function toggleSelect(videoId: string) {
    const next = new Set(selected);
    if (next.has(videoId)) next.delete(videoId);
    else next.add(videoId);
    setSelected(next);
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(r => r.videoId)));
    }
  }

  // Helper: Convert wildcard pattern to regex
  function wildcardToRegex(pattern: string): RegExp {
    // Escape special regex characters except * and ?
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    // Convert * to .* and ? to .
    const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`, 'i'); // case-insensitive
  }

  // Check if filter contains wildcards
  function hasWildcards(str: string): boolean {
    return str.includes('*') || str.includes('?');
  }

  // Filter with wildcard support
  const filtered = filter
    ? items.filter(r => {
        const searchTerm = filter.toLowerCase();

        // If wildcards present, use pattern matching on filename
        if (hasWildcards(filter)) {
          const regex = wildcardToRegex(filter);
          const filename = r.filePath ? r.filePath.split('/').pop() || '' : '';
          return regex.test(filename);
        }

        // Otherwise, simple includes search on title, channel, and filename
        const filename = r.filePath ? r.filePath.split('/').pop()?.toLowerCase() || '' : '';
        return (
          r.title.toLowerCase().includes(searchTerm) ||
          r.channel.toLowerCase().includes(searchTerm) ||
          filename.includes(searchTerm)
        );
      })
    : items;

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'title': cmp = a.title.localeCompare(b.title); break;
      case 'channel': cmp = a.channel.localeCompare(b.channel); break;
      case 'format': cmp = (a.format || '').localeCompare(b.format || ''); break;
      case 'fileSize': cmp = a.fileSize - b.fileSize; break;
      case 'resolution': cmp = (parseInt(a.resolution || '0') || 0) - (parseInt(b.resolution || '0') || 0); break;
      case 'duration': cmp = a.duration - b.duration; break;
      case 'downloadedAt': cmp = (a.downloadedAt || '').localeCompare(b.downloadedAt || ''); break;
      case 'addedAt': cmp = a.addedAt.localeCompare(b.addedAt); break;
      case 'filePath': cmp = (a.filePath || '').localeCompare(b.filePath || ''); break;
    }
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  function toggleColumn(col: SortField) {
    const next = new Set(visibleColumns);
    if (next.has(col)) { if (next.size > 2) next.delete(col); }
    else next.add(col);
    setVisibleColumns(next);
    localStorage.setItem('ytd-library-columns', JSON.stringify([...next]));
  }

  function formatDuration(seconds: number): string {
    if (!seconds) return '—';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatSize(bytes: number): string {
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes > 0) return `${bytes} B`;
    return '—';
  }

  function formatDate(iso: string | undefined): string {
    if (!iso) return '—';
    const date = new Date(iso + (iso.endsWith('Z') ? '' : 'Z'));
    return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function itemToPlayRecord(item: LibraryItem): DownloadRecord | null {
    if (!item.filePath) return null;
    return {
      id: 0,
      videoId: item.videoId,
      title: item.title,
      channel: item.channel,
      thumbnailUrl: item.thumbnailUrl,
      url: item.url,
      format: item.format || 'mp4',
      quality: item.quality || 'best',
      resolution: item.resolution,
      filePath: item.filePath,
      fileSize: item.fileSize,
      duration: item.duration,
      status: 'completed',
      downloadedAt: item.downloadedAt || item.addedAt,
    };
  }

  return (
    <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Typography variant="h6" fontWeight={600}>
          Library
          {items.length > 0 && (
            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
              ({items.length} {mediaType === 'all' ? 'items' : `${mediaType}s`})
            </Typography>
          )}
        </Typography>
        <Box display="flex" gap={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CreateNewFolderIcon />}
            onClick={handleAddLocalFolder}
          >
            Add Local Folder
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<FolderOpenIcon />}
            onClick={() => {
              loadIndexedFolders();
              setManageFoldersOpen(true);
            }}
          >
            Manage Folders
          </Button>
          {selected.size > 0 && (
            <Button size="small" color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={handleDeleteClick}>
              Delete {selected.size} selected
            </Button>
          )}
        </Box>
      </Box>

      {/* Always show filters if user has ever added content */}
      <Box display="flex" gap={1} mb={2} alignItems="center" flexWrap="wrap">
        <TextField
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by title, filename... (supports *.log, test*, etc.)"
          size="small"
          sx={{ flex: 1, minWidth: 200 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />

        {/* Source Filter */}
        <Box display="flex" gap={0.5} alignItems="center">
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            Source:
          </Typography>
          <ToggleButtonGroup
            value={source}
            exclusive
            onChange={(_, v) => { if (v) setSource(v); }}
            size="small"
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="youtube">YouTube</ToggleButton>
            <ToggleButton value="local">Local</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Media Type Filter - Dropdown for scalability */}
        <Box display="flex" gap={0.5} alignItems="center">
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            Type:
          </Typography>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select
              value={mediaType}
              onChange={(e) => setMediaType(e.target.value as any)}
              sx={{
                height: 32,
                '& .MuiSelect-select': { py: 0.5 }
              }}
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="video">Video</MenuItem>
              <MenuItem value="audio">Audio</MenuItem>
              <MenuItem value="image">Image</MenuItem>
              <MenuItem value="html">HTML</MenuItem>
              <MenuItem value="document">Document (PDF, JSON, Markdown, Text)</MenuItem>
              {/* Future: PowerPoint, Word will be added here */}
            </Select>
          </FormControl>
        </Box>

        {/* Divider between filters and view options */}
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* View Mode */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => { if (v) { setViewMode(v); localStorage.setItem('ytd-library-view', v); } }}
          size="small"
        >
          <ToggleButton value="list" title="Table view"><ViewListIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="grid" title="Card view"><GridViewIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
        {viewMode === 'list' && items.length > 0 && (
          <IconButton size="small" onClick={(e) => setColumnAnchor(e.currentTarget)} title="Choose columns">
            <ViewColumnIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {sorted.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography color="text.secondary" gutterBottom>
            {items.length === 0 ? 'Your library is empty. Download a video or add a local folder to get started.' : 'No matching results'}
          </Typography>
          {items.length === 0 && (source !== 'all' || mediaType !== 'all') && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Try changing the filters above to see your content.
            </Typography>
          )}
        </Box>
      ) : viewMode === 'grid' ? (
        <Grid container spacing={1.5}>
          {sorted.map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.videoId}>
              <Paper
                sx={{
                  p: 1.5, borderRadius: 2, border: '1px solid',
                  borderColor: selected.has(item.videoId) ? 'primary.main' : 'divider',
                  display: 'flex', gap: 1.5, cursor: 'pointer',
                  opacity: item.filePath ? 1 : 0.5,
                  '&:hover': { borderColor: 'primary.main' },
                }}
                elevation={0}
                onClick={() => { if (item.filePath) handlePlayItem(item); }}
              >
                <Checkbox
                  size="small"
                  checked={selected.has(item.videoId)}
                  onChange={(e) => { e.stopPropagation(); toggleSelect(item.videoId); }}
                  onClick={(e) => e.stopPropagation()}
                  sx={{ alignSelf: 'flex-start', p: 0.25 }}
                />
                <Box sx={{ width: 80, height: 52, flexShrink: 0, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover' }}>
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" style={{ width: 80, height: 52, objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <Box sx={{ width: 80, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PlayArrowIcon sx={{ color: 'text.secondary' }} />
                    </Box>
                  )}
                </Box>
                <Box flex={1} overflow="hidden">
                  <Typography variant="body2" fontWeight={500} noWrap>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {item.channel}{item.format ? ` · ${item.format.toUpperCase()}` : ''}{item.resolution ? ` ${item.resolution}p` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" noWrap>
                    {item.fileSize > 0 ? formatSize(item.fileSize) : ''}{item.downloadedAt ? ` · ${formatDate(item.downloadedAt)}` : ''}
                  </Typography>
                </Box>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuAnchor(e.currentTarget); setMenuItem(item); }} sx={{ alignSelf: 'flex-start' }}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Paper>
            </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    indeterminate={selected.size > 0 && selected.size < filtered.length}
                    onChange={toggleSelectAll}
                  />
                </TableCell>
                {ALL_COLUMNS.filter(c => visibleColumns.has(c.id)).map(col => (
                  <TableCell key={col.id}>
                    <TableSortLabel active={sortField === col.id} direction={sortField === col.id ? sortOrder : 'asc'} onClick={() => handleSort(col.id)}>
                      {col.label}
                    </TableSortLabel>
                  </TableCell>
                ))}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((item) => (
                <TableRow key={item.videoId} hover selected={selected.has(item.videoId)} sx={{ opacity: item.filePath ? 1 : 0.5 }}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={selected.has(item.videoId)} onChange={() => toggleSelect(item.videoId)} />
                  </TableCell>
                  {visibleColumns.has('title') && (
                    <TableCell sx={{ maxWidth: 250 }}>
                      <Typography variant="body2" noWrap>{item.title}</Typography>
                    </TableCell>
                  )}
                  {visibleColumns.has('channel') && (
                    <TableCell>
                      <Typography variant="body2" noWrap color="text.secondary">{item.channel}</Typography>
                    </TableCell>
                  )}
                  {visibleColumns.has('format') && (
                    <TableCell>
                      {item.format && <Chip label={item.format.toUpperCase()} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                    </TableCell>
                  )}
                  {visibleColumns.has('resolution') && (
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {item.resolution ? `${item.resolution}p` : '—'}
                      </Typography>
                    </TableCell>
                  )}
                  {visibleColumns.has('fileSize') && (
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{formatSize(item.fileSize)}</Typography>
                    </TableCell>
                  )}
                  {visibleColumns.has('duration') && (
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{formatDuration(item.duration)}</Typography>
                    </TableCell>
                  )}
                  {visibleColumns.has('downloadedAt') && (
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{formatDate(item.downloadedAt)}</Typography>
                    </TableCell>
                  )}
                  {visibleColumns.has('addedAt') && (
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{formatDate(item.addedAt)}</Typography>
                    </TableCell>
                  )}
                  {visibleColumns.has('filePath') && (
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography variant="body2" color="text.secondary" noWrap title={item.filePath || ''}>
                        {item.filePath || '—'}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {item.filePath && (
                      <IconButton size="small" onClick={() => handlePlayItem(item)} title="Play">
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" onClick={(e) => { setMenuAnchor(e.currentTarget); setMenuItem(item); }}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <VideoPlayer
        open={!!playingItem}
        record={playingItem ? itemToPlayRecord(playingItem) : null}
        onClose={() => setPlayingItem(null)}
      />

      {viewingImages && (
        <ImageViewer
          images={viewingImages.images}
          currentIndex={viewingImages.currentIndex}
          onClose={() => setViewingImages(null)}
          onNavigate={(index) => setViewingImages({ ...viewingImages, currentIndex: index })}
        />
      )}

      {viewingHTML && (
        <HTMLViewer
          filePath={viewingHTML.filePath}
          title={viewingHTML.title}
          onClose={() => setViewingHTML(null)}
        />
      )}

      {viewingJSON && (
        <JSONViewer
          filePath={viewingJSON.filePath}
          title={viewingJSON.title}
          onClose={() => setViewingJSON(null)}
        />
      )}

      {viewingMarkdown && (
        <MarkdownViewer
          filePath={viewingMarkdown.filePath}
          title={viewingMarkdown.title}
          onClose={() => setViewingMarkdown(null)}
        />
      )}

      {viewingPDF && (
        <PDFViewer
          filePath={viewingPDF.filePath}
          title={viewingPDF.title}
          onClose={() => setViewingPDF(null)}
        />
      )}

      {viewingText && (
        <TextViewer
          filePath={viewingText.filePath}
          title={viewingText.title}
          onClose={() => setViewingText(null)}
        />
      )}

      <AddToPlaylistDialog
        open={!!addToPlaylistVideo}
        videos={addToPlaylistVideo ? [addToPlaylistVideo] : []}
        onClose={() => setAddToPlaylistVideo(null)}
      />

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => { setMenuAnchor(null); setMenuItem(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {(() => {
          const itemType = menuItem ? getItemMediaType(menuItem) : 'unknown';
          const isPlayable = ['video', 'audio'].includes(itemType);
          const isDocument = ['html', 'json', 'markdown', 'pdf', 'text'].includes(itemType);
          const isImage = itemType === 'image';

          const items = [];

          if (menuItem?.filePath) {
            items.push(
              <MenuItem key="play" onClick={() => { handlePlayItem(menuItem); setMenuAnchor(null); }}>
                <ListItemIcon><PlayArrowIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{isDocument || isImage ? 'View' : 'Play'}</ListItemText>
              </MenuItem>
            );
          }

          if (menuItem?.filePath && isPlayable) {
            items.push(
              <MenuItem key="system-player" onClick={() => { openInSystemPlayer(menuItem!.filePath!); setMenuAnchor(null); }}>
                <ListItemIcon><OpenWithIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Open in System Player</ListItemText>
              </MenuItem>
            );
          }

          if (menuItem?.filePath) {
            items.push(
              <MenuItem key="finder" onClick={() => { openInFinder(menuItem!.filePath!); setMenuAnchor(null); }}>
                <ListItemIcon><FolderOpenIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Show in Finder</ListItemText>
              </MenuItem>
            );
          }

          items.push(<Divider key="divider1" />);

          if (isPlayable) {
            items.push(
              <MenuItem key="playlist" onClick={() => { if (menuItem) setAddToPlaylistVideo({ id: menuItem.videoId, title: menuItem.title, channel: menuItem.channel, channelId: '', thumbnail: menuItem.thumbnailUrl || '', duration: menuItem.duration, publishedAt: menuItem.downloadedAt || '', viewCount: 0, description: '' }); setMenuAnchor(null); }}>
                <ListItemIcon><PlaylistAddIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Add to Playlist</ListItemText>
              </MenuItem>
            );
            items.push(
              <MenuItem key="transcribe" onClick={handleTranscribe}>
                <ListItemIcon>
                  <SubtitlesIcon fontSize="small" color={menuItem && transcriptStatus[menuItem.videoId] ? 'success' : 'inherit'} />
                </ListItemIcon>
                <ListItemText>
                  {menuItem && transcriptStatus[menuItem.videoId] ? 'View Transcript' : 'Transcribe'}
                </ListItemText>
              </MenuItem>
            );
            items.push(<Divider key="divider2" />);
          }

          items.push(
            <MenuItem key="rename" onClick={openRenameDialog}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Rename</ListItemText>
            </MenuItem>
          );

          if (menuItem?.filePath && itemType === 'video' && menuItem.format && menuItem.format !== 'mp4') {
            items.push(
              <MenuItem key="convert" onClick={async () => {
                if (!menuItem?.filePath) return;
                setMenuAnchor(null);
                setConverting(prev => new Set(prev).add(menuItem.videoId));
                const result = await window.api.app.convertToMp4(menuItem.filePath);
                setConverting(prev => { const next = new Set(prev); next.delete(menuItem.videoId); return next; });
                if (result.success && result.outputPath) window.api.app.showInFinder(result.outputPath);
              }}>
                <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Convert to MP4</ListItemText>
              </MenuItem>
            );
          }

          return items;
        })()}
        <Divider />
        {menuItem?.filePath && (
          <MenuItem onClick={() => {
            if (menuItem?.filePath) {
              navigator.clipboard.writeText(menuItem.filePath);
              setSnackbarMessage('File path copied to clipboard');
            }
            setMenuAnchor(null);
          }}>
            <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Copy File Path</ListItemText>
          </MenuItem>
        )}
        {menuItem?.videoId && !menuItem.videoId.startsWith('local-') && (
          <MenuItem onClick={handleCopyURL}>
            <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Copy Video URL</ListItemText>
          </MenuItem>
        )}
        {menuItem?.videoId && !menuItem.videoId.startsWith('local-') && (
          <MenuItem onClick={() => { if (menuItem) openInYouTube(menuItem.videoId); setMenuAnchor(null); }}>
            <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Open on YouTube</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={() => { if (menuItem) { setSelected(new Set([menuItem.videoId])); setDeleteDialogOpen(true); } setMenuAnchor(null); }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <Popover
        open={!!columnAnchor}
        anchorEl={columnAnchor}
        onClose={() => setColumnAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ p: 1.5, minWidth: 160 }}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, pb: 0.5, display: 'block' }}>Show Columns</Typography>
          {ALL_COLUMNS.map(col => (
            <MenuItem key={col.id} dense onClick={() => toggleColumn(col.id)}>
              <Checkbox size="small" checked={visibleColumns.has(col.id)} sx={{ p: 0.5, mr: 1 }} />
              <ListItemText primaryTypographyProps={{ variant: 'body2' }}>{col.label}</ListItemText>
            </MenuItem>
          ))}
        </Box>
      </Popover>

      <Dialog open={deleteDialogOpen} onClose={() => { setDeleteDialogOpen(false); setDeleteFiles(false); }}>
        <DialogTitle>Delete from Library</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Remove {selected.size} {selected.size === 1 ? 'video' : 'videos'} from your library?
            This will also remove them from any playlists.
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={deleteFiles} onChange={(e) => setDeleteFiles(e.target.checked)} />}
            label="Also delete downloaded files from disk"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteDialogOpen(false); setDeleteFiles(false); }}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)}>
        <DialogTitle>Rename Video</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Video Title"
            fullWidth
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyPress={(e) => { if (e.key === 'Enter') handleRename(); }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRename} variant="contained">
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={indexingInProgress} onClose={() => {}}>
        <DialogTitle>Indexing Media Files...</DialogTitle>
        <DialogContent sx={{ minWidth: 400 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Found: {indexingProgress.filesFound} | Processed: {indexingProgress.filesProcessed} | Failed: {indexingProgress.filesFailed}
            </Typography>
            <LinearProgress
              variant="determinate"
              value={indexingProgress.filesFound > 0 ? (indexingProgress.filesProcessed / indexingProgress.filesFound) * 100 : 0}
            />
          </Box>
          {indexingProgress.currentFile && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {indexingProgress.currentFile}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => window.api.media.cancelIndexing()}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Manage Folders Dialog */}
      <Dialog open={manageFoldersOpen} onClose={() => setManageFoldersOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Manage Indexed Folders</DialogTitle>
        <DialogContent>
          {indexedFolders.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>
              No folders added yet. Click "Add Local Folder" to scan your media files.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {indexedFolders.map(folder => (
                <Paper key={folder.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                  <FolderOpenIcon color="primary" />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body1">{folder.path}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Last scanned: {folder.lastScannedAt ? new Date(folder.lastScannedAt).toLocaleString() : 'Never'}
                    </Typography>
                  </Box>
                  <IconButton
                    color="primary"
                    onClick={() => handleRescanFolder(folder.id, folder.path)}
                    disabled={rescanning.has(folder.id)}
                    title={rescanning.has(folder.id) ? 'Rescanning...' : 'Rescan folder for new files'}
                  >
                    {rescanning.has(folder.id) ? <CircularProgress size={24} /> : <RefreshIcon />}
                  </IconButton>
                  <IconButton
                    color="error"
                    onClick={() => {
                      if (window.confirm(
                        `Remove folder: ${folder.path}?\n\n` +
                        `• Media items from this folder will be removed from the library\n` +
                        `• Your actual files will NOT be deleted from disk\n` +
                        `• File watcher will be stopped\n\n` +
                        `Continue?`
                      )) {
                        handleRemoveFolder(folder.id, folder.path);
                      }
                    }}
                    title="Remove folder"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setManageFoldersOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={3000}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Box>
  );
}
