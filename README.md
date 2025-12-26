# Video Reel Splitter & Auto-Caption Tool

A client-side web application to split long videos into shorts/reels and automatically generate subtitles using AI (OpenAI Whisper).

## Features
- **Video Splitting:** Split long videos into chunks (e.g., 30s, 60s) using `ffmpeg.wasm`.
- **AI Auto-Captions:** Generate `.srt` subtitles automatically using `Transformers.js` (Whisper).
- **Client-Side Only:** No video is uploaded to any server. Everything happens in your browser for privacy.
- **Custom Footer:** Includes "Made by Shivam Soni".

## ⚠️ Limitations (Important)
Since this tool runs entirely in the browser (using WebAssembly), it has some limits compared to server-side software:

1.  **File Size:** 
    -   Recommended: **Under 500MB**.
    -   Maximum: Usually around **1GB - 2GB** depending on your browser and RAM. Larger files may cause the tab to crash (Out of Memory).
2.  **Performance:** 
    -   Speed depends entirely on your device's CPU/GPU.
    -   AI Transcription (Whisper) is heavy. On low-end devices, it might be slow.
3.  **Browser Compatibility:** 
    -   Requires **SharedArrayBuffer** support.
    -   Works best in Chrome/Edge (Desktop). Mobile support is experimental and might crash on large files.

## Local Setup
Due to security requirements (SharedArrayBuffer), you cannot just open `index.html`.

1.  **Install Node.js** (if not installed).
2.  Run the included server:
    ```bash
    node server.js
    ```
3.  Open `http://localhost:8080`.

## Deployment (Vercel)
To host this online for free:

1.  Push this code to **GitHub**.
2.  Import the project in **Vercel**.
3.  Deploy!
    -   The included `vercel.json` file automatically handles the required security headers (`Cross-Origin-Opener-Policy` & `Cross-Origin-Embedder-Policy`).

**Note:** GitHub Pages will **NOT** work because it does not allow setting custom headers required for `ffmpeg.wasm`.
