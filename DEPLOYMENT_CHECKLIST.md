# Vercel Deployment Checklist

Use this checklist to ensure your deployment is successful.

## Pre-Deployment Setup

### ☐ 1. Get Browserless.io Account & Token

**Required for Vercel!** Vercel can't run Chrome locally.

- [ ] Sign up at https://www.browserless.io/
- [ ] Verify email and login
- [ ] Copy API token from dashboard
- [ ] Test token locally first (recommended)

**Free Tier:** 6000 units/month (~600 PDFs)

### ☐ 2. Get Cloudinary Account (Recommended for Production)

- [ ] Sign up at https://cloudinary.com/
- [ ] Go to console: https://cloudinary.com/console
- [ ] Copy Cloud Name
- [ ] Copy API Key
- [ ] Copy API Secret

**Alternative:** Use `STORAGE_TYPE=local` with `/tmp` (not recommended - files are ephemeral)

### ☐ 3. Generate Flask Secret Key

Run this command:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

- [ ] Copy the generated key
- [ ] Keep it secret - never commit to Git

### ☐ 4. Test Locally with Browserless

Before deploying, verify Browserless works:

1. [ ] Add to `.env`:
   ```bash
   BROWSERLESS_TOKEN=your-token-here
   ```

2. [ ] Start Flask:
   ```bash
   python api/index.py
   ```

3. [ ] Go to: `http://localhost:5000/tools/convert/html-to-pdf`

4. [ ] Upload `Newsletter.html`

5. [ ] Verify PDF is generated with visible content

**Expected:** Logs show "Using Browserless HTTP screenshot"

## Vercel Deployment

### ☐ 5. Push to Git Repository

- [ ] Commit all changes:
  ```bash
  git add .
  git commit -m "Add PDF blank page fix with Vercel support"
  git push origin main
  ```

- [ ] Verify GitHub/GitLab/Bitbucket shows latest code

### ☐ 6. Deploy to Vercel

**Option A: Via Web UI**

- [ ] Go to https://vercel.com/new
- [ ] Click "Import Git Repository"
- [ ] Select your repository
- [ ] Click "Deploy"

**Option B: Via CLI**

- [ ] Install Vercel CLI: `npm i -g vercel`
- [ ] Login: `vercel login`
- [ ] Deploy: `vercel`
- [ ] Follow prompts

### ☐ 7. Configure Environment Variables

In Vercel Dashboard → Project → Settings → Environment Variables:

**Required Variables:**

- [ ] `FLASK_SECRET_KEY` = `<your-generated-secret>`
- [ ] `BROWSERLESS_TOKEN` = `<your-browserless-token>`
- [ ] `STORAGE_TYPE` = `cloudinary` (or `local`)

**If using Cloudinary:**

- [ ] `CLOUDINARY_CLOUD_NAME` = `<your-cloud-name>`
- [ ] `CLOUDINARY_API_KEY` = `<your-api-key>`
- [ ] `CLOUDINARY_API_SECRET` = `<your-api-secret>`

**Optional (Production Settings):**

- [ ] `FLASK_ENV` = `production`
- [ ] `FLASK_DEBUG` = `false`

**Important:** Apply to **all environments** (Production, Preview, Development)

### ☐ 8. Redeploy After Setting Variables

Variables only take effect on new deployments:

- [ ] Go to Deployments tab
- [ ] Click "Redeploy" on latest deployment
- [ ] Wait for build to complete

## Post-Deployment Testing

### ☐ 9. Test PDF Generation

- [ ] Visit: `https://your-app.vercel.app/tools/convert/html-to-pdf`
- [ ] Upload `Newsletter.html` (the one that was failing)
- [ ] Click "Convert to PDF"
- [ ] Verify PDF downloads
- [ ] Open PDF and verify content is visible (not blank)

### ☐ 10. Test with Different HTML Files

- [ ] Test with `Newsletter_-_October_11.html` (previously working)
- [ ] Test with a simple HTML file
- [ ] Test with a complex nested table structure
- [ ] Verify all generate proper PDFs

### ☐ 11. Check Vercel Function Logs

- [ ] Go to Vercel Dashboard → Deployments → Latest → Functions
- [ ] Click on a function execution
- [ ] Verify no errors
- [ ] Check execution time (should be < 10s on Hobby plan)

### ☐ 12. Monitor Browserless Usage

- [ ] Go to https://www.browserless.io/dashboard
- [ ] Check "Usage" metrics
- [ ] Verify PDFs are being generated
- [ ] Monitor quota (6000 units/month on free tier)

## Troubleshooting

### Error: "BROWSERLESS_TOKEN is required for Vercel deployment"

✓ **Solution:** Add `BROWSERLESS_TOKEN` to Vercel environment variables and redeploy.

### Error: "Browserless screenshot request returned 401"

✓ **Solution:** Token is invalid. Get a new token from Browserless dashboard.

### Error: "Browserless screenshot request returned 429"

✓ **Solution:** Free tier quota exhausted. Upgrade plan or wait for quota reset.

### PDFs are still blank

1. [ ] Check Vercel function logs for errors
2. [ ] Verify HTML renders in browser first
3. [ ] Test with simple HTML to isolate issue
4. [ ] Check external image URLs are accessible

### Vercel build fails

1. [ ] Verify `api/requirements.txt` exists
2. [ ] Check for syntax errors in Python files
3. [ ] Review build logs in Vercel dashboard

### Function timeout (10s on Hobby plan)

✓ **Solution:** Complex PDFs might timeout. Upgrade to Pro ($20/mo) for 60s timeout.

## Success Criteria

Your deployment is successful when:

- ✅ Vercel deployment completes without errors
- ✅ Environment variables are set correctly
- ✅ PDF generation works from the web interface
- ✅ Previously failing `Newsletter.html` now generates proper PDF
- ✅ PDF content is visible (not blank pages)
- ✅ No errors in Vercel function logs
- ✅ Browserless usage is tracked in dashboard

## Ongoing Maintenance

### Weekly

- [ ] Check Browserless usage (avoid quota surprises)
- [ ] Review Vercel function execution times

### Monthly

- [ ] Review and optimize costs
- [ ] Check for Vercel/Browserless service updates
- [ ] Test PDF generation with new newsletter templates

### As Needed

- [ ] Rotate secrets (FLASK_SECRET_KEY) periodically
- [ ] Update Python dependencies
- [ ] Monitor Cloudinary storage usage

## Cost Management

### Free Tier Limits

- **Vercel Hobby:** 100 GB bandwidth, 100 GB-hr compute
- **Browserless Free:** 6000 units/month (~600 PDFs)
- **Cloudinary Free:** 25 GB storage

### When to Upgrade

**Upgrade Browserless** ($50/mo) when:
- Generating > 600 PDFs/month
- Need higher concurrency

**Upgrade Vercel Pro** ($20/mo) when:
- Need 60s function timeout (vs 10s)
- Bandwidth > 100 GB/month
- Need team collaboration

**Upgrade Cloudinary** ($89/mo) when:
- Storage > 25 GB
- Bandwidth > 25 GB/month

## Quick Reference

| Service | Free Tier | Paid Tier | Cost |
|---------|-----------|-----------|------|
| Vercel | Hobby | Pro | $20/mo |
| Browserless | 6000 units | 50k units | $50/mo |
| Cloudinary | 25 GB | 100 GB | $89/mo |
| **Total** | **$0/mo** | **Full** | **$159/mo** |

## Support & Documentation

- **This Project:**
  - `README.md` - General project info
  - `PDF_FIX_SUMMARY.md` - Technical fix details
  - `VERCEL_DEPLOYMENT.md` - Complete deployment guide
  - `TECHNICAL_DETAILS.md` - Deep technical analysis

- **External Resources:**
  - Vercel Docs: https://vercel.com/docs
  - Browserless Docs: https://www.browserless.io/docs
  - Cloudinary Docs: https://cloudinary.com/documentation

---

## Final Checklist Before Going Live

- [ ] All environment variables set in Vercel
- [ ] PDF generation tested successfully
- [ ] No errors in Vercel function logs
- [ ] Browserless usage monitoring set up
- [ ] Cost limits understood
- [ ] Backup/disaster recovery plan in place
- [ ] Custom domain configured (optional)
- [ ] SSL certificate verified (automatic on Vercel)

**Status:** Ready for production! 🚀

Your newsletter builder with PDF generation is now deployed on Vercel with the blank PDF fix applied.
