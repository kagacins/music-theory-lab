# Sticky Keyboard Bug - Problem Definition

## UPDATE: New Findings

When keyboard uses `position: fixed` - it works on ALL tabs (stays in place)
When keyboard uses `position: sticky` - it works on Chord Lab and Composition Studio, but BREAKS on Scale Explorer and Theory Academy

The keyboard's sticky `top` value references the header position. On Scale Explorer and Theory Academy, "the keyboard does not know where to stop" - it scrolls past where it should stick.

**Key question to answer:** What is different about Scale Explorer and Theory Academy that prevents the keyboard from "knowing" where to stop when using `position: sticky`?

## The Problem

The title bar (`#main-header`) and keyboard (`#keyboard-section`) should be "sticky" - they scroll up slightly, then lock in place while the rest of the page content scrolls behind them.

**Current Behavior:**
- **Chord Lab (`#tab-builder`)**: Sticky works correctly. Header and keyboard stick in place, content scrolls behind them.
- **Composition Studio (`#tab-melody`)**: Sticky works correctly. Same behavior as Chord Lab.
- **Scale Explorer (`#tab-scales`)**: Sticky is BROKEN. Header and keyboard start to stick, but when the `#tab-scales` div reaches the keyboard, it pushes them off the page.
- **Theory Academy (`#tab-learn`)**: Sticky is BROKEN. Same broken behavior as Scale Explorer.

## Key User Observations

1. "The keyboard and title bar both stay visible as I scroll and the other content 'goes behind' the keyboard" - describing the CORRECT behavior on Chord Lab.

2. "On the Scale Explorer and Theory Academy the title bar starts to scroll a little and then 'sticks' like on the Chord Lab and Composition Studio, but then it eventually starts to scroll away."

3. "When the div `<div id="tab-learn">` gets up to where the keyboard is located, it looks like that section pushes the keyboard off the page. The keyboard scrolls exactly away with that container when that container gets to the keyboard."

4. "On the Scale Explorer, it's `<div id="tab-scales">` that has the same impact on the intended sticky keyboard and title bar."

5. "It has nothing to do with the action bar. This sticky/non-sticky behavior was the same before the action bar existed."

## DOM Structure

```
<div id="main-app">
  <div class="max-w-7xl mx-auto">

    <!-- STICKY ELEMENTS -->
    <div id="main-header" class="sticky top-1 z-20 ...">...</div>

    <section id="keyboard-section" class="mb-2 sticky z-10"
             style="top: calc(var(--header-height, 76px) + 0.5rem);">
      ...
    </section>

    <section id="action-bar" class="hidden sticky z-10 ...">...</section>

    <!-- TAB CONTENT (only one visible at a time) -->
    <div id="tab-builder" class="tab-content">
      <div class="bg-white p-4 rounded-xl shadow-2xl border border-amber-100 mb-4 max-w-7xl mx-auto">
        ...LOTS OF CONTENT...
      </div>
    </div>

    <div id="tab-melody" class="tab-content hidden">
      <div class="bg-white p-4 rounded-xl shadow-2xl border border-violet-100 mb-4 max-w-7xl mx-auto">
        ...LOTS OF CONTENT...
      </div>
    </div>

    <div id="tab-scales" class="tab-content hidden">
      <div class="bg-white p-4 rounded-xl shadow-2xl border border-lime-200 mb-4 max-w-7xl mx-auto">
        ...LESS CONTENT...
      </div>
    </div>

    <div id="tab-learn" class="tab-content hidden">
      <div class="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-2xl border border-blue-200 dark:border-gray-700 mb-4 max-w-7xl mx-auto">
        <div id="learn-tab-content">
          ...DYNAMIC CONTENT (lessons)...
        </div>
      </div>
    </div>

  </div>
</div>
```

## Key Files

- `index.html` - DOM structure (lines ~568-2730)
- `music.css` - Main styles
- `src/modules/ui/tabs.js` - Tab switching logic

## CSS Applied to Sticky Elements (Current State after ChatGPT changes)

```css
/* From music.css - ChatGPT's changes to fix sticky on all tabs */
:root {
    --app-edge-pad: 1rem;  /* 2rem on screens >= 640px */
    --app-max-width: 80rem;
}

/* Space reserved for fixed header */
#main-app > .max-w-7xl.mx-auto {
    padding-top: calc(
        var(--app-edge-pad) +
        var(--header-height, 76px) +
        0.5rem
    );
}

/* Header is FIXED (not sticky) */
#main-header {
    position: fixed !important;
    top: var(--app-edge-pad) !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    width: calc(100vw - (2 * var(--app-edge-pad))) !important;
    max-width: var(--app-max-width) !important;
}

/* Keyboard is STICKY - this works on builder/melody but NOT scales/learn */
#keyboard-section {
    position: -webkit-sticky !important;
    position: sticky !important;
    top: calc(var(--app-edge-pad) + var(--header-height, 76px) + 0.5rem) !important;
    z-index: 15 !important;
}
```

## CSS Applied to Tab Content

```css
/* From music.css lines 820-831 */
.tab-content > div {
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    box-shadow: var(--shadow-soft);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

## What Has Been Tried (Failed Attempts)

1. **Adding min-height to tab containers** - Created white space that DID scroll behind sticky elements, but the tab content div still pushed keyboard away when it reached it.

2. **Adding z-index to tab content** - Did not help; this is not a z-index/stacking issue.

3. **Keeping action-bar in flow with visibility:hidden** - Did not help; confirmed action-bar is not the cause.

4. **CSS !important on sticky positioning** - Already applied, doesn't fix the issue.

## The Core Mystery

All four tab containers have identical HTML structure:
```html
<div id="tab-xxx" class="tab-content">
  <div class="bg-white p-4 rounded-xl ...">
    ...content...
  </div>
</div>
```

Yet `#tab-builder` and `#tab-melody` work correctly, while `#tab-scales` and `#tab-learn` break the sticky behavior.

The sticky elements are SIBLINGS to the tab content divs (not parents or children). When scrolling on the broken tabs, the tab content div itself appears to "push" the sticky elements off the page when it reaches them.

## Questions to Investigate

1. Why does the same CSS sticky positioning work for some sibling content but not others?
2. Is there something about the CONTENT inside the tabs that affects the sticky behavior?
3. Is there JavaScript modifying styles differently for different tabs?
4. Could the `backdrop-filter` on `.tab-content > div` be creating a stacking context that interferes with sticky?
5. Is the amount of content (height) somehow affecting the sticky context?
