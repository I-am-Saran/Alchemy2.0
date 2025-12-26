"""
Test script to check permission checking for a specific user.
"""
import os
import sys
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

from services.rbac_service import check_permission, get_user_roles, get_role_permissions
from services.db_service import local_db as supabase

def test_user_permission(email: str):
    """Test permission check for a user."""
    try:
        # Get user by email
        resp = supabase.table("users").select("id, email, tenant_id").eq("email", email).limit(1).execute()
        if not resp.data or len(resp.data) == 0:
            print(f"User '{email}' not found")
            return
        
        user = resp.data[0]
        user_id = user["id"]
        tenant_id = user.get("tenant_id") or "00000000-0000-0000-0000-000000000001"
        
        print("=" * 60)
        print(f"Testing permissions for: {email}")
        print(f"User ID: {user_id}")
        print(f"Tenant ID: {tenant_id}")
        print("=" * 60)
        print()
        
        # Get user roles
        user_roles = get_user_roles(user_id, tenant_id)
        print(f"User roles: {len(user_roles)}")
        for ur in user_roles:
            print(f"  - {ur}")
        print()
        
        # Check permission
        print("Testing security_controls.retrieve permission...")
        has_permission = check_permission(user_id, tenant_id, "security_controls", "retrieve")
        print(f"Result: {has_permission}")
        print()
        
        # Manually check permissions
        print("Manual permission check:")
        for user_role in user_roles:
            role_id = user_role.get("role_id")
            if not role_id and user_role.get("roles"):
                roles_data = user_role.get("roles")
                if isinstance(roles_data, dict):
                    role_id = roles_data.get("id")
                elif isinstance(roles_data, list) and len(roles_data) > 0:
                    role_id = roles_data[0].get("id")
            
            if role_id:
                print(f"  Checking role_id: {role_id}")
                permissions = get_role_permissions(role_id, tenant_id)
                for perm in permissions:
                    if perm.get("module_name", "").lower() == "security_controls":
                        can_retrieve = perm.get("can_retrieve")
                        print(f"    Module: {perm.get('module_name')}")
                        print(f"    can_retrieve value: {can_retrieve} (type: {type(can_retrieve)})")
                        print(f"    can_retrieve is True: {can_retrieve is True}")
                        print(f"    can_retrieve == True: {can_retrieve == True}")
                        print(f"    can_retrieve bool(): {bool(can_retrieve)}")
                        if isinstance(can_retrieve, str):
                            print(f"    String comparison: '{can_retrieve.lower()}' == 'true': {can_retrieve.lower() == 'true'}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_permission_check.py <email>")
        print("Example: python test_permission_check.py abc@hepl.com")
        sys.exit(1)
    
    email = sys.argv[1]
    test_user_permission(email)

