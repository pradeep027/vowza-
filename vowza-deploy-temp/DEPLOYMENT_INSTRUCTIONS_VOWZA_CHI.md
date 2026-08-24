# DEPLOYMENT INSTRUCTIONS - vowza-chi.vercel.app

**Status:** ⚠️ **MANUAL ACTION REQUIRED**

---

## SITUATION

The commit `9c89c73` has been successfully committed and pushed to origin/main.

However, the Vercel project configuration for the `vowza` project (which serves vowza-chi.vercel.app) has an incorrect rootDirectory setting that prevents CLI deployment.

---

## WHAT NEEDS TO BE DONE

### Option 1: Fix Vercel Settings (Recommended)

1. Go to: https://vercel.com/pradeep027s-projects/vowza/settings
2. Navigate to: **Build & Development**
3. Find: **Root Directory**
4. Change from: `vowza-event-connections-main`
5. Change to: `. (current directory)` or leave blank
6. Save settings
7. Then redeploy from CLI: `vercel --prod`

OR

### Option 2: Trigger Deployment via GitHub Actions

Since the commit is already at origin/main, the GitHub Actions workflow should automatically deploy it (if configured correctly).

1. Check: GitHub repository → Actions tab
2. Verify the "Deploy to Vercel" workflow ran for commit 9c89c73
3. Check if deployment went to `vowza` project (not `vowza-event-connections-main`)

If workflow didn't run or deployed to wrong project:
1. Manual trigger in GitHub Actions or
2. Go to: https://vercel.com/pradeep027s-projects/vowza/deployments
3. Click "Deploy Now" or "Redeploy"

---

## COMMIT READY FOR DEPLOYMENT

**Commit:** `9c89c73453859e321b5185ec1470cc5d900eda3a`

**Changes:**
- src/lib/providerCategory.ts (added 4 new functions)
- src/pages/vendor/VendorPackages.tsx (added routing logic)
- Plus previous: PhotoVideoPackageManager.tsx + migration

**Build Status:** ✅ Verified locally (3232 modules, no errors)

**Git Status:** ✅ Pushed to origin/main

---

## VERCEL PROJECT INFO

**Project Name:** vowza  
**Project ID:** prj_5mX5v41IFnIJMamlcvGQp64FEEKr  
**Main URL:** https://vowza-chi.vercel.app  
**Organization:** team_ypWext3JQ8gvnCi4dHgKPq8D

---

## AFTER FIXING VERCEL SETTINGS

Once the rootDirectory is fixed, run:

```bash
cd vowza-event-connections-main
vercel --prod --yes
```

This will deploy commit 9c89c73 to production at vowza-chi.vercel.app.

---

## VERIFICATION AFTER DEPLOYMENT

1. Hard refresh: https://vowza-chi.vercel.app (Ctrl+Shift+R)
2. Log in as vendor with profession='photography_videography'
3. Go to: Services & Packages → Create Package
4. Verify:
   - PhotoVideoPackageManager loads ✓
   - Gallery accepts 15+ images ✓
   - Video upload UI present ✓
   - "Photography + Videography" option available ✓

---

## NEXT ACTION

**User action required:**
1. Go to Vercel project settings
2. Fix the Root Directory setting
3. Redeploy

OR manually trigger in GitHub Actions.

Once fixed, confirm deployment is live on https://vowza-chi.vercel.app
