import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, IconButton, Typography, CircularProgress, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import * as pdfjsLib from 'pdfjs-dist';

interface PDFViewerProps {
  filePath: string;
  title: string;
  onClose: () => void;
}

export default function PDFViewer({ filePath, title, onClose }: PDFViewerProps) {
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load PDF file
  useEffect(() => {
    async function loadPDF() {
      setLoading(true);
      setError('');

      try {
        // Set worker path to local file (CSP compliant) - must be set before loading PDF
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const result = await window.api.app.getPDFFileUrl(filePath);

        if (result.error) {
          setError(result.error);
          return;
        }

        if (!result.data) {
          setError('No PDF data returned');
          return;
        }

        // Convert array back to Uint8Array for pdf.js
        const uint8Array = new Uint8Array(result.data);

        // Load PDF document from data
        const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
        const pdf = await loadingTask.promise;

        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error('Failed to load PDF:', err);
        setError('Failed to load PDF file');
      } finally {
        setLoading(false);
      }
    }

    loadPDF();
  }, [filePath]);

  // Render current page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    async function renderPage() {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
      } catch (err) {
        console.error('Failed to render page:', err);
      }
    }

    renderPage();
  }, [pdfDoc, currentPage, scale]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && currentPage > 1) {
        setCurrentPage(p => p - 1);
      } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
        setCurrentPage(p => p + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, currentPage, totalPages]);

  const handleZoomIn = useCallback(() => {
    setScale(s => Math.min(s + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(s => Math.max(s - 0.25, 0.5));
  }, []);

  const handlePrevPage = useCallback(() => {
    setCurrentPage(p => Math.max(p - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage(p => Math.min(p + 1, totalPages));
  }, [totalPages]);

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
            PDF Document {totalPages > 0 && `· Page ${currentPage} of ${totalPages}`}
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
          {/* Navigation */}
          {totalPages > 0 && (
            <>
              <IconButton
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                sx={{ color: 'white' }}
                size="small"
                title="Previous page (←)"
              >
                <NavigateBeforeIcon />
              </IconButton>
              <Typography variant="body2" color="white" sx={{ mx: 1, minWidth: 60, textAlign: 'center' }}>
                {currentPage} / {totalPages}
              </Typography>
              <IconButton
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                sx={{ color: 'white' }}
                size="small"
                title="Next page (→)"
              >
                <NavigateNextIcon />
              </IconButton>
            </>
          )}

          {/* Zoom */}
          <IconButton
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            sx={{ color: 'white', ml: 2 }}
            size="small"
            title="Zoom out"
          >
            <ZoomOutIcon />
          </IconButton>
          <Typography variant="body2" color="white" sx={{ minWidth: 50, textAlign: 'center' }}>
            {Math.round(scale * 100)}%
          </Typography>
          <IconButton
            onClick={handleZoomIn}
            disabled={scale >= 3}
            sx={{ color: 'white' }}
            size="small"
            title="Zoom in"
          >
            <ZoomInIcon />
          </IconButton>

          <IconButton
            onClick={handleOpenExternal}
            sx={{ color: 'white', ml: 2 }}
            size="small"
            title="Open in external viewer"
          >
            <OpenInNewIcon />
          </IconButton>
          <IconButton
            onClick={onClose}
            sx={{ color: 'white', ml: 2 }}
            size="small"
            title="Close (ESC)"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>

      {/* PDF Content */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          bgcolor: '#525659',
          p: 3,
        }}
      >
        {loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress />
            <Typography color="white">Loading PDF...</Typography>
          </Box>
        )}

        {error && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="error" variant="h6" gutterBottom>
              Error Loading PDF
            </Typography>
            <Typography color="text.secondary">{error}</Typography>
          </Box>
        )}

        {!loading && !error && pdfDoc && (
          <Box
            sx={{
              bgcolor: 'white',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              display: 'inline-block',
            }}
          >
            <canvas ref={canvasRef} />
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
        ESC Close · ← → Navigate Pages · Zoom In/Out
      </Box>
    </Box>
  );
}
