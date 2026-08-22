# GitHub Actions Secrets Reference

Add these secrets in your GitHub repo: Settings → Secrets and variables → Actions

## Required for Vercel Deployment

| Secret | How to Get |
|--------|------------|
| `VERCEL_TOKEN` | Vercel dashboard → Settings → Tokens → Create |
| `VERCEL_ORG_ID` | Run `vercel link` locally, check `.vercel/project.json` |
| `VERCEL_PROJECT_ID` | Run `vercel link` locally, check `.vercel/project.json` |

### Setup Steps
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Link project (in dashboard/ directory)
cd dashboard
vercel link

# 4. Check the generated .vercel/project.json
cat .vercel/project.json
# Copy "orgId" → VERCEL_ORG_ID
# Copy "projectId" → VERCEL_PROJECT_ID

# 5. Get token
# Go to https://vercel.com/account/tokens
# Create new token → copy to VERCEL_TOKEN
```

## Required for Railway Deployment

| Secret | How to Get |
|--------|------------|
| `RAILWAY_TOKEN` | Railway dashboard → Account Settings → Tokens → Create |

### Setup Steps
```bash
# 1. Install Railway CLI
npm i -g @railway/cli

# 2. Login
railway login

# 3. Link project
railway link

# 4. Get token
# Go to https://railway.app/account/tokens
# Create new token → copy to RAILWAY_TOKEN
```

## Optional: Sentry (Crash Reporting)

| Secret | How to Get |
|--------|------------|
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens → Create |
| `SENTRY_ORG` | Your Sentry org slug |
| `SENTRY_PROJECT` | Your Sentry project slug |

## Verification

After adding secrets, trigger a deployment:
```bash
git push origin main
```

Check the Actions tab in GitHub to monitor deployment progress.
