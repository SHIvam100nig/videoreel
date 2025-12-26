import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';

// Config to ensure we don't try to load local models if not available
env.allowLocalModels = false;

const { createFFmpeg, fetchFile } = FFmpeg;
let ffmpeg = null;
let currentFile = null;
let transcriber = null;

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploadSection = document.getElementById('upload-section');
const settingsSection = document.getElementById('settings-section');
const progressSection = document.getElementById('progress-section');
const resultsSection = document.getElementById('results-section');
const fileNameDisplay = document.getElementById('file-name');
const processBtn = document.getElementById('process-btn');
const splitDurationInput = document.getElementById('split-duration');
const captionsToggle = document.getElementById('captions-toggle');
const statusText = document.getElementById('status-text');
const progressFill = document.getElementById('progress-fill');
const reelsGrid = document.getElementById('reels-grid');
const resetBtn = document.getElementById('reset-btn');
const changeFileBtn = document.getElementById('change-file-btn');

// Initialize FFmpeg
const initFFmpeg = async () => {
    if (ffmpeg === null) {
        ffmpeg = createFFmpeg({ log: true });
    }
    if (!ffmpeg.isLoaded()) {
        await ffmpeg.load();
    }
};

// Initialize Whisper Transcriber
const initTranscriber = async () => {
    if (!transcriber) {
        statusText.textContent = 'Loading AI Model (Whisper)... ~100MB';
        // Using quantization for smaller download/faster inference
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
    }
};

// Event Listeners
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

changeFileBtn.addEventListener('click', () => {
    currentFile = null;
    settingsSection.classList.add('hidden');
    uploadSection.classList.remove('hidden');
    fileInput.value = '';
});

processBtn.addEventListener('click', startProcessing);

resetBtn.addEventListener('click', () => {
    location.reload();
});

// Functions
function handleFile(file) {
    if (!file.type.startsWith('video/')) {
        alert('Please upload a video file.');
        return;
    }
    currentFile = file;
    fileNameDisplay.textContent = file.name;
    uploadSection.classList.add('hidden');
    settingsSection.classList.remove('hidden');
}

async function startProcessing() {
    const duration = parseInt(splitDurationInput.value);
    const generateCaptions = captionsToggle.checked;

    if (!duration || duration < 5) {
        alert('Please enter a valid duration (minimum 5 seconds).');
        return;
    }

    settingsSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    progressFill.style.width = '10%';

    try {
        if (!window.crossOriginIsolated) {
            const hasReloaded = sessionStorage.getItem('retry_reload');

            if (!hasReloaded) {
                statusText.textContent = 'Enabling High-Performance Mode (Reloading)...';
                sessionStorage.setItem('retry_reload', 'true');
                window.location.reload();
                return; // Stop execution
            } else {
                // Already reloaded once, so it's a persistent issue or user blocked it
                statusText.textContent = 'Performance Mode Failed.';
                alert("Critical Error: Your browser is blocking the high-performance features (SharedArrayBuffer) needed for this AI tool.\n\nSolutions:\n1. Open this in Chrome or Edge Desktop.\n2. If on GitHub Pages, try waiting 1 minute and Hard Refresh (Ctrl+F5).");
                sessionStorage.removeItem('retry_reload'); // Reset for next time
                throw new Error("Security Headers Missing - Application cannot run.");
            }
        }

        // Clear flag if we are successful
        sessionStorage.removeItem('retry_reload');

        if (generateCaptions) {
            await initTranscriber();
        }

        statusText.textContent = 'Loading FFmpeg Core...';
        await initFFmpeg();
        progressFill.style.width = '20%';

        statusText.textContent = 'Reading file...';
        const { name } = currentFile;
        ffmpeg.FS('writeFile', name, await fetchFile(currentFile));

        // --- Caption Generation Logic ---
        let subtitles = null;
        if (generateCaptions) {
            statusText.textContent = 'Extracting audio for AI...';
            // Extract audio to 16kHz mono WAV for Whisper
            await ffmpeg.run('-i', name, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1', 'audio.wav');

            const audioData = ffmpeg.FS('readFile', 'audio.wav');
            const audioBlob = new Blob([audioData.buffer], { type: 'audio/wav' });
            const audioUrl = URL.createObjectURL(audioBlob);

            statusText.textContent = 'Generating Captions with AI... (This may take a moment)';
            const output = await transcriber(audioUrl, {
                chunk_length_s: 30,
                stride_length_s: 5,
            });

            subtitles = output; // Text and chunks
        }
        progressFill.style.width = '50%';

        // --- Video Splitting Logic ---
        statusText.textContent = 'Splitting video...';

        await ffmpeg.run(
            '-i', name,
            '-c', 'copy',
            '-map', '0',
            '-segment_time', duration.toString(),
            '-f', 'segment',
            '-reset_timestamps', '1',
            'output%03d.mp4'
        );

        statusText.textContent = 'Processing complete!';
        progressFill.style.width = '100%';

        await listAndDisplayFiles(subtitles, duration);

    } catch (error) {
        console.error(error);
        statusText.textContent = 'Error: ' + error.message;
        alert('An error occurred. If getting SharedArrayBuffer errors, please use a compatible browser environment.');
    }
}

async function listAndDisplayFiles(subtitles, segmentDuration) {
    progressSection.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    reelsGrid.innerHTML = '';

    const files = ffmpeg.FS('readdir', '/');
    const outputFiles = files.filter(f => f.startsWith('output') && f.endsWith('.mp4'));

    if (outputFiles.length === 0) {
        reelsGrid.innerHTML = '<p>No segments were created. Verify the video format.</p>';
        return;
    }

    outputFiles.forEach((file, index) => {
        const data = ffmpeg.FS('readFile', file);
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

        let srtBlobUrl = null;
        if (subtitles) {
            // Filter subtitles for this segment
            const startTime = index * segmentDuration;
            const endTime = (index + 1) * segmentDuration;

            const segmentSubs = subtitles.chunks.filter(chunk => {
                // Check if chunk overlaps with this segment
                return chunk.timestamp[1] > startTime && chunk.timestamp[0] < endTime;
            }).map(chunk => {
                // Adjust timestamps relative to segment start
                return {
                    text: chunk.text,
                    timestamp: [
                        Math.max(0, chunk.timestamp[0] - startTime),
                        Math.max(0, chunk.timestamp[1] - startTime)
                    ]
                };
            });

            const srtContent = generateSRT(segmentSubs);
            const srtBlob = new Blob([srtContent], { type: 'text/srt' });
            srtBlobUrl = URL.createObjectURL(srtBlob);
        }

        createReelCard(file, url, srtBlobUrl);
    });
}

function generateSRT(chunks) {
    return chunks.map((chunk, index) => {
        const start = formatTime(chunk.timestamp[0]);
        const end = formatTime(chunk.timestamp[1]);
        return `${index + 1}\n${start} --> ${end}\n${chunk.text.trim()}\n`;
    }).join('\n');
}

function formatTime(seconds) {
    if (!seconds && seconds !== 0) return '00:00:00,000';
    const date = new Date(seconds * 1000);
    const hh = date.getUTCHours().toString().padStart(2, '0');
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
}

function createReelCard(filename, videoUrl, srtUrl) {
    const card = document.createElement('div');
    card.className = 'reel-card';

    let srtButton = '';
    if (srtUrl) {
        srtButton = `<a href="${srtUrl}" download="${filename.replace('.mp4', '.srt')}" class="download-btn" style="background:var(--accent); margin-top:5px;">Download Subtitles (.srt)</a>`;
    }

    card.innerHTML = `
        <video class="reel-preview" src="${videoUrl}" controls></video>
        <div class="reel-info">
            <p style="margin-bottom:0.5rem; font-weight:600;">${filename}</p>
            <a href="${videoUrl}" download="reel_${filename}" class="download-btn">Download Video</a>
            ${srtButton}
        </div>
    `;

    reelsGrid.appendChild(card);
}
