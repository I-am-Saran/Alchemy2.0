"""
Set a specific user's password in the database to a provided value (bcrypt).
Usage (PowerShell):
  $env:ENVIRONMENT = "development"; $env:DB_URL = "<connection>"; python alchemy_backend_fastapi/scripts/set_user_password.py --email admin@alchemy.local --password Alchemygrc@123
"""
import sys
import os
import argparse
import psycopg2

# Ensure project root is on sys.path so we can import config and services
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from services.auth_service import hash_password  # uses bcrypt
from config import DB_URL


def set_user_password(email: str, plain_password: str) -> bool:
    hashed = hash_password(plain_password)
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("UPDATE users SET password = %s, updated_at = NOW() WHERE LOWER(email) = LOWER(%s)", (hashed, email))
    updated = cur.rowcount
    conn.commit()
    conn.close()
    return updated > 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    ok = set_user_password(args.email.strip(), args.password)
    if ok:
        print(f"OK: Updated password for {args.email}")
        sys.exit(0)
    else:
        print(f"ERROR: No user found for {args.email}")
        sys.exit(2)


if __name__ == "__main__":
    main()

