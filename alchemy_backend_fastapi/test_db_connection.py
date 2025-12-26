#!/usr/bin/env python3
"""Test database connection and check if tables exist."""

import os
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# Load .env file directly
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    load_dotenv(env_file)
    print(f"[*] Loaded .env from: {env_file}")
else:
    print(f"[WARNING] .env file not found: {env_file}")

DB_URL = os.getenv("DB_URL")
if not DB_URL:
    print("[ERROR] DB_URL not found in environment!")
    exit(1)

try:
    print(f"[*] Connecting to database...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Check PostgreSQL version
    cur.execute('SELECT version()')
    version = cur.fetchone()[0]
    print(f"[OK] PostgreSQL version: {version.split(',')[0]}")
    
    # Check current database
    cur.execute('SELECT current_database()')
    db_name = cur.fetchone()[0]
    print(f"[OK] Current database: {db_name}")
    
    # Check if tables exist
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
    """)
    tables = cur.fetchall()
    
    if tables:
        print(f"\n[OK] Found {len(tables)} tables:")
        for table in tables[:20]:  # Show first 20
            print(f"  - {table[0]}")
        if len(tables) > 20:
            print(f"  ... and {len(tables) - 20} more")
    else:
        print("\n[WARNING] No tables found in the database!")
        print("[INFO] You may need to run the database setup script.")
    
    # Check if users table exists and has data
    cur.execute("""
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'users'
    """)
    users_table_exists = cur.fetchone()[0] > 0
    
    if users_table_exists:
        cur.execute("SELECT COUNT(*) FROM users")
        user_count = cur.fetchone()[0]
        print(f"\n[OK] Users table exists with {user_count} users")
    else:
        print("\n[WARNING] Users table does not exist!")
    
    conn.close()
    print("\n[OK] Database connection successful!")
    
except psycopg2.Error as e:
    print(f"\n[ERROR] Database connection failed: {e}")
    exit(1)
except Exception as e:
    print(f"\n[ERROR] Unexpected error: {e}")
    exit(1)

