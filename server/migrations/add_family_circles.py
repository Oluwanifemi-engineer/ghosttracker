"""
Migration: Add Family Circles and Payment Subscription tables.
Run once: python -m migrations.add_family_circles
"""

import os
import sqlite3

DB_PATH = os.getenv("MT_DATABASE_PATH", "data/magneetar.db")


def migrate():
    conn = sqlite3.connect(DB_PATH)
    db = conn.cursor()

    # ─── Family Circles ──────────────────────────────────────────────────
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS family_circles (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            name TEXT NOT NULL DEFAULT 'My Family',
            created_at TEXT NOT NULL,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """
    )

    db.execute(
        """
        CREATE TABLE IF NOT EXISTS family_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            circle_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'member',
            joined_at TEXT NOT NULL,
            FOREIGN KEY (circle_id) REFERENCES family_circles(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(circle_id, user_id)
        )
    """
    )

    # ─── Payment Subscription Columns ────────────────────────────────────
    # Add columns to users table if they don't exist
    existing_cols = {row[1] for row in db.execute("PRAGMA table_info(users)").fetchall()}

    new_cols = [
        ("subscription_plan", "TEXT DEFAULT 'free'"),
        ("subscription_status", "TEXT DEFAULT 'inactive'"),
        ("subscription_started", "TEXT"),
        ("subscription_expires", "TEXT"),
        ("paystack_reference", "TEXT"),
        ("paystack_customer_code", "TEXT"),
    ]

    for col_name, col_def in new_cols:
        if col_name not in existing_cols:
            db.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
            print(f"  + Added column: {col_name}")
        else:
            print(f"  - Column exists: {col_name}")

    # ─── Indexes ─────────────────────────────────────────────────────────
    db.execute("CREATE INDEX IF NOT EXISTS idx_family_circles_owner ON family_circles(owner_id)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_family_members_circle ON family_members(circle_id)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_plan, subscription_status)")

    conn.commit()
    conn.close()
    print("Migration complete: family_circles + payment columns")


if __name__ == "__main__":
    migrate()
