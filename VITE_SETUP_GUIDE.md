# Vite Setup Guide for Music Theory Lab

This document describes how to set up and deploy the project using Vite, and how to revert to the previous non-Vite setup if needed.

---

## Part 1: Prerequisites

### Install Node.js
1. Download Node.js LTS from: https://nodejs.org/
2. Run the installer with default settings (ensure "Add to PATH" is checked)
3. Restart your terminal/PowerShell
4. Verify installation:
   ```powershell
   node --version
   npm --version
   ```

---

## Part 2: Local Development with Vite

### First-Time Setup
1. Open PowerShell/terminal in the project folder:
   ```powershell
   cd "C:\Users\agaci\Documents\Github\Music Theory Lab"
   ```

2. Install dependencies:
   ```powershell
   npm install
   ```

3. Start the development server:
   ```powershell
   npm run dev
   ```

4. Open your browser to `http://localhost:3000` (should auto-open)

### Daily Development
After the first-time setup, you only need:
```powershell
npm run dev
```

### Building for Production
```powershell
npm run build
```
This creates a `dist/` folder with all bundled files.

### Preview Production Build
```powershell
npm run preview
```

---

## Part 3: Deploy to GitHub Pages

### One-Time Setup
1. Go to your GitHub repository settings
2. Navigate to **Settings → Pages**
3. Under "Build and deployment", set Source to: **GitHub Actions**

### Update Base Path (if needed)
In `vite.config.js`, ensure the `base` matches your repo name:
```javascript
base: '/Music-Theory-Lab/',  // Change to your actual repo name
```

### Deploy
Simply push to the main branch:
```powershell
git add .
git commit -m "Your commit message"
git push
```

The GitHub Action (`.github/workflows/deploy.yml`) will automatically:
1. Install dependencies
2. Build the project
3. Deploy to GitHub Pages

Your site will be available at: `https://YOUR_USERNAME.github.io/Music-Theory-Lab/`

---

## Part 4: How It Works

### What Vite Does
- Bundles npm packages (TensorFlow.js, Tonal.js, Basic Pitch) into static JS files
- Resolves `import` statements that browsers can't handle natively
- Optimizes code for production

### Files Changed for Vite Setup
1. **package.json** - Added Vite and dependencies
2. **vite.config.js** - Created new (Vite configuration)
3. **index.html** - Removed CDN scripts for Tonal.js and TensorFlow.js
4. **songAnalyzer.js** - Added ES module imports at top
5. **.gitignore** - Added node_modules/ and dist/
6. **.github/workflows/deploy.yml** - Created new (auto-deploy)

---

## Part 5: REVERT TO NON-VITE SETUP

If Vite doesn't work and you need to go back to the original setup:

### Step 1: Restore index.html CDN Scripts
Find this section in `index.html` (around line 31-34):
```html
<!-- Load Essentia.js for audio analysis and chord detection (WASM - keep as CDN) -->
<script src="https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.web.js"></script>
<script src="https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.js"></script>
<!-- TensorFlow.js, Tonal.js, and Basic Pitch are now bundled via Vite -->
```

**Replace with:**
```html
<!-- Load Essentia.js for audio analysis and chord detection -->
<script src="https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.web.js"></script>
<script src="https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.js"></script>
<!-- Load Tonal.js for music theory and chord detection (alternative method) -->
<script src="https://cdn.jsdelivr.net/npm/tonal@5.0.0/browser/tonal.min.js"></script>
<!-- Load TensorFlow.js for ML-based audio analysis -->
<script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js"></script>
<!-- Note: Basic Pitch requires npm bundling, CDN version not available -->
```

### Step 2: Remove ES Imports from songAnalyzer.js
Open `src/modules/features/songAnalyzer.js` and **delete** these lines at the top (around lines 8-12):
```javascript
// ===========================================
// ES MODULE IMPORTS (Bundled by Vite)
// ===========================================
import * as Tonal from 'tonal';
import { BasicPitch } from '@spotify/basic-pitch';
```

### Step 3: Restore Global Variable Checks in songAnalyzer.js

**Find this (around line 898-901):**
```javascript
console.log('[SongAnalyzer] Loading Basic Pitch model...');
// BasicPitch is now imported as an ES module via Vite
basicPitchModel = new BasicPitch();
```

**Replace with:**
```javascript
// Check if BasicPitch is available
if (typeof BasicPitch === 'undefined') {
    throw new Error('Basic Pitch library not loaded');
}

console.log('[SongAnalyzer] Loading Basic Pitch model...');
basicPitchModel = new BasicPitch.BasicPitch();
```

**Find this (around line 997-998):**
```javascript
// Tonal.js is now imported as an ES module via Vite
const hasTonal = Tonal && Tonal.Chord;
```

**Replace with:**
```javascript
// Check if Tonal.js is available
const hasTonal = typeof Tonal !== 'undefined' && Tonal.Chord;

if (!hasTonal) {
    console.warn('[SongAnalyzer] Tonal.js not available, using fallback chord detection');
}
```

### Step 4: Delete Vite-Related Files (Optional)
You can delete these files/folders:
- `vite.config.js`
- `node_modules/` folder
- `package-lock.json`
- `.github/workflows/deploy.yml`

### Step 5: Restore package.json (Optional)
If you want to completely revert package.json, here's the original:
```json
{
  "name": "music-theory-lab",
  "version": "1.0.0",
  "description": "Interactive Music Theory Lab",
  "scripts": {
    "build-css": "tailwindcss -i ./src/input.css -o ./dist/output.css --minify",
    "watch-css": "tailwindcss -i ./src/input.css -o ./dist/output.css --watch"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.0"
  }
}
```

### Step 6: Update GitHub Pages Settings
1. Go to repository Settings → Pages
2. Change Source from "GitHub Actions" to "Deploy from a branch"
3. Select `main` branch and `/ (root)` folder

### After Reverting
- You can open `index.html` directly in the browser again
- No need for `npm run dev`
- Basic Pitch (AI detection) will NOT work (requires npm bundling)
- Essentia DSP detection will still work

---

## Troubleshooting

### "npm is not recognized"
Node.js is not installed or not in PATH. Reinstall Node.js and restart terminal.

### "Failed to resolve module specifier"
You're opening index.html directly instead of using `npm run dev`. Use Vite's dev server.

### Build fails on GitHub Actions
Check that `base` in vite.config.js matches your exact repository name (case-sensitive).

### Basic Pitch model fails to load
The model is ~20MB. Check your internet connection. First load may take 30+ seconds.

---

## Quick Reference

| Task | Command |
|------|---------|
| Install dependencies | `npm install` |
| Start dev server | `npm run dev` |
| Build for production | `npm run build` |
| Preview production build | `npm run preview` |

---

*Document created: December 2024*
*For Music Theory Lab project*
