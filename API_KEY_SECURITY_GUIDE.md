# API Key Security Guide for GitHub Pages

## Current Situation

Your API keys are currently exposed in `src/main.js` because GitHub Pages only serves static files. Anyone can view your source code and see the keys.

## Solutions

### Option 1: Deploy to Netlify (Recommended - Easiest)

You already have a Netlify function set up! This is the easiest solution:

1. **Deploy to Netlify**:
   - Push your code to GitHub
   - Go to [Netlify](https://www.netlify.com/)
   - Click "Add new site" → "Import an existing project"
   - Connect your GitHub repository
   - Netlify will auto-detect your `netlify.toml` and deploy

2. **Set Environment Variables in Netlify**:
   - In Netlify dashboard, go to Site settings → Environment variables
   - Add:
     - `GOOGLE_SEARCH_API_KEY` = your API key
     - `GOOGLE_SEARCH_ENGINE_ID` = your search engine ID
   - Redeploy the site

3. **Update the Code**:
   - Remove API keys from `src/main.js`
   - The code will automatically use the Netlify function

**Benefits**:
- ✅ Free tier available
- ✅ Serverless functions included
- ✅ Environment variables secure
- ✅ Automatic deployments from GitHub
- ✅ Custom domain support

### Option 2: Use GitHub Actions + Netlify Functions (Hybrid)

Keep GitHub Pages for static hosting, but use Netlify just for the function:

1. **Deploy Function to Netlify**:
   - Create a minimal Netlify site just for the function
   - Set environment variables in Netlify
   - Get the function URL (e.g., `https://your-function.netlify.app/.netlify/functions/searchChords`)

2. **Update Code to Use Function URL**:
   - Update `src/modules/features/songSearch.js` to use the Netlify function URL
   - Remove API keys from `src/main.js`
   - Deploy to GitHub Pages

**Benefits**:
- ✅ Keep using GitHub Pages
- ✅ API keys stay secure
- ⚠️ Requires managing two deployments

### Option 3: Use a Backend Proxy Service

Create a simple backend service to proxy API requests:

1. **Deploy a Simple Backend** (Railway, Render, or Heroku):
   ```javascript
   // server.js (example for Railway/Render)
   const express = require('express');
   const app = express();
   
   app.get('/api/search', async (req, res) => {
       const query = req.query.q;
       const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
       const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
       
       const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${encodeURIComponent(query)}`;
       const response = await fetch(url);
       const data = await response.json();
       res.json(data);
   });
   
   app.listen(process.env.PORT || 3000);
   ```

2. **Update Frontend**:
   - Point to your backend URL instead of direct API
   - Remove API keys from client code

**Benefits**:
- ✅ Works with GitHub Pages
- ✅ Full control over backend
- ⚠️ Requires maintaining a backend service

### Option 4: Use GitHub Secrets (Limited)

GitHub Actions can use secrets, but they'll still end up in the built files:

1. **Create GitHub Secrets**:
   - Go to repository Settings → Secrets and variables → Actions
   - Add `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_ENGINE_ID`

2. **Create GitHub Actions Workflow**:
   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - name: Inject API keys
           run: |
             sed -i "s/YOUR_API_KEY/${{ secrets.GOOGLE_SEARCH_API_KEY }}/g" src/main.js
             sed -i "s/YOUR_ENGINE_ID/${{ secrets.GOOGLE_SEARCH_ENGINE_ID }}/g" src/main.js
         - name: Deploy
           uses: peaceiris/actions-gh-pages@v3
   ```

**Warning**: This still exposes keys in the built files! Not recommended.

## Recommended Solution: Option 1 (Netlify)

Since you already have the Netlify function set up, this is the easiest and most secure option.

### Steps to Implement:

1. **Remove API keys from source code**:
   ```javascript
   // src/main.js - Remove these lines:
   // window.GOOGLE_SEARCH_API_KEY = '...';
   // window.GOOGLE_SEARCH_ENGINE_ID = '...';
   ```

2. **Update search function to always use Netlify function**:
   - Modify `src/modules/features/songSearch.js` to use the Netlify function URL
   - Remove the fallback to direct API calls

3. **Deploy to Netlify**:
   - Connect your GitHub repo
   - Set environment variables
   - Deploy!

4. **Update your domain** (optional):
   - Point your custom domain to Netlify
   - Or use the free `yoursite.netlify.app` domain

## Quick Start: Switch to Netlify

1. Go to https://app.netlify.com/
2. Click "Add new site" → "Import an existing project"
3. Authorize GitHub and select your repository
4. Netlify will auto-detect settings from `netlify.toml`
5. Add environment variables:
   - `GOOGLE_SEARCH_API_KEY`
   - `GOOGLE_SEARCH_ENGINE_ID`
6. Click "Deploy site"
7. Done! Your site is live with secure API keys

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for all secrets
3. **Restrict API keys** in Google Cloud Console:
   - Limit to specific APIs (Custom Search API only)
   - Add HTTP referrer restrictions if using client-side
   - Set usage quotas
4. **Monitor API usage** in Google Cloud Console
5. **Rotate keys** if they're ever exposed

## Cost Comparison

- **GitHub Pages**: Free (but no serverless functions)
- **Netlify**: Free tier includes:
  - 100GB bandwidth/month
  - 300 build minutes/month
  - 125,000 serverless function invocations/month
  - Perfect for your use case!

## Need Help?

If you want help implementing any of these solutions, I can:
- Update the code to use Netlify functions exclusively
- Remove the hardcoded API keys
- Set up the deployment configuration
