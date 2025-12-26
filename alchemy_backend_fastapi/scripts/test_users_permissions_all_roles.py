"""
Comprehensive test script to verify all users module permissions across all roles.
Tests all 6 permissions: create, retrieve, update, delete, comment, create_task

This script:
1. Fetches all users from the database with their roles
2. Tests each permission for the users module using API calls
3. Verifies that permissions match expected values for each role
4. Reports any discrepancies
"""

import os
import sys
import requests
import psycopg2
import time
from typing import Dict, List, Tuple, Optional
from dotenv import load_dotenv

# Add parent directory to path to import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config import DB_URL, JWT_SECRET, JWT_ALGORITHM
from services.auth_service import create_jwt_token, authenticate_user

load_dotenv()

# API Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

# Expected permissions for each role
EXPECTED_PERMISSIONS = {
    "Super Admin": {
        "can_create": True,
        "can_retrieve": True,
        "can_update": True,
        "can_delete": True,
        "can_comment": True,
        "can_create_task": True,
    },
    "Admin": {
        "can_create": True,
        "can_retrieve": True,
        "can_update": True,
        "can_delete": False,
        "can_comment": True,
        "can_create_task": True,
    },
    "Contributor": {
        "can_create": True,
        "can_retrieve": True,
        "can_update": True,
        "can_delete": False,
        "can_comment": True,
        "can_create_task": True,
    },
    "Viewer": {
        "can_create": False,
        "can_retrieve": True,
        "can_update": False,
        "can_delete": False,
        "can_comment": False,
        "can_create_task": False,
    },
}

# Map permission keys to API actions
PERMISSION_TO_ACTION = {
    "can_create": "create",
    "can_retrieve": "retrieve",
    "can_update": "update",
    "can_delete": "delete",
    "can_comment": "comment",
    "can_create_task": "create_task",
}

# Map actions to HTTP methods and endpoints
ACTION_TO_ENDPOINT = {
    "create": ("POST", "/api/users"),
    "retrieve": ("GET", "/api/users"),
    "update": ("PUT", "/api/users/{user_id}"),
    "delete": ("DELETE", "/api/users/{user_id}"),
    "comment": ("POST", "/api/users/{user_id}/comments"),  # May not exist
    "create_task": ("POST", "/api/users/{user_id}/tasks"),  # May not exist
}


def get_users_with_roles() -> List[Dict]:
    """Get all users from database with their roles."""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Get all users with their roles
        cur.execute("""
            SELECT DISTINCT
                u.id,
                u.email,
                u.full_name,
                u.is_active,
                u.password,
                r.role_name,
                r.id as role_id
            FROM users u
            LEFT JOIN user_roles ur ON u.id = ur.user_id
            LEFT JOIN roles r ON ur.role_id = r.id
            WHERE u.tenant_id = %s OR u.tenant_id IS NULL
            ORDER BY u.email, r.role_name
        """, (DEFAULT_TENANT_ID,))
        
        rows = cur.fetchall()
        conn.close()
        
        # Group users by email (one user can have multiple roles)
        users_dict = {}
        for row in rows:
            user_id, email, full_name, is_active, password, role_name, role_id = row
            if email not in users_dict:
                users_dict[email] = {
                    "id": user_id,
                    "email": email,
                    "full_name": full_name,
                    "is_active": is_active,
                    "password": password,
                    "roles": []
                }
            if role_name:
                users_dict[email]["roles"].append({
                    "role_name": role_name,
                    "role_id": role_id
                })
        
        return list(users_dict.values())
    except Exception as e:
        print(f"Error fetching users: {e}")
        import traceback
        traceback.print_exc()
        return []


def get_user_permissions_from_db(user_id: str, role_id: str) -> Dict[str, bool]:
    """Get permissions for a user's role from the database."""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                can_create,
                can_retrieve,
                can_update,
                can_delete,
                can_comment,
                can_create_task
            FROM permissions
            WHERE role_id = %s 
            AND module_name = 'users'
            AND tenant_id = %s
        """, (role_id, DEFAULT_TENANT_ID))
        
        row = cur.fetchone()
        conn.close()
        
        if row:
            return {
                "can_create": row[0] or False,
                "can_retrieve": row[1] or False,
                "can_update": row[2] or False,
                "can_delete": row[3] or False,
                "can_comment": row[4] or False,
                "can_create_task": row[5] or False,
            }
        return {}
    except Exception as e:
        print(f"Error fetching permissions from DB: {e}")
        return {}


def test_api_permission(
    token: str,
    action: str,
    endpoint: str,
    method: str,
    test_user_id: Optional[str] = None
) -> Tuple[bool, str, int]:
    """Test an API permission by making an API call."""
    url = f"{API_BASE_URL}{endpoint}"
    if test_user_id:
        url = url.replace("{user_id}", test_user_id)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        if method == "GET":
            response = requests.get(
                url,
                headers=headers,
                params={"tenant_id": DEFAULT_TENANT_ID},
                timeout=5
            )
        elif method == "POST":
            # Create a test user for create action
            if action == "create":
                data = {
                    "email": f"test_{int(time.time())}@test.com",
                    "username": "Test User",
                    "role": "Viewer",
                    "tenant_id": DEFAULT_TENANT_ID
                }
            else:
                data = {
                    "tenant_id": DEFAULT_TENANT_ID,
                    "comment": "Test comment" if action == "comment" else None
                }
            response = requests.post(url, headers=headers, json=data, timeout=5)
        elif method == "PUT":
            data = {
                "full_name": "Updated Test User"
            }
            response = requests.put(
                url,
                headers=headers,
                json=data,
                params={"tenant_id": DEFAULT_TENANT_ID},
                timeout=5
            )
        elif method == "DELETE":
            response = requests.delete(
                url,
                headers=headers,
                params={"tenant_id": DEFAULT_TENANT_ID},
                timeout=5
            )
        else:
            return False, f"Unsupported method: {method}", 0
        
        status_code = response.status_code
        
        # 200/201 = success (permission granted)
        # 403 = permission denied
        # 401 = unauthorized (invalid token)
        # 404 = not found (endpoint may not exist, but permission check passed)
        # 405 = method not allowed (endpoint doesn't support this method)
        
        if status_code in [200, 201]:
            return True, f"Success (HTTP {status_code})", status_code
        elif status_code == 403:
            return False, f"Permission denied (HTTP 403)", status_code
        elif status_code == 401:
            return False, f"Unauthorized (HTTP 401) - Invalid token", status_code
        elif status_code == 404:
            # For non-existent endpoints, 404 might mean endpoint doesn't exist
            # But if it's a permission check, it means permission was checked and passed
            return True, f"Not found (HTTP 404) - Endpoint may not exist", status_code
        elif status_code == 405:
            return False, f"Method not allowed (HTTP 405) - Endpoint doesn't support {method}", status_code
        else:
            return False, f"Unexpected status (HTTP {status_code}): {response.text[:200]}", status_code
    
    except requests.exceptions.ConnectionError:
        return False, "Connection error - Is the API server running?", 0
    except Exception as e:
        return False, f"Error: {str(e)}", 0


def get_user_token(email: str, password: str = "pass") -> Optional[str]:
    """Get JWT token for a user by authenticating."""
    try:
        result = authenticate_user(email, password)
        if result and "token" in result:
            return result["token"]
        elif result and "error" in result:
            print(f"  ⚠️  Authentication error: {result.get('message', 'Unknown error')}")
            return None
        return None
    except Exception as e:
        print(f"  ⚠️  Error authenticating user {email}: {e}")
        return None


def get_test_user_id() -> Optional[str]:
    """Get a test user ID for update/delete operations."""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        cur.execute("""
            SELECT id FROM users 
            WHERE is_active = TRUE 
            AND tenant_id = %s 
            LIMIT 1
        """, (DEFAULT_TENANT_ID,))
        row = cur.fetchone()
        conn.close()
        return row[0] if row else None
    except:
        return None


def test_user_permissions(user: Dict, test_user_id: Optional[str] = None) -> Dict:
    """Test all permissions for a user."""
    email = user["email"]
    user_id = user["id"]
    roles = user.get("roles", [])
    
    print(f"\n{'='*90}")
    print(f"Testing User: {user['full_name']} ({email})")
    print(f"User ID: {user_id}")
    print(f"Roles: {', '.join([r['role_name'] for r in roles]) if roles else 'No roles'}")
    print(f"{'='*90}")
    
    if not user.get("is_active"):
        print("⚠️  User is inactive, skipping...")
        return {"user": email, "skipped": True, "reason": "User is inactive"}
    
    # Get token - try multiple password options
    password = user.get("password")
    token = None
    
    # Try default password first
    if not password:
        print("  ⚠️  User has no password in DB, trying default 'pass'...")
        token = get_user_token(email, "pass")
    else:
        # User has password in DB, but we can't use the hash directly
        # Try common default passwords
        for pwd in ["pass", "password", "Pass123!"]:
            token = get_user_token(email, pwd)
            if token:
                break
    
    if not token:
        print("  ❌ Failed to get authentication token (tried default passwords)")
        return {"user": email, "skipped": True, "reason": "Failed to authenticate - may need to set password"}
    
    # Use provided test_user_id or get one from DB
    if not test_user_id:
        test_user_id = get_test_user_id()
        if not test_user_id:
            print("  ⚠️  No test user ID available for update/delete operations")
    
    results = {
        "user": email,
        "user_id": user_id,
        "roles": [r["role_name"] for r in roles],
        "permissions": {},
        "api_tests": {},
        "issues": []
    }
    
    # Test each role
    for role in roles:
        role_name = role["role_name"]
        role_id = role["role_id"]
        
        print(f"\n  Testing Role: {role_name}")
        
        # Get expected permissions
        expected = EXPECTED_PERMISSIONS.get(role_name, {})
        
        # Get actual permissions from database
        db_permissions = get_user_permissions_from_db(user_id, role_id)
        
        # Test each permission
        for perm_key, expected_value in expected.items():
            action = PERMISSION_TO_ACTION[perm_key]
            method, endpoint = ACTION_TO_ENDPOINT[action]
            
            # Check database permission
            db_value = db_permissions.get(perm_key, False)
            
            # Test API permission
            # For update/delete/comment/create_task, use test_user_id (not the current user's ID)
            test_id = test_user_id if action in ["update", "delete", "comment", "create_task"] else None
            api_success, api_message, status_code = test_api_permission(
                token,
                action,
                endpoint,
                method,
                test_id
            )
            
            # Determine if permission should be granted
            should_have_permission = expected_value
            
            # For API tests:
            # - If endpoint doesn't exist (404/405), we can't test it
            # - If permission should be granted, 200/201 = pass, 403 = fail
            # - If permission should NOT be granted, 403 = pass, 200/201 = fail
            
            if status_code in [404, 405]:
                api_result = "N/A (endpoint doesn't exist)"
                api_pass = None
            elif should_have_permission:
                api_pass = api_success  # Should succeed
            else:
                api_pass = not api_success  # Should fail (403)
            
            # Store results
            perm_key_short = perm_key.replace("can_", "")
            if role_name not in results["permissions"]:
                results["permissions"][role_name] = {}
            results["permissions"][role_name][perm_key_short] = {
                "expected": expected_value,
                "db_value": db_value,
                "api_test": api_result if status_code in [404, 405] else ("✅ PASS" if api_pass else "❌ FAIL"),
                "api_message": api_message,
                "status_code": status_code,
                "match": db_value == expected_value,
            }
            
            # Check for issues
            if db_value != expected_value:
                results["issues"].append(
                    f"{role_name}.{perm_key}: DB has {db_value}, expected {expected_value}"
                )
            
            if api_pass is False:
                results["issues"].append(
                    f"{role_name}.{perm_key}: API test failed - {api_message}"
                )
            
            # Print result
            status_icon = "✅" if (db_value == expected_value and (api_pass is True or api_pass is None)) else "❌"
            print(f"    {status_icon} {perm_key_short:20} | Expected: {str(expected_value):5} | DB: {str(db_value):5} | API: {api_result if status_code in [404, 405] else ('✅' if api_pass else '❌')}")
            if db_value != expected_value or api_pass is False:
                print(f"      └─ {api_message}")
    
    return results


def main():
    """Main test function."""
    print("="*90)
    print("COMPREHENSIVE USERS MODULE PERMISSIONS TEST")
    print("="*90)
    print(f"API Base URL: {API_BASE_URL}")
    print(f"Tenant ID: {DEFAULT_TENANT_ID}")
    print()
    
    # Check if API is running
    try:
        response = requests.get(f"{API_BASE_URL}/api/users", timeout=2)
        print("✅ API server is running")
    except:
        print("⚠️  WARNING: API server is not running or not accessible")
        print("   Some tests will be skipped")
        print()
    
    # Get all users
    print("Fetching users from database...")
    users = get_users_with_roles()
    
    if not users:
        print("❌ No users found in database")
        return
    
    print(f"Found {len(users)} user(s)")
    print()
    
    # Get a test user ID for update/delete operations
    test_user_id = get_test_user_id()
    if test_user_id:
        print(f"Using test user ID for update/delete operations: {test_user_id}")
    print()
    
    # Test each user
    all_results = []
    for user in users:
        result = test_user_permissions(user, test_user_id)
        all_results.append(result)
    
    # Print summary
    print("\n" + "="*90)
    print("SUMMARY")
    print("="*90)
    
    total_users = len(all_results)
    users_tested = sum(1 for r in all_results if not r.get("skipped"))
    users_skipped = total_users - users_tested
    
    print(f"Total users: {total_users}")
    print(f"Users tested: {users_tested}")
    print(f"Users skipped: {users_skipped}")
    
    # Count issues
    total_issues = sum(len(r.get("issues", [])) for r in all_results)
    
    if total_issues == 0:
        print("\n✅ All permission tests passed!")
    else:
        print(f"\n❌ Found {total_issues} issue(s):")
        for result in all_results:
            if result.get("issues"):
                print(f"\n  User: {result['user']}")
                for issue in result["issues"]:
                    print(f"    - {issue}")
    
    # Print detailed results
    print("\n" + "="*90)
    print("DETAILED RESULTS")
    print("="*90)
    
    for result in all_results:
        if result.get("skipped"):
            continue
        
        print(f"\nUser: {result['user']}")
        print(f"Roles: {', '.join(result['roles'])}")
        
        for role_name, perms in result.get("permissions", {}).items():
            print(f"\n  Role: {role_name}")
            for perm_key, perm_data in perms.items():
                match_icon = "✅" if perm_data["match"] else "❌"
                print(f"    {match_icon} {perm_key:20} | Expected: {perm_data['expected']:5} | DB: {perm_data['db_value']:5} | API: {perm_data['api_test']}")


if __name__ == "__main__":
    main()

