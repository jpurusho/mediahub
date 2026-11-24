import React from 'react';
import { Box, Typography, IconButton, Button, Paper } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface PowerPointViewerProps {
  filePath: string;
  onClose: () => void;
}

export function PowerPointViewer({ filePath, onClose }: PowerPointViewerProps) {
  const fileName = filePath.split('/').pop() || 'Unknown';
  const fileExt = fileName.split('.').pop()?.toUpperCase() || 'PPT';

  const handleOpenExternal = async () => {
    await window.api.app.openExternal(filePath);
  };

  // Keyboard shortcut: ESC to close
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
      }}
    >
      {/* Top toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          bgcolor: '#1e1e1e',
          borderBottom: '1px solid #333',
        }}
      >
        <Typography
          variant="h6"
          sx={{
            color: '#fff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            mr: 2,
          }}
        >
          {fileName}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<OpenInNewIcon />}
            onClick={handleOpenExternal}
          >
            Open in External App
          </Button>

          <IconButton onClick={onClose} sx={{ color: '#fff' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Main content area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 6,
            textAlign: 'center',
            bgcolor: '#2d2d2d',
            color: '#fff',
            maxWidth: '600px',
          }}
        >
          {/* PowerPoint icon */}
          <SlideshowIcon
            sx={{
              fontSize: 120,
              color: fileExt === 'PPTX' ? '#d04423' : '#c43e1c', // PowerPoint colors
              mb: 3,
            }}
          />

          <Typography variant="h4" gutterBottom>
            PowerPoint Presentation
          </Typography>

          <Typography variant="body1" sx={{ color: '#aaa', mb: 3 }}>
            {fileExt} files cannot be rendered directly in the app.
          </Typography>

          <Typography variant="body2" sx={{ color: '#888', mb: 4 }}>
            Click the button below to open this presentation in PowerPoint, Keynote,
            LibreOffice, or your default presentation app.
          </Typography>

          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<OpenInNewIcon />}
            onClick={handleOpenExternal}
            sx={{ px: 4 }}
          >
            Open in External App
          </Button>

          <Typography variant="caption" sx={{ display: 'block', color: '#666', mt: 3 }}>
            {filePath}
          </Typography>
        </Paper>
      </Box>

      {/* Keyboard shortcuts hint */}
      <Box
        sx={{
          p: 2,
          bgcolor: '#1e1e1e',
          borderTop: '1px solid #333',
          display: 'flex',
          justifyContent: 'center',
          gap: 3,
        }}
      >
        <Typography variant="caption" sx={{ color: '#888' }}>
          <strong>ESC</strong> Close
        </Typography>
        <Typography variant="caption" sx={{ color: '#888' }}>
          <strong>Cmd+O</strong> Open External
        </Typography>
      </Box>
    </Box>
  );
}
