import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import MaximizeIcon from '@mui/icons-material/Fullscreen';
import RestoreIcon from '@mui/icons-material/FullscreenExit';
import Draggable from 'react-draggable';

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
  const [maximized, setMaximized] = useState(false);
  const nodeRef = useRef(null);

  console.log('[TextViewer] RENDER - maximized:', maximized, 'copied:', copied, 'loading:', loading);

  // Load text file
  useEffect(() => {
    console.log('[TextViewer] MOUNT - Loading file:', filePath);
    async function loadText() {
      setLoading(true);
      setError('');

      try {
        console.log('[TextViewer] Fetching file content...');
        const result = await window.api.app.getTextFileContent(filePath);

        if (result.error) {
          console.error('[TextViewer] File load error:', result.error);
          setError(result.error);
          return;
        }

        console.log('[TextViewer] File loaded successfully, length:', result.content.length);
        setTextContent(result.content);
      } catch (err: any) {
        console.error('[TextViewer] Failed to load text:', err);
        setError(err?.message || 'Failed to load text file');
      } finally {
        setLoading(false);
      }
    }

    loadText();
  }, [filePath]);

  const handleCopy = useCallback(async () => {
    console.log('[TextViewer] ===== COPY BUTTON CLICKED =====');
    console.log('[TextViewer] Text length to copy:', textContent.length);
    try {
      await navigator.clipboard.writeText(textContent);
      console.log('[TextViewer] ✓ Clipboard write successful');
      setCopied(true);
      setTimeout(() => {
        console.log('[TextViewer] Resetting copied state');
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('[TextViewer] ✗ Clipboard write failed, trying fallback:', err);
      try {
        const textArea = document.createElement('textarea');
        textArea.value = textContent;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        console.log('[TextViewer] ✓ Fallback copy successful');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('[TextViewer] ✗ Fallback copy also failed:', fallbackErr);
        setError('Failed to copy to clipboard. Please select and copy manually.');
      }
    }
  }, [textContent]);

  const handleOpenExternal = useCallback(async () => {
    console.log('[TextViewer] ===== OPEN EXTERNAL CLICKED =====');
    console.log('[TextViewer] File path:', filePath);
    try {
      await window.api.app.openExternal(filePath);
      console.log('[TextViewer] ✓ Open external successful');
    } catch (err) {
      console.error('[TextViewer] ✗ Failed to open external:', err);
    }
  }, [filePath]);

  const toggleMaximize = useCallback(() => {
    console.log('[TextViewer] ===== MAXIMIZE/RESTORE CLICKED =====');
    console.log('[TextViewer] Current maximized state:', maximized);
    setMaximized((prev) => {
      console.log('[TextViewer] ⚡ Setting maximized to:', !prev);
      return !prev;
    });
  }, [maximized]);

  // Log when maximized state changes
  useEffect(() => {
    console.log('[TextViewer] ⚡⚡⚡ MAXIMIZED STATE EFFECT - maximized is now:', maximized);
    console.log('[TextViewer] Window will be:', maximized ? '100vw x 100vh' : '90vw x 85vh');
  }, [maximized]);

  // Keyboard shortcuts
  useEffect(() => {
    console.log('[TextViewer] Setting up keyboard listener');
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        console.log('[TextViewer] ===== ESC KEY PRESSED - CLOSING =====');
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      console.log('[TextViewer] Removing keyboard listener');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bgcolor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
      onMouseDown={(e) => {
        console.log('[TextViewer] 🖱️ BACKDROP MOUSEDOWN', e.target);
      }}
      onClick={(e) => {
        console.log('[TextViewer] 🖱️ BACKDROP CLICK', e.target, e.currentTarget);
        if (e.target === e.currentTarget) {
          console.log('[TextViewer] Backdrop direct click - closing');
          onClose();
        }
      }}
    >
      <Draggable
        nodeRef={nodeRef}
        handle="#draggable-title-text"
        disabled={maximized}
        bounds="parent"
      >
        <Box
          ref={nodeRef}
          sx={{
            width: maximized ? '100vw' : '90vw',
            height: maximized ? '100vh' : '85vh',
            maxWidth: maximized ? '100vw' : '1600px',
            maxHeight: maximized ? '100vh' : '900px',
            bgcolor: '#1e1e1e',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 24,
            pointerEvents: 'auto',
            position: maximized ? 'fixed' : 'relative',
            top: maximized ? 0 : 'auto',
            left: maximized ? 0 : 'auto',
            zIndex: 10000,
          }}
          onMouseDown={(e) => {
            console.log('[TextViewer] 🖱️ CONTENT BOX MOUSEDOWN', e.target);
          }}
          onClick={(e) => {
            console.log('[TextViewer] 🖱️ CONTENT BOX CLICK', e.target);
            e.stopPropagation();
          }}
        >
        {/* Title Bar - Split into two independent zones */}
        <Box
          sx={{
            bgcolor: '#2d2d2d',
            borderBottom: '1px solid #3d3d3d',
            p: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          {/* ZONE 1: DRAGGABLE AREA - Drag here to move window */}
          <Box
            id="draggable-title-text"
            onMouseDown={() => console.log('[TextViewer] 🖱️ DRAGGABLE TITLE AREA MOUSEDOWN - drag starting')}
            sx={{
              flex: 1,
              cursor: maximized ? 'default' : 'move',
              pointerEvents: 'auto',
              userSelect: 'none',
              py: 1,
              '&:hover': {
                bgcolor: maximized ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
              },
            }}
          >
            <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 500 }}>
              {title}
            </Typography>
            <Typography variant="caption" sx={{ color: '#888' }}>
              {maximized ? 'Text Document (Drag disabled)' : 'Text Document (Drag to move)'}
            </Typography>
          </Box>

          {/* ZONE 2: BUTTON AREA - Buttons only, no dragging */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              pointerEvents: 'auto',
              position: 'relative',
              zIndex: 10001,
            }}
            onMouseDown={(e) => {
              console.log('[TextViewer] 🖱️ BUTTON CONTAINER MOUSEDOWN');
              e.stopPropagation(); // Prevent drag from starting
            }}
            onClick={(e) => console.log('[TextViewer] 🖱️ BUTTON CONTAINER CLICK')}
          >
            <IconButton
              onMouseDown={(e) => console.log('[TextViewer] 🖱️ COPY BUTTON MOUSEDOWN')}
              onClick={(e) => {
                console.log('[TextViewer] 🖱️ COPY BUTTON CLICK');
                handleCopy();
              }}
              sx={{
                color: copied ? '#4caf50' : '#fff',
                pointerEvents: 'auto',
                zIndex: 1,
                p: 2,
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s',
              }}
              size="medium"
              title={copied ? 'Copied!' : 'Copy to clipboard'}
            >
              <ContentCopyIcon />
            </IconButton>
            {copied && (
              <Typography variant="caption" sx={{ color: '#4caf50', mr: 1 }}>
                Copied!
              </Typography>
            )}
            <IconButton
              onMouseDown={(e) => console.log('[TextViewer] 🖱️ OPEN EXTERNAL BUTTON MOUSEDOWN')}
              onClick={(e) => {
                console.log('[TextViewer] 🖱️ OPEN EXTERNAL BUTTON CLICK');
                handleOpenExternal();
              }}
              sx={{
                color: '#fff',
                pointerEvents: 'auto',
                zIndex: 1,
                p: 2,
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s',
              }}
              size="medium"
              title="Open in editor"
            >
              <OpenInNewIcon />
            </IconButton>
            <IconButton
              onMouseDown={(e) => console.log('[TextViewer] 🖱️ MAXIMIZE BUTTON MOUSEDOWN')}
              onClick={(e) => {
                console.log('[TextViewer] 🖱️ MAXIMIZE BUTTON CLICK');
                toggleMaximize();
              }}
              sx={{
                color: '#fff',
                pointerEvents: 'auto',
                zIndex: 1,
                p: 2,
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s',
              }}
              size="medium"
              title={maximized ? 'Restore' : 'Maximize'}
            >
              {maximized ? <RestoreIcon /> : <MaximizeIcon />}
            </IconButton>
            <IconButton
              onMouseDown={(e) => console.log('[TextViewer] 🖱️ CLOSE BUTTON MOUSEDOWN')}
              onClick={(e) => {
                console.log('[TextViewer] 🖱️ CLOSE BUTTON CLICK');
                onClose();
              }}
              sx={{
                color: '#fff',
                ml: 1,
                pointerEvents: 'auto',
                zIndex: 1,
                p: 2,
                '&:hover': {
                  bgcolor: 'rgba(255, 0, 0, 0.2)',
                  transform: 'scale(1.1)',
                },
                transition: 'all 0.2s',
              }}
              size="medium"
              title="Close (ESC)"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content Area */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto',
            display: 'flex',
            bgcolor: '#1e1e1e',
          }}
        >
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
              <Typography sx={{ color: '#fff' }}>Loading text file...</Typography>
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
              <Typography color="error" variant="h6" gutterBottom>
                Error Loading Text File
              </Typography>
              <Typography sx={{ color: '#aaa' }}>{error}</Typography>
            </Box>
          )}

          {!loading && !error && (
            <Box sx={{ display: 'flex', width: '100%' }}>
              {/* Line numbers */}
              <Box
                sx={{
                  minWidth: `${String(textContent.split('\n').length).length * 12 + 40}px`,
                  p: 3,
                  pr: 2,
                  bgcolor: '#21252b',
                  color: '#5c6370',
                  fontFamily: '"Fira Code", "Monaco", "Menlo", monospace',
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
                  pl: 4,
                  color: '#abb2bf',
                  fontFamily: '"Fira Code", "Monaco", "Menlo", monospace',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  whiteSpace: 'pre',
                  wordWrap: 'normal',
                  overflowX: 'auto',
                  flex: 1,
                }}
              >
                {textContent}
              </Box>
            </Box>
          )}
        </Box>
      </Box>
      </Draggable>
    </Box>
  );
}
