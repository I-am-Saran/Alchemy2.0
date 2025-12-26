"""
Script to check a user's permissions and role assignments.
"""
import sys
import psycopg2
import os

# Add parent directory to path to import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DB_URL

def check_user_permissions(email: str):
    """Check user permissions by email."""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Get user by email
        cur.execute(
            "SELECT id, email, full_name, role, tenant_id FROM users WHERE LOWER(email) = LOWER(%s) LIMIT 1",
            (email,)
        )
        user = cur.fetchone()
        
        if not user:
            print(f"User with email '{email}' not found")
            return
        
        user_id, user_email, full_name, user_role, tenant_id = user
        tenant_id = tenant_id or "00000000-0000-0000-0000-000000000001"
        
        print("=" * 60)
        print(f"User: {full_name} ({user_email})")
        print(f"User ID: {user_id}")
        print(f"Role (from users table): {user_role}")
        print(f"Tenant ID: {tenant_id}")
        print("=" * 60)
        print()
        
        # Get user roles from user_roles table
        cur.execute(
            """SELECT ur.role_id, ur.tenant_id, r.role_name 
               FROM user_roles ur
               JOIN roles r ON ur.role_id = r.id
               WHERE ur.user_id = %s AND ur.tenant_id = %s""",
            (user_id, tenant_id)
        )
        user_roles = cur.fetchall()
        
        if not user_roles:
            print("No roles assigned in user_roles table!")
            return
        
        print(f"Roles assigned in user_roles table: {len(user_roles)}")
        for role_id, role_tenant_id, role_name in user_roles:
            print(f"  - {role_name} (ID: {role_id})")
        print()
        
        # Check permissions for each role
        for role_id, role_tenant_id, role_name in user_roles:
            print(f"Permissions for role '{role_name}' (ID: {role_id}):")
            print("-" * 60)
            
            cur.execute(
                """SELECT module_name, can_create, can_retrieve, can_update, can_delete, can_comment, can_create_task
                   FROM permissions
                   WHERE role_id = %s AND tenant_id = %s
                   ORDER BY module_name""",
                (role_id, tenant_id)
            )
            permissions = cur.fetchall()
            
            if not permissions:
                print("  No permissions found for this role!")
            else:
                for perm in permissions:
                    module_name, can_create, can_retrieve, can_update, can_delete, can_comment, can_create_task = perm
                    print(f"  Module: {module_name}")
                    print(f"    - create: {can_create}")
                    print(f"    - retrieve: {can_retrieve}")
                    print(f"    - update: {can_update}")
                    print(f"    - delete: {can_delete}")
                    print(f"    - comment: {can_comment}")
                    print(f"    - create_task: {can_create_task}")
                    print()
            
            # Check specifically for security_controls
            cur.execute(
                """SELECT module_name, can_retrieve
                   FROM permissions
                   WHERE role_id = %s AND tenant_id = %s AND LOWER(module_name) = 'security_controls'""",
                (role_id, tenant_id)
            )
            sec_perm = cur.fetchone()
            
            if sec_perm:
                print(f"  Security Controls retrieve permission: {sec_perm[1]}")
            else:
                print(f"  Security Controls permission: NOT FOUND")
            print()
        
        conn.close()
        
    except Exception as e:
        print(f"Error checking user permissions: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_user_permissions.py <email>")
        print("Example: python check_user_permissions.py abd@example.com")
        sys.exit(1)
    
    email = sys.argv[1]
    check_user_permissions(email)

