import React, { useState, useEffect, useCallback } from 'react';
import { Box, IconButton, Typography, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface HTMLViewerProps {
  filePath: string;
  title: string;
  onClose: () => void;
}

export default function HTMLViewer({ filePath, title, onClose }: HTMLViewerProps) {
  const [htmlUrl, setHtmlUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [key, setKey] = useState(0); // For forcing iframe reload

  // Load HTML file URL
  useEffect(() => {
    async function loadHTML() {
      setLoading(true);
      setError('');

      try {
        // Use file:// protocol for HTML files so relative resources work
        const result = await window.api.app.getHTMLFileUrl(filePath);
        if (result.error) {
          setError(result.error);
        } else if (result.url) {
          setHtmlUrl(result.url);
        } else {
          setError('Failed to get HTML URL');
        }
      } catch (err) {
        console.error('Failed to load HTML:', err);
        setError('Failed to load HTML file');
      } finally {
        setLoading(false);
      }
    }

    loadHTML();
  }, [filePath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleRefresh();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleRefresh = useCallback(() => {
    setKey(prev => prev + 1); // Force iframe reload
  }, []);

  const handleOpenExternal = useCallback(() => {
    if (htmlUrl) {
      window.open(htmlUrl, '_blank');
    }
  }, [htmlUrl]);

  return (
    // Full-screen overlay
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(0, 0, 0, 0.95)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        WebkitAppRegion: 'no-drag',
      }}
    >
      {/* Top Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          WebkitAppRegion: 'no-drag',
          pointerEvents: 'auto',
        }}
      >
        <Box
          sx={{
            WebkitAppRegion: 'no-drag',
            pointerEvents: 'auto',
          }}
        >
          <Typography variant="subtitle1" color="white" noWrap>
            {title}
          </Typography>
          <Typography variant="caption" color="rgba(255, 255, 255, 0.6)">
            HTML Document
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            WebkitAppRegion: 'no-drag',
            pointerEvents: 'auto',
          }}
        >
          <IconButton
            onClick={handleRefresh}
            sx={{
              color: 'white',
              WebkitAppRegion: 'no-drag',
              pointerEvents: 'auto',
            }}
            size="small"
            title="Refresh (Cmd+R)"
          >
            <RefreshIcon />
          </IconButton>
          <IconButton
            onClick={handleOpenExternal}
            sx={{
              color: 'white',
              WebkitAppRegion: 'no-drag',
              pointerEvents: 'auto',
            }}
            size="small"
            title="Open in browser"
          >
            <OpenInNewIcon />
          </IconButton>
          <IconButton
            onClick={onClose}
            sx={{
              color: 'white',
              ml: 2,
              WebkitAppRegion: 'no-drag',
              pointerEvents: 'auto',
            }}
            size="small"
            title="Close (ESC)"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* HTML Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          bgcolor: 'white',
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress />
            <Typography color="text.secondary">Loading HTML...</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="error" variant="h6" gutterBottom>
              Error Loading HTML
            </Typography>
            <Typography color="text.secondary">{error}</Typography>
          </Box>
        )}

        {!loading && !error && htmlUrl && (
          <iframe
            key={key}
            src={htmlUrl}
            title={title}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              backgroundColor: 'white',
            }}
          />
        )}
      </Box>

      {/* Bottom hint */}
      <Box
        sx={{
          py: 1,
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'rgba(255, 255, 255, 0.6)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          bgcolor: 'rgba(0, 0, 0, 0.8)',
        }}
      >
        ESC Close · Cmd+R Refresh · Full JavaScript/CSS support
      </Box>
    </Box>
  );
}
