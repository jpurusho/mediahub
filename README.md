# MediaHub

A comprehensive media library manager for macOS. Browse your YouTube playlists and subscriptions, search videos, preview before downloading, manage a local media library, generate searchable transcripts, and organize your content — all with a clean native interface.

## Features

- **Google OAuth** — Sign in with your YouTube/Google account
- **Search** — Find videos with fuzzy search, see thumbnails and metadata
- **Browse** — View your playlists, subscriptions, and channel uploads
- **Preview** — Inline YouTube player to watch before downloading
- **Download** — Multiple simultaneous downloads with progress tracking
- **Format Selection** — MP4, WebM, MP3 (audio), with resolution picker showing available qualities
- **Time Range** — Visual slider to download specific segments of a video
- **Pause/Resume** — Pause downloads, resume on restart (persistent queue)
- **Local Playlists** — Create and manage playlists, sync two-way with YouTube
- **History** — Sortable download history with file status, bulk delete
- **Local Player** — Built-in media player with seek support
- **Transcription** — Generate searchable transcripts using local Whisper or OpenAI API
- **Convert** — Convert WebM to MP4 for ProPresenter/other tools
- **Themes** — 6 themes (Midnight, YouTube, Ocean, Sunset, GitHub Dark, Light)
- **Auto-Update** — Checks GitHub Releases for new versions
- **Zero Dependencies** — yt-dlp and ffmpeg bundled in packaged builds

## Install (macOS)

1. Download the `.zip` from [Releases](https://github.com/jpurusho/mediahub/releases)
2. Extract (double-click)
3. Move `MediaHub.app` to `/Applications`
4. Run: `xattr -rc /Applications/MediaHub.app`
5. Open MediaHub and sign in with Google

## Development

### Prerequisites

- Node.js 20+
- `yt-dlp` and `ffmpeg` installed via Homebrew: `brew install yt-dlp ffmpeg`
- **Optional:** `openai-whisper` for local video transcription: `pip install openai-whisper`
- Google Cloud project with YouTube Data API v3 enabled

### Setup

```bash
git clone git@github.com:jpurusho/mediahub.git
cd mediahub
cp .env.example .env
# Edit .env with your Google OAuth Client ID and Secret
npm install
npm run dev
```

### Google Cloud Console

1. Create or use an existing project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable **YouTube Data API v3**
3. Create OAuth 2.0 credentials (Desktop app type)
4. Add authorized redirect URIs: `http://localhost:48620/callback` through `http://localhost:48640/callback`
5. Copy Client ID and Secret to `.env`

### Transcription Setup

MediaHub supports two transcription methods:

1. **Local Whisper** (free, runs on your machine)
   - Install: `pip install openai-whisper`
   - Models: `tiny`, `base`, `small`, `medium`, `large` (larger = more accurate, slower)
   - Requires: Python 3.8+, ffmpeg

2. **OpenAI API** (paid, faster, cloud-based)
   - Add `OPENAI_API_KEY` to `.env`
   - Cost: ~$0.006/minute of audio
   - Best for quick transcription of long videos

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Vite + Electron) |
| `npm run build` | Compile TypeScript + bundle React |
| `npm run dist` | Package macOS .zip |
| `npm test` | Run tests |
| `npm run download-bins` | Fetch yt-dlp + ffmpeg for packaging |

## Build & Release

### Local release

```bash
./scripts/release.sh 1.0.0
```

### CI/CD

Push a version tag to trigger automated build + GitHub Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Requires repo secrets: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture with Mermaid diagrams.

**Stack:** Electron 33 · React 18 · MUI 5 · TypeScript 5 · Vite 6 · SQLite · yt-dlp · ffmpeg

```
mediahub/
├── desktop/        # Electron main process (services, IPC)
├── frontend/       # React renderer (pages, components, themes)
├── shared/         # TypeScript interfaces
├── scripts/        # Build and release scripts
├── docs/           # Architecture documentation
└── resources/      # App icons
```

## License

MIT
