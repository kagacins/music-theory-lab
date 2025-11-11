# Guide to Adding Inversions to the Song Database

## Overview

Adding inversions to chord progressions makes them sound more like the original recordings. This guide explains how to find and add inversions to songs in the database.

## What Are Inversions?

- **0 (Root Position)**: The root note is in the bass (e.g., C-E-G)
- **1 (First Inversion)**: The third is in the bass (e.g., E-G-C)
- **2 (Second Inversion)**: The fifth is in the bass (e.g., G-C-E)
- **3 (Third Inversion)**: The seventh is in the bass (for 7th chords, e.g., B-C-E-G)

## How to Find Correct Inversions

### Method 1: Listen to the Original Recording
1. Play the original song
2. Focus on the bass line (lowest notes)
3. Identify which note of each chord is in the bass
4. Map that to the inversion number

### Method 2: Check Sheet Music or Chord Charts
- Look for chord symbols with slash notation (e.g., "C/E" = C major with E in bass = first inversion)
- Professional sheet music often indicates inversions
- Guitar chord charts may show different voicings

### Method 3: Use Your Ear in the App
1. Import the song progression (without inversions)
2. Play it and listen
3. Try different inversions for each chord
4. Compare to the original recording
5. Choose the inversion that sounds closest

### Method 4: Common Voice Leading Patterns

Many songs follow common patterns:

- **I-V-I progressions**: Often use first inversion on V (e.g., C-G/C-C)
- **IV-V-I progressions**: Often use first inversion on IV or V
- **Passing chords**: Often use first or second inversion for smooth bass movement
- **Cadences**: Final chords often use root position for stability

## Adding Inversions to the Database

### Option 1: Edit JSON File Directly

1. Open `src/data/song-database.json`
2. Find the song you want to update
3. Add an `inversions` array with the same length as the `chords` array

Example:
```json
{
  "title": "Example Song",
  "artist": "Example Artist",
  "key": "C",
  "chords": ["C", "Am", "F", "G", "C", "Am", "F", "G"],
  "inversions": [0, 0, 1, 0, 0, 0, 1, 0]
}
```

### Option 2: Use the Helper Script

1. Run the helper script:
   ```bash
   node scripts/add-inversions-helper.js
   ```

2. This will show you:
   - All songs without inversions
   - Suggested inversions based on voice leading (as a starting point)
   - Instructions for adding inversions

### Option 3: Use the App's Import Feature

1. Import a song progression
2. Manually adjust inversions in the chord builder
3. Note the inversions you used
4. Add them to the JSON file

## Verification

After adding inversions:

1. Import the song in the app
2. Play the progression
3. Compare to the original recording
4. Adjust if needed

## Tips

- **Start with well-known songs**: These are easier to verify
- **Focus on the bass line**: The inversion is determined by the lowest note
- **Use root position as default**: If unsure, use 0 (root position)
- **Check multiple sources**: Compare different chord charts or transcriptions
- **Trust your ear**: If it sounds right, it probably is

## Common Patterns by Genre

### Pop/Rock
- Often uses root position for strong chord changes
- First inversion for smoother transitions
- Second inversion less common

### Jazz
- More frequent use of inversions
- Often uses first and second inversions for voice leading
- Third inversion common with 7th chords

### Classical
- Very specific voice leading rules
- Inversions used for harmonic progression
- Often follows traditional patterns

## Resources

- **Ultimate Guitar**: Check chord charts (look for slash chords)
- **Sheet Music**: Professional transcriptions often include inversions
- **YouTube Tutorials**: Many cover songs show the exact voicings
- **Music Theory Books**: Learn common voice leading patterns

## Example: "Like a Rolling Stone"

Current entry:
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
- Most chords are in root position (0)
- The F chords use first inversion (1) for smoother voice leading
- This creates a descending bass line: C-A-F-G-C-A-F-G

## Need Help?

If you're unsure about inversions for a specific song:
1. Start with all root positions (0)
2. Listen to the original
3. Adjust one chord at a time
4. Test in the app
5. Refine until it sounds right

Remember: Inversions are optional. If you're not sure, it's better to leave them out (they'll default to root position) than to guess incorrectly.

