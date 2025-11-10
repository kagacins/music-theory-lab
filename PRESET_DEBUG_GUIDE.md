# Preset Name Display Debug Guide

## Issue
Preset names are not showing in the library view.

## Debug Steps

### Step 1: Check if presets are being saved
Open browser console (F12) and run:
```javascript
JSON.parse(localStorage.getItem('musicTheoryLab_presets'))
```

**Expected**: Array of preset objects, each with a `name` property
**If null/undefined**: No presets are saved yet

### Step 2: Check if preset has name property
After saving a preset, run:
```javascript
const presets = JSON.parse(localStorage.getItem('musicTheoryLab_presets'));
console.log(presets[0]); // Check first preset
console.log(presets[0].name); // Check name specifically
```

**Expected**: Should log the preset object and the name string
**If undefined**: Name is not being saved properly

### Step 3: Check preset card HTML
Open preset library, then in console run:
```javascript
document.querySelector('.preset-card')
```

**Expected**: Should show the preset card element
**If null**: Cards aren't being rendered

### Step 4: Check preset name element
```javascript
document.querySelector('.preset-name')
```

**Expected**: Should show span element with preset name
**If null**: Name span isn't being created

### Step 5: Check if name is in the HTML but not visible
```javascript
const nameEl = document.querySelector('.preset-name');
if (nameEl) {
    console.log('Text content:', nameEl.textContent);
    console.log('Computed styles:', window.getComputedStyle(nameEl));
    console.log('Display:', window.getComputedStyle(nameEl).display);
    console.log('Visibility:', window.getComputedStyle(nameEl).visibility);
    console.log('Opacity:', window.getComputedStyle(nameEl).opacity);
}
```

**Expected**: Should show the name text and CSS properties
**Look for**: display: none, visibility: hidden, opacity: 0, width/height: 0

### Step 6: Check escapeHtml function
In console:
```javascript
const div = document.createElement('div');
div.textContent = "Test Name";
console.log(div.innerHTML); // Should output: Test Name
```

**Expected**: "Test Name"

### Step 7: Manually test createPresetCard
```javascript
const testPreset = {
    id: 999,
    name: "Test Preset Name",
    description: "Test description",
    category: "chord",
    tags: ["test"],
    metadata: {
        modified: new Date().toISOString(),
        key: "C"
    }
};

// This requires access to internal functions, so try from preset panel
window.testPreset = testPreset;
```

Then in the console, check if you can see the preset data structure.

## Common Causes & Fixes

### Cause 1: CSS Issue
**Symptoms**: HTML contains name but it's not visible
**Fix**: Check [music.css](music.css) for `.preset-name` styles (line ~744)
```css
.preset-name {
    font-weight: 600;
    font-size: 1rem;
    color: #1f2937;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
```

Make sure this isn't being overridden by:
- `display: none`
- `width: 0` or `max-width: 0`
- `font-size: 0`
- `color: transparent`

### Cause 2: escapeHtml returning empty
**Fix**: Check the escapeHtml function in [presetUI.js:576](src/modules/ui/presetUI.js#L576)

### Cause 3: Preset.name is undefined
**Fix**: Check that savePreset in [presetManager.js](src/modules/storage/presetManager.js) creates name:
```javascript
const newPreset = {
    id: generatePresetId(),
    name: presetData.name || 'Untitled Preset', // Should default if empty
    // ...
}
```

### Cause 4: HTML template literal issue
**Fix**: Check [presetUI.js:324-329](src/modules/ui/presetUI.js#L324-329) for proper string interpolation:
```javascript
<span class="preset-name">${escapeHtml(preset.name)}</span>
```

## Quick Test HTML
Open preset panel and run this in console:
```javascript
// Inject a test card
const testHTML = `
    <div class="preset-card" style="margin: 20px;">
        <div class="preset-card-header">
            <div class="preset-card-title">
                <span class="preset-category-emoji">🎹</span>
                <span class="preset-name">TEST NAME VISIBLE?</span>
            </div>
        </div>
    </div>
`;
document.querySelector('.preset-list').insertAdjacentHTML('afterbegin', testHTML);
```

**Expected**: You should see "TEST NAME VISIBLE?" in the preset list
**If not visible**: CSS problem with `.preset-name`
**If visible**: The issue is with the data or escapeHtml function

## Report Findings
After running these tests, report back:
1. Which step showed the issue
2. What the console logged
3. Whether the test HTML showed the name

This will help pinpoint the exact problem!
