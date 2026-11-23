import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'media-streaming',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Video streaming endpoint
          if (req.url?.startsWith('/video?')) {
            const url = new URL(req.url, 'http://localhost');
            const videoPath = url.searchParams.get('path');

            if (!videoPath || !fs.existsSync(videoPath)) {
              res.statusCode = 404;
              res.end('Not found');
              return;
            }

            const stat = fs.statSync(videoPath);
            const fileSize = stat.size;
            const ext = path.extname(videoPath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.mp4': 'video/mp4',
              '.webm': 'video/webm',
              '.mp3': 'audio/mpeg',
              '.ogg': 'audio/ogg',
              '.wav': 'audio/wav',
            };
            const contentType = mimeTypes[ext] || 'application/octet-stream';
            const range = req.headers.range;

            if (range) {
              const parts = range.replace(/bytes=/, '').split('-');
              const start = parseInt(parts[0], 10);
              const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
              const chunkSize = (end - start) + 1;

              const stream = fs.createReadStream(videoPath, { start, end });
              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunkSize,
                'Content-Type': contentType,
              });
              stream.pipe(res);
            } else {
              res.writeHead(200, {
                'Content-Length': fileSize,
                'Accept-Ranges': 'bytes',
                'Content-Type': contentType,
              });
              fs.createReadStream(videoPath).pipe(res);
            }
            return;
          }

          // Image serving endpoint
          if (req.url?.startsWith('/image?')) {
            const url = new URL(req.url, 'http://localhost');
            const imagePath = url.searchParams.get('path');

            if (!imagePath || !fs.existsSync(imagePath)) {
              res.statusCode = 404;
              res.end('Not found');
              return;
            }

            const stat = fs.statSync(imagePath);
            const fileSize = stat.size;
            const ext = path.extname(imagePath).toLowerCase();
            const mimeTypes: Record<string, string> = {
              '.png': 'image/png',
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
              '.heic': 'image/heic',
              '.heif': 'image/heif',
              '.bmp': 'image/bmp',
              '.tiff': 'image/tiff',
              '.tif': 'image/tiff',
            };
            const contentType = mimeTypes[ext] || 'image/jpeg';

            res.writeHead(200, {
              'Content-Length': fileSize,
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=3600',
            });
            fs.createReadStream(imagePath).pipe(res);
            return;
          }

          next();
        });
      },
    },
  ],
  root: 'frontend',
  base: './',
  publicDir: 'public',
  build: {
    outDir: '../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@': path.resolve(__dirname, 'frontend'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
