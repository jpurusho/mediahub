import React, { useState, useEffect, useCallback } from 'react';
import { Box, IconButton, Typography, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';

interface TextViewerProps {
  filePath: string;
  title: string;
  onClose: () => void;
}

export default function TextViewer({ filePath, title, onClose }: TextViewerProps) {
  const [textContent, setTextContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Load text file
  useEffect(() => {
    async function loadText() {
      try {
        const result = await window.api.app.getTextFileContent(filePath);
        if (result.error) {
          setError(result.error);
        } else {
          setTextContent(result.content);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load file');
      } finally {
        setLoading(false);
      }
    }
    loadText();
  }, [filePath]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = textContent;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [textContent]);

  const handleOpenExternal = useCallback(async () => {
    try {
      await window.api.app.openExternal(filePath);
    } catch (err) {
      console.error('Failed to open external:', err);
    }
  }, [filePath]);

  // ESC to close
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(0, 0, 0, 0.8)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Box
        sx={{
          width: fullscreen ? '100%' : '90%',
          height: fullscreen ? '100%' : '85%',
          maxWidth: fullscreen ? '100%' : '1400px',
          maxHeight: fullscreen ? '100%' : '900px',
          bgcolor: '#1e1e1e',
          borderRadius: fullscreen ? 0 : 2,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: 24,
        }}
      >
        {/* Header */}
        <Box
          sx={{
            bgcolor: '#2d2d2d',
            px: 3,
            py: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #3d3d3d',
            flexShrink: 0,
          }}
        >
          <Box>
            <Typography variant="h6" sx={{ color: '#fff', fontWeight: 500 }}>
              {title}
            </Typography>
            <Typography variant="caption" sx={{ color: '#888' }}>
              Text Document
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              onClick={handleCopy}
              sx={{
                color: copied ? '#4caf50' : '#fff',
                bgcolor: copied ? 'rgba(76, 175, 80, 0.1)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
              }}
              title={copied ? 'Copied!' : 'Copy to clipboard'}
            >
              <ContentCopyIcon />
            </IconButton>

            <IconButton
              onClick={handleOpenExternal}
              sx={{
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
              }}
              title="Open in external editor"
            >
              <OpenInNewIcon />
            </IconButton>

            <IconButton
              onClick={() => setFullscreen(!fullscreen)}
              sx={{
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' },
              }}
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
            </IconButton>

            <IconButton
              onClick={onClose}
              sx={{
                color: '#fff',
                '&:hover': { bgcolor: 'rgba(255, 0, 0, 0.2)' },
              }}
              title="Close (ESC)"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', bgcolor: '#1e1e1e' }}>
          {loading && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                gap: 2,
              }}
            >
              <CircularProgress />
              <Typography sx={{ color: '#888' }}>Loading...</Typography>
            </Box>
          )}

          {error && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
                p: 4,
              }}
            >
              <Typography color="error" variant="h6">
                Error Loading File
              </Typography>
              <Typography sx={{ color: '#888', mt: 1 }}>{error}</Typography>
            </Box>
          )}

          {!loading && !error && (
            <Box sx={{ display: 'flex', width: '100%' }}>
              {/* Line numbers */}
              <Box
                sx={{
                  minWidth: `${String(textContent.split('\n').length).length * 12 + 40}px`,
                  py: 3,
                  px: 2,
                  bgcolor: '#21252b',
                  color: '#5c6370',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  textAlign: 'right',
                  userSelect: 'none',
                  borderRight: '1px solid #181a1f',
                  flexShrink: 0,
                }}
              >
                {textContent.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </Box>

              {/* Text content */}
              <Box
                component="pre"
                sx={{
                  m: 0,
                  p: 3,
                  color: '#abb2bf',
                  fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre',
                  flex: 1,
                  overflowX: 'auto',
                }}
              >
                {textContent}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
