import React, { useState, useEffect, useCallback } from 'react';
import { Box, IconButton, Typography, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface JSONViewerProps {
  filePath: string;
  title: string;
  onClose: () => void;
}

export default function JSONViewer({ filePath, title, onClose }: JSONViewerProps) {
  const [jsonContent, setJsonContent] = useState<string>('');
  const [formatted, setFormatted] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Load JSON file
  useEffect(() => {
    async function loadJSON() {
      setLoading(true);
      setError('');

      try {
        const fs = window.require?.('fs');
        if (!fs) {
          setError('File system access not available');
          return;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        setJsonContent(content);

        // Try to parse and format
        try {
          const parsed = JSON.parse(content);
          const prettified = JSON.stringify(parsed, null, 2);
          setFormatted(prettified);
        } catch (parseError) {
          setError('Invalid JSON: ' + (parseError as Error).message);
          setFormatted(content); // Show raw content anyway
        }
      } catch (err) {
        console.error('Failed to load JSON:', err);
        setError('Failed to load JSON file');
      } finally {
        setLoading(false);
      }
    }

    loadJSON();
  }, [filePath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(formatted || jsonContent);
  }, [formatted, jsonContent]);

  const handleOpenExternal = useCallback(() => {
    window.api.app.openExternal(`file://${filePath}`);
  }, [filePath]);

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
            JSON Document
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
            onClick={handleCopy}
            sx={{
              color: 'white',
              WebkitAppRegion: 'no-drag',
              pointerEvents: 'auto',
            }}
            size="small"
            title="Copy to clipboard"
          >
            <ContentCopyIcon />
          </IconButton>
          <IconButton
            onClick={handleOpenExternal}
            sx={{
              color: 'white',
              WebkitAppRegion: 'no-drag',
              pointerEvents: 'auto',
            }}
            size="small"
            title="Open in editor"
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

      {/* JSON Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          bgcolor: '#1e1e1e',
          p: 3,
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress />
            <Typography color="white">Loading JSON...</Typography>
          </Box>
        )}

        {error && !formatted && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="error" variant="h6" gutterBottom>
              Error Loading JSON
            </Typography>
            <Typography color="text.secondary">{error}</Typography>
          </Box>
        )}

        {!loading && formatted && (
          <Box
            sx={{
              width: '100%',
              maxWidth: 1200,
              bgcolor: '#282c34',
              borderRadius: 1,
              overflow: 'hidden',
            }}
          >
            {error && (
              <Box sx={{ p: 1, bgcolor: '#ffa50033', borderBottom: '1px solid #ffa500' }}>
                <Typography variant="caption" color="warning.main">
                  ⚠️ {error}
                </Typography>
              </Box>
            )}
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 3,
                color: '#abb2bf',
                fontFamily: '"Fira Code", "Monaco", "Menlo", monospace',
                fontSize: '14px',
                lineHeight: 1.6,
                overflow: 'auto',
                maxHeight: 'calc(100vh - 200px)',
                '& .string': { color: '#98c379' },
                '& .number': { color: '#d19a66' },
                '& .boolean': { color: '#56b6c2' },
                '& .null': { color: '#c678dd' },
                '& .key': { color: '#e06c75' },
              }}
            >
              {formatted}
            </Box>
          </Box>
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
        ESC Close · Copy · Open in Editor
      </Box>
    </Box>
  );
}
