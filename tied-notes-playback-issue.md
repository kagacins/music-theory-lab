# Tied Notes Playback Issue - Problem Summary

## Application Context
Music Theory Lab - A web application for composing and playing chord progressions with variable durations and proper music notation using VexFlow 5.x and Tone.js for audio.

## The Problem

**Primary Issue:** Chords with ties across measure boundaries stop playing at the measure change instead of continuing for their full duration.

**Specific Example:**
- Pattern: 6-4-4-4 (beats per chord)
- Time signature: 4/4
- Tempo: 120 BPM
- Expected behavior:
  - Chord 0: 6 beats (whole note in measure 0 + half note tied in measure 1) = 3 seconds
  - Chord 1: 4 beats (half note in measure 1 beat 2 + half note tied in measure 2) = 2 seconds
  - Chord 2: 4 beats (half note in measure 2 beat 2 + half note tied in measure 3) = 2 seconds
  - Chord 3: 4 beats (half note in measure 3 beat 2 + half note tied in measure 4) = 2 seconds

**Actual behavior:**
- First chord (6 beats) stops after 4 beats (at the measure boundary)
- Remaining tied chords (4 beats each) seem to continue through measure boundaries correctly

## Technical Architecture

### Key Components

1. **compositionState.js** - Single source of truth for chord data
   - Handles splitting chords across measure boundaries
   - Creates tied notes when a chord's duration exceeds measure capacity
   - Assigns `chordIndex` to each bass note to track which chord it belongs to

2. **melodyGenerator.js** - Audio playback engine
   - Uses Tone.js to schedule and play notes
   - Tracks currently playing notes
   - Detects chord changes and releases previous chord

3. **audioEngine.js** - Piano sampler configuration
   - Uses Salamander piano sampler
   - Has `release: 1` (1-second release envelope)

### Data Flow

1. User sets chord durations (e.g., 6-4-4-4 beats)
2. `compositionState.syncWithProgressionData()` splits chords across measures:
   ```
   Measure 0: Chord 0 (4 beats, whole note)
   Measure 1: Chord 0 tied (2 beats, half note) + Chord 1 (2 beats, half note)
   Measure 2: Chord 1 tied (2 beats, half note) + Chord 2 (2 beats, half note)
   Measure 3: Chord 2 tied (2 beats, half note) + Chord 3 (2 beats, half note)
   Measure 4: Chord 3 tied (2 beats, half note)
   ```
3. Each bass note gets `chordIndex` property to identify which chord it belongs to
4. `melodyGenerator.js` schedules playback events for each bass note
5. On first bass note of a NEW chord, it calculates total duration including tied notes
6. Plays the chord with calculated duration

## Relevant Code Sections

### compositionState.js - Adding chordIndex to bass notes

```javascript
// Lines 510-518
const chordNote = {
    type: 'note',
    pitches: [...voicedNotes], // Use voicedNotes (filtered by omittedNotes)
    duration: duration,
    beat: currentBeatInMeasure,
    dotted: duration.includes('.'),
    isTied: !isFirstSegmentOfChord, // Tied if not the first segment
    chordIndex: chordIndex // Track which chord this note belongs to
};
```

### melodyGenerator.js - Chord change detection

```javascript
// Lines 3871-3895
const chordIndex = specificNote?.chordIndex ?? chord.chordIndex;

// Detect if this is a new chord (before updating lastChordIndex)
const isNewChord = chordIndex !== lastChordIndex;

// Only release previous chord if we're starting a DIFFERENT chord
if (currentlyPlayingChordNotes.length > 0 && isNewChord) {
    try {
        piano.releaseAll(time);
        console.log(`[Release] Released previous chord ${lastChordIndex} at time=${time}s (measure ${measureIndex}), starting chord ${chordIndex}`);
    } catch (e) {
        // Ignore errors
    }
    currentlyPlayingChordNotes = [];
} else {
    console.log(`[PlayAll] Playing chord ${chordIndex} at measure ${measureIndex}, beat ${specificNote?.beat || 0}, isNewChord=${isNewChord}, lastChordIndex=${lastChordIndex}`);
}

lastChordIndex = chordIndex;
```

### melodyGenerator.js - Duration calculation with look-ahead

```javascript
// Lines 3946-3978
// Calculate full duration including tied notes (only for first bass note)
let totalDuration = Tone.Time(bassNote.duration).toSeconds();

if (bassNoteIndex === 0 && !bassNote.isTied && window.getCompositionState) {
    const compositionState = window.getCompositionState();
    console.log(`[Duration] Chord ${chordIndex} at measure ${measureIndex}: calculating total duration, starting with ${totalDuration}s`);

    // Look ahead to find tied continuations of this chord
    let nextMeasureIndex = measureIndex + 1;
    while (nextMeasureIndex < compositionState.getMeasureCount()) {
        const nextMeasure = compositionState.getMeasure(nextMeasureIndex);
        const nextBassVoice = nextMeasure?.notation?.bass?.voices?.[0];
        const nextNote = nextBassVoice?.notes?.[0];

        // Check if the next measure starts with a tied note (continuation of THIS chord)
        // Must verify chordIndex matches to avoid adding tied notes from other chords
        if (nextNote && nextNote.isTied && nextNote.beat === 0 && nextNote.chordIndex === chordIndex) {
            const addedDuration = Tone.Time(nextNote.duration).toSeconds();
            console.log(`[Duration]   Found tied continuation at measure ${nextMeasureIndex} (chordIndex=${nextNote.chordIndex}), adding ${addedDuration}s`);
            totalDuration += addedDuration;
            nextMeasureIndex++;
        } else {
            const reason = !nextNote ? 'no note' :
                          !nextNote.isTied ? 'not tied' :
                          nextNote.beat !== 0 ? 'not at beat 0' :
                          nextNote.chordIndex !== chordIndex ? `different chord (${nextNote.chordIndex} vs ${chordIndex})` :
                          'unknown';
            console.log(`[Duration]   No more tied continuations at measure ${nextMeasureIndex} (${reason})`);
            break;
        }
    }
    chordTotalDuration = totalDuration;
    console.log(`[Duration] Chord ${chordIndex} total duration: ${chordTotalDuration}s`);
}
```

### melodyGenerator.js - Playing the note

```javascript
// Lines 3980-3983
// Play the bass note(s) with the exact calculated duration
// Use the totalDuration which includes tied notes for the first bass note
// For continuation notes (isTied), just use the single note duration
piano.triggerAttackRelease(notesToPlay, totalDuration, bassTime);
```

## Attempts to Fix

### Attempt 1: Using triggerAttack without explicit release
**Rationale:** Let notes sustain indefinitely, then call `releaseAll()` when next chord starts.

**Problem:** Notes stopped at measure boundaries anyway. Suspected the piano sampler's `release: 1` envelope caused notes to decay even without explicit release.

### Attempt 2: Using triggerAttackRelease with 60-second duration
**Rationale:** Give notes a very long duration to ensure they sustain, then use `releaseAll()` to stop them early.

**Problem:** `releaseAll()` doesn't interrupt notes that were started with `triggerAttackRelease` - they continue for their full duration.

### Attempt 3: Using triggerAttackRelease with calculated totalDuration (CURRENT)
**Rationale:** Play notes for exactly their calculated duration including ties.

**Problem:** First chord (6 beats) still stops after 4 beats instead of 6 beats. Other chords seem to work correctly.

## Console Logs from Testing (Pattern 6-4-4-4)

```
[Duration] Chord 0 at measure 0: calculating total duration, starting with 2s
[Duration]   Found tied continuation at measure 1 (chordIndex=0), adding 1s
[Duration]   No more tied continuations at measure 2 (different chord (1 vs 0))
[Duration] Chord 0 total duration: 3s
[Track] Added notes to tracking for chord 0: ['C3', 'E3', 'G3'] total tracked: 3

[PlayAll] Playing chord 0 at measure 1, beat 0, isNewChord=false, lastChordIndex=0
[Track] NOT tracking notes: bassNoteIndex=0, isNewChord=false

[Release] Released previous chord 0 at time=42.24s (measure 1), starting chord 1
[Duration] Chord 1 at measure 1: calculating total duration, starting with 1s
[Duration]   Found tied continuation at measure 2 (chordIndex=1), adding 1s
[Duration]   No more tied continuations at measure 3 (different chord (2 vs 1))
[Duration] Chord 1 total duration: 2s
[Track] Added notes to tracking for chord 1: ['F3', 'A3', 'C4'] total tracked: 3
```

**Analysis:**
- Chord 0 correctly calculates 3 seconds total duration
- Chord 0 starts at ~40.24s
- Chord 1 releases Chord 0 at ~42.24s (2 seconds later, not 3!)
- This suggests Chord 1 is being scheduled 2 seconds after Chord 0, not 3 seconds

## Hypothesis

**The scheduling timing is wrong.** The look-ahead logic correctly calculates that Chord 0 should play for 3 seconds (6 beats), but the Tone.js scheduler is only waiting 2 seconds (4 beats) before scheduling Chord 1.

This means the issue is likely in **how events are scheduled** in Tone.Part, not in the duration calculation or playback method.

## Questions to Investigate

1. How are the `chordPart` events being scheduled? What time values are being passed?
2. Is there a separate event for the tied note at measure 1, beat 0 that's interfering?
3. Are we scheduling multiple events for the same chord (one for each bass note segment)?
4. Should we ONLY schedule an event for the FIRST bass note of each chord, not for tied continuations?

## Related Code to Examine

Look at where `chordPart.add()` is called to schedule events - this likely happens before the code shown above. The scheduling setup determines when each callback fires, which affects when chords start/stop.

## Expected Fix Direction

Likely need to modify the event scheduling logic to:
1. Only schedule ONE event per chord (at the first bass note)
2. Do NOT schedule separate events for tied continuations
3. Or ensure tied continuations don't trigger chord change logic

The duration calculation appears correct, but something is causing the next chord to start too early.
