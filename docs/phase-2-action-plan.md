# Phase 2 Implementation Action Plan
## Tactical Step-by-Step Guide

**Start Date**: 2025-11-15
**Current Phase**: Phase 2.1 - Sidebar UI Component
**Status**: 🚀 **READY TO START**

---

## Quick Reference

**Phase 2 Overview**: [phase-2-plan.md](phase-2-plan.md) (comprehensive plan)

**This Document**: Tactical action plan with specific implementation steps

---

## Phase 2.1: Sidebar UI Component (Week 1)

### Task Breakdown

#### Task 2.1.1: Create CSS File (15 minutes)
**Status**: ⏳ Pending

**Action**:
1. Create file: `src/styles/recommendations-sidebar.css`
2. Add CSS rules from Phase 2 plan
3. Link in `index.html` `<head>` section

**Success Criteria**:
- ✅ CSS file created
- ✅ Linked in HTML
- ✅ No console errors when loading page

**Files**:
- **Create**: `src/styles/recommendations-sidebar.css`
- **Modify**: `index.html` (add `<link>` tag)

---

#### Task 2.1.2: Add Sidebar HTML Structure (30 minutes)
**Status**: ⏳ Pending

**Action**:
1. Find the Melody Composer tab content in `index.html`
2. Locate the section with `id="melody-composer-tab"`
3. Restructure content to add sidebar:
   ```html
   <div class="flex gap-3">
       <!-- NEW: Sidebar (left) -->
       <div id="chord-recommendations-sidebar">...</div>

       <!-- EXISTING: Notation area (right) -->
       <div class="flex-1">...</div>
   </div>
   ```
4. Add all sidebar HTML elements:
   - Header
   - Current context display (key, last chord)
   - Recommendations list container
   - Refresh button

**Success Criteria**:
- ✅ Sidebar appears on Melody Composer tab
- ✅ Existing notation area still works
- ✅ Layout uses flexbox (sidebar on left, notation on right)
- ✅ Sidebar has placeholder text "No suggestions available"

**Files**:
- **Modify**: `index.html` (~50 lines added)

---

#### Task 2.1.3: Create Sidebar JavaScript Module (45 minutes)
**Status**: ⏳ Pending

**Action**:
1. Create file: `src/modules/ui/recommendationsSidebar.js`
2. Implement functions:
   - `renderRecommendationItem(recommendation)` - Create DOM element for one recommendation
   - `getChordSuffix(type)` - Get chord symbol suffix (m, 7, etc.)
   - `clearRecommendations()` - Clear recommendation list
   - `showEmptyState()` - Show "no suggestions" message

**Function Signatures**:
```javascript
/**
 * Render a single chord recommendation item
 * @param {object} recommendation - { chord: {root, type}, totalScore, voiceLeadingScore, function }
 * @returns {HTMLElement} DOM element
 */
export function renderRecommendationItem(recommendation) { }

/**
 * Get chord suffix for display
 * @param {string} type - Chord type (Major, Minor, etc.)
 * @returns {string} Suffix (m, 7, dim, etc.)
 */
export function getChordSuffix(type) { }
```

**Success Criteria**:
- ✅ File created with exports
- ✅ Functions return proper DOM elements
- ✅ Chord symbols display correctly (C, Dm, G7, etc.)
- ✅ Score badges show with correct colors

**Files**:
- **Create**: `src/modules/ui/recommendationsSidebar.js` (~150 lines)

---

#### Task 2.1.4: Test Sidebar Rendering (30 minutes)
**Status**: ⏳ Pending

**Action**:
1. Create test data in browser console:
   ```javascript
   const testRec = {
       chord: { root: 'F', type: 'Major' },
       function: 'IV',
       totalScore: 92,
       voiceLeadingScore: 88
   };
   ```
2. Test rendering:
   ```javascript
   import { renderRecommendationItem } from './src/modules/ui/recommendationsSidebar.js';
   const item = renderRecommendationItem(testRec);
   document.getElementById('recommendations-list').appendChild(item);
   ```
3. Verify visual appearance matches design
4. Test hover effects
5. Test with different scores (excellent/good/fair)

**Success Criteria**:
- ✅ Recommendation item appears in sidebar
- ✅ Hover effect works (background change, border color)
- ✅ Score badge shows correct color (green/blue/yellow)
- ✅ Voice leading dot shows correct color
- ✅ Chord symbol and function display correctly

**Files**:
- None (testing only)

---

#### Task 2.1.5: Add Click Handler Placeholder (15 minutes)
**Status**: ⏳ Pending

**Action**:
1. Add click event listener to recommendation items
2. For now, just log to console (actual insertion comes in Phase 2.2)
3. Add visual feedback (selected state)

**Code**:
```javascript
item.addEventListener('click', () => {
    console.log('[Sidebar] Clicked recommendation:', recommendation);
    // TODO: Phase 2.2 - Insert chord
});
```

**Success Criteria**:
- ✅ Clicking recommendation logs to console
- ✅ Visual feedback on click (border/background change)
- ✅ Only one recommendation can be selected at a time

**Files**:
- **Modify**: `src/modules/ui/recommendationsSidebar.js`

---

## Phase 2.1 Completion Checklist

Before moving to Phase 2.2, verify:
- ✅ CSS file created and linked
- ✅ Sidebar HTML structure in place
- ✅ Sidebar visible on Melody Composer tab
- ✅ JavaScript module created with rendering functions
- ✅ Test recommendation renders correctly
- ✅ Hover effects work
- ✅ Click handler logs to console
- ✅ No console errors
- ✅ Responsive layout (sidebar + notation area)
- ✅ Code committed to git with message "Phase 2.1: Sidebar UI Component"

---

## Phase 2.2: Recommendation Engine Integration (Week 2)

### Task Breakdown (High-Level)

#### Task 2.2.1: Create RecommendationService (2 hours)
**Status**: ⏳ Pending (starts after 2.1 complete)

**Action**:
1. Create `src/modules/integration/recommendationService.js`
2. Implement `RecommendationService` class
3. Connect to existing `calculateNextChordRecommendations()` function
4. Setup event listeners for composition changes

#### Task 2.2.2: Create Sidebar Controller (2 hours)
**Status**: ⏳ Pending

**Action**:
1. Create `src/modules/ui/recommendationsSidebarController.js`
2. Implement controller to manage sidebar state
3. Listen for recommendation updates
4. Update UI when recommendations change

#### Task 2.2.3: Integrate with Progression Builder (1 hour)
**Status**: ⏳ Pending

**Action**:
1. Import `addChordToProgressionByParams()` function
2. Implement `insertChordFromRecommendation()` function
3. Replace console.log with actual chord insertion
4. Verify bass auto-generates

#### Task 2.2.4: Initialize on Tab Load (1 hour)
**Status**: ⏳ Pending

**Action**:
1. Modify `src/modules/features/tabs.js`
2. Initialize RecommendationService when Melody Composer tab loads
3. Initialize SidebarController
4. Wire up refresh button

#### Task 2.2.5: Test Full Flow (1 hour)
**Status**: ⏳ Pending

**Action**:
1. Create progression: C-F-G
2. Verify sidebar shows recommendations
3. Click recommendation
4. Verify chord inserted with bass
5. Verify recommendations update

---

## Phase 2.3: Real-Time Analysis Display (Week 3)

### Task Breakdown (High-Level)

#### Task 2.3.1: Create HarmonyAnalyzer (3 hours)
**Status**: ⏳ Pending

**Action**:
1. Create `src/modules/analysis/harmonyAnalyzer.js`
2. Implement chord function detection (I, IV, V, etc.)
3. Implement modal interchange detection
4. Implement common pattern detection (ii-V-I, etc.)

#### Task 2.3.2: Add Analysis Panel to Sidebar (1 hour)
**Status**: ⏳ Pending

**Action**:
1. Add HTML for analysis panel in sidebar
2. Display chord functions
3. Display detected patterns
4. Display modal interchange indicators

#### Task 2.3.3: Update Analysis on Changes (1 hour)
**Status**: ⏳ Pending

**Action**:
1. Listen for progression changes
2. Run harmony analysis
3. Update analysis panel display

---

## Phase 2.4: Polish & Testing (Week 4)

### Task Breakdown (High-Level)

#### Task 2.4.1: Add Hover Preview (2 hours)
**Status**: ⏳ Pending

**Action**:
1. Show what would change on hover
2. Highlight bass pattern that would generate
3. Optional: Audio preview

#### Task 2.4.2: Keyboard Shortcuts (1 hour)
**Status**: ⏳ Pending

**Action**:
1. Implement 1-5 keys to insert top 5 recommendations
2. Implement R to refresh
3. Implement Esc to dismiss

#### Task 2.4.3: Tooltips & Explanations (2 hours)
**Status**: ⏳ Pending

**Action**:
1. Add tooltips explaining scores
2. Add "why recommended" text
3. Add helpful hints

#### Task 2.4.4: Comprehensive Testing (3 hours)
**Status**: ⏳ Pending

**Action**:
1. Test all 5 bass patterns with recommendations
2. Test empty progression
3. Test long progressions (16+ chords)
4. Test performance (<100ms updates)
5. Test on different browsers
6. Test responsive layout

---

## Daily Progress Tracking

### Day 1: Sidebar UI Setup
- [ ] Task 2.1.1: Create CSS (15 min)
- [ ] Task 2.1.2: Add HTML structure (30 min)
- [ ] Task 2.1.3: Create JavaScript module (45 min)
- [ ] Task 2.1.4: Test rendering (30 min)
- [ ] Task 2.1.5: Add click handler (15 min)
- [ ] Git commit

**Total**: ~2.5 hours

### Day 2: Recommendation Service
- [ ] Task 2.2.1: Create RecommendationService (2 hours)
- [ ] Task 2.2.2: Create Sidebar Controller (2 hours)
- [ ] Git commit

**Total**: ~4 hours

### Day 3: Integration
- [ ] Task 2.2.3: Integrate with Progression Builder (1 hour)
- [ ] Task 2.2.4: Initialize on tab load (1 hour)
- [ ] Task 2.2.5: Test full flow (1 hour)
- [ ] Git commit

**Total**: ~3 hours

### Week 1 Checkpoint
**Expected Status**: Phase 2.1 complete, Phase 2.2 70% complete

---

## Week 2: Complete Engine Integration + Start Analysis

### Day 4-5: Harmony Analyzer
- [ ] Task 2.3.1: Create HarmonyAnalyzer (3 hours)
- [ ] Task 2.3.2: Add analysis panel (1 hour)
- [ ] Task 2.3.3: Update on changes (1 hour)
- [ ] Git commit

### Week 2 Checkpoint
**Expected Status**: Phase 2.2 complete, Phase 2.3 complete

---

## Week 3-4: Polish & Testing

### Days 6-10: Final Features
- [ ] Task 2.4.1: Hover preview (2 hours)
- [ ] Task 2.4.2: Keyboard shortcuts (1 hour)
- [ ] Task 2.4.3: Tooltips (2 hours)
- [ ] Task 2.4.4: Testing (3 hours)
- [ ] Documentation updates
- [ ] Final git commit

### Phase 2 Completion
**Expected Status**: All tasks complete, ready for user testing

---

## Resources & References

### Existing Code to Study
1. `src/modules/features/chordRecommendations.js` - Recommendation engine
2. `src/modules/features/progressionBuilder.js` - Chord insertion
3. `src/modules/integration/melodyComposerBridge.js` - Tab sync
4. `src/modules/integration/bassAutoFill.js` - Bass generation

### Design References
1. [phase-2-plan.md](phase-2-plan.md) - Full detailed plan
2. Existing Progression Builder UI - Styling reference
3. Tailwind CSS classes - Use existing design system

---

## Git Commit Strategy

### Phase 2.1 Commit
```
git add src/styles/recommendations-sidebar.css
git add src/modules/ui/recommendationsSidebar.js
git add index.html
git commit -m "Phase 2.1: Add chord recommendations sidebar UI

- Created sidebar CSS with hover effects and score badges
- Added sidebar HTML structure to Melody Composer tab
- Implemented recommendation item rendering
- Added click handler placeholders
- Verified visual appearance and responsiveness

Sidebar is now visible and functional but not yet connected to
recommendation engine (Phase 2.2)"
```

### Phase 2.2 Commit
```
git add src/modules/integration/recommendationService.js
git add src/modules/ui/recommendationsSidebarController.js
git add src/modules/features/tabs.js
git commit -m "Phase 2.2: Connect recommendation engine to sidebar

- Created RecommendationService to bridge engine with UI
- Implemented SidebarController for state management
- Integrated with existing chord insertion system
- Added auto-refresh on progression changes
- Verified click-to-insert functionality with bass auto-fill

Sidebar now shows real recommendations and inserts chords"
```

---

## Quick Start (Right Now)

### Immediate Next Steps:

**Step 1** (5 min): Create CSS file
```bash
# Create the file
touch "src/styles/recommendations-sidebar.css"
```

**Step 2** (10 min): Copy CSS from [phase-2-plan.md](phase-2-plan.md) section 2.1.2

**Step 3** (5 min): Link CSS in index.html:
```html
<link rel="stylesheet" href="src/styles/recommendations-sidebar.css">
```

**Step 4** (20 min): Add sidebar HTML structure to Melody Composer tab

**Step 5** (30 min): Create `recommendationsSidebar.js` module

**Step 6** (15 min): Test in browser console

---

## Troubleshooting

### Issue: Sidebar not appearing
**Check**:
1. Is CSS linked in `<head>`?
2. Is sidebar HTML in correct tab (`id="melody-composer-tab"`)?
3. Is flexbox layout applied?
4. Check browser console for errors

### Issue: Styling not applied
**Check**:
1. CSS file path correct?
2. Class names match between HTML and CSS?
3. Browser cache cleared?
4. Tailwind classes conflicting?

### Issue: Recommendation items not rendering
**Check**:
1. JavaScript module imported?
2. Container element exists (`id="recommendations-list"`)?
3. Function called with correct data structure?
4. Browser console shows errors?

---

## Success Metrics

### Phase 2.1 Complete When:
- ✅ Sidebar visible on Melody Composer tab
- ✅ Test recommendation renders with proper styling
- ✅ Hover effects work
- ✅ Click handler logs to console
- ✅ No console errors
- ✅ Code passes visual review

### Phase 2.2 Complete When:
- ✅ Real recommendations appear in sidebar
- ✅ Clicking recommendation inserts chord
- ✅ Bass auto-generates with inserted chord
- ✅ Recommendations update when progression changes
- ✅ Refresh button works

### Phase 2.3 Complete When:
- ✅ Chord functions display (I, IV, V, etc.)
- ✅ Modal interchange detected
- ✅ Common patterns recognized (ii-V-I, etc.)
- ✅ Analysis updates in real-time

### Phase 2.4 Complete When:
- ✅ All features polished
- ✅ Keyboard shortcuts work
- ✅ Tooltips helpful
- ✅ Performance <100ms
- ✅ No bugs
- ✅ Documentation complete

---

## Current Status

**Phase**: 2.1 - Sidebar UI Component
**Task**: 2.1.1 - Create CSS File
**Next Action**: Create `src/styles/recommendations-sidebar.css`
**Estimated Time**: 15 minutes

**Let's start building!** 🚀
