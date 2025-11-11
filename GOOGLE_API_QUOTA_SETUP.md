# Setting API Quotas in Google Cloud Console

You can set daily quotas/limits directly in Google Cloud Console. This is **more secure** than client-side limiting because:
- ✅ Enforced at the API level (can't be bypassed)
- ✅ Works across all users/devices
- ✅ Prevents accidental overages
- ✅ Protects against API key abuse

## Step-by-Step Instructions

### Step 1: Go to Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (the one with your Custom Search API)

### Step 2: Navigate to API Quotas

1. In the left sidebar, go to **APIs & Services** → **Quotas**
2. Or go directly to: https://console.cloud.google.com/apis/api/customsearch.googleapis.com/quotas

### Step 3: Find Custom Search API Quotas

1. In the "Filter" box, type: `Custom Search API`
2. You'll see quotas like:
   - **Queries per day**
   - **Queries per 100 seconds per user**
   - **Queries per 100 seconds**

### Step 4: Set Daily Quota Limit

1. Click on **"Queries per day"**
2. Click **"EDIT QUOTAS"** button (top of the page)
3. Check the box next to "Queries per day"
4. Enter your desired limit:
   - **100** for free tier
   - **Higher number** if you have a paid account
5. Click **"SAVE"**
6. Wait a few minutes for changes to take effect

### Step 5: Set Rate Limits (Optional but Recommended)

You can also set rate limits to prevent burst usage:

1. Click on **"Queries per 100 seconds"**
2. Click **"EDIT QUOTAS"**
3. Set a reasonable limit (e.g., **10 queries per 100 seconds**)
4. This prevents someone from using all 100 searches in a few seconds

## Alternative: Set Quota via API

You can also set quotas programmatically using the Service Usage API, but the UI method above is easier.

## Important Notes

### Quota vs. Client-Side Limit

- **Google Cloud Quota**: Hard limit enforced by Google (recommended)
- **Client-Side Limit**: Soft limit in your code (can be bypassed)

**Best Practice**: Use both!
- Google Cloud quota = hard limit (safety net)
- Client-side limit = user-friendly warnings and early blocking

### Quota Reset Time

- Google quotas reset at **midnight Pacific Time (PST/PDT)**
- Your client-side limit resets at **midnight in the user's timezone**
- These may differ, so the Google quota is the ultimate limit

### Monitoring Usage

1. Go to **APIs & Services** → **Dashboard**
2. Select **Custom Search API**
3. View **"Queries per day"** chart
4. See real-time usage and remaining quota

### Setting Up Alerts

1. Go to **Monitoring** → **Alerting**
2. Create an alert for when quota usage exceeds a threshold (e.g., 80%)
3. Get notified before hitting the limit

## Recommended Settings

For free tier:
- **Queries per day**: 100
- **Queries per 100 seconds**: 10 (prevents burst usage)

For paid tier:
- **Queries per day**: Your budget allows
- **Queries per 100 seconds**: 20-50 (depending on expected usage)

## Troubleshooting

### "Quota exceeded" errors
- Check your quota settings in Cloud Console
- Verify the limit hasn't been reached
- Wait until quota resets (midnight PST)

### Quota changes not taking effect
- Wait 5-10 minutes for propagation
- Refresh the page
- Check you're editing the correct project

### Can't find quota settings
- Make sure Custom Search API is enabled
- Check you have "Quota Administrator" or "Owner" role
- Try the direct link: https://console.cloud.google.com/apis/api/customsearch.googleapis.com/quotas

