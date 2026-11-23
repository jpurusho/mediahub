import React, { useState, useEffect, useCallback } from 'react';
import { Box, IconButton, Typography, CircularProgress } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { marked } from 'marked';
import mermaid from 'mermaid';

interface MarkdownViewerProps {
  filePath: string;
  title: string;
  onClose: () => void;
}

export default function MarkdownViewer({ filePath, title, onClose }: MarkdownViewerProps) {
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [htmlContent, setHtmlContent] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
      themeVariables: {
        darkMode: true,
        background: '#1e1e1e',
        primaryColor: '#BB86FC',
        primaryTextColor: '#fff',
        primaryBorderColor: '#7f39fb',
        lineColor: '#5c6370',
        secondaryColor: '#03dac6',
        tertiaryColor: '#3700b3',
      },
    });
  }, []);

  // Load Markdown file
  useEffect(() => {
    async function loadMarkdown() {
      setLoading(true);
      setError('');

      try {
        const result = await window.api.app.getMarkdownFileContent(filePath);

        if (result.error) {
          setError(result.error);
          return;
        }

        if (!result.content) {
          setError('No content returned');
          return;
        }

        const content = result.content;
        setMarkdownContent(content);

        // Convert Markdown to HTML
        try {
          const html = await marked.parse(content, {
            gfm: true,
            breaks: true,
          });
          setHtmlContent(html);

          // Render Mermaid diagrams after content is set
          setTimeout(() => {
            mermaid.run({
              querySelector: '.mermaid',
            });
          }, 100);
        } catch (parseError) {
          setError('Failed to parse Markdown: ' + (parseError as Error).message);
        }
      } catch (err) {
        console.error('Failed to load Markdown:', err);
        setError('Failed to load Markdown file');
      } finally {
        setLoading(false);
      }
    }

    loadMarkdown();
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
    navigator.clipboard.writeText(markdownContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [markdownContent]);

  const handleOpenExternal = useCallback(() => {
    window.api.app.openExternal(`file://${filePath}`);
  }, [filePath]);

  return (
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
            Markdown Document
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

      {/* Markdown Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflow: 'auto',
          bgcolor: '#1e1e1e',
          p: 3,
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mt: 10 }}>
            <CircularProgress />
            <Typography color="white">Loading Markdown...</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 4, textAlign: 'center', mt: 10 }}>
            <Typography color="error" variant="h6" gutterBottom>
              Error Loading Markdown
            </Typography>
            <Typography color="text.secondary">{error}</Typography>
          </Box>
        )}

        {!loading && !error && htmlContent && (
          <Box
            sx={{
              width: '100%',
              maxWidth: 900,
              bgcolor: '#282c34',
              borderRadius: 1,
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            <Box
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              sx={{
                p: 4,
                color: '#abb2bf',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                fontSize: '16px',
                lineHeight: 1.6,
                overflow: 'auto',
                maxHeight: 'calc(100vh - 200px)',
                // Markdown styling
                '& h1': {
                  fontSize: '2em',
                  fontWeight: 600,
                  color: '#e06c75',
                  borderBottom: '2px solid #5c6370',
                  pb: 1,
                  mb: 2,
                  mt: 3,
                },
                '& h2': {
                  fontSize: '1.5em',
                  fontWeight: 600,
                  color: '#61afef',
                  borderBottom: '1px solid #5c6370',
                  pb: 1,
                  mb: 2,
                  mt: 2.5,
                },
                '& h3': {
                  fontSize: '1.25em',
                  fontWeight: 600,
                  color: '#c678dd',
                  mb: 1.5,
                  mt: 2,
                },
                '& h4, & h5, & h6': {
                  fontWeight: 600,
                  color: '#98c379',
                  mb: 1,
                  mt: 1.5,
                },
                '& p': {
                  mb: 2,
                },
                '& code': {
                  bgcolor: '#21252b',
                  color: '#e06c75',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 0.5,
                  fontSize: '0.9em',
                  fontFamily: '"Fira Code", "Monaco", "Menlo", monospace',
                },
                '& pre': {
                  bgcolor: '#21252b',
                  p: 2,
                  borderRadius: 1,
                  overflow: 'auto',
                  mb: 2,
                  border: '1px solid #181a1f',
                  '& code': {
                    bgcolor: 'transparent',
                    color: '#abb2bf',
                    p: 0,
                  },
                },
                '& a': {
                  color: '#61afef',
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline',
                  },
                },
                '& ul, & ol': {
                  pl: 3,
                  mb: 2,
                },
                '& li': {
                  mb: 0.5,
                },
                '& blockquote': {
                  borderLeft: '4px solid #61afef',
                  pl: 2,
                  py: 0.5,
                  ml: 0,
                  color: '#5c6370',
                  fontStyle: 'italic',
                  mb: 2,
                },
                '& table': {
                  width: '100%',
                  borderCollapse: 'collapse',
                  mb: 2,
                },
                '& th': {
                  bgcolor: '#21252b',
                  color: '#e06c75',
                  fontWeight: 600,
                  p: 1.5,
                  borderBottom: '2px solid #5c6370',
                  textAlign: 'left',
                },
                '& td': {
                  p: 1.5,
                  borderBottom: '1px solid #3e4451',
                },
                '& tr:hover': {
                  bgcolor: '#2c313a',
                },
                '& img': {
                  maxWidth: '100%',
                  height: 'auto',
                  borderRadius: 1,
                  mb: 2,
                },
                '& hr': {
                  border: 'none',
                  borderTop: '1px solid #5c6370',
                  my: 3,
                },
                // Mermaid diagram styling
                '& .mermaid': {
                  textAlign: 'center',
                  mb: 2,
                  bgcolor: '#1e1e1e',
                  p: 2,
                  borderRadius: 1,
                },
              }}
            />
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
