# API Key Security Implementation Guide

This guide shows how to secure your Google Custom Search API key using different approaches.

## Option 1: Netlify Serverless Functions (Recommended for Netlify)

**Best for**: Projects deployed on Netlify

### Step 1: Create Netlify Function

1. Create a `netlify/functions` directory in your project root:
   ```
   netlify/
     functions/
       searchChords.js
   ```

2. Create `netlify/functions/searchChords.js`:
   ```javascript
   exports.handler = async (event, context) => {
     // Only allow GET requests
     if (event.httpMethod !== 'GET') {
       return {
         statusCode: 405,
         body: JSON.stringify({ error: 'Method not allowed' })
       };
     }

     // Get query from query string
     const query = event.queryStringParameters?.query;
     if (!query) {
       return {
         statusCode: 400,
         body: JSON.stringify({ error: 'Query parameter required' })
       };
     }

     // Get API credentials from environment variables
     const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
     const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

     if (!apiKey || !engineId) {
       return {
         statusCode: 500,
         body: JSON.stringify({ error: 'API credentials not configured' })
       };
     }

     // Build search query
     const searchQuery = `${query} chords site:ultimate-guitar.com OR site:chordify.net OR site:hooktheory.com`;
     const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(searchQuery)}&num=10`;

     try {
       const response = await fetch(url);
       const data = await response.json();

       return {
         statusCode: 200,
         headers: {
           'Content-Type': 'application/json',
           'Access-Control-Allow-Origin': '*' // Allow CORS
         },
         body: JSON.stringify(data)
       };
     } catch (error) {
       return {
         statusCode: 500,
         body: JSON.stringify({ error: error.message })
       };
     }
   };
   ```

### Step 2: Set Environment Variables in Netlify

1. Go to your Netlify dashboard
2. Select your site
3. Go to **Site settings** → **Environment variables**
4. Add:
   - `GOOGLE_SEARCH_API_KEY` = `AIzaSyCKMAccLd1yCc9tuTWmCBItpnB7QxtZiWo`
   - `GOOGLE_SEARCH_ENGINE_ID` = `6233b4a886ca64ede`
5. Click **Save**

### Step 3: Update Your Frontend Code

Update `src/modules/features/songSearch.js`:

```javascript
/**
 * Search Google Custom Search for chord progressions via Netlify Function
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of song results
 */
async function searchGoogleForChords(query) {
    // Use Netlify function instead of direct API call
    const functionUrl = '/.netlify/functions/searchChords';
    const url = `${functionUrl}?query=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Function error: ${response.status}`);
        }
        
        const data = await response.json();
        const results = [];
        
        if (data.items && data.items.length > 0) {
            data.items.forEach((item) => {
                const titleMatch = item.title.match(/^(.+?)\s*[-–—]\s*(.+?)\s*[-–—]?\s*Chords?/i);
                const title = titleMatch ? titleMatch[1].trim() : item.title.split(' - ')[0].trim();
                const artist = titleMatch ? titleMatch[2].trim() : (item.title.split(' - ')[1] || '').replace(/Chords?/i, '').trim();
                
                const chords = extractChordsFromText(item.snippet || '');
                
                results.push({
                    title: title || item.title,
                    artist: artist || 'Unknown',
                    chords: chords,
                    url: item.link,
                    source: 'internet',
                    sourceName: getSourceName(item.link)
                });
            });
        }
        
        return results;
    } catch (error) {
        console.error('Netlify function error:', error);
        throw error;
    }
}
```

### Step 4: Remove API Key from Frontend

Remove these lines from `src/main.js`:
```javascript
// Remove these lines:
window.GOOGLE_SEARCH_API_KEY = 'AIzaSyCKMAccLd1yCc9tuTWmCBItpnB7QxtZiWo';
window.GOOGLE_SEARCH_ENGINE_ID = '6233b4a886ca64ede';
```

### Step 5: Update searchInternetForChords Function

Update `src/modules/features/songSearch.js`:

```javascript
async function searchInternetForChords(query) {
    const results = [];
    
    // Always try Netlify function (no need to check for API key)
    try {
        const googleResults = await searchGoogleForChords(query);
        results.push(...googleResults);
    } catch (error) {
        console.warn('Internet search failed:', error);
    }
    
    return results;
}
```

---

## Option 2: Vercel Serverless Functions

**Best for**: Projects deployed on Vercel

### Step 1: Create Vercel Function

1. Create `api/searchChords.js`:
   ```javascript
   export default async function handler(req, res) {
     if (req.method !== 'GET') {
       return res.status(405).json({ error: 'Method not allowed' });
     }

     const { query } = req.query;
     if (!query) {
       return res.status(400).json({ error: 'Query parameter required' });
     }

     const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
     const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

     if (!apiKey || !engineId) {
       return res.status(500).json({ error: 'API credentials not configured' });
     }

     const searchQuery = `${query} chords site:ultimate-guitar.com OR site:chordify.net OR site:hooktheory.com`;
     const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(searchQuery)}&num=10`;

     try {
       const response = await fetch(url);
       const data = await response.json();
       res.status(200).json(data);
     } catch (error) {
       res.status(500).json({ error: error.message });
     }
   }
   ```

### Step 2: Set Environment Variables in Vercel

1. Go to Vercel dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the same variables as Netlify
5. Redeploy

### Step 3: Update Frontend

Use `/api/searchChords?query=...` instead of `/.netlify/functions/searchChords?query=...`

---

## Option 3: Simple Node.js Backend Proxy

**Best for**: Self-hosted or custom deployments

### Step 1: Create Backend Server

Create `server.js` in project root:

```javascript
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/searchChords', async (req, res) => {
  const { query } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !engineId) {
    return res.status(500).json({ error: 'API credentials not configured' });
  }

  const searchQuery = `${query} chords site:ultimate-guitar.com OR site:chordify.net OR site:hooktheory.com`;
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(searchQuery)}&num=10`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 2: Install Dependencies

```bash
npm install express cors dotenv
```

### Step 3: Create .env File

Create `.env` in project root:
```
GOOGLE_SEARCH_API_KEY=AIzaSyCKMAccLd1yCc9tuTWmCBItpnB7QxtZiWo
GOOGLE_SEARCH_ENGINE_ID=6233b4a886ca64ede
```

### Step 4: Add .env to .gitignore

```
node_modules/
.env
```

### Step 5: Update Frontend

Point to your backend URL: `http://localhost:3001/api/searchChords?query=...`

---

## Option 4: GitHub Pages with GitHub Actions (Environment Variables)

**Best for**: GitHub Pages deployments

### Step 1: Create GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Inject API Keys
        run: |
          sed -i "s/YOUR_API_KEY_HERE/${{ secrets.GOOGLE_SEARCH_API_KEY }}/g" src/main.js
          sed -i "s/YOUR_ENGINE_ID_HERE/${{ secrets.GOOGLE_SEARCH_ENGINE_ID }}/g" src/main.js
      
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

### Step 2: Set GitHub Secrets

1. Go to your repository on GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add:
   - `GOOGLE_SEARCH_API_KEY`
   - `GOOGLE_SEARCH_ENGINE_ID`

### Step 3: Update main.js Template

```javascript
// These will be replaced by GitHub Actions
window.GOOGLE_SEARCH_API_KEY = 'YOUR_API_KEY_HERE';
window.GOOGLE_SEARCH_ENGINE_ID = 'YOUR_ENGINE_ID_HERE';
```

---

## Comparison

| Option | Security | Complexity | Best For |
|--------|----------|------------|----------|
| Netlify Functions | ✅ High | ⭐⭐ Easy | Netlify deployments |
| Vercel Functions | ✅ High | ⭐⭐ Easy | Vercel deployments |
| Node.js Backend | ✅ High | ⭐⭐⭐ Medium | Self-hosted |
| GitHub Actions | ⚠️ Medium* | ⭐⭐⭐⭐ Hard | GitHub Pages |

*GitHub Actions still exposes keys in built files, but they're not in source code.

---

## Recommended: Netlify Functions

Since you already have Netlify deployment setup, **Option 1 (Netlify Functions)** is the easiest and most secure solution. The API key stays on the server and is never exposed to the client.

