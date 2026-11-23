import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import DownloadIcon from '@mui/icons-material/Download';
import StorageIcon from '@mui/icons-material/Storage';
import SyncIcon from '@mui/icons-material/Sync';

interface StatusBarProps {
  currentPage?: string;
}

export default function StatusBar({ currentPage = 'Dashboard' }: StatusBarProps) {
  const [indexingProgress, setIndexingProgress] = useState<{ filesProcessed: number; filesFound: number } | null>(null);
  const [downloadQueue, setDownloadQueue] = useState<number>(0);
  const [storageUsed, setStorageUsed] = useState<string>('');

  useEffect(() => {
    loadStorage();

    // Listen for indexing progress
    const unsubIndexing = window.api.media.onIndexingProgress((progress) => {
      setIndexingProgress({ filesProcessed: progress.filesProcessed, filesFound: progress.filesFound });
    });

    const unsubCompleted = window.api.media.onIndexingCompleted(() => {
      setIndexingProgress(null);
      loadStorage(); // Refresh storage after indexing completes
    });

    // Listen for download queue updates
    const unsubQueue = window.api.downloads.onQueueUpdate((queue) => {
      const active = queue.filter(q => q.status === 'downloading' || q.status === 'pending').length;
      setDownloadQueue(active);
    });

    // Listen for download completions to update storage
    const unsubComplete = window.api.downloads.onComplete(() => {
      loadStorage();
    });

    return () => {
      unsubIndexing();
      unsubCompleted();
      unsubQueue();
      unsubComplete();
    };
  }, []);

  async function loadStorage() {
    try {
      const libraryStats = await window.api.library.getStats();
      if (libraryStats.totalSize > 0) {
        setStorageUsed(formatSize(libraryStats.totalSize));
      }
    } catch (err) {
      console.error('Failed to load storage stats:', err);
    }
  }

  function formatSize(bytes: number): string {
    if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
    if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(0)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${bytes} B`;
  }

  function getPageName(): string {
    // Capitalize first letter of page name
    return currentPage.charAt(0).toUpperCase() + currentPage.slice(1);
  }

  const hasActivity = indexingProgress || downloadQueue > 0;

  return (
    <Box
      sx={{
        height: 32,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        px: 2,
        gap: 1.5,
        flexShrink: 0,
      }}
    >
      {/* Current Page */}
      <Typography variant="caption" fontWeight={600} sx={{ whiteSpace: 'nowrap' }}>
        {getPageName()}
      </Typography>

      {hasActivity && <Box sx={{ width: '1px', height: 16, bgcolor: 'divider', flexShrink: 0 }} />}

      {/* Indexing Progress */}
      {indexingProgress && (
        <>
          <Box display="flex" alignItems="center" gap={0.5}>
            <SyncIcon sx={{ fontSize: 14, animation: 'spin 2s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />
            <Typography variant="caption" color="primary" sx={{ whiteSpace: 'nowrap' }}>
              Indexing: {indexingProgress.filesProcessed}/{indexingProgress.filesFound}
            </Typography>
          </Box>
          {downloadQueue > 0 && <Box sx={{ width: '1px', height: 16, bgcolor: 'divider', flexShrink: 0 }} />}
        </>
      )}

      {/* Download Queue */}
      {downloadQueue > 0 && (
        <Box display="flex" alignItems="center" gap={0.5}>
          <DownloadIcon sx={{ fontSize: 14 }} color="primary" />
          <Typography variant="caption" color="primary" sx={{ whiteSpace: 'nowrap' }}>
            {downloadQueue} {downloadQueue === 1 ? 'download' : 'downloads'} active
          </Typography>
        </Box>
      )}

      <Box sx={{ flex: 1 }} />

      {/* Storage Used */}
      {storageUsed && (
        <Box display="flex" alignItems="center" gap={0.5}>
          <StorageIcon sx={{ fontSize: 14 }} />
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {storageUsed}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
