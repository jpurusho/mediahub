import React, { useState, useEffect, useCallback } from 'react';
import { Box, IconButton, Typography, Dialog, AppBar, Toolbar, CircularProgress, Alert, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';

interface ImageViewerProps {
  images: Array<{
    videoId: string;
    title: string;
    filePath: string;
    thumbnailUrl?: string;
  }>;
  currentIndex: number;
  onClose: () => void;
  onNavigate?: (index: number) => void;
}

export default function ImageViewer({ images, currentIndex, onClose, onNavigate }: ImageViewerProps) {
  const [index, setIndex] = useState(currentIndex);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<'fit' | 'actual'>('fit');
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const currentImage = images[index];

  // Define all callbacks first (before useEffect hooks that reference them)
  const handlePrevious = useCallback(() => {
    if (index > 0) {
      const newIndex = index - 1;
      setIndex(newIndex);
      setZoom(1);
      setFitMode('fit');
      onNavigate?.(newIndex);
    }
  }, [index, onNavigate]);

  const handleNext = useCallback(() => {
    if (index < images.length - 1) {
      const newIndex = index + 1;
      setIndex(newIndex);
      setZoom(1);
      setFitMode('fit');
      onNavigate?.(newIndex);
    }
  }, [index, images.length, onNavigate]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 5));
    setFitMode('actual');
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.25));
    setFitMode('actual');
  }, []);

  const handleFitToggle = useCallback(() => {
    if (fitMode === 'fit') {
      setFitMode('actual');
      setZoom(1);
    } else {
      setFitMode('fit');
      setZoom(1);
    }
  }, [fitMode]);

  // Load image via HTTP endpoint
  useEffect(() => {
    async function loadImage() {
      setLoading(true);
      setError('');

      try {
        if (currentImage.filePath) {
          // Get HTTP URL for image file
          const result = await window.api.app.getImageFileUrl(currentImage.filePath);
          if (result.error) {
            setError(result.error);
          } else if (result.url) {
            setImageSrc(result.url);
          } else {
            setError('Failed to get image URL');
          }
        } else if (currentImage.thumbnailUrl) {
          setImageSrc(currentImage.thumbnailUrl);
        } else {
          setError('No image source available');
        }
      } catch (err) {
        console.error('Failed to load image:', err);
        setError('Failed to load image');
      } finally {
        setLoading(false);
      }
    }

    loadImage();
  }, [currentImage]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          handleFitToggle();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrevious, handleNext, handleZoomIn, handleZoomOut, handleFitToggle]);

  // Handle mouse wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          handleZoomIn();
        } else {
          handleZoomOut();
        }
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [handleZoomIn, handleZoomOut]);

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen
      sx={{
        '& .MuiDialog-paper': {
          bgcolor: 'rgba(0, 0, 0, 0.95)',
        }
      }}
    >
      {/* Top Toolbar */}
      <AppBar position="fixed" sx={{ bgcolor: 'rgba(0, 0, 0, 0.8)' }}>
        <Toolbar>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" noWrap>
              {currentImage.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {index + 1} / {images.length}
            </Typography>
          </Box>

          <IconButton color="inherit" onClick={handleZoomOut} disabled={zoom <= 0.25}>
            <ZoomOutIcon />
          </IconButton>
          <Typography variant="body2" sx={{ mx: 1, minWidth: 50, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton color="inherit" onClick={handleZoomIn} disabled={zoom >= 5}>
            <ZoomInIcon />
          </IconButton>
          <IconButton color="inherit" onClick={handleFitToggle} title={fitMode === 'fit' ? 'Actual size' : 'Fit to screen'}>
            <FitScreenIcon />
          </IconButton>
          <IconButton color="inherit" onClick={onClose} sx={{ ml: 2 }}>
            <CloseIcon />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Main Image Display */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          pt: 8,
          overflow: fitMode === 'fit' ? 'hidden' : 'auto',
          position: 'relative',
        }}
      >
        {/* Previous Button */}
        {index > 0 && (
          <IconButton
            onClick={handlePrevious}
            sx={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.8)' },
              color: 'white',
              zIndex: 1,
            }}
            size="large"
          >
            <NavigateBeforeIcon fontSize="large" />
          </IconButton>
        )}

        {/* Image Content */}
        {loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ maxWidth: 400 }}>
            {error}
          </Alert>
        )}

        {!loading && !error && imageSrc && (
          <Box
            component="img"
            src={imageSrc}
            alt={currentImage.title}
            sx={{
              maxWidth: fitMode === 'fit' ? '100%' : 'none',
              maxHeight: fitMode === 'fit' ? 'calc(100vh - 100px)' : 'none',
              width: fitMode === 'actual' ? `${zoom * 100}%` : 'auto',
              height: fitMode === 'actual' ? 'auto' : 'auto',
              objectFit: 'contain',
              userSelect: 'none',
              cursor: fitMode === 'fit' ? 'zoom-in' : 'zoom-out',
            }}
            onClick={handleFitToggle}
            draggable={false}
          />
        )}

        {/* Next Button */}
        {index < images.length - 1 && (
          <IconButton
            onClick={handleNext}
            sx={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.8)' },
              color: 'white',
              zIndex: 1,
            }}
            size="large"
          >
            <NavigateNextIcon fontSize="large" />
          </IconButton>
        )}
      </Box>

      {/* Media Info Footer */}
      {currentImage && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 60,
            left: 0,
            right: 0,
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            bgcolor: 'rgba(0, 0, 0, 0.85)',
            px: 2,
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            fontSize: '0.75rem',
          }}
        >
          {/* Source Icon & Type */}
          <Box display="flex" alignItems="center" gap={0.5}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />
            <Typography variant="caption" fontWeight={600} color="white">Local Image</Typography>
          </Box>

          <Box sx={{ width: 1, height: 14, bgcolor: 'rgba(255, 255, 255, 0.2)' }} />

          {/* File Name */}
          {currentImage.filePath && (
            <Typography variant="caption" noWrap sx={{ maxWidth: 300, color: 'white' }}>
              {currentImage.filePath.split('/').pop()}
            </Typography>
          )}

          {/* Format */}
          {currentImage.filePath && (
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              {currentImage.filePath.split('.').pop()?.toUpperCase()}
            </Typography>
          )}

          <Box sx={{ flex: 1 }} />

          {/* File Path */}
          {currentImage.filePath && (
            <Tooltip title={currentImage.filePath}>
              <IconButton
                size="small"
                onClick={() => {
                  navigator.clipboard.writeText(currentImage.filePath);
                }}
                sx={{ p: 0.5, color: 'white' }}
              >
                <Box display="flex" alignItems="center" gap={0.5}>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem' }}>Copy Path</Typography>
                </Box>
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Keyboard Hints */}
      <Box
        sx={{
          position: 'fixed',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          bgcolor: 'rgba(0, 0, 0, 0.7)',
          color: 'white',
          px: 2,
          py: 1,
          borderRadius: 1,
          display: 'flex',
          gap: 2,
          fontSize: '0.75rem',
        }}
      >
        <span>← → Navigate</span>
        <span>+ - Zoom</span>
        <span>0 Fit/Actual</span>
        <span>ESC Close</span>
      </Box>
    </Dialog>
  );
}
