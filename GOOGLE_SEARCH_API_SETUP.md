# Google Custom Search API Setup Guide

This guide will walk you through setting up Google Custom Search API for the "Search Song Chords" feature.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click on the project dropdown at the top
4. Click "New Project"
5. Enter a project name (e.g., "Music Theory Lab")
6. Click "Create"

## Step 2: Enable Custom Search API

1. In your new project, go to the [API Library](https://console.cloud.google.com/apis/library)
2. Search for "Custom Search API"
3. Click on "Custom Search API"
4. Click "Enable"

## Step 3: Create API Credentials

1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "API Key"
3. Your API key will be displayed
4. **Important**: Click "Restrict Key" to secure it:
   - Under "API restrictions", select "Restrict key"
   - Choose "Custom Search API"
   - Click "Save"
5. Copy your API key (you'll need it later)

## Step 4: Create a Custom Search Engine

1. Go to [Google Custom Search](https://cse.google.com/cse/all)
2. Click "Add" to create a new search engine
3. In "Sites to search", enter:
   ```
   ultimate-guitar.com
   chordify.net
   hooktheory.com
   songsterr.com
   ```
4. Give it a name (e.g., "Chord Progression Search")
5. Click "Create"
6. Click "Control Panel" for your new search engine
7. Under "Basics", find your "Search engine ID" (also called CX)
8. Copy the Search Engine ID (you'll need it later)

## Step 5: Configure in Your Code

Add the following to your `src/main.js` file (or create a separate config file):

```javascript
// Google Custom Search API Configuration
// Get these from:
// - API Key: https://console.cloud.google.com/apis/credentials
// - Search Engine ID: https://cse.google.com/cse/all
window.GOOGLE_SEARCH_API_KEY = 'YOUR_API_KEY_HERE';
window.GOOGLE_SEARCH_ENGINE_ID = 'YOUR_SEARCH_ENGINE_ID_HERE';
```

**Important Security Note**: 
- For production, don't commit API keys directly to your repository
- Consider using environment variables or a backend proxy
- The free tier allows 100 searches per day

## Step 6: Test the Feature

1. Open your application
2. Go to the "Progression Builder" tab
3. Expand the "Search Song Chords" section
4. Search for a song (e.g., "Let It Be")
5. You should see both local database results and internet search results

## Troubleshooting

### "API key not valid" error
- Make sure you've enabled the Custom Search API
- Check that your API key is correct
- Verify the API key restrictions allow Custom Search API

### "Search engine ID not found" error
- Verify your Search Engine ID is correct
- Make sure the search engine is active in Google Custom Search

### No internet results appearing
- Check the browser console for errors
- Verify both API key and Search Engine ID are set correctly
- Make sure you haven't exceeded the free tier limit (100 searches/day)

### Rate limiting
- Free tier: 100 searches per day
- Paid tier: $5 per 1,000 additional searches
- Consider caching results to reduce API calls

## Alternative: Use Without API Key

If you don't want to set up the API key, the feature will still work:
- Local database search will function normally
- When no results are found, a button will appear to search Ultimate Guitar directly
- This opens Ultimate Guitar in a new tab where users can find chords manually

## Cost Information

- **Free Tier**: 100 searches per day
- **Paid Tier**: $5 per 1,000 searches after the free tier
- Most users will stay within the free tier limit

