# Deploy to GitHub Pages (Git Method)

## Prerequisites
- GitHub account (free at https://github.com)
- Git installed on your computer (download from https://git-scm.com)

## Step-by-Step Instructions

### Step 1: Create GitHub Repository

1. **Go to GitHub**: https://github.com
2. **Click the "+" icon** (top right) → **New repository**
3. **Repository settings**:
   - **Name**: `music-theory-lab` (or your preferred name)
   - **Description**: "Interactive Music Theory Lab - Web Application"
   - **Visibility**: ✅ **Public** (required for free GitHub Pages)
   - **DO NOT** check "Initialize with README"
4. **Click "Create repository"**

### Step 2: Initialize Git in Your Project

Open **PowerShell** or **Command Prompt** in your project folder:

```powershell
# Navigate to your project folder
cd "C:\Users\agaci\Downloads\Music Project Refactored"

# Initialize git repository
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit: Music Theory Lab"

# Rename branch to main (GitHub's default)
git branch -M main
```

### Step 3: Connect to GitHub and Upload

```powershell
# Replace YOUR_USERNAME with your GitHub username
git remote add origin https://github.com/YOUR_USERNAME/music-theory-lab.git

# Push to GitHub
git push -u origin main
```

**Note**: GitHub will ask for your username and password. Use a **Personal Access Token** instead of password:
- Go to: https://github.com/settings/tokens
- Click "Generate new token (classic)"
- Select scope: `repo`
- Copy the token and use it as password

### Step 4: Enable GitHub Pages

1. **Go to your repository** on GitHub: `https://github.com/YOUR_USERNAME/music-theory-lab`
2. **Click "Settings"** tab (top menu)
3. **Scroll down** to "Pages" (left sidebar)
4. **Under "Source"**:
   - Select: **"Deploy from a branch"**
   - Branch: **`main`**
   - Folder: **`/ (root)`**
5. **Click "Save"**
6. **Wait 1-2 minutes** for deployment
7. **Your site is live at**: `https://YOUR_USERNAME.github.io/music-theory-lab/`

### Step 5: Update Your Site (Future Changes)

Whenever you make changes:

```powershell
git add .
git commit -m "Description of changes"
git push
```

GitHub Pages automatically updates your site (takes 1-2 minutes).

---

## Custom Domain (Optional)

1. **Add custom domain** in GitHub Pages settings
2. **Update DNS records** at your domain registrar:
   - Add A record: `185.199.108.153`
   - Add A record: `185.199.109.153`
   - Add A record: `185.199.110.153`
   - Add A record: `185.199.111.153`
   - Add CNAME record: `www` → `YOUR_USERNAME.github.io`
3. **GitHub provides free SSL** automatically

---

## Troubleshooting

### "Repository not found" error:
- Check repository name is correct
- Ensure repository is public
- Verify GitHub username is correct

### Files not showing on site:
- Check file paths are relative (not absolute)
- Ensure `music.html` is in root directory
- Wait a few minutes for GitHub Pages to update

### Want to use a different file as homepage:
- Rename `music.html` to `index.html`
- Or add `index.html` that redirects to `music.html`

