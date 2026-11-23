import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const currentImage = images[index];

  // Reset zoom and pan when changing images
  const resetZoomPan = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Navigation
  const handlePrevious = useCallback(() => {
    if (index > 0) {
      const newIndex = index - 1;
      setIndex(newIndex);
      resetZoomPan();
      onNavigate?.(newIndex);
    }
  }, [index, onNavigate, resetZoomPan]);

  const handleNext = useCallback(() => {
    if (index < images.length - 1) {
      const newIndex = index + 1;
      setIndex(newIndex);
      resetZoomPan();
      onNavigate?.(newIndex);
    }
  }, [index, images.length, onNavigate, resetZoomPan]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.25, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  }, []);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return;
    e.preventDefault();
    isPanning.current = true;
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  }, [zoom, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    e.preventDefault();
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  // Click to zoom
  const handleImageClick = useCallback(() => {
    if (!isPanning.current) {
      if (zoom === 1) {
        setZoom(2);
      } else {
        resetZoomPan();
      }
    }
  }, [zoom, resetZoomPan]);

  // Load image
  useEffect(() => {
    async function loadImage() {
      setLoading(true);
      setError('');

      try {
        if (currentImage.filePath) {
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      } else if (e.key === '0') {
        resetZoomPan();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrevious, handleNext, handleZoomIn, handleZoomOut, resetZoomPan]);

  // Smooth wheel zoom
  useEffect(() => {
    const el = imageContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.max(0.5, Math.min(5, z - e.deltaY * 0.002)));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [currentImage.videoId]);

  return (
    // Full-screen overlay (not MUI Dialog)
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
        // Prevent Electron window drag on this overlay
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
          position: 'relative',
          zIndex: 100,
          // Make sure this can receive clicks, not window drag
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
            {currentImage.title}
          </Typography>
          <Typography variant="caption" color="rgba(255, 255, 255, 0.6)">
            {index + 1} / {images.length}
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
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            sx={{
              color: 'white',
              WebkitAppRegion: 'no-drag',
              pointerEvents: 'auto',
            }}
            size="small"
          >
            <ZoomOutIcon />
          </IconButton>
          <Typography variant="body2" sx={{ color: 'white', minWidth: 50, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            sx={{
              color: 'white',
              WebkitAppRegion: 'no-drag',
              pointerEvents: 'auto',
            }}
            size="small"
          >
            <ZoomInIcon />
          </IconButton>
          {zoom !== 1 && (
            <IconButton
              onClick={resetZoomPan}
              sx={{
                color: 'white',
                WebkitAppRegion: 'no-drag',
                pointerEvents: 'auto',
              }}
              size="small"
              title="Reset zoom"
            >
              <FitScreenIcon />
            </IconButton>
          )}
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

      {/* Image Container */}
      <Box
        ref={imageContainerRef}
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          cursor: zoom > 1 ? (isPanning.current ? 'grabbing' : 'grab') : 'zoom-in',
          userSelect: 'none',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleImageClick}
      >
        {/* Previous Button */}
        {index > 0 && (
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              handlePrevious();
            }}
            sx={{
              position: 'absolute',
              left: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.8)' },
              zIndex: 10,
            }}
            size="large"
          >
            <NavigateBeforeIcon fontSize="large" />
          </IconButton>
        )}

        {/* Image */}
        {loading && (
          <Typography color="white">Loading...</Typography>
        )}

        {error && (
          <Typography color="error">{error}</Typography>
        )}

        {!loading && !error && imageSrc && (
          <Box
            component="img"
            src={imageSrc}
            alt={currentImage.title}
            draggable={false}
            sx={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: 'transform 0.1s ease-out',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Next Button */}
        {index < images.length - 1 && (
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            sx={{
              position: 'absolute',
              right: 16,
              top: '50%',
              transform: 'translateY(-50%)',
              bgcolor: 'rgba(0, 0, 0, 0.6)',
              color: 'white',
              '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.8)' },
              zIndex: 10,
            }}
            size="large"
          >
            <NavigateNextIcon fontSize="large" />
          </IconButton>
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
        }}
      >
        Scroll to zoom · Click to zoom in · Drag to pan · ← → Navigate · 0 Reset · ESC Close
      </Box>
    </Box>
  );
}
