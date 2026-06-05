from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import sqlite3, os, base64, datetime, hashlib, secrets

app = FastAPI(title="GhostTracker Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "ghosttracker.db"
API_KEY  = os.environ.get("GT_API_KEY", "changeme-set-in-env")

# ─── Database setup ────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS devices (
            id          TEXT PRIMARY KEY,
            alias       TEXT,
            last_seen   TEXT,
            registered  TEXT
        );

        CREATE TABLE IF NOT EXISTS locations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id   TEXT,
            lat         REAL,
            lng         REAL,
            accuracy    REAL,
            provider    TEXT,
            timestamp   TEXT
        );

        CREATE TABLE IF NOT EXISTS media (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id   TEXT,
            type        TEXT,   -- 'photo' | 'audio'
            data_b64    TEXT,
            timestamp   TEXT
        );

        CREATE TABLE IF NOT EXISTS commands (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id   TEXT,
            command     TEXT,   -- 'lock' | 'wipe' | 'capture_photo' | 'capture_audio' | 'ping'
            params      TEXT,
            status      TEXT DEFAULT 'pending',
            issued_at   TEXT,
            executed_at TEXT
        );
    """)
    conn.commit()
    conn.close()

init_db()

# ─── Auth ──────────────────────────────────────────────────────────────────────

def verify_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

def verify_device_key(x_api_key: str = Header(...)):
    """Devices use the same key for now; can be split later."""
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

# ─── Models ────────────────────────────────────────────────────────────────────

class LocationReport(BaseModel):
    device_id: str
    lat: float
    lng: float
    accuracy: Optional[float] = None
    provider: Optional[str] = "gps"
    timestamp: Optional[str] = None

class MediaReport(BaseModel):
    device_id: str
    type: str          # 'photo' | 'audio'
    data_b64: str
    timestamp: Optional[str] = None

class CommandRequest(BaseModel):
    device_id: str
    command: str
    params: Optional[str] = ""

# ─── Device endpoints (called by the Android app) ──────────────────────────────

@app.post("/api/device/location", dependencies=[Depends(verify_device_key)])
def post_location(report: LocationReport, db: sqlite3.Connection = Depends(get_db)):
    ts = report.timestamp or datetime.datetime.utcnow().isoformat()
    db.execute(
        "INSERT INTO locations (device_id, lat, lng, accuracy, provider, timestamp) VALUES (?,?,?,?,?,?)",
        (report.device_id, report.lat, report.lng, report.accuracy, report.provider, ts)
    )
    db.execute(
        "INSERT INTO devices (id, last_seen, registered) VALUES (?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen",
        (report.device_id, ts, ts)
    )
    db.commit()
    return {"status": "ok"}

@app.post("/api/device/media", dependencies=[Depends(verify_device_key)])
def post_media(report: MediaReport, db: sqlite3.Connection = Depends(get_db)):
    ts = report.timestamp or datetime.datetime.utcnow().isoformat()
    db.execute(
        "INSERT INTO media (device_id, type, data_b64, timestamp) VALUES (?,?,?,?)",
        (report.device_id, report.type, report.data_b64, ts)
    )
    db.commit()
    return {"status": "ok"}

@app.get("/api/device/commands/{device_id}", dependencies=[Depends(verify_device_key)])
def poll_commands(device_id: str, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT id, command, params FROM commands WHERE device_id=? AND status='pending'",
        (device_id,)
    ).fetchall()
    return {"commands": [dict(r) for r in rows]}

@app.post("/api/device/commands/{command_id}/ack", dependencies=[Depends(verify_device_key)])
def ack_command(command_id: int, db: sqlite3.Connection = Depends(get_db)):
    db.execute(
        "UPDATE commands SET status='executed', executed_at=? WHERE id=?",
        (datetime.datetime.utcnow().isoformat(), command_id)
    )
    db.commit()
    return {"status": "ok"}

# ─── Dashboard endpoints (called by the web UI) ────────────────────────────────

@app.get("/api/dashboard/devices", dependencies=[Depends(verify_key)])
def list_devices(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute("SELECT * FROM devices ORDER BY last_seen DESC").fetchall()
    return {"devices": [dict(r) for r in rows]}

@app.get("/api/dashboard/locations/{device_id}", dependencies=[Depends(verify_key)])
def get_locations(device_id: str, limit: int = 200, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT * FROM locations WHERE device_id=? ORDER BY timestamp DESC LIMIT ?",
        (device_id, limit)
    ).fetchall()
    return {"locations": [dict(r) for r in rows]}

@app.get("/api/dashboard/media/{device_id}", dependencies=[Depends(verify_key)])
def get_media(device_id: str, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT id, device_id, type, timestamp FROM media WHERE device_id=? ORDER BY timestamp DESC",
        (device_id,)
    ).fetchall()
    return {"media": [dict(r) for r in rows]}

@app.get("/api/dashboard/media/file/{media_id}", dependencies=[Depends(verify_key)])
def get_media_file(media_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute("SELECT * FROM media WHERE id=?", (media_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404)
    return {"id": row["id"], "type": row["type"], "data_b64": row["data_b64"], "timestamp": row["timestamp"]}

@app.post("/api/dashboard/command", dependencies=[Depends(verify_key)])
def issue_command(cmd: CommandRequest, db: sqlite3.Connection = Depends(get_db)):
    ts = datetime.datetime.utcnow().isoformat()
    cur = db.execute(
        "INSERT INTO commands (device_id, command, params, issued_at) VALUES (?,?,?,?)",
        (cmd.device_id, cmd.command, cmd.params, ts)
    )
    db.commit()
    return {"status": "queued", "command_id": cur.lastrowid}

@app.get("/api/dashboard/commands/{device_id}", dependencies=[Depends(verify_key)])
def get_commands(device_id: str, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT * FROM commands WHERE device_id=? ORDER BY issued_at DESC LIMIT 50",
        (device_id,)
    ).fetchall()
    return {"commands": [dict(r) for r in rows]}

@app.get("/health")
def health():
    return {"status": "online", "time": datetime.datetime.utcnow().isoformat()}
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional, List
import sqlite3, os, base64, datetime, hashlib, secrets

app = FastAPI(title="GhostTracker Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "ghosttracker.db"
API_KEY  = os.environ.get("GT_API_KEY", "changeme-set-in-env")

# ─── Database setup ────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript("""
        CREATE TABLE IF NOT EXISTS devices (
            id          TEXT PRIMARY KEY,
            alias       TEXT,
            last_seen   TEXT,
            registered  TEXT
        );

        CREATE TABLE IF NOT EXISTS locations (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id   TEXT,
            lat         REAL,
            lng         REAL,
            accuracy    REAL,
            provider    TEXT,
            timestamp   TEXT
        );

        CREATE TABLE IF NOT EXISTS media (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id   TEXT,
            type        TEXT,   -- 'photo' | 'audio'
            data_b64    TEXT,
            timestamp   TEXT
        );

        CREATE TABLE IF NOT EXISTS commands (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id   TEXT,
            command     TEXT,   -- 'lock' | 'wipe' | 'capture_photo' | 'capture_audio' | 'ping'
            params      TEXT,
            status      TEXT DEFAULT 'pending',
            issued_at   TEXT,
            executed_at TEXT
        );
    """)
    conn.commit()
    conn.close()

init_db()

# ─── Auth ──────────────────────────────────────────────────────────────────────

def verify_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

def verify_device_key(x_api_key: str = Header(...)):
    """Devices use the same key for now; can be split later."""
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

# ─── Models ────────────────────────────────────────────────────────────────────

class LocationReport(BaseModel):
    device_id: str
    lat: float
    lng: float
    accuracy: Optional[float] = None
    provider: Optional[str] = "gps"
    timestamp: Optional[str] = None

class MediaReport(BaseModel):
    device_id: str
    type: str          # 'photo' | 'audio'
    data_b64: str
    timestamp: Optional[str] = None

class CommandRequest(BaseModel):
    device_id: str
    command: str
    params: Optional[str] = ""

# ─── Device endpoints (called by the Android app) ──────────────────────────────

@app.post("/api/device/location", dependencies=[Depends(verify_device_key)])
def post_location(report: LocationReport, db: sqlite3.Connection = Depends(get_db)):
    ts = report.timestamp or datetime.datetime.utcnow().isoformat()
    db.execute(
        "INSERT INTO locations (device_id, lat, lng, accuracy, provider, timestamp) VALUES (?,?,?,?,?,?)",
        (report.device_id, report.lat, report.lng, report.accuracy, report.provider, ts)
    )
    db.execute(
        "INSERT INTO devices (id, last_seen, registered) VALUES (?,?,?) "
        "ON CONFLICT(id) DO UPDATE SET last_seen=excluded.last_seen",
        (report.device_id, ts, ts)
    )
    db.commit()
    return {"status": "ok"}

@app.post("/api/device/media", dependencies=[Depends(verify_device_key)])
def post_media(report: MediaReport, db: sqlite3.Connection = Depends(get_db)):
    ts = report.timestamp or datetime.datetime.utcnow().isoformat()
    db.execute(
        "INSERT INTO media (device_id, type, data_b64, timestamp) VALUES (?,?,?,?)",
        (report.device_id, report.type, report.data_b64, ts)
    )
    db.commit()
    return {"status": "ok"}

@app.get("/api/device/commands/{device_id}", dependencies=[Depends(verify_device_key)])
def poll_commands(device_id: str, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT id, command, params FROM commands WHERE device_id=? AND status='pending'",
        (device_id,)
    ).fetchall()
    return {"commands": [dict(r) for r in rows]}

@app.post("/api/device/commands/{command_id}/ack", dependencies=[Depends(verify_device_key)])
def ack_command(command_id: int, db: sqlite3.Connection = Depends(get_db)):
    db.execute(
        "UPDATE commands SET status='executed', executed_at=? WHERE id=?",
        (datetime.datetime.utcnow().isoformat(), command_id)
    )
    db.commit()
    return {"status": "ok"}

# ─── Dashboard endpoints (called by the web UI) ────────────────────────────────

@app.get("/api/dashboard/devices", dependencies=[Depends(verify_key)])
def list_devices(db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute("SELECT * FROM devices ORDER BY last_seen DESC").fetchall()
    return {"devices": [dict(r) for r in rows]}

@app.get("/api/dashboard/locations/{device_id}", dependencies=[Depends(verify_key)])
def get_locations(device_id: str, limit: int = 200, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT * FROM locations WHERE device_id=? ORDER BY timestamp DESC LIMIT ?",
        (device_id, limit)
    ).fetchall()
    return {"locations": [dict(r) for r in rows]}

@app.get("/api/dashboard/media/{device_id}", dependencies=[Depends(verify_key)])
def get_media(device_id: str, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT id, device_id, type, timestamp FROM media WHERE device_id=? ORDER BY timestamp DESC",
        (device_id,)
    ).fetchall()
    return {"media": [dict(r) for r in rows]}

@app.get("/api/dashboard/media/file/{media_id}", dependencies=[Depends(verify_key)])
def get_media_file(media_id: int, db: sqlite3.Connection = Depends(get_db)):
    row = db.execute("SELECT * FROM media WHERE id=?", (media_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404)
    return {"id": row["id"], "type": row["type"], "data_b64": row["data_b64"], "timestamp": row["timestamp"]}

@app.post("/api/dashboard/command", dependencies=[Depends(verify_key)])
def issue_command(cmd: CommandRequest, db: sqlite3.Connection = Depends(get_db)):
    ts = datetime.datetime.utcnow().isoformat()
    cur = db.execute(
        "INSERT INTO commands (device_id, command, params, issued_at) VALUES (?,?,?,?)",
        (cmd.device_id, cmd.command, cmd.params, ts)
    )
    db.commit()
    return {"status": "queued", "command_id": cur.lastrowid}

@app.get("/api/dashboard/commands/{device_id}", dependencies=[Depends(verify_key)])
def get_commands(device_id: str, db: sqlite3.Connection = Depends(get_db)):
    rows = db.execute(
        "SELECT * FROM commands WHERE device_id=? ORDER BY issued_at DESC LIMIT 50",
        (device_id,)
    ).fetchall()
    return {"commands": [dict(r) for r in rows]}

@app.get("/health")
def health():
    return {"status": "online", "time": datetime.datetime.utcnow().isoformat()}
