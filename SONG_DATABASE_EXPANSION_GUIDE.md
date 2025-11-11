# Song Database Expansion Guide

## Quick Expansion Methods

### Method 1: JSON File (Recommended for 50-500 songs)

**Pros:**
- Easy to edit (just add JSON entries)
- Separates data from code
- Can be updated without touching JavaScript
- Still client-side (fast, no server needed)

**Cons:**
- Increases bundle size (but acceptable up to ~500 songs)
- Still downloaded with the page

**Steps:**
1. Create/edit `src/data/song-database.json` (already created)
2. Add songs in JSON format
3. Update `songSearch.js` to import from JSON

### Method 2: Backend Database (Recommended for 500+ songs)

**Pros:**
- Can scale to thousands of songs
- Doesn't bloat client bundle
- Can be updated without redeploying frontend
- Can track usage, add caching, etc.

**Cons:**
- Requires server/backend
- Network latency (but can be fast with good caching)
- Server costs

### Method 3: Hybrid Approach (Best of Both Worlds)

**Recommended Architecture:**
1. **Small curated set** (50-100 songs) in client-side JSON
   - Fast, instant results
   - Works offline
   - Most popular songs
2. **Full database** on backend
   - Search if client-side has no results
   - Can have thousands of songs
   - Updated independently

## Implementation Examples

### Option A: JSON File (Quick & Easy)

Modify `src/modules/features/songSearch.js`:

```javascript
// Replace the hardcoded array with:
import songDatabase from '../../data/song-database.json';

const DEMO_SONG_DATABASE = songDatabase;
```

**Note:** You may need to configure your build tool to handle JSON imports, or use a fetch:

```javascript
let DEMO_SONG_DATABASE = [];

// Load on initialization
async function loadSongDatabase() {
    try {
        const response = await fetch('/src/data/song-database.json');
        DEMO_SONG_DATABASE = await response.json();
    } catch (error) {
        console.error('Failed to load song database:', error);
        // Fallback to empty array or default songs
    }
}

// Call before first search
loadSongDatabase();
```

### Option B: Backend API (Scalable)

Create a backend endpoint (e.g., Netlify Function or separate API):

```javascript
// In songSearch.js, modify searchSongChords():
export async function searchSongChords() {
    // ... existing code ...
    
    // First, search the local demo database (small curated set)
    const localResults = DEMO_SONG_DATABASE.map(...).filter(...);
    
    // If no local results, search backend database
    let backendResults = [];
    if (localResults.length === 0) {
        try {
            const response = await fetch(`/.netlify/functions/searchSongDatabase?q=${encodeURIComponent(query)}`);
            if (response.ok) {
                backendResults = await response.json();
                backendResults = backendResults.map(song => ({
                    ...song,
                    source: 'database'
                }));
            }
        } catch (error) {
            console.warn('Backend search failed:', error);
        }
    }
    
    // Only search Google API if no local or backend results
    let internetResults = [];
    if (localResults.length === 0 && backendResults.length === 0) {
        // ... existing Google API code ...
    }
    
    // Combine results: local first, then backend, then internet
    const allResults = [...localResults, ...backendResults, ...internetResults];
    // ... rest of function ...
}
```

### Option C: Hybrid (Recommended for Large Scale)

**Search Priority:**
1. Client-side JSON (instant, 50-100 popular songs)
2. Backend database (fast, thousands of songs)
3. Google API (slow, expensive, fallback)

This gives you:
- Instant results for popular songs
- Fast results for most songs (backend)
- Fallback for obscure songs (Google API)

## Quick Expansion Workflow

### For JSON Method:
1. Open `src/data/song-database.json`
2. Copy an existing entry
3. Modify title, artist, key, and chords
4. Save - done!

### For Backend Method:
1. Add entry to your database (SQL, MongoDB, etc.)
2. No frontend changes needed
3. Results appear automatically

## Size Considerations

- **< 50 songs**: Keep in JavaScript array (current method)
- **50-200 songs**: Use JSON file (Method 1)
- **200-500 songs**: JSON still works, but consider backend
- **500+ songs**: Definitely use backend (Method 2 or 3)

## Performance Notes

- **Client-side JSON**: ~1KB per song, so 500 songs ≈ 500KB (acceptable)
- **Backend**: No client bundle impact, but requires network call (~50-200ms)
- **Hybrid**: Best performance - instant for popular songs, fast for others

## Recommendation

For your use case, I recommend:
1. **Short term**: Move to JSON file (Method 1) for easy expansion
2. **Long term**: Implement hybrid approach (Method 3) when you have 200+ songs

This gives you immediate flexibility while keeping the door open for scaling.

