import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Typography,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Paper,
  PaperProps,
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

function DraggablePaper(props: PaperProps) {
  const nodeRef = React.useRef(null);
  return (
    <Draggable
      handle="#draggable-text-viewer-title"
      cancel={'[class*="MuiDialogContent-root"]'}
      nodeRef={nodeRef}
    >
      <Paper {...props} ref={nodeRef} />
    </Draggable>
  );
}

export default function TextViewer({ filePath, title, onClose }: TextViewerProps) {
  const [textContent, setTextContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [maximized, setMaximized] = useState(false);

  // Load text file
  useEffect(() => {
    async function loadText() {
      setLoading(true);
      setError('');

      try {
        const result = await window.api.app.getTextFileContent(filePath);

        if (result.error) {
          setError(result.error);
          return;
        }

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

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [textContent]);

  const handleOpenExternal = useCallback(async () => {
    await window.api.app.openExternal(filePath);
  }, [filePath]);

  const toggleMaximize = useCallback(() => {
    setMaximized((prev) => !prev);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <Dialog
      open={true}
      onClose={onClose}
      maxWidth={false}
      PaperComponent={maximized ? Paper : DraggablePaper}
      PaperProps={{
        sx: {
          width: maximized ? '100vw' : '90vw',
          height: maximized ? '100vh' : '85vh',
          maxWidth: maximized ? '100vw' : '1600px',
          maxHeight: maximized ? '100vh' : '900px',
          m: maximized ? 0 : 2,
          bgcolor: '#1e1e1e',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogTitle
        id="draggable-text-viewer-title"
        sx={{
          cursor: maximized ? 'default' : 'move',
          bgcolor: '#2d2d2d',
          borderBottom: '1px solid #3d3d3d',
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ color: '#fff', fontWeight: 500 }}>
            {title}
          </Typography>
          <Typography variant="caption" sx={{ color: '#888' }}>
            Text Document
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={handleCopy}
            sx={{ color: copied ? '#4caf50' : '#fff' }}
            size="small"
            title={copied ? 'Copied!' : 'Copy to clipboard'}
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
          {copied && (
            <Typography variant="caption" sx={{ color: '#4caf50', mr: 1 }}>
              Copied!
            </Typography>
          )}
          <IconButton
            onClick={handleOpenExternal}
            sx={{ color: '#fff' }}
            size="small"
            title="Open in editor"
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
          <IconButton
            onClick={toggleMaximize}
            sx={{ color: '#fff' }}
            size="small"
            title={maximized ? 'Restore' : 'Maximize'}
          >
            {maximized ? <RestoreIcon fontSize="small" /> : <MaximizeIcon fontSize="small" />}
          </IconButton>
          <IconButton onClick={onClose} sx={{ color: '#fff', ml: 1 }} size="small" title="Close (ESC)">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          p: 0,
          bgcolor: '#1e1e1e',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {loading && (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
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
              height: '100%',
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
          <Box
            sx={{
              display: 'flex',
              overflow: 'auto',
              height: '100%',
            }}
          >
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
      </DialogContent>
    </Dialog>
  );
}
