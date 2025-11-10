# Deployment Guide - Music Theory Lab

This guide explains how to deploy your Music Theory Lab web application online for free.

## Quick Options (Easiest to Hardest)

### Option 1: Netlify Drop (Easiest - No Git Required) ⭐ RECOMMENDED
**Best for**: Quick deployment without git setup

1. **Prepare your files**:
   - Make sure all files are in the project folder
   - The app uses CDN resources, so no build step needed

2. **Deploy**:
   - Go to https://app.netlify.com/drop
   - Drag and drop your entire project folder
   - Netlify will give you a URL (e.g., `https://random-name-123.netlify.app`)

3. **Custom Domain (Optional)**:
   - In Netlify dashboard: Site settings → Domain management
   - Add your custom domain

**Pros**: 
- No git required
- Instant deployment
- Free HTTPS
- Custom domains supported

**Cons**:
- Manual drag-and-drop for updates

---

### Option 2: GitHub Pages (Free, Git-Based)
**Best for**: Version control and automatic deployments

#### Step 1: Create GitHub Repository
1. Go to https://github.com and create an account (if needed)
2. Click "New repository"
3. Name it (e.g., `music-theory-lab`)
4. Choose "Public" (required for free GitHub Pages)
5. **Don't** initialize with README (we'll upload files)
6. Click "Create repository"

#### Step 2: Initialize Git and Upload
```bash
# In your project folder, open terminal/PowerShell
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/music-theory-lab.git
git push -u origin main
```

#### Step 3: Enable GitHub Pages
1. Go to your repository on GitHub
2. Click "Settings" tab
3. Scroll to "Pages" (left sidebar)
4. Under "Source", select "Deploy from a branch"
5. Choose branch: `main`
6. Choose folder: `/ (root)`
7. Click "Save"
8. Your site will be at: `https://YOUR_USERNAME.github.io/music-theory-lab/`

**Pros**:
- Free
- Version control built-in
- Automatic deployments on push
- Free HTTPS

**Cons**:
- Requires git knowledge
- Public repositories only (for free tier)

---

### Option 3: Netlify with Git (Recommended for Updates)
**Best for**: Automatic deployments when you push to git

1. **Push to GitHub** (follow Option 2, Step 2)

2. **Connect to Netlify**:
   - Go to https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Choose "GitHub"
   - Authorize Netlify
   - Select your repository
   - Build settings:
     - Build command: (leave empty)
     - Publish directory: `/` (root)
   - Click "Deploy site"

3. **Result**:
   - Every time you push to GitHub, Netlify auto-deploys
   - You get a URL like `https://your-site-name.netlify.app`

**Pros**:
- Automatic deployments
- Free HTTPS
- Custom domains
- Deploy previews for pull requests

---

### Option 4: Vercel (Alternative to Netlify)
**Best for**: Modern static sites with git integration

1. Push to GitHub (follow Option 2, Step 2)
2. Go to https://vercel.com
3. Click "Import Project"
4. Select your GitHub repository
5. Vercel auto-detects settings (no build needed for static sites)
6. Click "Deploy"

**Pros**:
- Very fast deployments
- Automatic HTTPS
- Global CDN
- Free tier

---

## Important Notes

### File Structure
Make sure these files are in the root:
- `music.html` (main HTML file)
- `music.css` (CSS file)
- `src/` folder (all JavaScript modules)
- `public/` folder (key signatures, audio files)

### CDN Resources
Your app already uses CDN resources, so:
- ✅ No build step required
- ✅ Works immediately after upload
- ✅ All dependencies load from CDN

### Browser Compatibility
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Audio features require user interaction (browser security)
- Works on desktop and mobile

---

## Quick Start: Netlify Drop (5 minutes)

1. Go to https://app.netlify.com/drop
2. Drag your entire project folder onto the page
3. Wait for upload (10-30 seconds)
4. Get your live URL!
5. Share with the world 🌍

---

## Custom Domain Setup

### Netlify:
1. Domain settings → Add custom domain
2. Follow DNS instructions
3. SSL certificate auto-generated

### GitHub Pages:
1. Repository Settings → Pages
2. Add custom domain
3. Update DNS records
4. GitHub provides SSL

---

## Troubleshooting

### Issues with audio not working:
- Browsers require user interaction before playing audio
- User must click a button first
- This is a browser security feature, not a bug

### CORS errors:
- Shouldn't occur with static hosting
- All resources use CDN or same origin

### Files not loading:
- Check file paths are correct
- Use relative paths (e.g., `./src/main.js` not `C:\...`)
- Ensure all files are uploaded

---

## Next Steps After Deployment

1. Test all features on the live site
2. Share the URL with others
3. Consider adding analytics (Google Analytics, etc.)
4. Set up a custom domain for branding
5. Update README with live site link

