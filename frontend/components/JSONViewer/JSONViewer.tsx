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
  const [copied, setCopied] = useState(false);

  // Load JSON file
  useEffect(() => {
    async function loadJSON() {
      setLoading(true);
      setError('');

      try {
        const result = await window.api.app.getJSONFileContent(filePath);

        if (result.error) {
          setError(result.error);
          return;
        }

        if (!result.content) {
          setError('No content returned');
          return;
        }

        const content = result.content;
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

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatted || jsonContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[JSONViewer] Clipboard write failed, trying fallback:', err);
      // Fallback method
      try {
        const textArea = document.createElement('textarea');
        textArea.value = formatted || jsonContent;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error('[JSONViewer] Fallback copy also failed:', fallbackErr);
      }
    }
  }, [formatted, jsonContent]);

  const handleOpenExternal = useCallback(async () => {
    try {
      await window.api.app.openExternal(filePath);
    } catch (err) {
      console.error('[JSONViewer] Failed to open external:', err);
    }
  }, [filePath]);

  // Syntax highlight JSON
  const syntaxHighlight = (json: string): string => {
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
        } else {
          cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return `<span class="${cls}">${match}</span>`;
    });
  };

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
              color: copied ? '#4caf50' : 'white',
              WebkitAppRegion: 'no-drag',
              pointerEvents: 'auto',
            }}
            size="small"
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
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            {error && (
              <Box sx={{ p: 1.5, bgcolor: '#ffa50033', borderBottom: '1px solid #ffa500' }}>
                <Typography variant="caption" color="warning.main" sx={{ fontWeight: 500 }}>
                  ⚠️ {error}
                </Typography>
              </Box>
            )}
            <Box
              sx={{
                display: 'flex',
                overflow: 'auto',
                maxHeight: 'calc(100vh - 200px)',
              }}
            >
              {/* Line numbers */}
              <Box
                sx={{
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
                }}
              >
                {formatted.split('\n').map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </Box>
              {/* JSON content */}
              <Box
                component="pre"
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(formatted) }}
                sx={{
                  m: 0,
                  p: 3,
                  pl: 2,
                  flex: 1,
                  color: '#abb2bf',
                  fontFamily: '"Fira Code", "Monaco", "Menlo", monospace',
                  fontSize: '14px',
                  lineHeight: 1.6,
                  '& .string': { color: '#98c379' },
                  '& .number': { color: '#e5c07b' },
                  '& .boolean': { color: '#61afef' },
                  '& .null': { color: '#c678dd' },
                  '& .key': { color: '#e06c75', fontWeight: 600 },
                }}
              />
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
