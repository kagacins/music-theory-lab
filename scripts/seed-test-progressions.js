/**
 * Seed Test Progressions Script
 *
 * Populates the database with test progressions for testing the variant system.
 * Creates variations of common progressions with different inversions and durations.
 *
 * Usage: node scripts/seed-test-progressions.js
 *
 * Requirements:
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * - Or create a .env file in the project root
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// Load environment variables (for local testing)
// Try .env.local first, then .env
import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // Also try .env as fallback

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
    console.error('Create a .env file with these values or set them in your environment');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to generate SHA-256 hash
function sha256(str) {
    return createHash('sha256').update(str).digest('hex');
}

// Chord definitions for building progressions
const CHORD_INTERVALS = {
    'Major': [0, 4, 7],
    'Minor': [0, 3, 7],
    'Dominant 7th': [0, 4, 7, 10],
    'Major 7th': [0, 4, 7, 11],
    'Minor 7th': [0, 3, 7, 10]
};

// Note to MIDI mapping
const NOTE_TO_MIDI = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
    'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
    'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

const MIDI_TO_NOTE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Generate chord notes with specific octave and inversion
function generateChordNotes(root, type, octave = 3, inversion = 0) {
    const rootMidi = NOTE_TO_MIDI[root];
    const intervals = CHORD_INTERVALS[type] || CHORD_INTERVALS['Major'];

    // Generate base notes
    let notes = intervals.map(interval => {
        const midi = rootMidi + interval;
        const noteName = MIDI_TO_NOTE[midi % 12];
        const noteOctave = octave + Math.floor(midi / 12);
        return `${noteName}${noteOctave}`;
    });

    // Apply inversion by moving bottom notes up an octave
    for (let i = 0; i < inversion && i < notes.length; i++) {
        const note = notes[i];
        const match = note.match(/^([A-G]#?)(\d+)$/);
        if (match) {
            notes[i] = `${match[1]}${parseInt(match[2]) + 1}`;
        }
    }

    // Sort by pitch for proper voicing
    notes.sort((a, b) => {
        const aMatch = a.match(/^([A-G]#?)(\d+)$/);
        const bMatch = b.match(/^([A-G]#?)(\d+)$/);
        const aOct = parseInt(aMatch[2]);
        const bOct = parseInt(bMatch[2]);
        if (aOct !== bOct) return aOct - bOct;
        return NOTE_TO_MIDI[aMatch[1]] - NOTE_TO_MIDI[bMatch[1]];
    });

    return notes;
}

// Generate normalized chord string for hashing
function normalizeChord(root, type, key) {
    // Simple scale degree calculation (assuming major key)
    const keyMidi = NOTE_TO_MIDI[key];
    const rootMidi = NOTE_TO_MIDI[root];
    const degree = ((rootMidi - keyMidi + 12) % 12);

    const degreeNames = {
        0: 'I', 2: 'II', 4: 'III', 5: 'IV', 7: 'V', 9: 'VI', 11: 'VII',
        1: 'bII', 3: 'bIII', 6: 'bV', 8: 'bVI', 10: 'bVII'
    };

    const qualityMap = {
        'Major': 'maj',
        'Minor': 'min',
        'Dominant 7th': '7',
        'Major 7th': 'maj7',
        'Minor 7th': 'min7'
    };

    return `${degreeNames[degree] || degree}${qualityMap[type] || 'maj'}`;
}

// Generate base hash (chord sequence only)
function generateBaseHash(chords, key) {
    const normalized = chords.map(c => normalizeChord(c.root, c.type, key));
    return sha256(normalized.join('-'));
}

// Generate variant hash (includes durations and inversions)
function generateVariantHash(chords, key) {
    const normalized = chords.map(c => {
        const base = normalizeChord(c.root, c.type, key);
        return `${base}:${c.beats}:${c.inversion || 0}`;
    });
    return sha256(normalized.join('-'));
}

// Generate normalized progression string for display
function generateNormalizedProgression(chords, key) {
    return chords.map(c => normalizeChord(c.root, c.type, key)).join(' - ');
}

// Create composition data format
function createCompositionData(chords, key, tempo = 120) {
    const progressionData = chords.map(chord => ({
        root: chord.root,
        type: chord.type,
        beats: chord.beats,
        inversion: chord.inversion || 0,
        notes: generateChordNotes(chord.root, chord.type, 3, chord.inversion || 0)
    }));

    return {
        formatVersion: '1.1.0',
        submissionType: 'chord-progression',
        metadata: {
            tempo,
            timeSignature: { num: 4, denom: 4 },
            key
        },
        progressionData
    };
}

// I-V-vi-IV Progression Variations (in C major)
const popProgressionVariations = [
    {
        title: 'Pop Progression - Classic',
        description: 'The classic I-V-vi-IV progression in root position with even durations.',
        chords: [
            { root: 'C', type: 'Major', beats: 4, inversion: 0 },
            { root: 'G', type: 'Major', beats: 4, inversion: 0 },
            { root: 'A', type: 'Minor', beats: 4, inversion: 0 },
            { root: 'F', type: 'Major', beats: 4, inversion: 0 }
        ],
        key: 'C',
        category: 'original'
    },
    {
        title: 'Pop Progression - Smooth Voice Leading',
        description: 'I-V-vi-IV with inversions for smoother voice leading.',
        chords: [
            { root: 'C', type: 'Major', beats: 4, inversion: 0 },
            { root: 'G', type: 'Major', beats: 4, inversion: 1 },
            { root: 'A', type: 'Minor', beats: 4, inversion: 1 },
            { root: 'F', type: 'Major', beats: 4, inversion: 2 }
        ],
        key: 'C',
        category: 'arrangement'
    },
    {
        title: 'Pop Progression - Half Time Feel',
        description: 'I-V-vi-IV with longer chord durations for a half-time feel.',
        chords: [
            { root: 'C', type: 'Major', beats: 8, inversion: 0 },
            { root: 'G', type: 'Major', beats: 8, inversion: 0 },
            { root: 'A', type: 'Minor', beats: 8, inversion: 0 },
            { root: 'F', type: 'Major', beats: 8, inversion: 0 }
        ],
        key: 'C',
        category: 'arrangement'
    },
    {
        title: 'Pop Progression - Quick Changes',
        description: 'I-V-vi-IV with faster chord changes (2 beats each).',
        chords: [
            { root: 'C', type: 'Major', beats: 2, inversion: 0 },
            { root: 'G', type: 'Major', beats: 2, inversion: 0 },
            { root: 'A', type: 'Minor', beats: 2, inversion: 0 },
            { root: 'F', type: 'Major', beats: 2, inversion: 0 }
        ],
        key: 'C',
        category: 'arrangement'
    },
    {
        title: 'Pop Progression - Jazz Voicings',
        description: 'I-V-vi-IV with seventh chords and varied inversions.',
        chords: [
            { root: 'C', type: 'Major 7th', beats: 4, inversion: 0 },
            { root: 'G', type: 'Dominant 7th', beats: 4, inversion: 2 },
            { root: 'A', type: 'Minor 7th', beats: 4, inversion: 1 },
            { root: 'F', type: 'Major 7th', beats: 4, inversion: 1 }
        ],
        key: 'C',
        category: 'arrangement'
    }
];

// i-VII-VI-V Andalusian Cadence Variations (in A minor)
const andalusianVariations = [
    {
        title: 'Andalusian Cadence - Classic',
        description: 'The classic Andalusian cadence i-VII-VI-V in root position.',
        chords: [
            { root: 'A', type: 'Minor', beats: 4, inversion: 0 },
            { root: 'G', type: 'Major', beats: 4, inversion: 0 },
            { root: 'F', type: 'Major', beats: 4, inversion: 0 },
            { root: 'E', type: 'Major', beats: 4, inversion: 0 }
        ],
        key: 'A',
        category: 'original'
    },
    {
        title: 'Andalusian Cadence - Flamenco Style',
        description: 'Andalusian cadence with inversions typical of flamenco guitar.',
        chords: [
            { root: 'A', type: 'Minor', beats: 4, inversion: 0 },
            { root: 'G', type: 'Major', beats: 4, inversion: 1 },
            { root: 'F', type: 'Major', beats: 4, inversion: 1 },
            { root: 'E', type: 'Major', beats: 4, inversion: 0 }
        ],
        key: 'A',
        category: 'arrangement'
    },
    {
        title: 'Andalusian Cadence - Double Time',
        description: 'Fast Andalusian cadence with 2-beat chords.',
        chords: [
            { root: 'A', type: 'Minor', beats: 2, inversion: 0 },
            { root: 'G', type: 'Major', beats: 2, inversion: 0 },
            { root: 'F', type: 'Major', beats: 2, inversion: 0 },
            { root: 'E', type: 'Major', beats: 2, inversion: 0 }
        ],
        key: 'A',
        category: 'arrangement'
    },
    {
        title: 'Andalusian Cadence - Extended',
        description: 'Andalusian with longer tonic and dominant for dramatic effect.',
        chords: [
            { root: 'A', type: 'Minor', beats: 6, inversion: 0 },
            { root: 'G', type: 'Major', beats: 4, inversion: 0 },
            { root: 'F', type: 'Major', beats: 4, inversion: 0 },
            { root: 'E', type: 'Major', beats: 6, inversion: 0 }
        ],
        key: 'A',
        category: 'arrangement'
    },
    {
        title: 'Andalusian Cadence - Smooth Bass',
        description: 'Andalusian with inversions creating a smooth descending bass line.',
        chords: [
            { root: 'A', type: 'Minor', beats: 4, inversion: 0 },
            { root: 'G', type: 'Major', beats: 4, inversion: 2 },
            { root: 'F', type: 'Major', beats: 4, inversion: 1 },
            { root: 'E', type: 'Major', beats: 4, inversion: 0 }
        ],
        key: 'A',
        category: 'arrangement'
    }
];

async function seedProgressions() {
    console.log('Starting to seed test progressions...\n');

    // First, we need a user ID to associate with submissions
    // For testing, we'll use a service account or create submissions without user_id
    // Let's check if we have any existing user
    const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .limit(1);

    let userId = null;
    if (profiles && profiles.length > 0) {
        userId = profiles[0].id;
        console.log(`Using existing user: ${profiles[0].display_name} (${userId})\n`);
    } else {
        console.log('No existing users found. Submissions will need a user_id.');
        console.log('Please sign in to the app first to create a user profile.\n');
        process.exit(1);
    }

    const allVariations = [...popProgressionVariations, ...andalusianVariations];
    let successCount = 0;
    let skipCount = 0;

    for (const variation of allVariations) {
        const baseHash = generateBaseHash(variation.chords, variation.key);
        const variantHash = generateVariantHash(variation.chords, variation.key);
        const normalizedProgression = generateNormalizedProgression(variation.chords, variation.key);
        const compositionData = createCompositionData(variation.chords, variation.key);

        // Check if this exact variant already exists
        const { data: existing } = await supabase
            .from('submissions')
            .select('id, title')
            .eq('variant_hash', variantHash)
            .limit(1);

        if (existing && existing.length > 0) {
            console.log(`⏭️  Skipping "${variation.title}" - already exists`);
            skipCount++;
            continue;
        }

        // Find parent submission (first submission with same base_hash)
        let parentSubmissionId = null;
        let isVariant = false;

        const { data: parentSubmission } = await supabase
            .from('submissions')
            .select('id')
            .eq('base_hash', baseHash)
            .order('created_at', { ascending: true })
            .limit(1);

        if (parentSubmission && parentSubmission.length > 0) {
            parentSubmissionId = parentSubmission[0].id;
            isVariant = true;
        }

        const insertData = {
            user_id: userId,
            title: variation.title,
            description: variation.description,
            submission_type: 'chord-progression',
            category: variation.category,
            key_signature: variation.key,
            time_signature_num: 4,
            time_signature_denom: 4,
            bpm: 120,
            chord_count: variation.chords.length,
            measure_count: Math.ceil(variation.chords.reduce((sum, c) => sum + c.beats, 0) / 4),
            progression_hash: baseHash,
            base_hash: baseHash,
            variant_hash: variantHash,
            normalized_progression: normalizedProgression,
            composition_data: compositionData,
            status: 'published',
            is_variant: isVariant,
            parent_submission_id: parentSubmissionId
        };

        const { data, error } = await supabase
            .from('submissions')
            .insert(insertData)
            .select('id')
            .single();

        if (error) {
            console.error(`❌ Error inserting "${variation.title}":`, error.message);

            // Try without variant columns if they don't exist
            if (error.message.includes('base_hash') || error.message.includes('variant_hash')) {
                delete insertData.base_hash;
                delete insertData.variant_hash;
                delete insertData.is_variant;
                delete insertData.parent_submission_id;

                const { data: retryData, error: retryError } = await supabase
                    .from('submissions')
                    .insert(insertData)
                    .select('id')
                    .single();

                if (retryError) {
                    console.error(`   Retry also failed:`, retryError.message);
                } else {
                    console.log(`✅ Inserted "${variation.title}" (without variant columns)`);
                    successCount++;
                }
            }
        } else {
            const variantLabel = isVariant ? ' (variant)' : ' (original)';
            console.log(`✅ Inserted "${variation.title}"${variantLabel}`);
            successCount++;
        }
    }

    console.log(`\n========================================`);
    console.log(`Seeding complete!`);
    console.log(`  ✅ Successfully inserted: ${successCount}`);
    console.log(`  ⏭️  Skipped (already exist): ${skipCount}`);
    console.log(`========================================\n`);
}

// Run the seeding
seedProgressions().catch(console.error);
