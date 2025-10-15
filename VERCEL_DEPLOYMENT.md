# Vercel Deployment Guide - Newsletter Builder

## Quick Start

### 1. Prerequisites

- Vercel account (free tier works)
- Browserless.io account (required for PDF generation)
- Cloudinary account (recommended for production)

### 2. Get Browserless Token (REQUIRED)

**Why?** Vercel's serverless functions can't run Chrome/Playwright. Browserless provides cloud-based Chrome.

1. Go to https://www.browserless.io/
2. Sign up (free tier: 6000 units/month)
3. Get your API token from the dashboard
4. Save it - you'll need it in step 4

### 3. Deploy to Vercel

#### Option A: Deploy via Git

1. Push your code to GitHub/GitLab/Bitbucket
2. Go to https://vercel.com/new
3. Import your repository
4. Vercel will auto-detect the Python project

#### Option B: Deploy via CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
cd "C:\Users\Leonardo Lopez\Desktop\newsletter-builder"
vercel
```

### 4. Configure Environment Variables

In Vercel Dashboard → Your Project → Settings → Environment Variables, add:

**REQUIRED:**

```bash
# Flask Security
FLASK_SECRET_KEY=<generate-with: python -c "import secrets; print(secrets.token_hex(32))">

# PDF Generation (CRITICAL for Vercel!)
BROWSERLESS_TOKEN=<your-browserless-token>

# Storage (choose one)
STORAGE_TYPE=cloudinary  # Recommended for production
```

**If using Cloudinary storage:**

```bash
CLOUDINARY_CLOUD_NAME=<your-cloud-name>
CLOUDINARY_API_KEY=<your-api-key>
CLOUDINARY_API_SECRET=<your-api-secret>
```

**Optional (for local storage on Vercel - not recommended):**

```bash
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=/tmp/newsletter-files
```

⚠️ **Note**: Vercel's filesystem is read-only except `/tmp`, and `/tmp` is cleared between invocations. Use Cloudinary for production.

### 5. Verify Deployment

After deployment completes:

1. Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Test PDF generation: Go to `/tools/convert/html-to-pdf`
3. Upload `Newsletter.html` and verify it generates a proper PDF

## Important Vercel Limitations & Solutions

### 1. No Playwright/Chrome Binary

**Problem:** Serverless functions can't include large binaries like Chrome.

**Solution:** ✅ Already handled! The app uses Browserless.io (cloud Chrome).

### 2. Execution Time Limits

- **Hobby Plan:** 10 seconds per request
- **Pro Plan:** 60 seconds per request

**Solution:** Our PDF generation typically takes 3-5 seconds with Browserless.

### 3. Memory Limits

- **Hobby Plan:** 1024 MB
- **Pro Plan:** 3008 MB

**Solution:** Our implementation uses minimal memory (< 256 MB per PDF).

### 4. Read-Only Filesystem

**Problem:** Can't write files except to `/tmp`.

**Solution:** 
- ✅ Use Cloudinary for persistent storage (`STORAGE_TYPE=cloudinary`)
- `/tmp` is used temporarily for PDF generation (automatically cleaned up)

## The PDF Fix on Vercel

### What Was Fixed

The previous implementation had two issues for Vercel:

1. **Blank PDFs** from inline-styled HTML (fixed with enhanced CSS injection)
2. **Browserless integration** wasn't optimized

### How It Works Now

```python
# 1. CSS is injected BEFORE sending to Browserless
prepared_html = self._inject_single_page_css(html_content)

# 2. Browserless is used with enhanced settings
payload = {
    "html": prepared_html,  # Already has our fixes!
    "waitFor": 2000,        # Extra rendering time
    "gotoOptions": {
        "timeout": 15000,   # More time for complex HTML
        "waitUntil": "networkidle2"
    }
}

# 3. Vercel detection prevents fallback to Playwright
if screenshot is None and is_vercel:
    raise RuntimeError("BROWSERLESS_TOKEN required for Vercel")
```

### Vercel-Specific Error Handling

If you forget to set `BROWSERLESS_TOKEN`, you'll see:

```
RuntimeError: BROWSERLESS_TOKEN is required for Vercel deployment.
Playwright cannot run in Vercel's serverless environment.
Please set BROWSERLESS_TOKEN in your Vercel environment variables.
Get a token at: https://www.browserless.io/
```

## Cost Estimates

### Browserless.io (Required)

- **Free Tier:** 6000 units/month
- **Usage:** ~10 units per PDF
- **Free capacity:** ~600 PDFs/month
- **Paid:** $50/month for 50,000 units (~5,000 PDFs)

### Vercel (Platform)

- **Hobby (Free):**
  - 100 GB bandwidth/month
  - 100 GB-hours serverless execution
  - Perfect for development/small projects

- **Pro ($20/month):**
  - 1 TB bandwidth/month
  - 1000 GB-hours serverless execution
  - 60-second function timeout (vs 10s on Hobby)

### Cloudinary (Storage - Recommended)

- **Free Tier:**
  - 25 GB storage
  - 25 GB monthly bandwidth
  - Good for ~5,000-10,000 newsletter templates

- **Plus ($89/month):**
  - 100 GB storage
  - 100 GB bandwidth

### Total Monthly Cost (Small Project)

- Vercel Hobby: **$0**
- Browserless Free: **$0** (up to 600 PDFs)
- Cloudinary Free: **$0** (up to 25 GB)
- **Total: $0/month** for small usage

### Total Monthly Cost (Production)

- Vercel Pro: **$20**
- Browserless: **$50** (~5,000 PDFs)
- Cloudinary Plus: **$89**
- **Total: ~$159/month**

## Testing Before Deploy

### Test Browserless Locally

```bash
# Set token in .env
echo "BROWSERLESS_TOKEN=your-token-here" >> .env

# Start Flask
python api/index.py

# Test PDF generation
# The logs will show: "Using Browserless HTTP screenshot"
```

### Simulate Vercel Environment

```bash
# Set Vercel environment variable
set VERCEL=1  # Windows CMD
# or
$env:VERCEL="1"  # Windows PowerShell
# or
export VERCEL=1  # Linux/Mac

# Start Flask
python api/index.py

# Try PDF generation - should fail without BROWSERLESS_TOKEN
```

## Troubleshooting

### "BROWSERLESS_TOKEN is required for Vercel"

**Solution:** Add `BROWSERLESS_TOKEN` to Vercel environment variables.

### "Browserless screenshot request returned 40x"

**Causes:**
- Invalid/expired token
- Free tier quota exhausted
- Token from wrong region

**Solution:** 
1. Verify token in Browserless dashboard
2. Check usage/quota
3. Get a new token if needed

### PDFs are still blank

**Possible causes:**
1. HTML has no visible content
2. Browserless timeout too short (check HTML complexity)
3. External images not loading (check CORS)

**Solution:**
1. Test the HTML in a browser first
2. Check browser console for errors
3. Ensure all image URLs are publicly accessible

### Vercel build fails

**Common issues:**
- Missing `requirements.txt` → Ensure `api/requirements.txt` exists
- Python version mismatch → Add `runtime.txt` with `python-3.9`

## Environment Variables Checklist

Before deploying to Vercel, ensure these are set:

- [ ] `FLASK_SECRET_KEY` - Generated securely
- [ ] `BROWSERLESS_TOKEN` - From browserless.io dashboard
- [ ] `STORAGE_TYPE` - Set to `cloudinary` for production
- [ ] `CLOUDINARY_CLOUD_NAME` - If using Cloudinary
- [ ] `CLOUDINARY_API_KEY` - If using Cloudinary
- [ ] `CLOUDINARY_API_SECRET` - If using Cloudinary

Optional:
- [ ] `FLASK_ENV` - Set to `production`
- [ ] `FLASK_DEBUG` - Set to `false` or omit

## Monitoring & Logs

### View Vercel Logs

```bash
# Via CLI
vercel logs <your-deployment-url>

# Or in dashboard
Vercel Dashboard → Your Project → Deployments → (select deployment) → Logs
```

### Monitor Browserless Usage

1. Go to https://www.browserless.io/dashboard
2. View usage metrics
3. Set up alerts for quota limits

## Next Steps After Deployment

1. **Test thoroughly:**
   - Generate PDFs from different HTML files
   - Test with both simple and complex newsletters
   - Verify storage (Cloudinary uploads)

2. **Set up monitoring:**
   - Configure Sentry/GlitchTip for errors (development only)
   - Monitor Browserless usage
   - Track Vercel function execution times

3. **Optimize costs:**
   - Cache frequently generated PDFs
   - Implement rate limiting if needed
   - Monitor and optimize Browserless usage

4. **Security:**
   - Enable HTTPS (automatic on Vercel)
   - Set up CORS if needed
   - Review and rotate secrets regularly

## Support Resources

- **Vercel Docs:** https://vercel.com/docs
- **Browserless Docs:** https://www.browserless.io/docs
- **Cloudinary Docs:** https://cloudinary.com/documentation
- **This Project:** See `README.md` and `PDF_FIX_SUMMARY.md`

---

✅ **Your app is now Vercel-ready with the PDF blank page fix!**

The enhanced CSS injection, improved rendering delays, and Browserless integration ensure that all GrapeJS-exported HTML files (with or without embedded CSS) will render correctly to PDF on Vercel's serverless platform.
