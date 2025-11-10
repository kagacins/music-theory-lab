/**
 * Chord Suggestion Engine
 * Provides style and mood aware chord continuation hints plus harmonic tension analysis
 */

import { ROMAN_MAP_BASE } from '../../data/music-data.js';

// -----------------------------------------------------------------------------
// Public preset metadata
// -----------------------------------------------------------------------------

export const STYLE_PRESETS = [
    { id: 'any', label: 'Balanced Blend', description: 'General-purpose functional harmony with smooth movement.' },
    { id: 'pop', label: 'Pop / Top 40', description: 'I–V–vi–IV staples and lift-friendly cadences.' },
    { id: 'jazz', label: 'Jazz Standards', description: 'ii–V turnarounds, circle motion, and color extensions.' },
    { id: 'classical', label: 'Classical', description: 'Functional progressions with strong cadences and voice-leading.' },
    { id: 'rock', label: 'Rock / Indie', description: 'Mixolydian bVII moves, driving IV chords, and power cadences.' }
];

export const MOOD_PRESETS = [
    { id: 'neutral', label: 'Balanced', description: 'Even keeled flow without heavy bias.' },
    { id: 'melancholic', label: 'Melancholic', description: 'Lean into vi, iv, and modal mixture for wistful colors.' },
    { id: 'triumphant', label: 'Triumphant', description: 'Bright cadences and lift into IV & V for anthemic energy.' },
    { id: 'mysterious', label: 'Mysterious', description: 'Borrowed tones, darker colors, and unresolved tension.' }
];

// -----------------------------------------------------------------------------
// Internal rule tables
// -----------------------------------------------------------------------------

const STYLE_RULES = {
    any: {
        fallback: [
            { to: 'IV', weight: 0.28, reason: 'Moves away from tonic while staying consonant.' },
            { to: 'V', weight: 0.32, reason: 'Sets up dominant tension ready to resolve.' },
            { to: 'vi', weight: 0.26, reason: 'Relative minor keeps motion gentle and lyrical.' }
        ],
        transitions: {
            DEFAULT: [
                { to: 'IV', weight: 0.25, reason: 'Supports functional movement toward cadence.' },
                { to: 'V', weight: 0.3, reason: 'Creates forward pull for resolution.' },
                { to: 'ii', weight: 0.22, reason: 'Pre-dominant setup that keeps the loop flowing.' }
            ],
            V: [
                { to: 'I', weight: 0.45, reason: 'Classic V→I authentic cadence releases built-up tension.' },
                { to: 'vi', weight: 0.28, reason: 'Deceptive cadence keeps things evolving.' }
            ],
            IV: [
                { to: 'I', weight: 0.32, reason: 'Plagal cadence softens the return home.' },
                { to: 'V', weight: 0.28, reason: 'Step up the tension heading into dominant.' }
            ]
        },
        chordTypes: {
            V: 'Dominant 7th'
        }
    },
    pop: {
        fallback: [
            { to: 'I', weight: 0.3, reason: 'Return to tonic for a chorus-ready lift.' },
            { to: 'vi', weight: 0.32, reason: 'Relative minor keeps the pop loop flowing.' },
            { to: 'IV', weight: 0.26, reason: 'IV adds warmth and sets up singable hooks.' }
        ],
        transitions: {
            I: [
                { to: 'V', weight: 0.38, reason: 'I→V builds classic pop momentum.' },
                { to: 'vi', weight: 0.34, reason: 'I→vi shift delivers the familiar emotional turn.' }
            ],
            V: [
                { to: 'vi', weight: 0.32, reason: 'V→vi deceptive cadence keeps interest high.' },
                { to: 'I', weight: 0.4, reason: 'Resolve for a satisfying chorus landing.' }
            ],
            vi: [
                { to: 'IV', weight: 0.42, reason: 'vi→IV sustains the progression with smooth voice-leading.' },
                { to: 'ii', weight: 0.22, reason: 'Moves toward a pre-chorus build.' }
            ],
            IV: [
                { to: 'V', weight: 0.34, reason: 'IV→V sets up a powerful cadence.' },
                { to: 'I', weight: 0.3, reason: 'IV→I plagal cadence for open, anthemic feel.' }
            ],
            DEFAULT: []
        },
        chordTypes: {
            V: 'Major',
            ii: 'Minor',
            vi: 'Minor',
            IV: 'Major'
        }
    },
    jazz: {
        fallback: [
            { to: 'ii', weight: 0.36, reason: 'Kick off a ii–V–I turnaround.' },
            { to: 'VI', weight: 0.24, reason: 'Secondary dominant setup for circle-of-fifths motion.' },
            { to: 'IV', weight: 0.2, reason: 'Subdominant color keeps things modal.' }
        ],
        transitions: {
            I: [
                { to: 'vi', weight: 0.3, reason: 'I→vi sets up the rhythm changes bridge feel.' },
                { to: 'ii', weight: 0.34, reason: 'I→ii starts a ii–V turnaround immediately.' }
            ],
            ii: [
                { to: 'V', weight: 0.48, reason: 'The essential ii→V dominant preparation.' },
                { to: 'bVII', weight: 0.18, reason: 'Modal mixture for a bluesy side-step.' }
            ],
            V: [
                { to: 'I', weight: 0.42, reason: 'Resolve into tonic for release.' },
                { to: 'ii', weight: 0.24, reason: 'Backcycling keeps turnaround energy alive.' },
                { to: 'bII', weight: 0.2, reason: 'Tritone sub for chromatic tension.' }
            ],
            vi: [
                { to: 'ii', weight: 0.4, reason: 'vi→ii extends the turnaround loop.' },
                { to: 'III', weight: 0.22, reason: 'Cycle-of-fifths up a third adds motion.' }
            ],
            DEFAULT: []
        },
        chordTypes: {
            ii: 'Minor 7th',
            V: 'Dominant 7th',
            I: 'Major 7th',
            vi: 'Minor 7th',
            bII: 'Dominant 7th',
            III: 'Dominant 7th',
            VI: 'Dominant 7th',
            bVII: 'Dominant 7th'
        }
    },
    classical: {
        fallback: [
            { to: 'ii', weight: 0.32, reason: 'Pre-dominant motion prepares authentic cadences.' },
            { to: 'V', weight: 0.38, reason: 'Dominant drive supports classical phrasing.' },
            { to: 'I', weight: 0.24, reason: 'Close the phrase with resolution.' }
        ],
        transitions: {
            I: [
                { to: 'IV', weight: 0.3, reason: 'Modulate toward subdominant territory.' },
                { to: 'ii', weight: 0.28, reason: 'Lead into cadential ii–V combinations.' }
            ],
            ii: [
                { to: 'V', weight: 0.46, reason: 'Classical predominant → dominant pull.' },
                { to: 'VII', weight: 0.18, reason: 'Leading tone chord intensifies cadence.' }
            ],
            IV: [
                { to: 'iio', weight: 0.22, reason: 'Move into diminished predominant for drama.' },
                { to: 'V', weight: 0.38, reason: 'IV→V cadential setup.' }
            ],
            V: [
                { to: 'I', weight: 0.5, reason: 'Authentic cadence for phrase closure.' },
                { to: 'vi', weight: 0.24, reason: 'Deceptive cadence for extension.' }
            ],
            DEFAULT: []
        },
        chordTypes: {
            V: 'Dominant 7th',
            ii: 'Minor',
            iio: 'Diminished',
            VII: 'Diminished',
            vi: 'Minor'
        }
    },
    rock: {
        fallback: [
            { to: 'bVII', weight: 0.38, reason: 'Mixolydian drop makes the groove feel huge.' },
            { to: 'IV', weight: 0.32, reason: 'IV keeps the anthem punching forward.' },
            { to: 'V', weight: 0.26, reason: 'Dominant power chord release.' }
        ],
        transitions: {
            I: [
                { to: 'bVII', weight: 0.44, reason: 'I→♭VII is quintessential arena rock.' },
                { to: 'IV', weight: 0.28, reason: 'I→IV sets up a big chorus lift.' }
            ],
            bVII: [
                { to: 'IV', weight: 0.36, reason: '♭VII→IV keeps the mixolydian loop moving.' },
                { to: 'I', weight: 0.32, reason: 'Snap back into tonic for impact.' }
            ],
            IV: [
                { to: 'V', weight: 0.34, reason: 'IV→V cranks up the drive.' },
                { to: 'I', weight: 0.28, reason: 'IV→I resolves with classic plagal punch.' }
            ],
            V: [
                { to: 'I', weight: 0.42, reason: 'Power cadence release.' },
                { to: 'bVII', weight: 0.26, reason: 'Borrowed dominant keeps it gritty.' }
            ],
            DEFAULT: []
        },
        chordTypes: {
            bVII: 'Major',
            V: 'Power Chord',
            IV: 'Power Chord'
        }
    }
};

const MOOD_MODIFIERS = {
    neutral: {
        boosts: {},
        penalties: {},
        additions: []
    },
    melancholic: {
        boosts: {
            vi: 0.18,
            iv: 0.12,
            ii: 0.1,
            iii: 0.08
        },
        penalties: {
            I: 0.1
        },
        additions: [
            { to: 'iv', weight: 0.22, reason: 'Modal interchange iv adds wistful color.' },
            { to: 'ii', weight: 0.18, reason: 'ii chord softens the descent with gentle motion.' }
        ]
    },
    triumphant: {
        boosts: {
            IV: 0.16,
            V: 0.2,
            I: 0.12
        },
        penalties: {
            vi: 0.08
        },
        additions: [
            { to: 'V', weight: 0.18, reason: 'Dominant drive fuels the triumphant lift.' },
            { to: 'IV', weight: 0.14, reason: 'IV chord widens the texture for a heroic feel.' }
        ]
    },
    mysterious: {
        boosts: {
            ii: 0.12,
            bVII: 0.18,
            iii: 0.11
        },
        penalties: {
            I: 0.12
        },
        additions: [
            { to: 'bII', weight: 0.22, reason: 'Neapolitan color deepens the mystery.' },
            { to: 'vi', weight: 0.14, reason: 'vi keeps the harmony hovering in ambiguity.' }
        ]
    }
};

const FUNCTION_MAP = {
    I: 'Tonic',
    i: 'Tonic',
    vi: 'Tonic',
    VI: 'Tonic',
    iii: 'Tonic',
    III: 'Tonic',
    IV: 'Subdominant',
    iv: 'Subdominant',
    ii: 'Subdominant',
    iio: 'Subdominant',
    V: 'Dominant',
    v: 'Dominant',
    vii: 'Dominant',
    'vii°': 'Dominant',
    VII: 'Dominant',
    bVII: 'Dominant',
    bII: 'Dominant'
};

// -----------------------------------------------------------------------------
// Utility helpers
// -----------------------------------------------------------------------------

function normalizeRoman(rawRoman) {
    if (!rawRoman) return '';
    let working = rawRoman.trim();
    if (!working) return '';

    const accidental = /^[b♭#♯]/.test(working) ? working[0] : '';
    if (accidental) {
        working = working.slice(1);
    }

    const cleaned = working.replace(/[0-9°+#♭♯()]/g, '');
    const accidentalNormalized = accidental === '♭' ? 'b' : accidental === '♯' ? '#' : accidental;
    return `${accidentalNormalized || ''}${cleaned}`;
}

function ensureCandidate(map, roman) {
    if (!map.has(roman)) {
        map.set(roman, {
            roman,
            weight: 0,
            reasons: [],
            tags: new Set(),
            typeOverride: null
        });
    }
    return map.get(roman);
}

function pushCandidate(map, roman, weight, reason, tag, typeOverride) {
    if (!roman || weight <= 0) return;
    const entry = ensureCandidate(map, roman);
    entry.weight += weight;
    if (reason) entry.reasons.push(reason);
    if (tag) entry.tags.add(tag);
    if (!entry.typeOverride && typeOverride) {
        entry.typeOverride = typeOverride;
    }
}

function deriveChordType(styleId, roman) {
    const rules = STYLE_RULES[styleId] || STYLE_RULES.any;
    const normalized = normalizeRoman(roman);

    if (rules.chordTypes && rules.chordTypes[normalized]) {
        return rules.chordTypes[normalized];
    }

    const baseEntry = ROMAN_MAP_BASE[normalized];
    if (baseEntry) {
        return baseEntry.quality;
    }

    // Fallback heuristics
    if (normalized === 'bVII') return 'Major';
    if (normalized === 'bII') return 'Major';
    if (normalized === 'iio') return 'Diminished';
    if (/ii/i.test(normalized)) return 'Minor';
    if (/vi/i.test(normalized)) return 'Minor';
    if (/iii/i.test(normalized)) return 'Minor';
    if (/iv/.test(normalized)) return 'Minor';
    if (/V/.test(normalized)) return 'Dominant 7th';

    return 'Major';
}

function composeReason(entry, styleId, moodId) {
    const reasons = Array.from(new Set(entry.reasons));
    const style = STYLE_PRESETS.find(p => p.id === styleId)?.label || 'Selected';
    const mood = MOOD_PRESETS.find(p => p.id === moodId)?.label || 'Mood';

    const base = reasons.length ? reasons[0] : `${style} flavor supports the current flow.`;
    const extras = reasons.slice(1);

    const extraSentence = extras.length ? ` Also: ${extras.join(' ')}` : '';
    return `${base} (${style} · ${mood}).${extraSentence}`.trim();
}

function clamp01(value) {
    if (Number.isNaN(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

// -----------------------------------------------------------------------------
// Suggestion generation
// -----------------------------------------------------------------------------

export function generateStyleMoodSuggestions({
    progression = [],
    styleId = 'any',
    moodId = 'neutral'
} = {}) {
    const styleKey = STYLE_RULES[styleId] ? styleId : 'any';
    const styleRules = STYLE_RULES[styleKey];
    const candidateMap = new Map();

    const lastChord = progression.length > 0 ? progression[progression.length - 1] : null;
    const lastRoman = lastChord?.roman || 'I';
    const normalizedLast = normalizeRoman(lastRoman) || 'I';

    const transitions = styleRules.transitions[normalizedLast] && styleRules.transitions[normalizedLast].length
        ? styleRules.transitions[normalizedLast]
        : styleRules.transitions.DEFAULT || [];

    transitions.forEach(({ to, weight, reason }) => {
        pushCandidate(candidateMap, to, weight, reason, 'style', styleRules.chordTypes?.[normalizeRoman(to)]);
    });

    // Fallback seeds if we still have few options
    if (candidateMap.size < 3) {
        styleRules.fallback.forEach(({ to, weight, reason }) => {
            pushCandidate(candidateMap, to, weight * 0.85, reason, 'style-seed', styleRules.chordTypes?.[normalizeRoman(to)]);
        });
    }

    // Mood adjustments
    const moodRules = MOOD_MODIFIERS[moodId] || MOOD_MODIFIERS.neutral;
    Object.entries(moodRules.boosts).forEach(([roman, boost]) => {
        const entry = ensureCandidate(candidateMap, roman);
        entry.weight += boost;
        entry.reasons.push(`Mood boost: ${MOOD_PRESETS.find(m => m.id === moodId)?.label || 'Mood'} favors ${roman}.`);
    });
    Object.entries(moodRules.penalties).forEach(([roman, penalty]) => {
        const entry = ensureCandidate(candidateMap, roman);
        entry.weight = Math.max(0, entry.weight - penalty);
        entry.reasons.push(`Mood shift tempers the pull toward ${roman}.`);
    });
    moodRules.additions.forEach(({ to, weight, reason }) => {
        pushCandidate(candidateMap, to, weight, reason, 'mood', styleRules.chordTypes?.[normalizeRoman(to)]);
    });

    // Convert to sorted array
    const suggestions = Array.from(candidateMap.values())
        .map(entry => {
            const normalized = normalizeRoman(entry.roman);
            const type = entry.typeOverride || deriveChordType(styleKey, entry.roman);
            const confidence = clamp01(0.18 + entry.weight);
            return {
                id: `${styleKey}-${moodId}-${normalized}`,
                roman: entry.roman,
                chordType: type,
                confidence: Number(confidence.toFixed(2)),
                reason: composeReason(entry, styleKey, moodId),
                styleId: styleKey,
                moodId,
                tags: Array.from(entry.tags)
            };
        })
        .filter(s => s.confidence > 0.05)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5);

    return {
        suggestions,
        context: {
            lastRoman,
            normalizedLast,
            styleId: styleKey,
            moodId
        }
    };
}

// -----------------------------------------------------------------------------
// Harmonic tension analysis
// -----------------------------------------------------------------------------

export function analyzeTension(progression = []) {
    if (!Array.isArray(progression) || progression.length === 0) {
        return {
            profile: [],
            summary: {
                average: 0,
                peak: 0,
                trend: 'steady',
                descriptor: 'Add chords to see the tension map.'
            }
        };
    }

    const profile = progression.map((chord, index) => {
        const roman = chord?.roman || '?';
        const normalized = normalizeRoman(roman);
        const functionLabel = FUNCTION_MAP[normalized] || 'Neutral';

        let tension = {
            Tonic: 0.18,
            Subdominant: 0.45,
            Dominant: 0.72,
            Neutral: 0.4
        }[functionLabel];

        const type = chord?.type || '';
        const upperType = type.toLowerCase();

        if (upperType.includes('diminished')) tension += 0.22;
        if (upperType.includes('half-diminished')) tension += 0.18;
        if (upperType.includes('augmented')) tension += 0.2;
        if (upperType.includes('7b') || upperType.includes('#5') || upperType.includes('#9')) tension += 0.18;
        if (upperType.includes('dominant')) tension += 0.12;
        if (upperType.includes('minor') && !upperType.includes('diminished')) tension += 0.05;
        if (upperType.includes('major 7')) tension += 0.08;

        if (/^b|♭/.test(roman)) tension += 0.1;
        if (/vi/i.test(normalized) || /iii/i.test(normalized)) tension += 0.04;

        tension = clamp01(tension);

        const level = tension < 0.3 ? 'Calm' : tension < 0.55 ? 'Balanced' : tension < 0.75 ? 'Charged' : 'Tense';

        return {
            index,
            roman,
            type: chord?.type || 'Unknown',
            tension,
            level,
            functionLabel
        };
    });

    const average = profile.reduce((acc, item) => acc + item.tension, 0) / profile.length;
    const peak = Math.max(...profile.map(item => item.tension));
    const start = profile[0]?.tension || 0;
    const end = profile[profile.length - 1]?.tension || 0;
    const delta = end - start;

    let trend;
    if (delta > 0.12) trend = 'building';
    else if (delta < -0.12) trend = 'resolving';
    else trend = 'steady';

    let descriptor;
    if (peak < 0.35) descriptor = 'Very relaxed flow.';
    else if (peak < 0.55) descriptor = 'Gentle rises and falls.';
    else if (peak < 0.75) descriptor = 'Healthy ebb and build of tension.';
    else descriptor = 'Big tension peaks—plan releases deliberately.';

    if (trend === 'building') descriptor += ' Momentum is building—consider a cadence soon.';
    if (trend === 'resolving') descriptor += ' You are easing off tension toward the end.';

    return {
        profile,
        summary: {
            average: Number(clamp01(average).toFixed(2)),
            peak: Number(clamp01(peak).toFixed(2)),
            trend,
            descriptor
        }
    };
}

