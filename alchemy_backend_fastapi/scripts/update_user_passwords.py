"""
Script to update all users in the database with bcrypted password "pass"
Run this script to ensure all users have a password set.
"""
import sys
import psycopg2
import os

# Add parent directory to path to import config and services
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.auth_service import hash_password
from config import DB_URL

def update_all_user_passwords(force=False):
    """Update all users in the database with bcrypted password 'pass'
    
    Args:
        force: If True, update all passwords even if they're already bcrypted
    """
    default_password = "pass"
    hashed_password = hash_password(default_password)
    
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Get all users
        cur.execute("SELECT id, email, password FROM users")
        users = cur.fetchall()
        
        updated_count = 0
        skipped_count = 0
        
        print(f"Found {len(users)} users in database")
        print(f"Updating passwords to bcrypted version of '{default_password}'...")
        print("-" * 60)
        
        for user_id, email, current_password in users:
            # Only update if password is NULL or empty, or if force is True
            if not current_password:
                cur.execute(
                    "UPDATE users SET password = %s WHERE id = %s",
                    (hashed_password, user_id)
                )
                updated_count += 1
                print(f"[OK] Updated password for: {email} (ID: {user_id})")
            elif force:
                # Force update all passwords
                cur.execute(
                    "UPDATE users SET password = %s WHERE id = %s",
                    (hashed_password, user_id)
                )
                updated_count += 1
                print(f"[OK] Force updated password for: {email} (ID: {user_id})")
            else:
                # Check if password is already bcrypted (starts with $2b$ or $2a$)
                if current_password.startswith('$2b$') or current_password.startswith('$2a$'):
                    skipped_count += 1
                    print(f"[SKIP] Skipped (already bcrypted): {email} (ID: {user_id})")
                else:
                    # Update plain text password to bcrypted
                    cur.execute(
                        "UPDATE users SET password = %s WHERE id = %s",
                        (hashed_password, user_id)
                    )
                    updated_count += 1
                    print(f"[OK] Updated plain text password to bcrypted for: {email} (ID: {user_id})")
        
        conn.commit()
        conn.close()
        
        print("-" * 60)
        print(f"[OK] Successfully updated {updated_count} users")
        print(f"[SKIP] Skipped {skipped_count} users (already had bcrypted passwords)")
        print(f"Total users processed: {len(users)}")
        
        return {
            "success": True,
            "updated": updated_count,
            "skipped": skipped_count,
            "total": len(users)
        }
        
    except Exception as e:
        print(f"Error updating passwords: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import sys
    
    print("=" * 60)
    print("User Password Update Script")
    print("=" * 60)
    print()
    
    # Check for --force flag
    force = "--force" in sys.argv
    
    if not force:
        try:
            confirm = input("This will update all user passwords to bcrypted 'pass'. Continue? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Aborted.")
                sys.exit(0)
        except EOFError:
            # Non-interactive mode - run automatically
            print("Running in non-interactive mode...")
    
    print()
    result = update_all_user_passwords(force=force)
    
    if result["success"]:
        print()
        print("=" * 60)
        print("Password update completed successfully!")
        print("=" * 60)
        sys.exit(0)
    else:
        print()
        print("=" * 60)
        print(f"Password update failed: {result.get('error', 'Unknown error')}")
        print("=" * 60)
        sys.exit(1)
