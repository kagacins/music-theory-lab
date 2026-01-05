/**
 * MusicXML Exporter Module
 *
 * Exports compositions to MusicXML format for import into
 * professional notation software (MuseScore, Finale, Sibelius, Dorico).
 *
 * Supported Elements:
 * - Notes with pitch, duration, accidentals
 * - Rests
 * - Chord symbols
 * - Key signatures
 * - Time signatures
 * - Clefs (treble, bass)
 * - Measure numbers
 * - Title and composer metadata
 * - Ties
 * - Dynamics (basic)
 * - Multiple voices
 */

import { getCompositionState } from '../state/compositionState.js';
import { getCurrentKey, getProgressionData } from '../state/trainerState.js';
import { CHORD_DEFINITIONS } from '../../data/music-data.js';
import { spellNoteInKey } from '../utils/noteUtils.js';

// =============================================================================
// CONSTANTS
// =============================================================================

// MusicXML duration values (divisions are typically set to 1 per quarter note)
// We'll use 4 divisions per quarter note for better resolution
const DIVISIONS_PER_QUARTER = 4;

// Duration mapping: Tone.js duration -> MusicXML duration (in divisions)
const DURATION_TO_DIVISIONS = {
    '1n': 16,      // whole note = 4 quarters * 4 divisions
    '2n': 8,       // half note = 2 quarters * 4 divisions
    '4n': 4,       // quarter note = 1 quarter * 4 divisions
    '8n': 2,       // eighth note = 0.5 quarter * 4 divisions
    '16n': 1,      // sixteenth note = 0.25 quarter * 4 divisions
    '32n': 0.5,    // 32nd note (may need rounding)
    // Dotted versions
    '1n.': 24,     // dotted whole = 6 quarters
    '2n.': 12,     // dotted half = 3 quarters
    '4n.': 6,      // dotted quarter = 1.5 quarters
    '8n.': 3,      // dotted eighth = 0.75 quarters
    '16n.': 1.5,   // dotted 16th
};

// Duration to MusicXML type name
const DURATION_TO_TYPE = {
    '1n': 'whole',
    '2n': 'half',
    '4n': 'quarter',
    '8n': 'eighth',
    '16n': '16th',
    '32n': '32nd',
    '1n.': 'whole',
    '2n.': 'half',
    '4n.': 'quarter',
    '8n.': 'eighth',
    '16n.': '16th',
};

// Note name to MusicXML step and alter
const NOTE_TO_MUSICXML = {
    'C': { step: 'C', alter: 0 },
    'C#': { step: 'C', alter: 1 },
    'Db': { step: 'D', alter: -1 },
    'D': { step: 'D', alter: 0 },
    'D#': { step: 'D', alter: 1 },
    'Eb': { step: 'E', alter: -1 },
    'E': { step: 'E', alter: 0 },
    'E#': { step: 'F', alter: 0 },  // E# = F
    'Fb': { step: 'E', alter: 0 },  // Fb = E
    'F': { step: 'F', alter: 0 },
    'F#': { step: 'F', alter: 1 },
    'Gb': { step: 'G', alter: -1 },
    'G': { step: 'G', alter: 0 },
    'G#': { step: 'G', alter: 1 },
    'Ab': { step: 'A', alter: -1 },
    'A': { step: 'A', alter: 0 },
    'A#': { step: 'A', alter: 1 },
    'Bb': { step: 'B', alter: -1 },
    'B': { step: 'B', alter: 0 },
    'B#': { step: 'C', alter: 0 },  // B# = C
    'Cb': { step: 'B', alter: 0 },  // Cb = B
};

// Key signature fifths value (positive = sharps, negative = flats)
const KEY_TO_FIFTHS = {
    'C': 0,
    'G': 1,
    'D': 2,
    'A': 3,
    'E': 4,
    'B': 5,
    'F#': 6,
    'Gb': -6,
    'Db': -5,
    'Ab': -4,
    'Eb': -3,
    'Bb': -2,
    'F': -1,
    // Minor keys
    'Am': 0,
    'Em': 1,
    'Bm': 2,
    'F#m': 3,
    'C#m': 4,
    'G#m': 5,
    'D#m': 6,
    'Ebm': -6,
    'Bbm': -5,
    'Fm': -4,
    'Cm': -3,
    'Gm': -2,
    'Dm': -1,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse a note name like "C4" into its components
 * @param {string} noteName - Note name with octave (e.g., "C4", "F#5")
 * @returns {Object} { step, alter, octave }
 */
function parseNoteName(noteName) {
    if (!noteName || typeof noteName !== 'string') {
        return { step: 'C', alter: 0, octave: 4 };
    }

    // Extract note and octave using regex
    const match = noteName.match(/^([A-Ga-g][#b]?)(\d+)?$/);
    if (!match) {
        return { step: 'C', alter: 0, octave: 4 };
    }

    const note = match[1].charAt(0).toUpperCase() + (match[1].slice(1) || '');
    const octave = match[2] ? parseInt(match[2], 10) : 4;

    const xmlNote = NOTE_TO_MUSICXML[note] || { step: 'C', alter: 0 };

    return {
        step: xmlNote.step,
        alter: xmlNote.alter,
        octave: octave
    };
}

/**
 * Get duration in divisions
 * @param {string} duration - Tone.js duration string
 * @param {boolean} dotted - Whether note is dotted
 * @returns {number} Duration in divisions
 */
function getDurationInDivisions(duration, dotted = false) {
    // Normalize duration - remove dot suffix if present (we use dotted flag)
    let baseDuration = duration?.replace('.', '') || '4n';

    // Get base divisions
    let divisions = DURATION_TO_DIVISIONS[baseDuration] || 4;

    // Apply dotted multiplier (1.5x)
    if (dotted || duration?.includes('.')) {
        divisions = divisions * 1.5;
    }

    return Math.round(divisions);
}

/**
 * Get MusicXML duration type
 * @param {string} duration - Tone.js duration string
 * @returns {string} MusicXML type name
 */
function getDurationType(duration) {
    const baseDuration = duration?.replace('.', '') || '4n';
    return DURATION_TO_TYPE[baseDuration] || 'quarter';
}

/**
 * Get chord symbol for MusicXML harmony element
 * @param {Object} chord - Chord object with root and type
 * @param {string} key - Current key for spelling
 * @returns {Object} { root, kind, text }
 */
function getChordHarmony(chord, key) {
    if (!chord || !chord.root) return null;

    const spelledRoot = spellNoteInKey ? spellNoteInKey(chord.root, key) : chord.root;
    const rootParsed = parseNoteName(spelledRoot + '4');

    // Map chord types to MusicXML kind values
    const typeToKind = {
        'Major': 'major',
        'Minor': 'minor',
        'Diminished': 'diminished',
        'Augmented': 'augmented',
        'Dominant 7th': 'dominant',
        'Major 7th': 'major-seventh',
        'Minor 7th': 'minor-seventh',
        'Diminished 7th': 'diminished-seventh',
        'Half-Diminished 7th': 'half-diminished',
        'Minor-Major 7th': 'major-minor',
        'Augmented 7th': 'augmented-seventh',
        'Sus4': 'suspended-fourth',
        'Sus2': 'suspended-second',
        'Major 6th': 'major-sixth',
        'Minor 6th': 'minor-sixth',
        'Add9': 'major',  // Will add degree
        'Dominant 9th': 'dominant-ninth',
        'Major 9th': 'major-ninth',
        'Minor 9th': 'minor-ninth',
        'Dominant 11th': 'dominant-11th',
        'Minor 11th': 'minor-11th',
        'Dominant 13th': 'dominant-13th',
        '6/9': 'major-sixth',
        '7b5': 'dominant',
        '7#5': 'augmented-seventh',
        '7b9': 'dominant',
        '7#9': 'dominant',
        'Major 7th #11': 'major-seventh',
        'Power Chord': 'power',
        'No Chord': 'none',
    };

    const kind = typeToKind[chord.type] || 'major';
    const def = CHORD_DEFINITIONS[chord.type];
    const symbol = def?.symbol || '';

    return {
        rootStep: rootParsed.step,
        rootAlter: rootParsed.alter,
        kind: kind,
        text: spelledRoot + symbol
    };
}

/**
 * Escape XML special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeXml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// =============================================================================
// MUSICXML GENERATION
// =============================================================================

/**
 * Generate MusicXML document from composition state
 * @param {Object} options - Export options
 * @returns {string} MusicXML document as string
 */
export function generateMusicXML(options = {}) {
    const compState = getCompositionState();
    if (!compState) {
        throw new Error('No composition state available');
    }

    const {
        title = 'Untitled Composition',
        composer = 'Music Theory Lab',
        includeChordSymbols = true,
        includeDynamics = true,
    } = options;

    const key = getCurrentKey() || 'C';
    const timeSignature = compState.getTimeSignature();
    const measureCount = compState.getMeasureCount();

    // Start building XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work>
    <work-title>${escapeXml(title)}</work-title>
  </work>
  <identification>
    <creator type="composer">${escapeXml(composer)}</creator>
    <encoding>
      <software>Music Theory Lab</software>
      <encoding-date>${new Date().toISOString().split('T')[0]}</encoding-date>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
      <score-instrument id="P1-I1">
        <instrument-name>Piano</instrument-name>
      </score-instrument>
    </score-part>
  </part-list>
  <part id="P1">
`;

    // Generate measures
    for (let m = 0; m < measureCount; m++) {
        const measure = compState.getMeasure(m);
        if (!measure) continue;

        xml += generateMeasureXML(m, measure, {
            isFirst: m === 0,
            key,
            timeSignature,
            includeChordSymbols,
            includeDynamics,
        });
    }

    xml += `  </part>
</score-partwise>`;

    return xml;
}

/**
 * Generate XML for a single measure
 * @param {number} measureIndex - Measure index (0-based)
 * @param {Object} measure - Measure data
 * @param {Object} options - Options
 * @returns {string} Measure XML
 */
function generateMeasureXML(measureIndex, measure, options) {
    const { isFirst, key, timeSignature, includeChordSymbols, includeDynamics } = options;

    let xml = `    <measure number="${measureIndex + 1}">
`;

    // Attributes (key, time, clef) - only on first measure
    if (isFirst) {
        xml += `      <attributes>
        <divisions>${DIVISIONS_PER_QUARTER}</divisions>
        <key>
          <fifths>${KEY_TO_FIFTHS[key] || 0}</fifths>
        </key>
        <time>
          <beats>${timeSignature?.num || 4}</beats>
          <beat-type>${timeSignature?.denom || 4}</beat-type>
        </time>
        <staves>2</staves>
        <clef number="1">
          <sign>G</sign>
          <line>2</line>
        </clef>
        <clef number="2">
          <sign>F</sign>
          <line>4</line>
        </clef>
      </attributes>
`;
    }

    // Add chord symbol (harmony) if available
    if (includeChordSymbols && measure.chord && measure.chord.root) {
        const harmony = getChordHarmony(measure.chord, key);
        if (harmony && harmony.kind !== 'none') {
            xml += `      <harmony>
        <root>
          <root-step>${harmony.rootStep}</root-step>
${harmony.rootAlter !== 0 ? `          <root-alter>${harmony.rootAlter}</root-alter>\n` : ''}        </root>
        <kind text="${escapeXml(harmony.text)}">${harmony.kind}</kind>
      </harmony>
`;
        }
    }

    // Get treble and bass notes
    const trebleVoices = measure.notation?.treble?.voices || [];
    const bassVoices = measure.notation?.bass?.voices || [];

    // Generate treble staff notes (staff 1)
    xml += generateStaffNotesXML(trebleVoices, 1, timeSignature, includeDynamics);

    // Add backup to return to start of measure for bass staff
    const beatsPerMeasure = (timeSignature?.num || 4) * (4 / (timeSignature?.denom || 4));
    const totalDivisions = beatsPerMeasure * DIVISIONS_PER_QUARTER;

    xml += `      <backup>
        <duration>${totalDivisions}</duration>
      </backup>
`;

    // Generate bass staff notes (staff 2)
    xml += generateStaffNotesXML(bassVoices, 2, timeSignature, includeDynamics);

    xml += `    </measure>
`;

    return xml;
}

/**
 * Generate XML for notes on a staff
 * @param {Array} voices - Voice array
 * @param {number} staffNumber - Staff number (1 or 2)
 * @param {Object} timeSignature - Time signature
 * @param {boolean} includeDynamics - Include dynamics
 * @returns {string} Notes XML
 */
function generateStaffNotesXML(voices, staffNumber, timeSignature, includeDynamics) {
    let xml = '';

    // Process first voice (primary)
    const primaryNotes = voices[0]?.notes || [];

    if (primaryNotes.length === 0) {
        // Add a whole measure rest
        const beatsPerMeasure = (timeSignature?.num || 4) * (4 / (timeSignature?.denom || 4));
        const restDivisions = beatsPerMeasure * DIVISIONS_PER_QUARTER;

        xml += `      <note>
        <rest measure="yes"/>
        <duration>${restDivisions}</duration>
        <voice>1</voice>
        <staff>${staffNumber}</staff>
      </note>
`;
        return xml;
    }

    // Sort notes by beat position
    const sortedNotes = [...primaryNotes].sort((a, b) => (a.beat || 0) - (b.beat || 0));

    for (let i = 0; i < sortedNotes.length; i++) {
        const note = sortedNotes[i];
        xml += generateNoteXML(note, staffNumber, 1, i === 0, includeDynamics);
    }

    // Process additional voices if present
    for (let v = 1; v < voices.length; v++) {
        const voiceNotes = voices[v]?.notes || [];
        if (voiceNotes.length === 0) continue;

        // Backup to start of measure for this voice
        const beatsPerMeasure = (timeSignature?.num || 4) * (4 / (timeSignature?.denom || 4));
        const totalDivisions = beatsPerMeasure * DIVISIONS_PER_QUARTER;

        xml += `      <backup>
        <duration>${totalDivisions}</duration>
      </backup>
`;

        const sortedVoiceNotes = [...voiceNotes].sort((a, b) => (a.beat || 0) - (b.beat || 0));
        for (let i = 0; i < sortedVoiceNotes.length; i++) {
            xml += generateNoteXML(sortedVoiceNotes[i], staffNumber, v + 1, i === 0, includeDynamics);
        }
    }

    return xml;
}

/**
 * Generate XML for a single note or chord
 * @param {Object} note - Note object
 * @param {number} staffNumber - Staff number
 * @param {number} voiceNumber - Voice number
 * @param {boolean} isFirstInVoice - Is first note in voice
 * @param {boolean} includeDynamics - Include dynamics
 * @returns {string} Note XML
 */
function generateNoteXML(note, staffNumber, voiceNumber, isFirstInVoice, includeDynamics) {
    let xml = '';

    if (note.isRest || note.type === 'rest') {
        // Rest
        const divisions = getDurationInDivisions(note.duration, note.dotted);
        const durationType = getDurationType(note.duration);

        xml += `      <note>
        <rest/>
        <duration>${divisions}</duration>
        <voice>${voiceNumber}</voice>
        <type>${durationType}</type>
${note.dotted ? '        <dot/>\n' : ''}        <staff>${staffNumber}</staff>
      </note>
`;
        return xml;
    }

    // Handle chord (multiple pitches)
    const pitches = note.pitches || (note.pitch ? [note.pitch] : ['C4']);

    for (let p = 0; p < pitches.length; p++) {
        const pitch = pitches[p];
        const parsedPitch = parseNoteName(pitch);
        const divisions = getDurationInDivisions(note.duration, note.dotted);
        const durationType = getDurationType(note.duration);

        xml += `      <note>
`;

        // Add chord indicator for additional pitches
        if (p > 0) {
            xml += `        <chord/>
`;
        }

        xml += `        <pitch>
          <step>${parsedPitch.step}</step>
${parsedPitch.alter !== 0 ? `          <alter>${parsedPitch.alter}</alter>\n` : ''}          <octave>${parsedPitch.octave}</octave>
        </pitch>
        <duration>${divisions}</duration>
`;

        // Add tie start
        if (note.tied || note.isTied === false && note.tieStart) {
            xml += `        <tie type="start"/>
`;
        }

        // Add tie stop
        if (note.isTied) {
            xml += `        <tie type="stop"/>
`;
        }

        xml += `        <voice>${voiceNumber}</voice>
        <type>${durationType}</type>
${note.dotted ? '        <dot/>\n' : ''}        <staff>${staffNumber}</staff>
`;

        // Add notations (ties, dynamics, etc.)
        const hasNotations = note.tied || note.isTied || (includeDynamics && note.dynamic);
        if (hasNotations) {
            xml += `        <notations>
`;
            if (note.tied) {
                xml += `          <tied type="start"/>
`;
            }
            if (note.isTied) {
                xml += `          <tied type="stop"/>
`;
            }
            if (includeDynamics && note.dynamic) {
                xml += `          <dynamics>
            <${note.dynamic}/>
          </dynamics>
`;
            }
            xml += `        </notations>
`;
        }

        xml += `      </note>
`;
    }

    return xml;
}

// =============================================================================
// EXPORT FUNCTIONS
// =============================================================================

/**
 * Export composition to MusicXML and trigger download
 * @param {Object} options - Export options
 */
export function exportToMusicXML(options = {}) {
    try {
        const xml = generateMusicXML(options);
        downloadMusicXMLFile(xml, options.filename || 'composition.musicxml');
        return { success: true };
    } catch (error) {
        console.error('[MusicXML Export] Error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Download MusicXML file
 * @param {string} xmlContent - MusicXML content
 * @param {string} filename - Filename
 */
function downloadMusicXMLFile(xmlContent, filename) {
    const blob = new Blob([xmlContent], { type: 'application/vnd.recordare.musicxml+xml' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.musicxml') ? filename : `${filename}.musicxml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

/**
 * Get MusicXML as string (for preview or other uses)
 * @param {Object} options - Export options
 * @returns {string} MusicXML content
 */
export function getMusicXMLString(options = {}) {
    return generateMusicXML(options);
}

/**
 * Validate that export is possible
 * @returns {Object} { canExport, reason }
 */
export function canExportMusicXML() {
    const compState = getCompositionState();

    if (!compState) {
        return { canExport: false, reason: 'No composition state available' };
    }

    const measureCount = compState.getMeasureCount();
    if (measureCount === 0) {
        return { canExport: false, reason: 'No measures to export' };
    }

    return { canExport: true, reason: null };
}
