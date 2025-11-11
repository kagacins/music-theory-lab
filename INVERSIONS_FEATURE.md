# Chord Inversions Feature

## Overview
The song database now supports chord inversions, allowing imported chord progressions to sound more like the original songs by using the correct chord voicings.

## JSON Database Format

Songs in `src/data/song-database.json` can now include an optional `inversions` array:

```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "key": "C",
  "chords": ["C", "Am", "F", "G"],
  "inversions": [0, 0, 1, 0]
}
```

### Inversion Values
- `0` = Root position (default)
- `1` = First inversion
- `2` = Second inversion
- `3` = Third inversion (for 7th chords)
- etc.

### Rules
- The `inversions` array is **optional** - if not provided, all chords default to root position (0)
- The `inversions` array must have the same length as the `chords` array
- Each inversion value corresponds to the chord at the same index in the `chords` array
- If an inversion value is missing or invalid, the chord defaults to root position (0)

## Example

```json
{
  "title": "Like a Rolling Stone",
  "artist": "Bob Dylan",
  "key": "C",
  "chords": ["C", "Am", "F", "G", "C", "Am", "F", "G"],
  "inversions": [0, 0, 1, 0, 0, 0, 1, 0]
}
```

In this example:
- First `C` chord: root position (0)
- First `Am` chord: root position (0)
- First `F` chord: first inversion (1)
- `G` chord: root position (0)
- Second `C` chord: root position (0)
- Second `Am` chord: root position (0)
- Second `F` chord: first inversion (1)
- Second `G` chord: root position (0)

## Implementation Details

### Code Changes
1. **`src/modules/features/chordBuilder.js`**
   - `selectBuilderChordBySymbol()` now accepts an optional `inversion` parameter

2. **`src/modules/features/songSearch.js`**
   - `addParsedChordToProgression()` now accepts an optional `inversion` parameter
   - `importSongProgression()` reads inversions from the song data and passes them to the chord import function

3. **`src/data/song-database.json`**
   - Example entry with inversions added to demonstrate the format

## Adding Inversions to Existing Songs

To add inversions to a song in the database:

1. Open `src/data/song-database.json`
2. Find the song entry
3. Add an `inversions` array with the same length as the `chords` array
4. Set each value to the desired inversion (0, 1, 2, etc.)

Example:
```json
{
  "title": "Example Song",
  "artist": "Example Artist",
  "key": "C",
  "chords": ["C", "F", "G", "C"],
  "inversions": [0, 1, 0, 0]
}
```

## Notes

- Inversions are applied when importing a song's chord progression
- The inversion information is stored in the chord data and will be used when playing the progression
- If you need to find the correct inversions for a song, you can:
  - Listen to the original recording
  - Check chord charts or sheet music
  - Use your ear to match the voicing
  - Leave inversions out if unsure (chords will default to root position)

