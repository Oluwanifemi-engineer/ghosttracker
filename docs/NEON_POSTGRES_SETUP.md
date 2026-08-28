# Neon PostgreSQL Setup — Free Database

Neon provides a free PostgreSQL database that's perfect for Magneetar's MVP. The free tier gives you 0.5GB storage — enough for 1,000+ devices with location history.

## Why Neon Over SQLite?

| Feature | SQLite | Neon Free |
|---------|--------|-----------|
| Concurrent writes | Single-writer lock | Multi-writer |
| Horizontal scale | None | Read replicas |
| Max storage | Disk size | 0.5 GB |
| Max connections | 1 | 100 |
| Cost | Free | Free |

**When to switch:** When you have 20+ testers sending location updates simultaneously, SQLite's single-writer lock will cause timeouts. Neon handles this natively.

## Step 1: Create Neon Account

1. Go to [neon.tech](https://neon.tech)
2. Sign up with GitHub (fastest)
3. Click **"Create a project"**
4. Project name: `magneetar`
5. Region: Choose closest to your users (e.g., `us-east-1` or `eu-west-1`)
6. Click **"Create project"**

## Step 2: Get Connection String

1. In the Neon dashboard, go to **"Connection details"**
2. Copy the connection string. It looks like:
```
postgresql://neondb_owner:xxxx@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

3. **Important:** Replace `?sslmode=require` with `?sslmode=require` (keep it — Neon requires SSL).

## Step 3: Configure Magneetar

1. Edit `server/.env` on your VPS:
```bash
# Uncomment and set the Neon connection string:
MT_DATABASE_URL=postgresql://neondb_owner:xxxx@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

2. Install the PostgreSQL adapter (already in requirements.txt):
```bash
cd ~/magneetar/server
source venv/bin/activate
pip install asyncpg psycopg2-binary
```

3. Restart the server:
```bash
cd ~/magneetar && docker compose restart server
```

4. Verify PostgreSQL is connected:
```bash
docker logs magneetar-server | grep -i postgres
# Should see: "PostgreSQL wired via the storage facade"
```

## Step 4: Verify Schema

The server auto-creates all tables on first connect. Verify:
```bash
docker exec magneetar-server python -c "
from storage import init_pg_store
init_pg_store()
print('Schema created successfully')
"
```

## How It Works

When `MT_DATABASE_URL` is set:
- The storage facade (`storage.py`) routes all reads/writes to PostgreSQL
- SQLite is completely bypassed
- All existing code works unchanged (the facade is transparent)
- Schema is auto-created on first connect

When `MT_DATABASE_URL` is NOT set:
- SQLite is used (default, zero-config)
- Everything works the same way

## Free Tier Limits

| Feature | Free Limit | Magneetar Usage |
|---------|-----------|-----------------|
| Storage | 0.5 GB | ~50 MB (1,000 devices) |
| Compute | 191.9 hours/month | ~720 hours (24/7) |
| Connections | 100 | ~10 (4 workers + dashboard) |
| Branches | 10 | 1 (main) |
| Projects | 1 | 1 |

**Warning:** The compute hours are shared across all branches. For a 24/7 server, you'll use ~720 hours/month. Neon's free tier gives 191.9 hours — this means **the database will pause after ~3 days of continuous use.**

**Workaround:** Use Neon's "Autosuspend" feature to pause the database when idle, and let it wake up on first connection. This extends the free tier significantly.

## Alternative: Supabase Free Tier

If Neon's compute limit is too restrictive, Supabase offers:
- 500 MB storage (same as Neon)
- 50,000 monthly active users
- Unlimited API requests
- No compute hour limit

Setup is similar — just use the Supabase connection string instead.

## Troubleshooting

**Connection refused:**
- Ensure the Neon database is not paused (check dashboard)
- Verify the connection string is correct
- Check that `sslmode=require` is present

**Schema errors:**
- The server auto-creates tables on startup
- Check logs: `docker logs magneetar-server | grep -i schema`

**Slow queries:**
- Neon free tier has limited compute
- Consider adding indexes for frequently queried columns
- Monitor query performance in the Neon dashboard
