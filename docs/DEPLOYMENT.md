# Magneetar Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION STACK                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────┐ │
│  │   Vercel     │────▶│   Railway    │────▶│ Postgres │ │
│  │  (Dashboard) │     │  (Backend)   │     │ (Managed)│ │
│  │  Next.js 14  │     │  FastAPI     │     │          │ │
│  └──────────────┘     └──────────────┘     └──────────┘ │
│         │                    │                           │
│         ▼                    ▼                           │
│    Static assets        Media files                     │
│    (Global CDN)         (Railway Volume)                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Free Tier Costs

| Service | Free Tier | What You Get |
|---------|-----------|--------------|
| **Vercel** | Hobby plan | 100GB bandwidth, 1000 build min/mo, serverless functions |
| **Railway** | $5 credit/mo | ~500 hours of a tiny container, 1GB disk |
| **PostgreSQL** | Railway managed | 1GB storage, shared CPU |

**Total: $0/month** for a production-ready deployment.

---

## Step 1: Deploy Backend to Railway

### 1.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `Oluwanifemi-engineer/magneetar`

### 1.2 Configure Environment Variables
In Railway dashboard, go to Variables tab and add:

```bash
# Required
MT_API_KEY=your-master-api-key
MT_DEVICE_KEY=your-device-key
MT_JWT_SECRET=your-jwt-secret-min-32-chars

# Optional (for full features)
MT_DATABASE_URL=postgresql://...  # Railway auto-provisions Postgres
MT_REDIS_URL=redis://...          # Railway auto-provisions Redis
MT_SENTRY_DSN=https://...        # For crash reporting
MT_TWILIO_ACCOUNT_SID=...        # For SMS/WhatsApp alerts
MT_TWILIO_AUTH_TOKEN=...
MT_TWILIO_FROM_NUMBER=...

# Server config
MT_PORT=8000
MT_CORS_ORIGINS=https://magneetar.vercel.app,https://www.magneetar.me
```

### 1.3 Add Postgres Database
1. In Railway project, click "New" → "Database" → "PostgreSQL"
2. Railway auto-generates `DATABASE_URL`
3. Copy the `DATABASE_URL` to your server's environment variables

### 1.4 Deploy
Railway auto-deploys on every push to `main`. The health check endpoint is `/health`.

Your backend URL will be: `https://magneetar-server.up.railway.app`

---

## Step 2: Deploy Dashboard to Vercel

### 2.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New..." → "Project"
4. Import `Oluwanifemi-engineer/magneetar`
5. Framework Preset: **Next.js**
6. Root Directory: `dashboard`

### 2.2 Configure Environment Variables
```bash
# API connection
NEXT_PUBLIC_API_URL=https://magneetar-server.up.railway.app
```

### 2.3 Deploy
Vercel auto-deploys on every push to `main`. Preview deployments are created for PRs.

Your dashboard URL will be: `https://magneetar.vercel.app`

---

## Step 3: Configure Custom Domain

### 3.1 Add Domain to Vercel
1. In Vercel project settings → "Domains"
2. Add `magneetar.me` and `www.magneetar.me`
3. Vercel provides DNS records

### 3.2 Update DNS
At your domain registrar (Namecheap, Cloudflare, etc.):

```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

### 3.3 SSL Certificate
Vercel auto-provisions SSL certificates. No manual setup needed.

---

## Step 4: Update API CORS

After deployment, update the backend's CORS origins:

```bash
# In Railway environment variables
MT_CORS_ORIGINS=https://magneetar.me,https://www.magneetar.me,https://magneetar.vercel.app
```

---

## Step 5: Verify Deployment

```bash
# Check backend health
curl https://magneetar-server.up.railway.app/health

# Check dashboard
curl -I https://magneetar.vercel.app

# Check API connectivity from dashboard
open https://magneetar.vercel.app/login
```

---

## Switching Hosts Later

### From Vercel to Railway (full-stack)
```bash
# 1. Move dashboard to Railway
# Add to railway.json:
{
  "build": { "builder": "NIXPACKS" },
  "deploy": { "startCommand": "cd dashboard && npm run build && npm start" }
}

# 2. Update DNS to point to Railway
# 3. Remove vercel.json
```

### From Vercel to Cloudflare Pages
```bash
# 1. Connect GitHub repo to Cloudflare Pages
# 2. Set build command: cd dashboard && npm run build
# 3. Set output directory: dashboard/.next
# 4. Update DNS to Cloudflare nameservers
```

### From Railway to Fly.io
```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Initialize
fly launch

# 3. Deploy
fly deploy
```

**Key insight:** Since the dashboard is a standard Next.js app and the backend is a standard FastAPI app, you can switch hosts by just changing the deployment config — no code changes needed.

---

## Environment Variables Reference

### Backend (Railway)
| Variable | Required | Description |
|----------|----------|-------------|
| `MT_API_KEY` | ✅ | Master API key for admin access |
| `MT_DEVICE_KEY` | ✅ | Device registration key |
| `MT_JWT_SECRET` | ✅ | JWT signing secret (32+ chars) |
| `MT_DATABASE_URL` | ⚠️ | PostgreSQL connection string |
| `MT_REDIS_URL` | ⚠️ | Redis connection string |
| `MT_CORS_ORIGINS` | ⚠️ | Comma-separated allowed origins |
| `MT_SENTRY_DSN` | ❌ | Sentry crash reporting |
| `MT_TWILIO_*` | ❌ | SMS/WhatsApp alerts |

### Dashboard (Vercel)
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend API URL |

---

## Cost Optimization

### If traffic is low (< 100 users/month)
- **Vercel Hobby**: Free
- **Railway**: $5 credit covers ~500 hours
- **Total**: $0/month

### If traffic grows (100-1000 users/month)
- **Vercel Pro**: $20/month (1TB bandwidth, team features)
- **Railway**: ~$5-10/month (more compute)
- **Total**: ~$25-30/month

### If traffic is high (1000+ users/month)
- **Vercel Pro**: $20/month
- **Railway**: $10-20/month
- **Postgres**: $10-20/month (dedicated)
- **Total**: ~$40-60/month

---

## Troubleshooting

### Dashboard can't connect to API
1. Check `NEXT_PUBLIC_API_URL` in Vercel
2. Check `MT_CORS_ORIGINS` in Railway includes your Vercel domain
3. Check Railway logs for CORS errors

### Backend crashes on startup
1. Check Railway logs for missing environment variables
2. Ensure `MT_API_KEY`, `MT_DEVICE_KEY`, `MT_JWT_SECRET` are set
3. Check `DATABASE_URL` is valid

### Static assets not loading
1. Check Vercel deployment logs
2. Ensure `public/` folder is in the `dashboard/` directory
3. Check `next.config.js` for asset prefix configuration
