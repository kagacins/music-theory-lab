# Start Here Guide Screenshot Enhancement Plan

## Goal
Enhance the Start Here Guide (`start-here.html`) with screenshots and callouts to make it more visual and beginner-friendly.

## Setup Completed
- Playwright MCP server installed for Claude Code
- Command used: `claude mcp add --transport stdio playwright -- cmd /c npx -y @anthropic-ai/mcp-playwright`
- Server added to local config at `C:\Users\agaci\.claude.json`

## Next Steps After Restarting Claude Code

1. **Verify MCP connection**: Type `/mcp` to confirm Playwright server is connected
2. **Test screenshot**: Try capturing `http://localhost:3000/start-here.html`
3. **Capture screenshots for each section** (see list below)
4. **Add callouts/annotations** to highlight key UI elements
5. **Update start-here.html** to include the screenshots

## Screenshots Completed ✅

### 1. App Overview ✅
- [x] Full app interface showing tabs (Chord Lab, Composition Studio, Scale Explorer, Theory Academy)
- [x] Location: `images/guide/app-overview.png`

### 2. Chord Lab Section ✅
- [x] Chord Lab tab with chord library and piano keyboard
- [x] Location: `images/guide/chord-lab-overview.png`

### 3. Composition Studio Section ✅
- [x] Composition Studio with progression, notation, and analysis panels
- [x] Location: `images/guide/composition-studio-overview.png`
- [x] Location: `images/guide/composition-studio-notation.png`

### 4. AI Recommendations Modal ✅
- [x] Chord suggestions tab with scores and explanations
- [x] Melody suggestions tab with chord tone analysis
- [x] Location: `images/guide/recommendations-modal.png`
- [x] Location: `images/guide/recommendations-melody.png`

### 5. Scale Explorer Section ✅
- [x] Scale Explorer with root selection, categories, and scale list
- [x] Location: `images/guide/scale-explorer.png`

### 6. Theory Academy Section ✅
- [x] Theory Academy with learning paths and progress tracking
- [x] Location: `images/guide/theory-academy.png`
- **Note**: Screenshot required CSS injection to fix white-on-white text rendering issue in Playwright

## New Sections Added to Guide ✅

### Interactive Tutorials Section ✅
- [x] Let It Be tutorial modal screenshot
- [x] Tutorial in progress screenshot (step-by-step guidance)
- [x] Location: `images/guide/let-it-be-tutorial-modal.png`, `images/guide/let-it-be-tutorial-interactive.png`

### Settings & Preferences Section ✅
- [x] Sidebar settings screenshot (Display, Keyboard, Features)
- [x] Location: `images/guide/sidebar-settings.png`

### Recommendation Weights Section ✅
- [x] Recommendation weights modal screenshot
- [x] Location: `images/guide/recommendation-weights.png`

## Screenshots Still Needed (Optional Future Enhancements)

### Notation Editing (could be added later)
- [ ] Notation toolbar showing duration buttons
- [ ] Click-to-add-note demonstration
- [ ] Multi-voice support (Voice 1/Voice 2 toggle)
- [ ] Isolated measure editing modal

### Additional Screenshots
- [ ] Songwriting Wizard modal
- [ ] Export options

## File Locations

- **Start Here Guide**: `start-here.html`
- **Screenshot destination**: `images/guide/` (create this folder)
- **This plan**: `docs/START_HERE_GUIDE_SCREENSHOT_PLAN.md`

## App URLs for Screenshots

- Main app: `http://localhost:3000/index.html`
- Start Here Guide: `http://localhost:3000/start-here.html`

Make sure the dev server is running (`npm run dev` or similar) before capturing screenshots.

## Instructions for New Claude Code Session

After restarting Claude Code:

1. Say: "I'm continuing the Start Here Guide screenshot project. Please read docs/START_HERE_GUIDE_SCREENSHOT_PLAN.md for context."

2. Verify Playwright MCP is working: `/mcp`

3. Start capturing screenshots one section at a time

4. After each screenshot, update the HTML to include it

5. Add callouts using CSS overlays or image editing as needed
