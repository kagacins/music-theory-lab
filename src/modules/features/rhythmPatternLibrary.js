/**
 * Rhythm Pattern Library
 * - Combines built-in patterns with user-defined custom patterns
 * - Supports persistence (localStorage) for custom patterns
 * - Provides helpers for fetching patterns by chord count and applying beats
 */

import {
    RHYTHMIC_PATTERNS,
    PATTERN_CATEGORIES,
    getPatternsForChordCount,
    getPatternById,
    formatBeatsDisplay
} from './rhythmicPatterns.js';

const STORAGE_KEY = 'mtlCustomRhythmPatterns';
const CUSTOM_CATEGORY = 'custom';

function loadCustomPatterns() {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.warn('[rhythmPatternLibrary] Failed to load custom patterns', err);
        return [];
    }
}

function persistCustomPatterns(patterns) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    } catch (err) {
        console.warn('[rhythmPatternLibrary] Failed to save custom patterns', err);
    }
}

export function getCustomPatternsForCount(chordCount) {
    return loadCustomPatterns().filter(p => p.chordCount === chordCount);
}

export function getAllPatternsForCount(chordCount) {
    return [
        ...getPatternsForChordCount(chordCount),
        ...getCustomPatternsForCount(chordCount)
    ];
}

export function getAnyPatternById(patternId) {
    const builtIn = getPatternById(patternId);
    if (builtIn) return builtIn;
    return loadCustomPatterns().find(p => p.id === patternId) || null;
}

export function saveCustomPattern({ name, beats, chordCount, description = '' }) {
    if (!name || !beats || !Array.isArray(beats) || beats.length === 0) {
        return null;
    }

    const totalBeats = beats.reduce((sum, b) => sum + Number(b || 0), 0);
    const slugBase = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const id = `${slugBase || 'custom'}-${chordCount}-${Date.now()}`;

    const customPattern = {
        id,
        name,
        chordCount,
        beats: beats.map(b => Number(b)),
        totalBeats,
        description: description || `Custom ${chordCount}-chord pattern (${formatBeatsDisplay(beats)})`,
        category: CUSTOM_CATEGORY,
        isCustom: true
    };

    const existing = loadCustomPatterns();
    existing.push(customPattern);
    persistCustomPatterns(existing);
    return customPattern;
}

export function deleteCustomPattern(id) {
    const existing = loadCustomPatterns();
    const next = existing.filter(p => p.id !== id);
    persistCustomPatterns(next);
}

export function getCustomPatterns() {
    return loadCustomPatterns();
}

/**
 * Apply an array of beats to specific chord indices in a progression.
 * @param {Array} progressionData - chord objects
 * @param {Array<number>} beats - beat durations to apply
 * @param {Array<number>} targetIndices - indices to apply beats to (length must match beats)
 * @returns {Array|null} updated progression or null on mismatch
 */
export function applyBeatsToProgression(progressionData, beats, targetIndices = null) {
    if (!progressionData || !Array.isArray(progressionData)) return null;
    const beatArray = Array.isArray(beats) ? beats.map(b => Number(b)) : null;
    if (!beatArray || beatArray.length === 0) return null;

    // If no target indices, apply across entire progression
    if (!targetIndices || targetIndices.length === 0) {
        if (beatArray.length !== progressionData.length) return null;
        return progressionData.map((chord, i) => ({ ...chord, beats: beatArray[i] }));
    }

    if (beatArray.length !== targetIndices.length) return null;

    const updated = progressionData.map(chord => ({ ...chord }));
    targetIndices.forEach((idx, i) => {
        if (idx >= 0 && idx < updated.length) {
            updated[idx].beats = beatArray[i];
        }
    });
    return updated;
}

export { CUSTOM_CATEGORY, PATTERN_CATEGORIES };

