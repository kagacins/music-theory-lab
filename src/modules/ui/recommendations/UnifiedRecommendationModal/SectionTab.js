/**
 * Section Tab Renderer for Unified Recommendation Modal
 *
 * Handles section planning and generation UI.
 */

// ============================================================================
// IMPORTS
// ============================================================================

// State management
import { getCompositionState } from '../../../state/compositionState.js';
import { getCurrentKey, getProgressionData } from '../../../state/trainerState.js';

// Utilities
import { spellNoteInKey } from '../../../utils/noteUtils.js';
import { noteToRomanNumeral } from '../../../utils/romanNumerals.js';

// Import from parent modal modules
import { modalState } from './ModalState.js';
import { SECTION_TYPES } from './Constants.js';

// ============================================================================
// SECTION TAB (ADD SECTION)
// ============================================================================

export function renderSectionTab(container) {
    const compositionState = getCompositionState();
    const progressionData = getProgressionData() || [];
    const key = getCurrentKey() || 'C';

    // Get recommendation service for section generation
    let recommendationService = null;
    try {
        recommendationService = window.getRecommendationService?.();
    } catch (e) {
        console.warn('Recommendation service not available:', e);
    }

    // Current structure visualization
    const structureSection = document.createElement('div');
    structureSection.style.cssText = `
        padding: 16px;
        background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
        border-radius: 8px;
        margin-bottom: 16px;
        border: 1px solid #e0e7ff;
    `;

    structureSection.innerHTML = `
        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span>📋</span> Current Song Structure
        </h4>
    `;

    // Get sections if available
    const sections = compositionState?.getSections?.() || compositionState?.sections || [];
    if (sections.length > 0) {
        const sectionRow = document.createElement('div');
        sectionRow.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;';
        sections.forEach((sec, idx) => {
            const secInfo = SECTION_TYPES.find(s => s.id === sec.type) || { name: sec.type, icon: '📄' };
            const chip = document.createElement('span');
            chip.style.cssText = `
                padding: 6px 12px;
                background: ${idx === sections.length - 1 ? '#dbeafe' : '#e5e7eb'};
                color: ${idx === sections.length - 1 ? '#1e40af' : '#374151'};
                border-radius: 6px;
                font-size: 13px;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            `;
            const chordCount = sec.chordIndices?.length || sec.chordCount || '?';
            chip.innerHTML = `${secInfo.icon} ${secInfo.name} <span style="opacity: 0.6;">(${chordCount})</span>`;
            sectionRow.appendChild(chip);
        });
        structureSection.appendChild(sectionRow);
    } else {
        structureSection.innerHTML += `
            <div style="color: #6b7280; font-size: 13px;">
                ${progressionData.length} chord${progressionData.length !== 1 ? 's' : ''} (no sections defined yet)
            </div>
        `;
    }
    container.appendChild(structureSection);

    // Next section suggestion
    const suggestionSection = document.createElement('div');
    suggestionSection.style.cssText = `
        padding: 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 16px;
    `;

    // Get next section suggestion
    let suggestion = null;
    if (recommendationService?.suggestNextSection) {
        suggestion = recommendationService.suggestNextSection(sections);
    }

    suggestionSection.innerHTML = `
        <h4 style="margin: 0 0 12px 0; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span>💡</span> Suggested Next Section
        </h4>
        ${suggestion ? `
            <div style="margin-bottom: 12px; padding: 10px; background: #fef3c7; border-radius: 6px;">
                <div style="font-weight: 600; color: #92400e; margin-bottom: 4px;">
                    ${capitalize(suggestion.suggested)}
                </div>
                <div style="font-size: 12px; color: #78716c;">
                    ${suggestion.reasoning || 'Based on your current song structure'}
                </div>
                ${suggestion.alternatives?.length ? `
                    <div style="font-size: 11px; color: #a8a29e; margin-top: 6px;">
                        Also consider: ${suggestion.alternatives.map(a => capitalize(a)).join(', ')}
                    </div>
                ` : ''}
            </div>
        ` : ''}
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${SECTION_TYPES.map(st => `
                <button class="quick-section-btn" data-section="${st.id}" style="
                    padding: 8px 14px;
                    border: 1px solid ${suggestion?.suggested === st.id ? '#f59e0b' : '#d1d5db'};
                    border-radius: 6px;
                    background: ${suggestion?.suggested === st.id ? '#fef3c7' : 'white'};
                    cursor: pointer;
                    font-size: 13px;
                    transition: all 0.15s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                ">
                    ${st.icon} ${st.name}
                </button>
            `).join('')}
        </div>
    `;
    container.appendChild(suggestionSection);

    // Generate section panel
    const generateSection = document.createElement('div');
    generateSection.style.cssText = `
        padding: 16px;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 16px;
    `;
    generateSection.innerHTML = `
        <h4 style="margin: 0 0 16px 0; font-size: 14px; color: #374151; display: flex; align-items: center; gap: 8px;">
            <span>🎲</span> Add New Section
        </h4>
        <p style="font-size: 12px; color: #6b7280; margin: 0 0 16px 0;">
            Generate a complete section with chords using AI. Click a section type above or configure below.
        </p>
        <div style="display: flex; gap: 8px; align-items: stretch; margin-bottom: 16px;">
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Type</label>
                <select id="gen-section-type" style="padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white; width: 100%;">
                    ${SECTION_TYPES.map(st => `
                        <option value="${st.id}" ${st.id === modalState.generateSectionType ? 'selected' : ''}>
                            ${st.icon} ${st.name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Style</label>
                <select id="gen-style-select" style="padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white; width: 100%;">
                    <option value="pop" ${modalState.generateStyle === 'pop' ? 'selected' : ''}>Pop</option>
                    <option value="rock" ${modalState.generateStyle === 'rock' ? 'selected' : ''}>Rock</option>
                    <option value="jazz" ${modalState.generateStyle === 'jazz' ? 'selected' : ''}>Jazz</option>
                    <option value="ballad" ${modalState.generateStyle === 'ballad' ? 'selected' : ''}>Ballad</option>
                </select>
            </div>
            <div style="flex: 1; display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">Length</label>
                <select id="gen-length-select" style="padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; background: white; width: 100%;">
                    <option value="4" ${modalState.generateLength === 4 ? 'selected' : ''}>4 chords</option>
                    <option value="8" ${modalState.generateLength === 8 ? 'selected' : ''}>8 chords</option>
                </select>
            </div>
        </div>
        <button id="generate-section-btn" style="
            padding: 10px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
        ">
            🎲 Generate Preview
        </button>
    `;
    container.appendChild(generateSection);

    // Preview container (initially hidden)
    const previewContainer = document.createElement('div');
    previewContainer.id = 'section-preview-container';
    previewContainer.style.cssText = `
        padding: 16px;
        background: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 8px;
        display: none;
    `;
    container.appendChild(previewContainer);

    // Set up event listeners
    setupSectionTabListeners(recommendationService);
}

function setupSectionTabListeners(recommendationService) {
    // Quick section buttons
    document.querySelectorAll('.quick-section-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sectionType = btn.dataset.section;
            document.getElementById('gen-section-type').value = sectionType;
            modalState.generateSectionType = sectionType;

            // Highlight selected button
            document.querySelectorAll('.quick-section-btn').forEach(b => {
                b.style.background = 'white';
                b.style.borderColor = '#d1d5db';
            });
            btn.style.background = '#eff6ff';
            btn.style.borderColor = '#3b82f6';
        });

        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#f9fafb';
        });
        btn.addEventListener('mouseleave', () => {
            if (btn.dataset.section !== modalState.generateSectionType) {
                btn.style.background = 'white';
            }
        });
    });

    // Generate button
    const generateBtn = document.getElementById('generate-section-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => handleGenerateSectionClick(recommendationService));
        generateBtn.addEventListener('mouseenter', () => {
            generateBtn.style.transform = 'scale(1.02)';
            generateBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        });
        generateBtn.addEventListener('mouseleave', () => {
            generateBtn.style.transform = '';
            generateBtn.style.boxShadow = '';
        });
    }

    // Selection change handlers
    const typeSelect = document.getElementById('gen-section-type');
    const styleSelect = document.getElementById('gen-style-select');
    const lengthSelect = document.getElementById('gen-length-select');

    if (typeSelect) {
        typeSelect.addEventListener('change', () => {
            modalState.generateSectionType = typeSelect.value;
        });
    }
    if (styleSelect) {
        styleSelect.addEventListener('change', () => {
            modalState.generateStyle = styleSelect.value;
        });
    }
    if (lengthSelect) {
        lengthSelect.addEventListener('change', () => {
            modalState.generateLength = parseInt(lengthSelect.value, 10);
        });
    }
}

function handleGenerateSectionClick(recommendationService) {
    const previewContainer = document.getElementById('section-preview-container');
    if (!previewContainer) return;

    const sectionType = modalState.generateSectionType;
    const style = modalState.generateStyle;
    const length = modalState.generateLength;
    const key = getCurrentKey() || 'C';

    // Show loading
    previewContainer.style.display = 'block';
    previewContainer.style.background = '#f9fafb';
    previewContainer.style.borderColor = '#e5e7eb';
    previewContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 24px; color: #6b7280;">
            <div style="width: 20px; height: 20px; border: 2px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin-right: 12px;"></div>
            <span>Generating 5 ${capitalize(sectionType)} options...</span>
        </div>
    `;

    // Generate 5 section options
    let results = [];
    modalState.selectedOptionIndex = 0;

    try {
        if (recommendationService?.generateMultipleSections) {
            results = recommendationService.generateMultipleSections({
                sectionType,
                length,
                style,
                count: 5
            });
        }
    } catch (e) {
        console.error('Error generating sections:', e);
    }

    // If no results from the service, generate fallback options
    if (!results || results.length === 0) {
        // Generate 5 fallback progressions with variations
        for (let i = 0; i < 5; i++) {
            const fallback = generateFallbackSection(sectionType, length, key, style, i);
            if (fallback && fallback.progression) {
                results.push({
                    ...fallback,
                    optionNumber: i + 1,
                    moodLabel: ['Classic', 'Alternative', 'Emotional', 'Driving', 'Experimental'][i]
                });
            }
        }
    }

    // Store options
    modalState.generatedOptions = results;
    modalState.generatedPreview = results[0] || null;

    // Display the preview with all options
    displaySectionOptionsPreview(previewContainer, results, key, style, length, sectionType, recommendationService);
}

export function generateFallbackSection(sectionType, length, key, style, variationIndex = 0) {
    // Multiple progression patterns per section type for variety
    const allPatterns = {
        verse: [
            // Variation 0: Classic I-V-vi-IV
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }],
            // Variation 1: I-IV-vi-V
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            // Variation 2: vi-IV-I-V (minor feel)
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            // Variation 3: I-vi-IV-V
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            // Variation 4: ii-V-I-IV
            [{ root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }]
        ],
        chorus: [
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }],
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }],
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }]
        ],
        bridge: [
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }],
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 4), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 4), type: 'Minor' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }]
        ],
        intro: [
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }],
            [{ root: key, type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }]
        ],
        prechorus: [
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }],
            [{ root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }]
        ],
        outro: [
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: getRelativeNote(key, 9), type: 'Minor' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: getRelativeNote(key, 2), type: 'Minor' }, { root: getRelativeNote(key, 7), type: 'Major' }, { root: key, type: 'Major' }, { root: key, type: 'Major' }],
            [{ root: key, type: 'Major' }, { root: getRelativeNote(key, 5), type: 'Major' }, { root: key, type: 'Major' }, { root: key, type: 'Major' }]
        ]
    };

    const moodLabels = ['Classic', 'Alternative', 'Emotional', 'Driving', 'Experimental'];
    const reasonings = [
        `Classic ${style} ${sectionType} progression`,
        `Alternative take on ${style} ${sectionType}`,
        `Emotional ${style} ${sectionType} with minor colors`,
        `Driving ${style} ${sectionType} progression`,
        `Experimental ${style} ${sectionType} variation`
    ];

    // Get patterns for section type (fallback to verse)
    const sectionPatterns = allPatterns[sectionType] || allPatterns.verse;
    const patternIndex = variationIndex % sectionPatterns.length;
    let progression = [...sectionPatterns[patternIndex]];

    // Extend if needed
    while (progression.length < length) {
        progression = [...progression, ...sectionPatterns[patternIndex]];
    }
    progression = progression.slice(0, length);

    return {
        progression,
        sectionType,
        style,
        optionNumber: variationIndex + 1,
        moodLabel: moodLabels[variationIndex % moodLabels.length],
        reasoning: reasonings[variationIndex % reasonings.length]
    };
}

// Keep the old function signature for backward compatibility
export function generateFallbackSectionLegacy(sectionType, length, key, style) {
    // Style-specific progression patterns
    const stylePatterns = {
        pop: {
            intro: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 5), type: 'Major' }
            ],
            verse: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 5), type: 'Major' }, // IV
                { root: getRelativeNote(key, 9), type: 'Minor' }, // vi
                { root: getRelativeNote(key, 7), type: 'Major' }  // V
            ],
            prechorus: [
                { root: getRelativeNote(key, 2), type: 'Minor' }, // ii
                { root: getRelativeNote(key, 7), type: 'Major' }, // V
                { root: getRelativeNote(key, 5), type: 'Major' }, // IV
                { root: getRelativeNote(key, 7), type: 'Major' }  // V
            ],
            chorus: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 7), type: 'Major' }, // V
                { root: getRelativeNote(key, 9), type: 'Minor' }, // vi
                { root: getRelativeNote(key, 5), type: 'Major' }  // IV
            ],
            bridge: [
                { root: getRelativeNote(key, 9), type: 'Minor' }, // vi
                { root: getRelativeNote(key, 5), type: 'Major' }, // IV
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 7), type: 'Major' }  // V
            ],
            instrumental: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 7), type: 'Major' }
            ],
            outro: [
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: key, type: 'Major' }
            ]
        },
        rock: {
            intro: [
                { root: key, type: 'Power' },
                { root: getRelativeNote(key, 5), type: 'Power' }
            ],
            verse: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 10), type: 'Major' }, // bVII
                { root: getRelativeNote(key, 5), type: 'Major' },  // IV
                { root: key, type: 'Major' }
            ],
            chorus: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 5), type: 'Major' },  // IV
                { root: getRelativeNote(key, 7), type: 'Major' },  // V
                { root: key, type: 'Major' }
            ],
            bridge: [
                { root: getRelativeNote(key, 9), type: 'Minor' }, // vi
                { root: getRelativeNote(key, 10), type: 'Major' }, // bVII
                { root: getRelativeNote(key, 5), type: 'Major' },  // IV
                { root: getRelativeNote(key, 7), type: 'Major' }   // V
            ]
        },
        jazz: {
            intro: [
                { root: getRelativeNote(key, 2), type: 'Minor 7th' },
                { root: getRelativeNote(key, 7), type: 'Dominant 7th' }
            ],
            verse: [
                { root: key, type: 'Major 7th' },
                { root: getRelativeNote(key, 9), type: 'Minor 7th' }, // vi7
                { root: getRelativeNote(key, 2), type: 'Minor 7th' }, // ii7
                { root: getRelativeNote(key, 7), type: 'Dominant 7th' }  // V7
            ],
            chorus: [
                { root: key, type: 'Major 7th' },
                { root: getRelativeNote(key, 5), type: 'Major 7th' },
                { root: getRelativeNote(key, 2), type: 'Minor 7th' },
                { root: getRelativeNote(key, 7), type: 'Dominant 7th' }
            ],
            bridge: [
                { root: getRelativeNote(key, 4), type: 'Minor 7th' }, // iii7
                { root: getRelativeNote(key, 9), type: 'Minor 7th' }, // vi7
                { root: getRelativeNote(key, 2), type: 'Minor 7th' }, // ii7
                { root: getRelativeNote(key, 7), type: 'Dominant 7th' }  // V7
            ]
        },
        ballad: {
            intro: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 9), type: 'Minor' }
            ],
            verse: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 9), type: 'Minor' },
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: key, type: 'Major' }
            ],
            chorus: [
                { root: key, type: 'Major' },
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: getRelativeNote(key, 9), type: 'Minor' },
                { root: getRelativeNote(key, 7), type: 'Major' }
            ],
            bridge: [
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: getRelativeNote(key, 2), type: 'Minor' },
                { root: getRelativeNote(key, 9), type: 'Minor' },
                { root: getRelativeNote(key, 7), type: 'Major' }
            ],
            outro: [
                { root: getRelativeNote(key, 5), type: 'Major' },
                { root: key, type: 'Major' }
            ]
        }
    };

    // Get style-specific patterns, fallback to pop
    const patterns = stylePatterns[style] || stylePatterns.pop;
    let progression = patterns[sectionType] || patterns.verse || stylePatterns.pop.verse;

    // Extend if needed
    while (progression.length < length) {
        progression = [...progression, ...progression];
    }
    progression = progression.slice(0, length);

    return {
        progression,
        sectionType,
        style,
        reasoning: `Generated a ${style} ${sectionType} progression in ${key}.`
    };
}

export function getRelativeNote(key, semitones) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const flatNotes = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

    let keyIndex = notes.indexOf(key);
    if (keyIndex === -1) keyIndex = flatNotes.indexOf(key);
    if (keyIndex === -1) keyIndex = 0;

    const newIndex = (keyIndex + semitones) % 12;
    return notes[newIndex];
}

/**
 * Display 5 section options for user selection
 */
function displaySectionOptionsPreview(container, options, key, style, length, sectionType, recommendationService) {
    if (!options || options.length === 0) {
        container.style.display = 'none';
        return;
    }

    const sectionInfo = SECTION_TYPES.find(s => s.id === sectionType) || { icon: '📄', name: sectionType };

    // Build options HTML with key-aware spelling and Roman numerals
    const optionsHtml = options.map((option, index) => {
        // Build chord names and Roman numerals
        const chordDetails = option.progression.map(c => {
            const suffix = c.type === 'Minor' ? 'm' : c.type === 'Diminished' ? 'dim' : c.type === 'Dominant 7th' ? '7' : c.type === 'Major 7th' ? 'maj7' : c.type === 'Minor 7th' ? 'm7' : '';
            const spelledRoot = spellNoteInKey(c.root, key);
            const romanNum = noteToRomanNumeral(c.root, key, c.type) || '?';
            return { name: `${spelledRoot}${suffix}`, roman: romanNum };
        });
        const progressionStr = chordDetails.map(cd => cd.name).join(' → ');
        const romanStr = chordDetails.map(cd => cd.roman).join(' → ');
        const isSelected = index === modalState.selectedOptionIndex;

        // Tension arc visualization (if available)
        const tensionArc = option.tensionArc?.values || [];
        const tensionBars = tensionArc.length > 0 ? tensionArc.map(t => {
            const height = Math.round(t * 20) + 4; // 4-24px height
            const color = t > 0.7 ? '#ef4444' : t > 0.4 ? '#f59e0b' : '#22c55e';
            return `<div style="width: 8px; height: ${height}px; background: ${color}; border-radius: 2px;"></div>`;
        }).join('') : '';

        return `
            <div class="section-option ${isSelected ? 'selected' : ''}" data-option-index="${index}" style="
                padding: 12px;
                background: ${isSelected ? '#ecfdf5' : 'white'};
                border: 2px solid ${isSelected ? '#10b981' : '#e5e7eb'};
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.15s ease;
                ${isSelected ? 'box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);' : ''}
            ">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                    <span style="
                        font-size: 11px;
                        font-weight: 700;
                        color: ${isSelected ? '#059669' : '#3b82f6'};
                        background: ${isSelected ? '#d1fae5' : '#eff6ff'};
                        padding: 2px 8px;
                        border-radius: 4px;
                    ">#${index + 1}</span>
                    <span style="font-size: 11px; color: #6b7280;">${option.moodLabel || 'Option'}</span>
                    ${tensionBars ? `
                        <span style="display: flex; align-items: flex-end; gap: 2px; padding: 2px 6px; background: #f9fafb; border-radius: 4px;" title="Tension arc">
                            ${tensionBars}
                        </span>
                    ` : ''}
                    <button class="section-preview-btn" data-preview-index="${index}" style="
                        margin-left: auto;
                        padding: 4px 10px;
                        background: ${isSelected ? '#059669' : '#6b7280'};
                        color: white;
                        border: none;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 500;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        transition: background 0.15s ease;
                    ">▶ Preview</button>
                    ${isSelected ? '<span style="font-size: 11px; font-weight: 600; color: #059669; margin-left: 8px;">✓ Selected</span>' : ''}
                </div>
                <div style="font-family: monospace; font-size: 13px; color: #1e293b; font-weight: 500;">
                    ${progressionStr}
                </div>
                <div style="font-family: monospace; font-size: 11px; color: #8b5cf6; margin-top: 2px;">
                    ${romanStr}
                </div>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 4px;">
                    ${option.reasoning || ''}
                </div>
            </div>
        `;
    }).join('');

    container.style.display = 'block';
    container.style.background = '#f0fdf4';
    container.style.borderColor = '#86efac';
    container.innerHTML = `
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; font-size: 14px; color: #166534; display: flex; align-items: center; gap: 8px;">
                ${sectionInfo.icon} ${capitalize(sectionType)} Options
            </h4>
            <span style="font-size: 12px; color: #6b7280;">Key: ${key} • ${capitalize(style)} • ${length} chords</span>
        </div>
        <p style="font-size: 12px; color: #6b7280; margin: 0 0 12px 0;">
            Click an option to select it, then apply to your composition:
        </p>
        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; margin-bottom: 16px;">
            ${optionsHtml}
        </div>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="apply-section-btn" style="
                padding: 10px 20px;
                background: #0ea5e9;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                ✓ Apply Selected (#${modalState.selectedOptionIndex + 1})
            </button>
            <button id="regenerate-section-btn" style="
                padding: 10px 20px;
                background: white;
                color: #374151;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                🔄 Regenerate All
            </button>
        </div>
    `;

    // Set up option click handlers
    container.querySelectorAll('.section-option').forEach(optionEl => {
        optionEl.addEventListener('click', (e) => {
            // Don't trigger selection if clicking the preview button
            if (e.target.closest('.section-preview-btn')) return;

            const index = parseInt(optionEl.dataset.optionIndex, 10);
            modalState.selectedOptionIndex = index;
            modalState.generatedPreview = options[index];
            // Re-render to show selection
            displaySectionOptionsPreview(container, options, key, style, length, sectionType, recommendationService);
        });

        // Hover effects
        optionEl.addEventListener('mouseenter', () => {
            if (!optionEl.classList.contains('selected')) {
                optionEl.style.borderColor = '#a7f3d0';
                optionEl.style.background = '#f0fdf4';
            }
        });
        optionEl.addEventListener('mouseleave', () => {
            if (!optionEl.classList.contains('selected')) {
                optionEl.style.borderColor = '#e5e7eb';
                optionEl.style.background = 'white';
            }
        });
    });

    // Set up preview button handlers (inside each option card)
    container.querySelectorAll('.section-preview-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the card selection
            const index = parseInt(btn.dataset.previewIndex, 10);
            const option = options[index];
            if (option) {
                playGeneratedSection(option.progression);
            }
        });

        // Hover effect for preview buttons
        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#4f46e5';
        });
        btn.addEventListener('mouseleave', () => {
            const index = parseInt(btn.dataset.previewIndex, 10);
            const isSelected = index === modalState.selectedOptionIndex;
            btn.style.background = isSelected ? '#059669' : '#6b7280';
        });
    });

    // Set up bottom button handlers
    const applyBtn = document.getElementById('apply-section-btn');
    const regenBtn = document.getElementById('regenerate-section-btn');

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const selectedOption = options[modalState.selectedOptionIndex];
            if (selectedOption) {
                applySectionToComposition(selectedOption);
            }
        });
    }
    if (regenBtn) {
        regenBtn.addEventListener('click', () => {
            handleGenerateSectionClick(recommendationService);
        });
    }
}

export function displaySectionPreview(container, result, key) {
    // Build chord names and Roman numerals
    const chordDetails = result.progression.map(c => {
        const suffix = c.type === 'Minor' ? 'm' : c.type === 'Diminished' ? 'dim' : c.type === 'Dominant 7th' ? '7' : c.type === 'Major 7th' ? 'maj7' : c.type === 'Minor 7th' ? 'm7' : '';
        const spelledRoot = spellNoteInKey(c.root, key);
        const romanNum = noteToRomanNumeral(c.root, key, c.type) || '?';
        return { name: `${spelledRoot}${suffix}`, roman: romanNum };
    });
    const progressionStr = chordDetails.map(cd => cd.name).join(' → ');
    const romanStr = chordDetails.map(cd => cd.roman).join(' → ');

    const sectionInfo = SECTION_TYPES.find(s => s.id === result.sectionType) || { icon: '📄', name: result.sectionType };

    container.style.background = '#f0fdf4';
    container.style.borderColor = '#86efac';
    container.innerHTML = `
        <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <h4 style="margin: 0; font-size: 14px; color: #166534; display: flex; align-items: center; gap: 8px;">
                ${sectionInfo.icon} ${capitalize(result.sectionType)} Preview
            </h4>
            <span style="font-size: 12px; color: #6b7280;">Key: ${key}</span>
        </div>
        <div style="
            padding: 12px;
            background: white;
            border-radius: 6px;
            margin-bottom: 12px;
            text-align: center;
        ">
            <div style="font-family: monospace; font-size: 14px; color: #1e293b; font-weight: 500;">
                ${progressionStr}
            </div>
            <div style="font-family: monospace; font-size: 12px; color: #8b5cf6; margin-top: 4px;">
                ${romanStr}
            </div>
        </div>
        ${result.reasoning ? `
            <div style="font-size: 12px; color: #6b7280; margin-bottom: 16px;">
                ${result.reasoning}
            </div>
        ` : ''}
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <button id="apply-section-btn" style="
                padding: 10px 20px;
                background: #0ea5e9;
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                ✓ Apply to Composition
            </button>
            <button id="regenerate-section-btn" style="
                padding: 10px 20px;
                background: white;
                color: #374151;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                🔄 Regenerate
            </button>
            <button id="play-preview-btn" style="
                padding: 10px 20px;
                background: white;
                color: #374151;
                border: 1px solid #d1d5db;
                border-radius: 6px;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 6px;
            ">
                ▶ Preview
            </button>
        </div>
    `;

    // Set up button handlers
    const applyBtn = document.getElementById('apply-section-btn');
    const regenBtn = document.getElementById('regenerate-section-btn');
    const playBtn = document.getElementById('play-preview-btn');

    if (applyBtn) {
        applyBtn.addEventListener('click', () => applySectionToComposition(result));
    }
    if (regenBtn) {
        regenBtn.addEventListener('click', () => {
            try {
                const recommendationService = window.getRecommendationService?.();
                handleGenerateSectionClick(recommendationService);
            } catch (e) {
                handleGenerateSectionClick(null);
            }
        });
    }
    if (playBtn) {
        playBtn.addEventListener('click', () => playGeneratedSection(result.progression));
    }
}

export function applySectionToComposition(result) {
    if (!result?.progression) return;

    // Dispatch event for the progression builder to handle
    window.dispatchEvent(new CustomEvent('applyGeneratedSection', {
        detail: {
            progression: result.progression,
            sectionType: result.sectionType,
            style: result.style
        }
    }));

    // Show success feedback
    const container = document.getElementById('section-preview-container');
    if (container) {
        container.style.background = '#dcfce7';
        container.style.borderColor = '#22c55e';
        container.innerHTML = `
            <div style="text-align: center; padding: 16px;">
                <div style="font-size: 32px; margin-bottom: 8px;">✓</div>
                <div style="font-size: 14px; font-weight: 600; color: #166534;">Section Applied!</div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">
                    The chords have been added to your progression
                </div>
            </div>
        `;

        // Hide after a moment
        setTimeout(() => {
            container.style.display = 'none';
        }, 2000);
    }
}

export function playGeneratedSection(progression) {
    if (!progression || progression.length === 0) return;

    // Use the existing playChordSequence function from window
    if (window.playChordSequence) {
        window.playChordSequence(progression, null, 400);
    }
}

function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}
