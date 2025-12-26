"""
Check tenant_id consistency for a user.
"""
import sys
import psycopg2
import os

# Add parent directory to path to import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DB_URL

def check_tenant_id(email: str):
    """Check tenant_id for a user."""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Get user
        cur.execute(
            "SELECT id, email, tenant_id FROM users WHERE LOWER(email) = LOWER(%s)",
            (email,)
        )
        user = cur.fetchone()
        
        if not user:
            print(f"User '{email}' not found")
            return
        
        user_id, user_email, user_tenant_id = user
        user_tenant_id = user_tenant_id or "00000000-0000-0000-0000-000000000001"
        
        print("=" * 60)
        print(f"User: {user_email}")
        print(f"User ID: {user_id}")
        print(f"User tenant_id (from users table): {user_tenant_id}")
        print("=" * 60)
        print()
        
        # Get user roles
        cur.execute(
            """SELECT ur.tenant_id, r.role_name, r.tenant_id as role_table_tenant_id
               FROM user_roles ur
               JOIN roles r ON ur.role_id = r.id
               WHERE ur.user_id = %s""",
            (user_id,)
        )
        roles = cur.fetchall()
        
        print(f"User roles: {len(roles)}")
        for ur_tenant_id, role_name, role_tenant_id in roles:
            print(f"  Role: {role_name}")
            print(f"    user_roles.tenant_id: {ur_tenant_id}")
            print(f"    roles.tenant_id: {role_tenant_id}")
            print(f"    Match with user tenant_id: {ur_tenant_id == user_tenant_id}")
            print()
        
        # Check permissions
        cur.execute(
            """SELECT p.module_name, p.can_retrieve, p.tenant_id
               FROM permissions p
               JOIN user_roles ur ON p.role_id = ur.role_id
               JOIN roles r ON ur.role_id = r.id
               WHERE ur.user_id = %s AND LOWER(p.module_name) = 'security_controls'""",
            (user_id,)
        )
        perms = cur.fetchall()
        
        print(f"Security controls permissions: {len(perms)}")
        for module_name, can_retrieve, perm_tenant_id in perms:
            print(f"  Module: {module_name}")
            print(f"    can_retrieve: {can_retrieve}")
            print(f"    permission tenant_id: {perm_tenant_id}")
            print(f"    Match with user tenant_id: {perm_tenant_id == user_tenant_id}")
            print()
        
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python check_tenant_id.py <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    check_tenant_id(email)

