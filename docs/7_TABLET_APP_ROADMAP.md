# Music Theory Lab - Tablet Application Roadmap

This document outlines the path to transforming Music Theory Lab from a desktop web application into a feature-complete tablet application.

---

## Current State Assessment

### What's Built (~70% Feature Complete)

**Core Composition Tools**
- Progression Builder with drag-and-drop
- Melody Composer with VexFlow notation
- Chord Builder with inversions
- Grand Staff rendering

**Recommendation Engines**
- 3D scoring system (600+ combinations)
- Multi-dimensional tension analysis
- Voice leading optimizer
- User preference learning

**Educational Features**
- 20+ theory lessons
- Scale Explorer (26+ scales)
- Practice Mode with spaced repetition
- Ear Training exercises
- Interactive tutorials

**Export/Import**
- PDF, MIDI, MusicXML, WAV/MP3, JSON

**Audio**
- Tone.js synthesis
- Real-time playback
- Arpeggiator

---

## Phase 1: Touch-Ready Foundation

**Goal:** Make the existing app usable on tablets without breaking desktop experience.

### 1.1 Touch Target Sizing
**Priority:** Critical
**Effort:** Low

All interactive elements need minimum 44x44px touch targets.

**Files to modify:**
- `src/input.css` - Add touch-friendly utility classes
- `index.html` - Update button sizes
- All modal components

**Changes:**
```css
/* Add to input.css */
.touch-target {
  min-width: 44px;
  min-height: 44px;
}

@media (pointer: coarse) {
  button, .btn, [role="button"] {
    min-height: 44px;
    padding: 12px 16px;
  }
}
```

### 1.2 iOS Audio Initialization
**Priority:** Critical
**Effort:** Low

iOS Safari requires user gesture before audio playback.

**File:** `src/modules/audio/audioEngine.js`

**Solution:**
```javascript
// Add touch-to-start handler
let audioUnlocked = false;

export async function unlockAudio() {
  if (audioUnlocked) return;

  await Tone.start();
  audioUnlocked = true;
}

// Call on first user interaction
document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('click', unlockAudio, { once: true });
```

### 1.3 Viewport & Scaling
**Priority:** Critical
**Effort:** Low

**File:** `index.html`

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

### 1.4 Replace Hover States
**Priority:** High
**Effort:** Medium

Convert CSS `:hover` states to work with touch.

**Approach:**
- Use `:active` for immediate feedback
- Use `@media (hover: hover)` to scope hover-only styles
- Add explicit tap feedback classes

```css
/* Only apply hover on devices that support it */
@media (hover: hover) {
  .card:hover {
    transform: scale(1.02);
  }
}

/* Always apply active state */
.card:active {
  transform: scale(0.98);
}
```

---

## Phase 2: Responsive Layout

**Goal:** Adapt the three-panel layout for tablet screens.

### 2.1 Breakpoint Strategy
**Priority:** High
**Effort:** Medium

| Breakpoint | Layout |
|------------|--------|
| < 768px | Single column, tabbed navigation |
| 768-1024px | Two columns, collapsible sidebar |
| > 1024px | Full three-panel (current) |

### 2.2 Collapsible Panels
**Priority:** High
**Effort:** Medium

**Files to create/modify:**
- `src/modules/ui/responsiveLayout.js` (new)
- `src/modules/ui/panelState.js` (extend)

**Features:**
- Swipe gestures to show/hide panels
- Bottom sheet for mobile chord selection
- Floating action button for common actions

### 2.3 Navigation Redesign
**Priority:** High
**Effort:** Medium

**Current:** Horizontal tabs at top
**Tablet:** Bottom navigation bar or hamburger menu

```html
<!-- Bottom navigation for tablet/mobile -->
<nav class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t md:hidden">
  <div class="flex justify-around py-2">
    <button data-tab="progression">Chords</button>
    <button data-tab="melody">Notation</button>
    <button data-tab="learn">Learn</button>
    <button data-tab="settings">Settings</button>
  </div>
</nav>
```

### 2.4 Notation Staff Handling
**Priority:** High
**Effort:** Medium

**Requirements:**
- Horizontal scroll for long progressions
- Pinch-to-zoom on notation
- Double-tap to reset zoom

**File:** `src/modules/notation/grandStaff.js`

```javascript
// Add touch zoom handling
let currentZoom = 1;

function handlePinchZoom(e) {
  if (e.touches.length === 2) {
    const distance = getDistance(e.touches[0], e.touches[1]);
    currentZoom = Math.max(0.5, Math.min(2, distance / initialDistance));
    applyZoom(currentZoom);
  }
}
```

---

## Phase 3: Touch-First Notation Editor

**Goal:** Rebuild notation editing for touch interaction.

### 3.1 Note Selection
**Priority:** Critical
**Effort:** High

**Current:** Mouse click with pixel-precision
**Touch:** Tap zones with visual feedback

**Changes needed:**
- Enlarge clickable areas around notes
- Add selection handles for duration/pitch adjustment
- Visual feedback on selection

### 3.2 Note Entry Mode
**Priority:** Critical
**Effort:** High

**Options:**

**Option A: Piano Roll Input**
- On-screen piano keyboard
- Tap key to enter note at cursor position
- Scroll timeline horizontally

**Option B: Tap-to-Place**
- Tap on staff to place note
- Snap to nearest pitch line
- Popup for duration selection

**Option C: Step Entry (Recommended)**
- Select duration first (toolbar)
- Tap staff position for pitch
- Auto-advance cursor

### 3.3 Gesture Controls
**Priority:** Medium
**Effort:** Medium

| Gesture | Action |
|---------|--------|
| Tap | Select note |
| Double-tap | Edit note properties |
| Long-press | Context menu (delete, tie, etc.) |
| Swipe left/right | Navigate measures |
| Swipe up/down on note | Change pitch |
| Pinch | Zoom notation |

### 3.4 On-Screen Toolbar
**Priority:** High
**Effort:** Medium

Redesign notation toolbar for touch:
- Larger icons (48px minimum)
- Grouped into expandable sections
- Floating position option

---

## Phase 4: PWA & Offline Support

**Goal:** Enable "Add to Home Screen" with offline functionality.

### 4.1 Web App Manifest
**Priority:** High
**Effort:** Low

**File:** `manifest.json` (create)

```json
{
  "name": "Music Theory Lab",
  "short_name": "Theory Lab",
  "description": "Learn music theory and compose chord progressions",
  "start_url": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#1f2937",
  "theme_color": "#10b981",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 4.2 Service Worker
**Priority:** High
**Effort:** Medium

**File:** `sw.js` (create)

**Cache strategy:**
- App shell (HTML, CSS, JS) - Cache first
- Audio samples - Cache first, update in background
- User data - Network first with offline fallback

```javascript
const CACHE_NAME = 'music-theory-lab-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dist/output.css',
  '/src/main.js',
  // ... core modules
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
  );
});
```

### 4.3 IndexedDB Storage
**Priority:** Medium
**Effort:** Medium

Replace localStorage with IndexedDB for:
- Larger storage quota
- Better performance with large compositions
- Structured data queries

**File:** `src/modules/storage/indexedDBStorage.js` (create)

```javascript
const DB_NAME = 'MusicTheoryLab';
const DB_VERSION = 1;

const stores = {
  compositions: 'id',
  progress: 'lessonId',
  settings: 'key'
};
```

---

## Phase 5: Platform-Specific Features

### 5.1 iPad Multitasking
**Priority:** Medium
**Effort:** Low

Support Split View and Slide Over:
- Maintain functionality at 320px width
- Responsive breakpoints for all split sizes

### 5.2 Apple Pencil Support (iPad)
**Priority:** Low
**Effort:** Medium

- Pressure sensitivity for dynamics
- Hover preview (M1+ iPads)
- Handwriting recognition for chord symbols

### 5.3 External Keyboard
**Priority:** Medium
**Effort:** Low

Maintain keyboard shortcuts when connected:
- Document shortcuts in help overlay
- Handle keyboard appearance/disappearance

### 5.4 Share Sheet Integration
**Priority:** Medium
**Effort:** Low

Use Web Share API for exports:

```javascript
async function shareComposition(file, title) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: title,
      text: 'Check out my chord progression!'
    });
  } else {
    // Fallback to download
    downloadFile(file);
  }
}
```

---

## Phase 6: Native App Wrapper (Optional)

### 6.1 Capacitor Setup
**Priority:** Low
**Effort:** Medium

For App Store distribution:

```bash
npm install @capacitor/core @capacitor/cli
npx cap init "Music Theory Lab" "com.musictheorylab.app"
npx cap add ios
npx cap add android
```

### 6.2 Native Features
**Priority:** Low
**Effort:** High

Features requiring native wrapper:
- Push notifications for practice reminders
- Background audio playback
- File system access
- In-app purchases (premium features)
- Haptic feedback

---

## Implementation Priority Matrix

| Phase | Feature | Priority | Effort | Impact |
|-------|---------|----------|--------|--------|
| 1 | Touch targets | Critical | Low | High |
| 1 | iOS audio fix | Critical | Low | High |
| 1 | Viewport setup | Critical | Low | High |
| 2 | Responsive layout | High | Medium | High |
| 2 | Bottom navigation | High | Medium | High |
| 3 | Touch note entry | Critical | High | Critical |
| 3 | Gesture controls | Medium | Medium | Medium |
| 4 | PWA manifest | High | Low | Medium |
| 4 | Service worker | High | Medium | High |
| 5 | Share integration | Medium | Low | Medium |
| 6 | Native wrapper | Low | High | Low |

---

## Testing Checklist

### Device Testing
- [ ] iPad (various sizes: Mini, Air, Pro)
- [ ] Android tablets (Samsung Galaxy Tab, etc.)
- [ ] iPad with keyboard attached
- [ ] iPad with Apple Pencil

### Browser Testing
- [ ] Safari (iOS/iPadOS)
- [ ] Chrome (Android)
- [ ] Firefox (Android)

### Interaction Testing
- [ ] All buttons reachable with thumb
- [ ] No accidental taps on adjacent elements
- [ ] Gestures don't conflict with browser gestures
- [ ] Audio plays on first interaction
- [ ] Offline mode functional

### Performance Testing
- [ ] Initial load < 3 seconds on 4G
- [ ] Smooth scrolling (60fps)
- [ ] No jank during notation rendering
- [ ] Memory usage stable during long sessions

---

## Success Metrics

**Phase 1 Complete:**
- App loads and functions on iPad Safari
- Audio plays without issues
- All buttons tappable

**Phase 2 Complete:**
- Comfortable use in portrait and landscape
- No horizontal scroll on main views
- Navigation intuitive

**Phase 3 Complete:**
- Can compose full progression via touch only
- Note entry as fast as desktop (within 50%)
- No precision frustration

**Phase 4 Complete:**
- Works offline after first load
- "Add to Home Screen" functional
- Data persists across sessions

**Production Ready:**
- User testing feedback positive (>4/5 rating)
- Core workflows completable on tablet
- Performance comparable to native apps

---

## Related Documents

- [MODULE_INDEX.md](MODULE_INDEX.md) - Current module structure
- [6_COMPREHENSIVE_ROADMAP_2026.md](6_COMPREHENSIVE_ROADMAP_2026.md) - Feature roadmap
- [STATE_MANAGEMENT.md](STATE_MANAGEMENT.md) - Data flow architecture
- [API_REFERENCE.md](API_REFERENCE.md) - Function signatures

---

*Last Updated: January 2026*
