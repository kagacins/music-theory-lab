# Server-Side Chord Analysis Deployment Guide

This guide explains how to deploy the server-side chord detection feature using Modal.com.

## Why Server-Side Analysis?

The browser-based methods (Essentia DSP and Basic Pitch) have limitations:
- **Essentia DSP**: Fast but can struggle with complex mixes
- **Basic Pitch**: Better accuracy but limited by browser WebGL/memory

Server-side analysis using **librosa** provides the best accuracy for professional chord detection.

## Prerequisites

- Python 3.10-3.13 installed (Modal does **not** support Python 3.14+)
- pip (Python package manager)
- Modal.com account (free tier available)

**Note:** If you have multiple Python versions (e.g., 3.12 and 3.14), you must use Python 3.12 or 3.13 for Modal commands.

Check your installed versions:
```powershell
py --list
```

## Setup Steps

### 1. Install Modal CLI

Open PowerShell and run (use `py -3.12` to target Python 3.12 specifically):
```powershell
py -3.12 -m pip install modal
```

If you only have one compatible Python version, you can use:
```powershell
pip install modal
```

### 2. Create Modal Account & Authenticate

1. Go to https://modal.com and sign up (use GitHub login for convenience)
2. After signing up, run in PowerShell:
```powershell
py -3.12 -m modal token new
```
This opens your browser to complete authentication.

### 3. Deploy the Server Function

Navigate to the server folder and deploy:
```powershell
cd "C:\Users\agaci\Documents\Github\Music Theory Lab\server"
py -3.12 -m modal deploy modal_app.py
```

You'll see output like:
```
✓ Created objects.
├── 🔨 Created analyze_chords.
└── 🔨 Created detect_chords_api => https://YOUR-USERNAME--music-theory-lab-chord-detector-detect-chords-api.modal.run
```

**Copy the URL** that ends with `-detect-chords-api.modal.run`

### 4. Update Configuration

Edit `server/config.js` and update:
```javascript
export const SERVER_API_URL = 'https://YOUR-USERNAME--music-theory-lab-chord-detector-detect-chords-api.modal.run';
export const SERVER_ENABLED = true;
```

### 5. Enable in songAnalyzer.js

Add this import at the top of `src/modules/features/songAnalyzer.js`:
```javascript
import { SERVER_API_URL, SERVER_ENABLED } from '../../../server/config.js';
```

Add the server analysis function (after the `analyzeChordsWithBasicPitch` function):
```javascript
/**
 * Analyze chords using server-side processing (Modal.com)
 * @param {AudioBuffer} audioBuffer - The audio to analyze
 * @returns {Promise<Array>} Array of detected chords with timestamps
 */
async function analyzeChordsWithServer(audioBuffer) {
    if (!SERVER_API_URL) {
        throw new Error('Server API URL not configured');
    }

    updateProgress('Preparing audio for server...', 10);

    // Convert AudioBuffer to WAV format
    const wavBlob = await audioBufferToWav(audioBuffer);
    const arrayBuffer = await wavBlob.arrayBuffer();

    // Convert to base64
    const base64Audio = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    updateProgress('Uploading to server...', 30);

    // Send to server
    const response = await fetch(SERVER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            audio: base64Audio,
            sample_rate: audioBuffer.sampleRate
        })
    });

    if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
    }

    updateProgress('Processing on server...', 60);

    const result = await response.json();

    if (!result.success) {
        throw new Error(result.error || 'Server analysis failed');
    }

    updateProgress('Processing results...', 90);

    // Convert server response to our chord format
    const chords = result.chords.map(chord => {
        const chordName = chord.chord;
        let root, type;

        if (chordName === 'N') {
            return null; // No chord detected
        }

        // Parse chord name (e.g., "Am7" -> root: "A", type: "Minor 7th")
        const match = chordName.match(/^([A-G][#b]?)(m7?|7|dim|aug|sus[24]|9|m9)?$/);
        if (match) {
            root = match[1];
            const suffix = match[2] || '';
            const typeMap = {
                '': 'Major',
                'm': 'Minor',
                'm7': 'Minor 7th',
                '7': 'Dominant 7th',
                'dim': 'Diminished',
                'aug': 'Augmented',
                'sus2': 'Sus2',
                'sus4': 'Sus4',
                '9': 'Dominant 9th',
                'm9': 'Minor 9th'
            };
            type = typeMap[suffix] || 'Major';
        } else {
            root = chordName;
            type = 'Major';
        }

        return {
            root,
            type,
            startTime: chord.time,
            endTime: chord.time + chord.duration,
            confidence: chord.confidence
        };
    }).filter(c => c !== null);

    return chords;
}

/**
 * Convert AudioBuffer to WAV Blob
 */
function audioBufferToWav(audioBuffer) {
    const numChannels = 1; // Mono
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    // Get mono audio data
    let samples;
    if (audioBuffer.numberOfChannels === 1) {
        samples = audioBuffer.getChannelData(0);
    } else {
        // Mix down to mono
        samples = new Float32Array(audioBuffer.length);
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            const channelData = audioBuffer.getChannelData(i);
            for (let j = 0; j < audioBuffer.length; j++) {
                samples[j] += channelData[j] / audioBuffer.numberOfChannels;
            }
        }
    }

    const dataLength = samples.length * (bitDepth / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    return new Blob([buffer], { type: 'audio/wav' });
}
```

Update `startAudioAnalysis` function to handle 'server' method:
```javascript
// In startAudioAnalysis, add this case:
if (method === 'server') {
    console.log('[SongAnalyzer] Starting server-side analysis...');
    detectedChords = await analyzeChordsWithServer(audioBuffer);
} else if (method === 'basicpitch') {
    // ... existing code
}
```

### 6. Enable Server Option in UI

Add to `index.html` after the Basic Pitch radio button (inside the detection method selector div):
```html
<label id="server-method-label" class="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer hidden">
    <input type="radio" name="detection-method" value="server" class="mt-1" />
    <div>
        <span class="font-semibold text-gray-800">Server Analysis</span>
        <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded ml-2">Best Accuracy</span>
        <p class="text-xs text-gray-500 mt-0.5">Cloud-based analysis using librosa. Most accurate but requires internet.</p>
    </div>
</label>
```

Add to the `initSongAnalyzer` function to show the option when server is enabled:
```javascript
// Show server option if configured
if (SERVER_ENABLED && SERVER_API_URL) {
    const serverLabel = document.getElementById('server-method-label');
    if (serverLabel) {
        serverLabel.classList.remove('hidden');
    }
}
```

### 7. Redeploy to GitHub Pages

```powershell
git add .
git commit -m "Add server-side chord analysis option"
git push
```

## Costs

Modal.com free tier includes:
- $30/month in free credits
- Plenty for personal use (each analysis costs ~$0.001-0.01)

## Monitoring

View your usage and logs at https://modal.com/apps

## Troubleshooting

### "This version of Modal does not support Python 3.14+"
Modal doesn't support Python 3.14 yet. Use Python 3.12 or 3.13:
```powershell
py -3.12 -m pip install modal
py -3.12 -m modal token new
py -3.12 -m modal deploy modal_app.py
```

### "modal: command not found"
Run `py -3.12 -m pip install modal` again, then restart PowerShell.

### Authentication issues
Run `py -3.12 -m modal token new` to re-authenticate.

### Server errors
Check Modal dashboard at https://modal.com/apps for logs.

### CORS errors
The Modal web endpoint should handle CORS automatically. If issues persist, you may need to add CORS headers to the endpoint.
