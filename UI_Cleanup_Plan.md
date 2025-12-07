# UI Cleanup Plan - Phase 1 Completion

This document outlines the remaining UI cleanup tasks for Phase 1 of the Music Theory Lab product vision.

---

## High Priority Items

### 1. Sidebar Toggle Grouping
**Status:** Not Started
**Files:** `index.html`

**Problem:** 8+ toggles displayed in a flat, ungrouped list creating visual clutter.

**Solution:** Group toggles into logical categories with visual separators:

```
DISPLAY SETTINGS
├── Dark Mode
├── Notation Style (Standard/Simple)
├── Accidentals (Sharps/Flats)

KEYBOARD SETTINGS
├── Show Octaves
├── Key Names on Keyboard
├── Classic Keyboard Style

FEATURE TOGGLES
├── Roman Numerals
├── Guitar Fretboard
├── Compact Controls
├── Chord Spans
├── Chord Tone Highlighting
```

**Implementation:**
- Add section headers with icons
- Group related toggles under collapsible sections
- Add subtle dividers between groups

---

### 2. CSS Variable Consolidation
**Status:** Not Started
**Files:** Create `src/styles/variables.css`, update `music.css`, `composition-studio.css`

**Problem:** CSS variables defined in 3+ locations leading to inconsistency.

**Solution:** Create single source of truth for all CSS variables:

```css
/* variables.css */
:root {
  /* Colors - Primary */
  --color-primary: #8B5CF6;
  --color-primary-light: #A78BFA;
  --color-primary-dark: #7C3AED;

  /* Colors - Semantic */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* Typography */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;

  /* Borders */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 16px;

  /* Transitions */
  --transition-fast: 0.15s ease;
  --transition-normal: 0.25s ease;
  --transition-slow: 0.35s ease;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
}
```

**Implementation:**
- Create `variables.css` with all design tokens
- Import at top of `music.css`
- Gradually replace hardcoded values

---

### 3. Focus States for Accessibility
**Status:** Not Started
**Files:** `music.css` or new `accessibility.css`

**Problem:** Limited focus states make keyboard navigation difficult.

**Solution:** Add comprehensive focus management:

```css
/* Focus visible for keyboard users */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

/* Remove default outline when using mouse */
:focus:not(:focus-visible) {
  outline: none;
}

/* Interactive elements */
button:focus-visible,
.toggle-bg:focus-visible,
input:focus-visible,
select:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.2);
}

/* Skip link for keyboard navigation */
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--color-primary);
  color: white;
  padding: 8px 16px;
  z-index: 9999;
  transition: top 0.3s;
}

.skip-link:focus {
  top: 0;
}
```

**Implementation:**
- Add focus-visible styles globally
- Ensure all interactive elements have visible focus states
- Add skip link to main content
- Test with keyboard-only navigation

---

### 4. Hardcoded Colors in JS Files
**Status:** Not Started
**Files:** Multiple JS files in `src/modules/`

**Problem:** ~1,700 inline color values in JavaScript making theming impossible.

**Priority Files to Address:**
1. `src/modules/ui/recommendationsSidebar.js`
2. `src/modules/features/progressionBuilder.js`
3. `src/modules/ui/sectionSidebar.js`
4. Modal and panel components

**Solution:** Replace inline styles with CSS classes:

```javascript
// Before
element.style.backgroundColor = '#8B5CF6';
element.style.color = '#ffffff';

// After
element.classList.add('bg-primary', 'text-white');
```

**Implementation:**
- Create utility classes for common colors
- Audit high-impact files first
- Replace inline color styles with class additions
- Document color utility classes

---

## Medium Priority Items

### 5. Unified Panel/Modal Base Styling
**Files:** Create `src/styles/components/panels.css`

**Problem:** Multiple panel implementations with inconsistent styling.

**Solution:** Create base panel class with variants:
- `.panel-base` - shared styles
- `.panel-light` / `.panel-dark` - theme variants
- `.panel-floating` - elevated panels
- `.panel-sidebar` - sidebar panels

---

### 6. Scrollbar Consistency
**Files:** `variables.css` or `music.css`

**Problem:** 4 different scrollbar implementations.

**Solution:** Create single scrollbar mixin:
```css
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
}
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: var(--scrollbar-track); }
.custom-scrollbar::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
```

---

### 7. Standardize Responsive Breakpoints
**Files:** `variables.css`

**Problem:** Inconsistent breakpoints (480px, 640px, 768px, etc.)

**Solution:** Define standard breakpoints:
```css
:root {
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}
```

---

### 8. Complete Dark Mode Implementation
**Files:** `variables.css`, component files

**Problem:** Dark mode toggle exists but only floating panel has dark theme.

**Solution:** Implement dark mode color system:
```css
[data-theme="dark"] {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --text-primary: #eaeaea;
  --text-secondary: #a0a0a0;
  /* ... etc */
}
```

---

## Low Priority Items

### 9. Split music.css
Split 80KB file into feature modules:
- `keyboard.css`
- `panels.css`
- `modals.css`
- `cards.css`
- `forms.css`

### 10. Remove Legacy Files
- `Works/Emergency/music.css`
- `Works/music.css`
- `*_old.js` files
- `*-simplified-refactor.js` files

### 11. Standardize Animation Timings
Replace varied timings (0.15s, 0.2s, 0.25s, 0.3s) with CSS variables:
- `--transition-fast: 0.15s`
- `--transition-normal: 0.25s`
- `--transition-slow: 0.35s`

---

## Progress Tracking

| Task | Priority | Status | Date Completed |
|------|----------|--------|----------------|
| Sidebar toggle grouping | HIGH | **COMPLETED** | Dec 7, 2025 |
| CSS variable consolidation | HIGH | **COMPLETED** | Dec 7, 2025 |
| Focus states for accessibility | HIGH | **COMPLETED** | Dec 7, 2025 |
| Hardcoded colors in JS | HIGH | **IN PROGRESS** | - |
| Unified panel styling | MEDIUM | **COMPLETED** | Dec 7, 2025 |
| Scrollbar consistency | MEDIUM | **COMPLETED** | Dec 7, 2025 |
| Header modernization | MEDIUM | **COMPLETED** | Dec 7, 2025 |
| Standardize breakpoints | MEDIUM | Not Started | - |
| Complete dark mode | MEDIUM | Not Started | - |
| Split music.css | LOW | **COMPLETED** | Dec 7, 2025 |
| Remove legacy files | LOW | **COMPLETED** | Dec 7, 2025 |
| Standardize animations | LOW | **COMPLETED** | Dec 7, 2025 |

---

## Implementation Notes

### Completed: Sidebar Toggle Grouping
- Settings organized into 3 collapsible groups: Display, Keyboard, Features
- Added `toggleSettingsGroup()` function in `sidebar.js`
- State persisted to localStorage
- CSS added to `music.css` (`.settings-group` classes)

### Completed: CSS Variable Consolidation
- Created `src/styles/variables.css` as single source of truth
- Includes: colors, gradients, spacing, typography, shadows, transitions
- Dark mode variables defined
- Imported at top of `music.css`
- Legacy aliases maintained for backwards compatibility

### Completed: Focus States for Accessibility
- Added comprehensive `:focus-visible` styles in `music.css`
- Skip link added to `index.html` with `#main-content` target
- High contrast mode support via `@media (prefers-contrast: high)`
- Reduced motion support for animations

### In Progress: Hardcoded Colors
- Added color utility classes to `music.css`:
  - `.bg-primary`, `.bg-success`, `.bg-warning`, etc.
  - `.text-primary`, `.text-success`, `.text-muted`, etc.
  - `.border-primary`, `.border-success`, etc.
  - `.bg-gradient-*` classes
  - `.chord-*` function colors
  - `.score-*` badge colors
- Gradual migration recommended for JS files

### Completed: Scrollbar Consistency
- Created `.custom-scrollbar` class for light backgrounds
- Created `.custom-scrollbar-dark` class for dark backgrounds (sidebar, dark panels)
- Unified scrollbar width to 6px
- Purple accent color (`rgba(139, 92, 246, 0.5)`) for consistency with theme
- Firefox support via `scrollbar-width: thin` and `scrollbar-color`

### Completed: Unified Panel Styling
- Added panel base classes to `music.css`:
  - `.panel-base` - shared border-radius and shadow
  - `.panel-light` - white background with subtle border
  - `.panel-glass` - semi-transparent with backdrop blur
  - `.panel-dark` - dark gradient for floating panels
  - `.panel-floating` - elevated shadow for overlays
  - `.panel-dropdown` - for menus and popovers
  - `.panel-card` - content cards with color variants (amber, purple, teal, lime)
  - `.panel-header`, `.panel-body`, `.panel-footer` - structural components

### Completed: Header Modernization
- Tab navigation: Icon + two-line text pills with gradient active states
- Collapsible center displays with localStorage persistence
- Compact 56px fixed header height
- Full title "Interactive Music Theory Lab" always displayed
- Removed wrapping/abbreviation logic

### Completed: Split music.css
- Created modular CSS architecture with separate feature files:
  - `src/styles/keyboard.css` - Piano keyboard styles and highlighting states
  - `src/styles/header.css` - Header bar, tab pills, and displays
  - `src/styles/sidebar.css` - Sidebar, settings groups, toggles
  - `src/styles/components.css` - Panels, floating controls, scrollbars
- Added `@import` statements at top of `music.css` for all modules
- Original styles remain in `music.css` as fallback (gradual migration)

### Completed: Remove Legacy Files
- Deleted `src/modules/audio/melodyGenerator_old.js`
- Deleted `src/modules/features/progressionBuilder-simplified-refactor.js`
- Works/ folder legacy files not present in current codebase

### Completed: Standardize Animations
- Animation timing variables already present in `src/styles/variables.css`:
  - `--transition-fast: 0.15s ease`
  - `--transition-normal: 0.25s ease`
  - `--transition-slow: 0.35s ease`
- No additional changes needed

---

*Document created: December 2025*
*Last updated: December 7, 2025*
