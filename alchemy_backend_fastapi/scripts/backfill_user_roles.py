"""
Script to backfill user_roles table for all existing users.
Maps the 'role' field in users table to actual role assignments in user_roles table.
"""
import sys
import psycopg2
import os

# Add parent directory to path to import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DB_URL

# Role name mapping from users.role field to actual role names
ROLE_NAME_MAPPING = {
    "QA": "Contributor",
    "DEV": "Contributor",
    "PM": "Contributor",
    "Others": "Viewer",
    "Viewer": "Viewer",
    "Contributor": "Contributor",
    "Admin": "Admin",
    "Super Admin": "Super Admin",
}

DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

def get_role_id_by_name(role_name: str, tenant_id: str, cur) -> str:
    """Get role ID by role name."""
    cur.execute(
        "SELECT id FROM roles WHERE role_name = %s AND tenant_id = %s LIMIT 1",
        (role_name, tenant_id)
    )
    result = cur.fetchone()
    if result:
        return str(result[0])
    return None

def backfill_user_roles(tenant_id: str = DEFAULT_TENANT_ID, force: bool = False):
    """Backfill user_roles table for all users."""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Get all users
        cur.execute("SELECT id, email, role, tenant_id FROM users WHERE is_active = TRUE")
        users = cur.fetchall()
        
        updated_count = 0
        skipped_count = 0
        error_count = 0
        
        print(f"Found {len(users)} active users in database")
        print(f"Backfilling user_roles table...")
        print("-" * 60)
        
        for user_id, email, user_role, user_tenant_id in users:
            # Use user's tenant_id if available, otherwise use default
            effective_tenant_id = user_tenant_id or tenant_id
            
            # Map user role to actual role name
            mapped_role_name = ROLE_NAME_MAPPING.get(user_role, "Viewer") if user_role else "Viewer"
            
            # Get role ID
            role_id = get_role_id_by_name(mapped_role_name, effective_tenant_id, cur)
            if not role_id:
                print(f"[ERROR] Role '{mapped_role_name}' not found for user {email} (ID: {user_id})")
                error_count += 1
                continue
            
            # Check if role assignment already exists
            cur.execute(
                "SELECT id FROM user_roles WHERE user_id = %s AND role_id = %s AND tenant_id = %s",
                (user_id, role_id, effective_tenant_id)
            )
            existing = cur.fetchone()
            
            if existing and not force:
                skipped_count += 1
                print(f"[SKIP] Role already assigned: {email} -> {mapped_role_name}")
            else:
                if existing:
                    # Update existing assignment
                    cur.execute(
                        "UPDATE user_roles SET assigned_at = NOW() WHERE user_id = %s AND role_id = %s AND tenant_id = %s",
                        (user_id, role_id, effective_tenant_id)
                    )
                    print(f"[UPDATE] Updated role assignment: {email} -> {mapped_role_name}")
                else:
                    # Insert new assignment
                    cur.execute(
                        "INSERT INTO user_roles (user_id, role_id, tenant_id, assigned_at) VALUES (%s, %s, %s, NOW()) ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING",
                        (user_id, role_id, effective_tenant_id)
                    )
                    print(f"[OK] Assigned role: {email} -> {mapped_role_name}")
                updated_count += 1
        
        conn.commit()
        conn.close()
        
        print("-" * 60)
        print(f"[OK] Successfully processed {updated_count} users")
        print(f"[SKIP] Skipped {skipped_count} users (already had role assignments)")
        print(f"[ERROR] Failed {error_count} users")
        print(f"Total users processed: {len(users)}")
        
        return {
            "success": True,
            "updated": updated_count,
            "skipped": skipped_count,
            "errors": error_count,
            "total": len(users)
        }
        
    except Exception as e:
        print(f"Error backfilling user roles: {e}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    import sys
    
    print("=" * 60)
    print("User Roles Backfill Script")
    print("=" * 60)
    print()
    
    # Check for --force flag
    force = "--force" in sys.argv
    
    if not force:
        try:
            confirm = input("This will assign roles to all users based on their 'role' field. Continue? (yes/no): ")
            if confirm.lower() != 'yes':
                print("Aborted.")
                sys.exit(0)
        except EOFError:
            # Non-interactive mode - run automatically
            print("Running in non-interactive mode...")
    
    print()
    result = backfill_user_roles(force=force)
    
    if result["success"]:
        print()
        print("=" * 60)
        print("User roles backfill completed successfully!")
        print("=" * 60)
        sys.exit(0)
    else:
        print()
        print("=" * 60)
        print(f"User roles backfill failed: {result.get('error', 'Unknown error')}")
        print("=" * 60)
        sys.exit(1)

