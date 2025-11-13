/**
 * 3D Chord Explorer Modal
 *
 * Visual exploration interface for ALL possible next chord combinations.
 * Provides:
 * - 3D rectangular prism visualization (Root × Type × Inversion)
 * - Color-coded scoring (Green = strong, Red = weak)
 * - Comprehensive filterable data table
 * - Full scoring transparency (harmonic, voice leading, style, mood)
 * - Playback capabilities for any chord
 */

import { generateComprehensiveRecommendations } from '../features/comprehensiveChordRecommendations.js';
import { CHORD_DEFINITIONS, INVERSION_NAMES, ALL_NOTES } from '../../data/music-data.js';
import { getInvertedChordNotes } from '../utils/noteUtils.js';
// Tone.js is loaded via script tag in index.html, available as global 'Tone'

/**
 * Show the comprehensive chord explorer modal
 * @param {string} currentRoot - Current chord root
 * @param {string} currentChordType - Current chord type
 * @param {number} currentInversion - Current inversion
 * @param {string} key - Musical key
 * @param {string} style - Musical style
 * @param {string} mood - Intended mood
 * @param {Function} onAddChord - Callback to add chord to progression
 * @param {Function} onPlayChord - Callback to preview chord
 * @param {Function} onStopChord - Callback to stop preview
 */
export function showChordExplorerModal(currentRoot, currentChordType, currentInversion, key, style, mood, onAddChord, onPlayChord, onStopChord) {
    // Remove existing explorer if any
    const existing = document.getElementById('chord-explorer-modal');
    if (existing) existing.remove();

    // Determine tension direction based on mood
    let tensionDirection = 'maintain';
    if (mood === 'bright' || mood === 'calm') {
        tensionDirection = 'resolve';
    } else if (mood === 'tense' || mood === 'energetic') {
        tensionDirection = 'build';
    }

    // Generate ALL recommendations (not just top 10)
    const allRecommendations = generateAllRecommendations(
        currentRoot,
        currentChordType,
        currentInversion,
        key,
        style,
        mood,
        tensionDirection
    );

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'chord-explorer-modal';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
        padding: 20px;
    `;
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };

    // Create modal content
    const modal = document.createElement('div');
    modal.style.cssText = `
        background-color: white;
        border-radius: 12px;
        width: 95%;
        max-width: 1400px;
        height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        overflow: hidden;
    `;
    modal.onclick = (e) => e.stopPropagation();

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 20px 24px;
        border-bottom: 2px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    `;

    const titleSection = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = '🔬 Comprehensive Chord Explorer';
    title.style.cssText = 'margin: 0; font-size: 24px; font-weight: 700;';
    const subtitle = document.createElement('p');
    const chordSymbol = CHORD_DEFINITIONS[currentChordType]?.symbol || '';
    subtitle.textContent = `Analyzing ALL possible next chords after ${currentRoot}${chordSymbol} (${INVERSION_NAMES[currentInversion] || currentInversion})`;
    subtitle.style.cssText = 'margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;';
    titleSection.appendChild(title);
    titleSection.appendChild(subtitle);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: none;
        font-size: 32px;
        color: white;
        cursor: pointer;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
    `;
    closeBtn.onmouseenter = () => closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
    closeBtn.onmouseleave = () => closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
    closeBtn.onclick = () => overlay.remove();

    header.appendChild(titleSection);
    header.appendChild(closeBtn);

    // Tab navigation
    const tabNav = document.createElement('div');
    tabNav.style.cssText = `
        display: flex;
        gap: 8px;
        padding: 12px 24px;
        background-color: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
    `;

    const tabs = [
        { id: 'visualization', label: '🎨 3D Visualization', icon: '🎨' },
        { id: 'table', label: '📊 Data Table', icon: '📊' }
    ];

    let activeTab = 'visualization';

    tabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.textContent = tab.label;
        btn.style.cssText = `
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            background-color: ${tab.id === activeTab ? '#667eea' : 'transparent'};
            color: ${tab.id === activeTab ? 'white' : '#6b7280'};
        `;
        btn.onclick = () => switchTab(tab.id);
        tabNav.appendChild(btn);
    });

    // Content area
    const contentArea = document.createElement('div');
    contentArea.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 24px;
    `;

    // Switch tab function
    function switchTab(tabId) {
        activeTab = tabId;
        // Update button styles
        const buttons = tabNav.querySelectorAll('button');
        buttons.forEach((btn, idx) => {
            const isActive = tabs[idx].id === tabId;
            btn.style.backgroundColor = isActive ? '#667eea' : 'transparent';
            btn.style.color = isActive ? 'white' : '#6b7280';
        });
        // Render content
        renderTabContent();
    }

    // Render tab content
    function renderTabContent() {
        contentArea.innerHTML = '';
        if (activeTab === 'visualization') {
            renderVisualization(contentArea, allRecommendations);
        } else if (activeTab === 'table') {
            renderDataTable(contentArea, allRecommendations, currentRoot, currentChordType, currentInversion, onAddChord, onPlayChord, onStopChord);
        }
    }

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(tabNav);
    modal.appendChild(contentArea);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Initial render
    renderTabContent();
}

/**
 * Generate ALL recommendations (not limited to top 10)
 * This directly calls the core recommendation engine without the top-10 limit
 */
function generateAllRecommendations(currentRoot, currentChordType, currentInversion, key, style, mood, tensionDirection) {
    // Call the comprehensive recommendation engine with limit=0 to get ALL results
    // This returns ALL ~600+ evaluated combinations, not just the top 10
    const recommendations = generateComprehensiveRecommendations(
        currentRoot,
        currentChordType,
        currentInversion,
        key,
        style,
        mood,
        tensionDirection,
        0 // limit=0 means return ALL results
    );

    return recommendations;
}

/**
 * Render 3D visualization tab
 */
function renderVisualization(container, recommendations) {
    const viz = document.createElement('div');
    viz.style.cssText = 'display: flex; flex-direction: column; gap: 24px;';

    // Info section
    const info = document.createElement('div');
    info.style.cssText = 'padding: 16px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;';
    info.innerHTML = `
        <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600; color: #1e40af;">3D Scoring Matrix</h3>
        <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.6;">
            Each block represents a unique (Root, Chord Type, Inversion) combination.
            <strong>Color indicates score</strong>:
            <span style="color: #059669; font-weight: 600;">Dark Green</span> = Excellent (90-100),
            <span style="color: #16a34a; font-weight: 600;">Green</span> = Good (75-89),
            <span style="color: #facc15; font-weight: 600;">Yellow</span> = Fair (50-74),
            <span style="color: #f97316; font-weight: 600;">Orange</span> = Weak (25-49),
            <span style="color: #dc2626; font-weight: 600;">Red</span> = Poor (0-24)
        </p>
    `;
    viz.appendChild(info);

    // Create 3D grid representation
    const grid = create3DGrid(recommendations);
    viz.appendChild(grid);

    container.appendChild(viz);
}

/**
 * Create 3D grid visualization
 */
function create3DGrid(recommendations) {
    const gridContainer = document.createElement('div');
    gridContainer.style.cssText = `
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 12px;
        max-height: 70vh;
        overflow: auto;
    `;

    // Group by root note
    const byRoot = {};
    recommendations.forEach(rec => {
        if (!byRoot[rec.root]) byRoot[rec.root] = [];
        byRoot[rec.root].push(rec);
    });

    // Create grid for each root
    ALL_NOTES.forEach(root => {
        const recs = byRoot[root] || [];

        // Root label
        const label = document.createElement('div');
        label.textContent = root;
        label.style.cssText = 'font-weight: 700; font-size: 18px; color: #374151; padding: 12px; text-align: right;';
        gridContainer.appendChild(label);

        // Chord blocks
        const blocks = document.createElement('div');
        blocks.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

        recs.forEach(rec => {
            const block = document.createElement('div');
            const color = getScoreColor(rec.score);
            block.style.cssText = `
                width: 32px;
                height: 32px;
                background-color: ${color};
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            `;
            block.title = `${rec.root} ${rec.type} (${INVERSION_NAMES[rec.inversion] || rec.inversion}) - Score: ${rec.score}`;
            block.onmouseenter = () => {
                block.style.transform = 'scale(1.2)';
                block.style.zIndex = '10';
            };
            block.onmouseleave = () => {
                block.style.transform = 'scale(1)';
                block.style.zIndex = '1';
            };
            blocks.appendChild(block);
        });

        gridContainer.appendChild(blocks);
    });

    return gridContainer;
}

/**
 * Get color based on score
 */
function getScoreColor(score) {
    if (score >= 90) return '#059669'; // Dark green
    if (score >= 75) return '#16a34a'; // Green
    if (score >= 50) return '#facc15'; // Yellow
    if (score >= 25) return '#f97316'; // Orange
    return '#dc2626'; // Red
}

/**
 * Render data table tab with Excel-style filtering
 */
function renderDataTable(container, recommendations, currentRoot, currentChordType, currentInversion, onAddChord, onPlayChord, onStopChord) {
    // State for active filters
    const activeFilters = {
        root: new Set(),
        type: new Set(),
        inversion: new Set(),
        scoreMin: 0
    };

    // Table container
    const tableContainer = document.createElement('div');
    container.appendChild(tableContainer);

    // Function to apply filters and re-render
    function applyFilters() {
        let filtered = recommendations.filter(rec => {
            // Root filter
            if (activeFilters.root.size > 0 && !activeFilters.root.has(rec.root)) {
                return false;
            }
            // Type filter
            if (activeFilters.type.size > 0 && !activeFilters.type.has(rec.type)) {
                return false;
            }
            // Inversion filter
            const invName = INVERSION_NAMES[rec.inversion] || `Inversion ${rec.inversion}`;
            if (activeFilters.inversion.size > 0 && !activeFilters.inversion.has(invName)) {
                return false;
            }
            // Score filter
            if (rec.score < activeFilters.scoreMin) {
                return false;
            }
            return true;
        });

        renderTable(tableContainer, filtered, currentRoot, currentChordType, currentInversion, activeFilters, recommendations, applyFilters, onAddChord, onPlayChord, onStopChord);
    }

    // Initial render with all data
    applyFilters();
}

/**
 * Create Excel-style filter dropdown for a column
 */
function createColumnFilter(columnName, allValues, activeFilterSet, applyFiltersCallback) {
    const filterBtn = document.createElement('button');
    filterBtn.innerHTML = activeFilterSet.size > 0 ? '▼ 🔵' : '▼';
    filterBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        padding: 2px 4px;
        margin-left: 4px;
        font-size: 10px;
        color: ${activeFilterSet.size > 0 ? '#3b82f6' : '#6b7280'};
    `;
    filterBtn.title = 'Filter';

    filterBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('Filter button clicked for column:', columnName);

        // Remove any existing filter menu
        document.querySelectorAll('.column-filter-menu').forEach(m => m.remove());

        // Create filter menu
        const menu = document.createElement('div');
        menu.className = 'column-filter-menu';
        menu.style.cssText = `
            position: fixed;
            background: white;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
            padding: 8px;
            z-index: 100001;
            min-width: 200px;
            max-height: 300px;
            overflow-y: auto;
        `;

        // Position the menu (use fixed positioning for better behavior in scrollable modal)
        const rect = filterBtn.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 5}px`;

        console.log('Menu positioned at:', menu.style.left, menu.style.top);

        // Search box for the column
        const searchBox = document.createElement('input');
        searchBox.type = 'text';
        searchBox.placeholder = `Search ${columnName}...`;
        searchBox.style.cssText = `
            width: 100%;
            padding: 6px 8px;
            border: 1px solid #d1d5db;
            border-radius: 4px;
            font-size: 12px;
            margin-bottom: 8px;
        `;

        // Get unique values
        const uniqueValues = Array.from(new Set(allValues)).sort();

        // Checkbox list container
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.cssText = 'max-height: 180px; overflow-y: auto; margin-bottom: 8px;';

        // Select All / Clear All
        const selectAllDiv = document.createElement('div');
        selectAllDiv.style.cssText = 'padding: 4px; border-bottom: 1px solid #e5e7eb; margin-bottom: 4px;';
        const selectAllLabel = document.createElement('label');
        selectAllLabel.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; font-weight: 600;';
        const selectAllCheckbox = document.createElement('input');
        selectAllCheckbox.type = 'checkbox';
        selectAllCheckbox.checked = activeFilterSet.size === 0;
        selectAllCheckbox.onchange = () => {
            const checkboxes = checkboxContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
        };
        selectAllLabel.appendChild(selectAllCheckbox);
        selectAllLabel.appendChild(document.createTextNode('(Select All)'));
        selectAllDiv.appendChild(selectAllLabel);
        checkboxContainer.appendChild(selectAllDiv);

        // Render checkboxes for each unique value
        function renderCheckboxes(valuesToShow) {
            // Clear existing (except select all)
            Array.from(checkboxContainer.children).slice(1).forEach(child => child.remove());

            valuesToShow.forEach(value => {
                const div = document.createElement('div');
                div.style.cssText = 'padding: 4px;';
                const label = document.createElement('label');
                label.style.cssText = 'display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px;';
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = value;
                checkbox.checked = activeFilterSet.size === 0 || activeFilterSet.has(value);
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(value));
                div.appendChild(label);
                checkboxContainer.appendChild(div);
            });
        }

        renderCheckboxes(uniqueValues);

        // Search functionality
        searchBox.oninput = () => {
            const search = searchBox.value.toLowerCase();
            const filtered = uniqueValues.filter(v => v.toLowerCase().includes(search));
            renderCheckboxes(filtered);
        };

        // Buttons
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display: flex; gap: 6px; margin-top: 8px;';

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Apply';
        applyBtn.style.cssText = `
            flex: 1;
            padding: 6px 12px;
            background: #3b82f6;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
        `;
        applyBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Apply filter button clicked');

            // Get all checkboxes except the Select All checkbox (which is inside selectAllDiv)
            const allCheckboxDivs = Array.from(checkboxContainer.children).slice(1); // Skip first child (selectAllDiv)
            const checkboxes = allCheckboxDivs.map(div => div.querySelector('input[type="checkbox"]')).filter(cb => cb !== null);

            console.log('Found', checkboxes.length, 'checkboxes');

            activeFilterSet.clear();
            let allChecked = true;
            checkboxes.forEach(cb => {
                console.log('Checkbox:', cb.value, 'checked:', cb.checked);
                if (cb.checked) {
                    activeFilterSet.add(cb.value);
                } else {
                    allChecked = false;
                }
            });
            // If all are checked, clear the filter (means "show all")
            if (allChecked) {
                activeFilterSet.clear();
            }
            console.log('Filter applied for', columnName, ':', Array.from(activeFilterSet));
            menu.remove();
            applyFiltersCallback();
        };

        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Clear';
        clearBtn.style.cssText = `
            flex: 1;
            padding: 6px 12px;
            background: #e5e7eb;
            color: #374151;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
        `;
        clearBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Clear filter button clicked');
            activeFilterSet.clear();
            menu.remove();
            applyFiltersCallback();
        };

        btnRow.appendChild(applyBtn);
        btnRow.appendChild(clearBtn);

        menu.appendChild(searchBox);
        menu.appendChild(checkboxContainer);
        menu.appendChild(btnRow);

        document.body.appendChild(menu);

        // Close menu when clicking outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target) && e.target !== filterBtn) {
                    menu.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 0);
    };

    return filterBtn;
}

/**
 * Render the data table with Excel-style column filters
 */
function renderTable(container, recommendations, currentRoot, currentChordType, currentInversion, activeFilters, allRecommendations, applyFiltersCallback, onAddChord, onPlayChord, onStopChord) {
    container.innerHTML = '';

    // Info section showing filter status
    const infoBar = document.createElement('div');
    infoBar.style.cssText = 'padding: 12px; background: #f0f9ff; border-radius: 6px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;';

    const infoText = document.createElement('div');
    infoText.style.cssText = 'font-size: 13px; color: #1e40af;';
    infoText.textContent = `Showing ${recommendations.length} of ${allRecommendations.length} chords`;

    const clearAllBtn = document.createElement('button');
    clearAllBtn.textContent = '🔄 Clear All Filters';
    clearAllBtn.style.cssText = `
        padding: 6px 12px;
        background: #e5e7eb;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        color: #374151;
    `;
    clearAllBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Clear All Filters button clicked');
        activeFilters.root.clear();
        activeFilters.type.clear();
        activeFilters.inversion.clear();
        activeFilters.scoreMin = 0;
        applyFiltersCallback();
    };

    infoBar.appendChild(infoText);
    infoBar.appendChild(clearAllBtn);
    container.appendChild(infoBar);

    // Create table
    const table = document.createElement('table');
    table.style.cssText = 'width: 100%; border-collapse: collapse; font-size: 13px;';

    // Prepare data for filters
    const allRoots = allRecommendations.map(r => r.root);
    const allTypes = allRecommendations.map(r => r.type);
    const allInversions = allRecommendations.map(r => INVERSION_NAMES[r.inversion] || `Inversion ${r.inversion}`);

    // Header with filter buttons
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.cssText = 'background-color: #f3f4f6; border-bottom: 2px solid #d1d5db;';

    // Define columns
    const columns = [
        { name: 'Root', align: 'left', hasFilter: true, filterKey: 'root', allValues: allRoots },
        { name: 'Chord Type', align: 'left', hasFilter: true, filterKey: 'type', allValues: allTypes },
        { name: 'Inversion', align: 'left', hasFilter: true, filterKey: 'inversion', allValues: allInversions },
        { name: 'Score', align: 'center', hasFilter: false },
        { name: 'Harmonic', align: 'center', hasFilter: false },
        { name: 'Voice Lead', align: 'center', hasFilter: false },
        { name: 'Style Fit', align: 'center', hasFilter: false },
        { name: 'Mood Fit', align: 'center', hasFilter: false },
        { name: 'Reason', align: 'left', hasFilter: false },
        { name: 'Actions', align: 'center', hasFilter: false }
    ];

    columns.forEach(col => {
        const th = document.createElement('th');
        th.style.cssText = `padding: 12px 8px; text-align: ${col.align}; font-weight: 600; position: relative;`;

        const headerContent = document.createElement('div');
        headerContent.style.cssText = 'display: flex; align-items: center; gap: 4px;';

        const text = document.createElement('span');
        text.textContent = col.name;
        headerContent.appendChild(text);

        if (col.hasFilter) {
            const filterBtn = createColumnFilter(
                col.name,
                col.allValues,
                activeFilters[col.filterKey],
                applyFiltersCallback
            );
            headerContent.appendChild(filterBtn);
        }

        th.appendChild(headerContent);
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');

    // Piano sampler for chord playback (same as used elsewhere on the site)
    let piano = null;
    let currentNotes = null;

    // Helper function to play a chord
    async function playChord(chordType, root, inversion) {
        try {
            console.log(`Playing chord: ${root} ${chordType} (inversion ${inversion})`);

            // Stop any currently playing notes
            if (piano && currentNotes) {
                piano.releaseAll();
            }

            // Check if Tone is available
            if (typeof Tone === 'undefined') {
                console.error('Tone.js is not loaded');
                alert('Audio library (Tone.js) is not loaded. Cannot play chord.');
                return;
            }

            // Validate chord type exists in definitions
            if (!CHORD_DEFINITIONS[chordType]) {
                console.error(`Invalid chord type: "${chordType}". Available types:`, Object.keys(CHORD_DEFINITIONS));
                alert(`Cannot play chord: "${chordType}" is not a valid chord type.`);
                return;
            }

            // Initialize piano sampler if needed (same as used elsewhere on the site)
            if (!piano) {
                await Tone.start();
                
                // Create a promise that resolves when the sampler is loaded
                const samplerLoaded = new Promise((resolve, reject) => {
                    piano = new Tone.Sampler({
                        urls: {
                            A0: "A0.mp3",
                            C1: "C1.mp3",
                            "D#1": "Ds1.mp3",
                            "F#1": "Fs1.mp3",
                            A1: "A1.mp3", C2: "C2.mp3", "D#2": "Ds2.mp3", "F#2": "Fs2.mp3",
                            A2: "A2.mp3", C3: "C3.mp3", "D#3": "Ds3.mp3", "F#3": "Fs3.mp3",
                            A3: "A3.mp3", C4: "C4.mp3", "D#4": "Ds4.mp3", "F#4": "Fs4.mp3",
                            A4: "A4.mp3", C5: "C5.mp3", "D#5": "Ds5.mp3", "F#5": "Fs5.mp3",
                            A5: "A5.mp3", C6: "C6.mp3", "D#6": "Ds6.mp3", "F#6": "Fs6.mp3",
                            A6: "A6.mp3", C7: "C7.mp3", "D#7": "Ds7.mp3", "F#7": "Fs7.mp3",
                            A7: "A7.mp3", C8: "C8.mp3"
                        },
                        release: 1,
                        baseUrl: "https://tonejs.github.io/audio/salamander/",
                        onload: () => {
                            console.log('Piano samples loaded and ready');
                            resolve();
                        },
                        onerror: (error) => {
                            console.error('Error loading piano samples:', error);
                            reject(error);
                        }
                    }).toDestination();
                });
                
                console.log('Piano sampler initialized, waiting for samples to load...');
                // Wait for the sampler's buffers to load
                await samplerLoaded;
            }

            // Get the chord notes (params: root, chordType, inversion, key, octaveShift, enharmonicPreference, notationPreference)
            const notesResult = getInvertedChordNotes(root, chordType, inversion);
            console.log('getInvertedChordNotes returned:', notesResult);

            // Extract notes array from the result
            let notesArray;
            if (notesResult && notesResult.specificNotes && Array.isArray(notesResult.specificNotes)) {
                notesArray = notesResult.specificNotes;
            } else if (Array.isArray(notesResult)) {
                notesArray = notesResult;
            } else {
                console.error('Invalid notes result format:', notesResult);
                notesArray = [];
            }

            console.log('Notes array to play:', notesArray);

            if (notesArray && notesArray.length > 0) {
                currentNotes = notesArray;
                piano.triggerAttack(notesArray);
                console.log('Playing notes:', notesArray);
            } else {
                console.error('No notes generated for chord. ChordType:', chordType, 'Root:', root, 'Inversion:', inversion);
                alert(`Cannot generate notes for ${root} ${chordType} (inversion ${inversion}). Check console for details.`);
            }
        } catch (error) {
            console.error('Error playing chord:', error);
            alert(`Error playing chord: ${error.message}`);
        }
    }

    // Helper function to stop chord
    function stopChord() {
        try {
            if (piano && currentNotes) {
                piano.triggerRelease(currentNotes);
                currentNotes = null;
                console.log('Stopped playing');
            }
        } catch (error) {
            console.error('Error stopping chord:', error);
        }
    }

    recommendations.forEach((rec, idx) => {
        const tr = document.createElement('tr');
        tr.style.cssText = `border-bottom: 1px solid #e5e7eb; ${idx % 2 === 0 ? 'background-color: #f9fafb;' : ''}`;

        const invName = INVERSION_NAMES[rec.inversion] || `Inversion ${rec.inversion}`;

        tr.innerHTML = `
            <td style="padding: 12px 8px; font-weight: 600;">${rec.root}</td>
            <td style="padding: 12px 8px;">${rec.type}</td>
            <td style="padding: 12px 8px;">${invName}</td>
            <td style="padding: 12px 8px; text-align: center;"><span style="padding: 4px 8px; background-color: ${getScoreColor(rec.score)}; color: white; border-radius: 4px; font-weight: 600;">${rec.score}</span></td>
            <td style="padding: 12px 8px; text-align: center;">${Math.round(rec.functionScore || 0)}</td>
            <td style="padding: 12px 8px; text-align: center;">${Math.round(rec.voiceLeadingScore || 0)}</td>
            <td style="padding: 12px 8px; text-align: center;">${Math.round(rec.styleFit || 0)}</td>
            <td style="padding: 12px 8px; text-align: center;">${Math.round(rec.moodFit || 0)}</td>
            <td style="padding: 12px 8px; font-size: 12px; color: #6b7280;">${rec.reason}</td>
            <td style="padding: 12px 8px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="display: flex; gap: 4px;">
                        <button data-action="play-current" data-index="${idx}" style="padding: 4px 8px; background: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 10px; flex: 1;">▶ Current</button>
                        <button data-action="play-this" data-index="${idx}" style="padding: 4px 8px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 10px; flex: 1;">▶ This</button>
                    </div>
                    <button data-action="add" data-index="${idx}" style="padding: 4px 8px; background: #10b981; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">➕ Add to Progression</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    // Event delegation for mousedown (hold-to-play)
    table.addEventListener('mousedown', async (e) => {
        const target = e.target;

        if (target.tagName === 'BUTTON') {
            const action = target.dataset.action;
            const idx = parseInt(target.dataset.index);
            const rec = recommendations[idx];

            console.log('Button pressed:', action, 'index:', idx, 'rec:', rec);

            if (action === 'play-current') {
                console.log('Play current chord (hold)');
                e.preventDefault();
                e.stopPropagation();
                // Play the current chord
                await playChord(currentChordType, currentRoot, currentInversion);
            } else if (action === 'play-this') {
                console.log('Play suggested chord (hold)');
                e.preventDefault();
                e.stopPropagation();
                // Play the suggested chord (from the recommendation)
                await playChord(rec.type, rec.root, rec.inversion);
            }
        }
    });

    // Event delegation for mouseup (stop playing)
    const stopPlayingHandler = (e) => {
        const target = e.target;

        if (target.tagName === 'BUTTON') {
            const action = target.dataset.action;

            if (action === 'play-current' || action === 'play-this') {
                console.log('Button released, stopping chord');
                e.preventDefault();
                e.stopPropagation();
                stopChord();
            }
        }
    };

    table.addEventListener('mouseup', stopPlayingHandler);
    table.addEventListener('mouseleave', stopPlayingHandler);

    // Event delegation for clicks (add button)
    table.onclick = (e) => {
        const target = e.target;

        if (target.tagName === 'BUTTON') {
            const action = target.dataset.action;

            if (action === 'add') {
                e.preventDefault();
                e.stopPropagation();
                const idx = parseInt(target.dataset.index);
                const rec = recommendations[idx];

                console.log('Add chord to progression');
                if (onAddChord) {
                    onAddChord(rec.type, rec.root, rec.inversion);
                } else {
                    console.error('onAddChord callback not provided');
                }
            }
        }
    };

    container.appendChild(table);
}
