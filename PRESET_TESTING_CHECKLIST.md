# Preset System Testing Checklist

## Visual Verification (Do This First!)

### 1. Check for Preset Button in Header ✅
**Location**: Top-right area of the page, next to the tab buttons
**Should see**:
- Purple/indigo gradient button
- 💾 icon
- Text "Presets" (on larger screens)
- Button should be to the LEFT of the "Chord Builder/Progression Builder/Scale Explorer" buttons

**If missing**: Open browser console (F12) and look for errors

---

### 2. Check for Quick Save Buttons ✅
**Location**: Top of each tab content area (right-aligned)

#### Chord Builder Tab
- Switch to **Chord Builder** tab
- Look at the very top of the content (above "1. Select Root Note")
- Should see: Green button with "💾 Quick Save"

#### Progression Builder Tab
- Switch to **Progression Builder** tab
- Look at the top of the progression content
- Should see: Green button with "💾 Quick Save"

#### Scale Explorer Tab
- Switch to **Scale Explorer** tab
- Look at the top of the scale content
- Should see: Green button with "💾 Quick Save"

**If missing**: Check browser console for warnings like "Container not found"

---

## Functional Testing

### Test 1: Open Preset Library
1. Click the **💾 Presets** button in the header
2. **Expected**:
   - Dark overlay appears over the page
   - White panel slides in from center
   - Panel has title "Preset Library"
   - Empty state message: "No presets found"
3. Click the **X** button or click outside the panel
4. **Expected**: Panel closes

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 2: Save Your First Chord Preset
1. Go to **Chord Builder** tab
2. Select a chord:
   - Root: **C**
   - Type: **Major 7th**
   - Inversion: **1st**
3. Click **💾 Quick Save** button
4. Enter name: **"My C Major 7th"**
5. Click **OK**
6. **Expected**: Alert says "Preset saved successfully!"

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 3: View Saved Preset in Library
1. Click **💾 Presets** button
2. **Expected**:
   - You see 1 preset card
   - Card shows:
     - 🎹 emoji (chord category)
     - Name: "My C Major 7th"
     - Modified date (today)
     - Action buttons: ▶️ ✏️ 📋 📤 🔗 🗑️
   - Statistics at bottom: "Total: 1 | Progressions: 0 | Chords: 1 | Scales: 0"

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 4: Load a Preset
1. In preset library, find your "My C Major 7th" preset
2. Click the **▶️ (Load/Play)** button
3. Confirm the load prompt
4. **Expected**:
   - Panel closes
   - Switches to Chord Builder tab
   - Chord Builder shows:
     - Root: C (highlighted)
     - Type: Major 7th (highlighted)
     - Inversion: 1st (highlighted)
   - Keyboard highlights the chord notes
   - Alert says: "Preset loaded!"

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 5: Save a Progression
1. Go to **Progression Builder** tab
2. Add some chords (e.g., build a I-IV-V-I progression):
   - Add C Major
   - Add F Major
   - Add G Major
   - Add C Major
3. Click **💾 Quick Save**
4. Enter name: **"Basic C Major Progression"**
5. Click **OK**
6. Open preset library
7. **Expected**:
   - You see 2 presets now
   - New preset has 🎵 emoji (progression category)
   - Statistics: "Total: 2 | Progressions: 1 | Chords: 1"

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 6: Filter Presets
1. Open preset library (you should have 1 chord + 1 progression)
2. Use the filter dropdown (top toolbar)
3. Select **"Progressions"**
4. **Expected**: Only the progression preset is visible
5. Select **"Chords"**
6. **Expected**: Only the chord preset is visible
7. Select **"All Presets"**
8. **Expected**: Both presets are visible

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 7: Search Presets
1. Open preset library
2. In the search box (top toolbar), type: **"Major"**
3. **Expected**: Both presets appear (both have "Major" in the name)
4. Type: **"Progression"**
5. **Expected**: Only the progression preset appears
6. Clear the search
7. **Expected**: All presets appear again

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 8: Edit Preset
1. Open preset library
2. Click **✏️ (Edit)** on any preset
3. Change the name to something else
4. Click **OK** twice (for name and description prompts)
5. **Expected**:
   - Preset card immediately updates with new name
   - No page reload needed

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 9: Duplicate Preset
1. Open preset library
2. Click **📋 (Duplicate)** on any preset
3. **Expected**:
   - A new preset appears immediately
   - Named "[Original Name] (Copy)"
   - Has same category emoji
   - Statistics count increases

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 10: Export Single Preset
1. Open preset library
2. Click **📤 (Export)** on any preset
3. **Expected**:
   - A JSON file downloads
   - Filename is based on preset name (e.g., "my_c_major_7th.json")
   - File contains JSON data with preset structure

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 11: Export All Presets
1. Open preset library
2. Click **📤 Export All** button (top toolbar)
3. **Expected**:
   - A JSON file downloads
   - Filename includes today's date (e.g., "music-theory-lab-presets-2025-01-05.json")
   - File contains array of all presets

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 12: Share Preset (Copy Link)
1. Open preset library
2. Click **🔗 (Share)** on any preset
3. **Expected**:
   - Alert says "Share link copied to clipboard!"
4. Open Notepad and paste (Ctrl+V)
5. **Expected**:
   - URL appears like: `file:///...music.html?preset=eyJuIjoi...`
   - Contains `?preset=` parameter with encoded data

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 13: Import Presets
1. First, export all presets (from Test 11)
2. Delete one of your presets
3. Open preset library
4. Click **📥 Import** button
5. Select the JSON file you exported
6. **Expected**:
   - Alert shows import results (e.g., "Imported: 2, Failed: 0")
   - Deleted preset reappears in library
   - May have duplicate IDs (that's OK)

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 14: Delete Preset
1. Open preset library
2. Click **🗑️ (Delete)** on any preset
3. Confirm deletion
4. **Expected**:
   - Preset card disappears immediately
   - Statistics update
   - No errors in console

**Status**: ⬜ Pass / ⬜ Fail

---

### Test 15: Save a Scale
1. Go to **Scale Explorer** tab
2. Select:
   - Root: **D**
   - Scale: **Minor**
3. Click **💾 Quick Save**
4. Name it: **"D Minor Scale"**
5. Open preset library
6. **Expected**:
   - New preset with 🎼 emoji (scale category)
   - Statistics shows "Scales: 1"

**Status**: ⬜ Pass / ⬜ Fail

---

## Known Issues & Troubleshooting

### Issue: Preset button not visible
**Solution**:
- Open console (F12)
- Look for warning: "Main header not found"
- Verify music.html has element with id="main-header"

### Issue: Quick save buttons not visible
**Solution**:
- Check console for: "Container not found"
- Verify these IDs exist: `tab-builder`, `tab-trainer`, `tab-scales`

### Issue: "Load function not available yet" alert
**Solution**:
- Verify `window.loadPresetData` function exists in main.js
- Check line ~409 in main.js

### Issue: Can't save progressions (empty data)
**Solution**:
- Make sure you've added chords to the progression first
- Check that `getTrainerState()` returns valid `progressionData` array

### Issue: LocalStorage quota exceeded
**Solution**:
- Export all presets first
- Open browser DevTools > Application > Local Storage
- Delete `musicTheoryLab_presets` key
- Re-import essential presets

---

## Browser Console Commands (Advanced)

Open console (F12) and try these:

### Check if preset system is initialized
```javascript
console.log(window.togglePresetPanel); // Should show function
```

### View all saved presets
```javascript
JSON.parse(localStorage.getItem('musicTheoryLab_presets'))
```

### Check storage usage
```javascript
let size = 0;
for (let key in localStorage) {
  if (key.startsWith('musicTheoryLab_')) {
    size += localStorage[key].length;
  }
}
console.log(`Storage used: ${(size / 1024).toFixed(2)} KB`);
```

### Manually open preset panel
```javascript
window.openPresetPanel();
```

### Clear all presets (DANGEROUS!)
```javascript
localStorage.removeItem('musicTheoryLab_presets');
localStorage.removeItem('musicTheoryLab_presetIdCounter');
```

---

## Success Criteria

**Minimum to pass**:
- ✅ Preset button visible in header
- ✅ Quick save buttons visible in all 3 tabs
- ✅ Can save at least one preset
- ✅ Can view preset in library
- ✅ Can load preset back

**Full functionality**:
- ✅ All 15 tests pass
- ✅ No console errors
- ✅ Import/Export works
- ✅ Search and filter work
- ✅ All action buttons functional

---

## Report Issues

If you encounter problems, please note:
1. Which test failed
2. Error message (from alert or console)
3. Browser and version
4. Screenshot if relevant

Then we can debug and fix!
