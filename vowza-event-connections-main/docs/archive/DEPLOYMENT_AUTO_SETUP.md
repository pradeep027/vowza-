# Vowza Auto-Deployment Setup

## Current Status
✅ Your code is now pushed to GitHub (`main` branch)  
✅ Vercel is connected to your GitHub repository  
✅ GitHub Actions workflow is ready  

---

## How to Enable Auto-Deployment

### Option 1: Simple (Let Vercel Handle It) ⭐ RECOMMENDED

**Vercel auto-deploys every push to `main` branch by default.**

1. **Go to your Vercel dashboard:** https://vercel.com/dashboard
2. **Find your project** (Vowza)
3. **Go to Settings → Git**
4. **Verify "Deploy on Push" is enabled** ✅
5. **Done!** Every git push to `main` automatically deploys

**To deploy promotional video changes:**
```bash
git push origin main
# Vercel automatically deploys within 30-60 seconds
```

---

### Option 2: Advanced (GitHub Actions Workflow)

I've created a GitHub Actions workflow that:
- Runs on every push to `main`
- Runs tests/linting first
- Builds the project
- Deploys to Vercel

**To activate this workflow, you need to add GitHub Secrets:**

#### Step 1: Get your Vercel tokens
1. Go to https://vercel.com/account/tokens
2. Create a new token (name it "VERCEL_TOKEN")
3. Copy the token value

#### Step 2: Get your Vercel project info
1. Go to your project dashboard: https://vercel.com/dashboard/project/vowza (or your project name)
2. Go to **Settings → General**
3. Find and copy:
   - **Project ID** → use as `VERCEL_PROJECT_ID`
   - **Organization/Team ID** → use as `VERCEL_ORG_ID`

#### Step 3: Add GitHub Secrets
1. Go to GitHub: https://github.com/pradeep027/vowza-/settings/secrets/actions
2. Click **New repository secret**
3. Add these secrets:

| Name | Value |
|------|-------|
| `VERCEL_TOKEN` | Your token from Step 1 |
| `VERCEL_ORG_ID` | Your org/team ID from Step 2 |
| `VERCEL_PROJECT_ID` | Your project ID from Step 2 |

#### Step 4: Done!
Now when you push code, GitHub Actions will:
1. Check out code
2. Install dependencies
3. Build project
4. Deploy to Vercel
5. Show deployment status on GitHub

---

## Test Auto-Deployment Now

Make a small change and push:

```bash
# Example: Update a comment
git add .
git commit -m "Test: Auto-deployment workflow"
git push origin main
```

Then check:
1. **GitHub Actions**: https://github.com/pradeep027/vowza-/actions
   - Should show green checkmark ✅
2. **Vercel Deployments**: https://vercel.com/dashboard/project/vowza
   - Should show "Ready" status ✅

---

## Promotional Video Deployment Status

**Latest code pushed:**
- ✅ Promotional video display fixed
- ✅ One-time display per user
- ✅ Mobile responsive
- ✅ Improved autoplay with fallback
- ✅ Viewer count removed from customer UI
- ✅ Build succeeds (0 errors)
- ✅ Pushed to Git

**What happens when you deploy:**
1. Latest code pulled from `main` branch
2. Dependencies installed
3. App built (TypeScript compiled, Tailwind processed, Vite bundled)
4. Static files deployed to Vercel CDN
5. Users see new features within minutes

---

## Current Deployment Command

If you want to manually deploy without git:

```bash
npm run build
# Then manually upload dist/ folder to your hosting
```

Or via Vercel CLI:
```bash
npm i -g vercel
vercel --prod
```

---

## Monitoring Deployments

**Check Vercel Dashboard:**
- https://vercel.com/dashboard/project/vowza
- Shows deployment history
- Shows build logs
- Shows real-time analytics

**Check GitHub Actions:**
- https://github.com/pradeep027/vowza-/actions
- Shows workflow runs
- Shows build/deploy status
- Shows errors (if any)

---

## Troubleshooting

**Build fails?**
- Check GitHub Actions logs: https://github.com/pradeep027/vowza-/actions
- Check Vercel build logs: Vercel dashboard → project → Deployments
- Run locally: `npm run build`

**Deployment doesn't update?**
- Clear browser cache (Ctrl+Shift+Delete)
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Check Vercel deployment date

**Video still not showing?**
- Verify you're logged in
- Clear localStorage (DevTools → Application → Clear All)
- Check browser console logs

---

## Next Steps

1. **Enable auto-deployment** (choose Option 1 or 2 above)
2. **Test by making a small code change and pushing**
3. **Verify deployment on Vercel dashboard**
4. **Verify changes live on vowza.com**

---

## Questions?

If deployment fails or takes too long, check:
1. GitHub Actions logs
2. Vercel build logs
3. Browser console (F12 → Console)
4. Vercel deployment status

The promotional video code is ready. Just deploy! 🚀
