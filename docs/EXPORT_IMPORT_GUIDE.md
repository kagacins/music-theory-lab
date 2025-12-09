# Export & Import Guide

Music Theory Lab provides multiple ways to save, share, and transfer your compositions. This guide covers all available export and import options.

---

## Overview

| Format | Export | Import | Contents | Best For |
|--------|--------|--------|----------|----------|
| `.imtl` Project | Yes | Yes | Everything | Full save/restore |
| MIDI (`.mid`) | Yes | Yes | Chords, Melody, Bass | DAW integration |
| PDF (Lead Sheet) | Yes | No | Chord chart | Printing chord charts |
| PDF (Notation) | Yes | No | Sheet music | Printing full notation |
| PDF (Combined) | Yes | No | Both formats | Complete documentation |
| Shareable Link | Yes | Yes | Chords + Key | Quick sharing |

---

## Project Files (`.imtl`)

### What's Included
- Complete chord progression with all properties
- Melody/treble notation (all voices)
- Bass line notation (all voices)
- Song sections (Intro, Verse, Chorus, etc.)
- Tempo, key signature, time signature
- Composition settings

### How to Save
1. Click **File** in the action bar
2. Select **Save**
3. Choose a location and filename
4. File saves as `filename.imtl`

### How to Load
1. Click **File** in the action bar
2. Select **Load**
3. Browse to your `.imtl` file
4. Composition loads with all data intact

### Use Cases
- Saving work in progress
- Creating backups
- Sharing complete compositions with other IMTL users

---

## MIDI Export

### What's Included
MIDI export creates a multi-track Standard MIDI File (SMF) with up to three tracks:

| Track | Channel | Instrument | Content |
|-------|---------|------------|---------|
| Chords | 1 | Piano (GM 1) | Chord voicings from progression |
| Melody | 2 | Piano (GM 1) | Notes from treble staff |
| Bass | 3 | Acoustic Bass (GM 33) | Notes from bass staff |

### How to Export
1. Click **File** in the action bar
2. Select **Export MIDI**
3. Configure options:
   - **Filename**: Name for the exported file
   - **Tempo**: BPM (defaults to composition tempo)
   - **Include Tracks**: Check which tracks to include
     - Chord Progression (shows chord count)
     - Melody (disabled if no treble notes)
     - Bass Line (disabled if no bass notes)
4. Click **Export MIDI**
5. File downloads as `filename.mid`

### Track Details

**Chord Track**
- Each chord plays as a block chord (all notes simultaneously)
- Duration matches chord length in progression
- Velocity: 70

**Melody Track**
- Includes all voices from treble staff
- Preserves note durations and timing
- Rests are not exported (gaps in the track)
- Velocity: 80

**Bass Track**
- Includes all voices from bass staff
- Preserves note durations and timing
- Velocity: 85

### Compatibility
Exported MIDI files are compatible with:
- DAWs: Ableton Live, Logic Pro, FL Studio, Pro Tools, Reaper, etc.
- Notation software: MuseScore, Finale, Sibelius
- Other MIDI applications

---

## MIDI Import

### What's Detected
The MIDI import analyzes simultaneous notes to detect chords:

**Supported Chord Types**
- Major, Minor
- Major 7th, Minor 7th, Dominant 7th
- Diminished, Diminished 7th, Half-Diminished 7th
- Augmented
- Sus2, Sus4
- Major 6th, Minor 6th
- Add9

**Inversion Detection**
- Root position, 1st inversion, and 2nd inversion
- Based on the lowest sounding note

### How to Import
1. Click **File** in the action bar
2. Select **Import MIDI**
3. Browse to a `.mid` or `.midi` file
4. Review the confirmation dialog showing detected chord count
5. Click **OK** to add chords to your progression

### Import Behavior
- Chords are **added** to your existing progression (not replaced)
- Consecutive duplicate chords are filtered out
- Notes must occur simultaneously to be detected as a chord
- Single notes (melodies) are not imported as chords
- Tempo and time signature from MIDI are extracted but not applied

### Tips for Best Results
- MIDI files with clear chord voicings import best
- Files exported from IMTL will re-import accurately
- Complex arrangements may need manual cleanup
- Arpeggiated chords may not be detected (notes must be simultaneous)

---

## PDF Export

Music Theory Lab offers three PDF export modes:

### Export Modes

| Mode | Description | Best For |
|------|-------------|----------|
| Lead Sheet Only | Chord symbols in a grid layout | Quick reference, band charts |
| Musical Notation Only | Full staff notation with notes | Sheet music printing |
| Lead Sheet + Notation | Combined multi-page document | Complete package |

### Lead Sheet Export

**What's Included:**
- Chord symbols in a grid layout
- Key signature
- Measure numbers
- Title and composer (optional)
- "Created with Music Theory Lab" footer

**Layout Options:**

| Chords/Line | Best For |
|-------------|----------|
| 2 | Large, readable charts |
| 4 | Standard lead sheets |
| 6 | Compact single-page charts |
| 8 | Very compact reference sheets |

### Musical Notation Export

**What's Included:**
- Full grand staff (treble and bass clef)
- All notes as written in the Melody Composer
- Optional section brackets under bass clef
- Optional chord labels under bass clef
- Optional section coloring

**Notation Options:**
- **Include section brackets**: Shows structural brackets under the bass clef marking sections (Intro, Verse, Chorus, etc.)
- **Include chord labels**: Displays chord symbols under the bass clef for each measure
- **Include section coloring**: Applies color coding to notes based on their harmonic function

### How to Export
1. Click **File** in the action bar
2. Select **Export PDF**
3. Choose your export mode:
   - **Lead Sheet Only**: Chord chart format
   - **Musical Notation Only**: Sheet music with staff notation
   - **Lead Sheet + Notation**: Both formats in one PDF
4. Configure the relevant options for your chosen mode
5. Click **Export PDF**
6. File downloads with appropriate suffix (`_lead_sheet.pdf`, `_notation.pdf`, or `_complete.pdf`)

### Use Cases
- **Lead Sheet**: Printing chord charts for rehearsal, creating handouts for students
- **Musical Notation**: Creating professional sheet music, archiving compositions
- **Combined**: Sharing complete works with both chord reference and full notation

---

## Shareable Links

### What's Included
- Chord progression (root, type, inversion for each chord)
- Key signature

### How to Share
1. Click **File** in the action bar
2. Select **Copy Link**
3. Link is copied to clipboard
4. Share via email, message, etc.

### Link Format
```
https://yoursite.com/?key=C&prog=C.Major.0,G.Major.0,Am.Minor.0,F.Major.0
```

### How to Open Shared Links
1. Click or paste the shared link in your browser
2. Progression loads automatically
3. URL is cleaned after loading (removes parameters)

### Limitations
- Only includes chord progression and key
- Does not include melody, bass, sections, or tempo
- Very long progressions create very long URLs

---

## Comparison: When to Use Each Format

### Use `.imtl` Project When:
- Saving work to continue later
- Backing up compositions
- Sharing complete works with other IMTL users
- You need to preserve everything

### Use MIDI Export When:
- Importing into a DAW for production
- Sharing with musicians who use other software
- Creating backing tracks
- Archiving in a universal format

### Use MIDI Import When:
- Analyzing chord progressions from existing MIDI files
- Converting DAW projects to IMTL
- Importing progressions created elsewhere

### Use PDF Export When:
- Printing charts for rehearsal
- Creating handouts for students
- Quick visual documentation

### Use Shareable Links When:
- Quick sharing via text/email
- Embedding in blog posts or social media
- Sharing with someone who just needs chords

---

## Technical Details

### MIDI Specifications
- Format: Standard MIDI File (SMF) Type 1
- Resolution: 128 ticks per quarter note
- Channels: 1 (Chords), 2 (Melody), 3 (Bass)

### PDF Specifications
- Format: PDF 1.4
- Page size: Letter (8.5" x 11")
- Orientation: Portrait
- Library: jsPDF

### Shareable Link Encoding
- Parameters: `key` (key signature), `prog` (progression)
- Progression format: `Root.Type.Inversion` comma-separated
- Spaces in chord types replaced with underscores

---

## Troubleshooting

### MIDI Export Issues

**"MIDI export library not loaded"**
- Refresh the page and try again
- Check that MidiWriterJS CDN is accessible

**Melody/Bass tracks are empty**
- Ensure you have notes in the notation editor
- Check that the checkboxes aren't disabled (grayed out)

### MIDI Import Issues

**"No chords detected"**
- MIDI may contain only single-note melodies
- Chords may be arpeggiated (not simultaneous)
- Try a different MIDI file

**Wrong chords detected**
- Complex voicings may be misinterpreted
- Extended chords may be simplified
- Manually adjust after import

### PDF Export Issues

**"PDF export library not loaded"**
- Refresh the page and try again
- Check that jsPDF CDN is accessible

### Shareable Link Issues

**Link doesn't load progression**
- URL may have been truncated
- Parameters may be malformed
- Try copying the full link again

---

## Future Enhancements

Planned improvements for future versions:
- MusicXML export/import
- Audio export (WAV/MP3)
- Cloud save/sync
- Collaboration features
