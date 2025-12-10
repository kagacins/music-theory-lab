# Chord Card Tooltip Issue

## Problem Summary
The chord card hover tooltips need to:
1. Appear on top of all other content (z-index issue - SOLVED)
2. Stay open while user interacts with buttons inside the tooltip (FAILING)

## Current State

### What Works
- Tooltip is now appended to `document.body` with `position: fixed` and `z-index: 999999`
- Tooltip positions correctly relative to the card using `getBoundingClientRect()`
- Tooltip appears on top of all content

### What's Broken
- When user clicks/releases an inversion button inside the tooltip, the tooltip closes immediately
- Expected behavior: tooltip should stay open until user either:
  1. Clicks the X close button
  2. Mouse leaves the tooltip area

## Relevant Code Location
**File:** `src/modules/features/progressionBuilder.js`

### Tooltip Creation (lines ~5720-5760)
```javascript
// Remove any existing tooltip for this index (cleanup on re-render)
const existingTooltip = document.querySelector(`.chord-tooltip[data-chord-index="${index}"]`);
if (existingTooltip) {
    existingTooltip.remove();
}

const tooltip = document.createElement('div');
tooltip.className = 'chord-tooltip hidden bg-gray-800 border-2 border-indigo-500 rounded-lg shadow-xl p-4 pointer-events-auto';
tooltip.style.cssText = 'position: fixed; z-index: 999999; min-width: 250px; max-width: 350px;';
tooltip.setAttribute('data-chord-index', index);
// Append to body to escape all containers
document.body.appendChild(tooltip);
```

### Event Listeners (lines ~6340-6470)
```javascript
// === SIMPLIFIED CARD INTERACTIVE TOOLTIP ===
const simplifiedCard = wrapper.querySelector('.simplified-card');
// Tooltip is now on body, find it by data-chord-index
const chordTooltip = document.querySelector(`.chord-tooltip[data-chord-index="${index}"]`);
const infoTooltipBtn = wrapper.querySelector('.info-tooltip-btn');
const tooltipInversionBtns = chordTooltip ? chordTooltip.querySelectorAll('.tooltip-inversion-btn') : [];

// Get the card wrapper (parent of simplified-card) for hover events
const cardWrapper = simplifiedCard ? simplifiedCard.parentElement : null;

if (simplifiedCard && chordTooltip && cardWrapper) {
    let tooltipTimeout = null;
    let isTooltipPinned = false;
    let hideTimeout = null;
    let inversionWasChanged = false;

    const showTooltip = () => {
        // ... positions tooltip using getBoundingClientRect()
        chordTooltip.classList.remove('hidden');
    };

    const hideTooltip = () => {
        chordTooltip.classList.add('hidden');
        isTooltipPinned = false;
        updateSingleCard(index);
        // ... other cleanup
    };

    // Show tooltip on card hover
    cardWrapper.addEventListener('mouseenter', (e) => {
        if (!isTooltipPinned) {
            tooltipTimeout = setTimeout(() => {
                showTooltip();
            }, 300);
        }
    });

    // When mouse leaves card, only cancel the pending show timeout
    cardWrapper.addEventListener('mouseleave', (e) => {
        if (tooltipTimeout) {
            clearTimeout(tooltipTimeout);
            tooltipTimeout = null;
        }
        // Don't hide here - let the tooltip's mouseleave handle it
    });

    // Keep tooltip open when mouse enters it
    chordTooltip.addEventListener('mouseenter', () => {
        isTooltipPinned = true;
    });

    // ONLY hide when mouse leaves the tooltip itself
    chordTooltip.addEventListener('mouseleave', () => {
        hideTooltip();
    });
}
```

### Inversion Button Event Listeners (lines ~6560-6625)
```javascript
tooltipInversionBtns.forEach(btn => {
    let wasPressed = false;

    // Mousedown - start playing chord
    btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        wasPressed = true;
        const inversion = parseInt(btn.getAttribute('data-inversion'));
        updateChordInversion(index, inversion, false, false);
        inversionWasChanged = true;
        updateInversionButtonHighlight(inversion);
        if (window.startProgressionChord) {
            window.startProgressionChord(index);
        }
    });

    // Mouseup - stop playing chord
    btn.addEventListener('mouseup', (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (window.stopTrainerChord) {
            window.stopTrainerChord();
        }
        if (inversionWasChanged) {
            updateChordAndRenderPreservingTrebleNotes(index);
            inversionWasChanged = false;
        }
        wasPressed = false;
    });

    // Mouseleave on button
    btn.addEventListener('mouseleave', (e) => {
        e.stopPropagation();
        if (window.stopTrainerChord) {
            window.stopTrainerChord();
        }
        if (wasPressed && inversionWasChanged) {
            updateChordAndRenderPreservingTrebleNotes(index);
            inversionWasChanged = false;
        }
        wasPressed = false;
    });
});
```

## Failed Attempts

1. **Setting `isTooltipPinned = true` on tooltip mouseenter** - Didn't prevent closing
2. **Adding `:hover` check before hiding** - Still closed
3. **Adding `e.stopPropagation()` to button events** - Still closed
4. **Removing hide call from cardWrapper mouseleave** - Still closed
5. **Only hiding on tooltip mouseleave** - Still closes on button mouseup

## Suspected Root Cause
Something is calling `hideTooltip()` when the inversion button mouseup fires. Possibilities:
1. The `mouseleave` event on the tooltip is somehow firing when clicking buttons inside it
2. Some other event handler elsewhere is hiding tooltips
3. The `updateChordAndRenderPreservingTrebleNotes()` or related functions might be triggering a re-render that destroys/recreates the tooltip

## Architecture Notes
- The tooltip is on `document.body` (not inside the card)
- The card wrapper and tooltip are NOT parent/child - they're siblings in different parts of the DOM
- The tooltip is linked to its card via `data-chord-index` attribute
- `createTooltipElement()` removes existing tooltip with same index before creating new one

## Desired Behavior
1. Hover over chord card -> tooltip appears after 300ms
2. Move mouse into tooltip -> tooltip stays open
3. Click inversion buttons -> chord plays, tooltip STAYS OPEN
4. Release mouse -> chord stops, tooltip STAYS OPEN
5. Move mouse out of tooltip -> tooltip closes
6. OR click X button -> tooltip closes
