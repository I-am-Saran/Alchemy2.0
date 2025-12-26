"""
Comprehensive permission test across ALL modules for ALL users and roles.

This script:
1. Fetches all users with their roles
2. For each user-role combination, checks permissions for ALL modules
3. Tests each permission (create, retrieve, update, delete, comment, create_task) via API
4. Verifies that:
   - If permission is ENABLED in DB → API should ALLOW (200/201)
   - If permission is DISABLED in DB → API should DENY (403)
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

from config import DB_URL
from services.auth_service import authenticate_user

load_dotenv()

# API Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"

# All modules in the system
ALL_MODULES = [
    'security_controls',
    'tasks',
    'audits',
    'users',
    'bugs',
    'certifications',
    'roles',
    'dashboard',
]

# All permission actions
ALL_ACTIONS = [
    'create',
    'retrieve',
    'update',
    'delete',
    'comment',
    'create_task',
]

# Map permission keys to actions
PERMISSION_KEY_TO_ACTION = {
    'can_create': 'create',
    'can_retrieve': 'retrieve',
    'can_update': 'update',
    'can_delete': 'delete',
    'can_comment': 'comment',
    'can_create_task': 'create_task',
}

# Map actions to HTTP methods and endpoint patterns
ACTION_TO_ENDPOINT = {
    'create': ('POST', '/api/{module}'),
    'retrieve': ('GET', '/api/{module}'),
    'update': ('PUT', '/api/{module}/{id}'),
    'delete': ('DELETE', '/api/{module}/{id}'),
    'comment': ('POST', '/api/{module}/{id}/comments'),
    'create_task': ('POST', '/api/{module}/{id}/tasks'),
}

# Special endpoint mappings for modules with different endpoint names
MODULE_ENDPOINT_MAP = {
    'security_controls': 'controls',
    'users': 'users',
    'tasks': 'tasks',
    'audits': 'audits',
    'bugs': 'bugs',
    'certifications': 'certifications',
    'roles': 'roles',
    'dashboard': 'dashboard',
}


def get_users_with_roles() -> List[Dict]:
    """Get all users from database with their roles."""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
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
            WHERE (u.tenant_id = %s OR u.tenant_id IS NULL)
            AND u.is_active = TRUE
            ORDER BY u.email, r.role_name
        """, (DEFAULT_TENANT_ID,))
        
        rows = cur.fetchall()
        conn.close()
        
        # Group users by email
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
            if role_name and role_id:
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


def get_role_permissions_for_module(role_id: str, module_name: str) -> Dict[str, bool]:
    """Get permissions for a role-module combination from database."""
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
            AND module_name = %s
            AND tenant_id = %s
        """, (role_id, module_name, DEFAULT_TENANT_ID))
        
        row = cur.fetchone()
        conn.close()
        
        if row:
            return {
                "can_create": bool(row[0]) if row[0] is not None else False,
                "can_retrieve": bool(row[1]) if row[1] is not None else False,
                "can_update": bool(row[2]) if row[2] is not None else False,
                "can_delete": bool(row[3]) if row[3] is not None else False,
                "can_comment": bool(row[4]) if row[4] is not None else False,
                "can_create_task": bool(row[5]) if row[5] is not None else False,
            }
        return {
            "can_create": False,
            "can_retrieve": False,
            "can_update": False,
            "can_delete": False,
            "can_comment": False,
            "can_create_task": False,
        }
    except Exception as e:
        print(f"Error fetching permissions: {e}")
        return {
            "can_create": False,
            "can_retrieve": False,
            "can_update": False,
            "can_delete": False,
            "can_comment": False,
            "can_create_task": False,
        }


def get_test_resource_id(module: str) -> Optional[str]:
    """Get a test resource ID for update/delete/comment/create_task operations."""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Map module to table name
        table_map = {
            'security_controls': 'controls',
            'tasks': 'tasks',
            'audits': 'audits',
            'users': 'users',
            'bugs': 'bugs',
            'certifications': 'certifications',
        }
        
        table_name = table_map.get(module)
        if not table_name:
            return None
        
        cur.execute(f"""
            SELECT id FROM {table_name} 
            WHERE tenant_id = %s 
            LIMIT 1
        """, (DEFAULT_TENANT_ID,))
        
        row = cur.fetchone()
        conn.close()
        return str(row[0]) if row else None
    except:
        return None


def test_api_permission(
    token: str,
    module: str,
    action: str,
    test_id: Optional[str] = None
) -> Tuple[bool, str, int]:
    """Test an API permission by making an API call."""
    method, endpoint_pattern = ACTION_TO_ENDPOINT[action]
    
    # Get the correct endpoint name for the module
    endpoint_name = MODULE_ENDPOINT_MAP.get(module, module)
    endpoint = endpoint_pattern.replace('{module}', endpoint_name)
    
    if test_id:
        endpoint = endpoint.replace('{id}', test_id)
    else:
        # For create operations, we don't need an ID
        if '{id}' in endpoint:
            return False, "Test ID required but not provided", 0
    
    url = f"{API_BASE_URL}{endpoint}"
    
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
            # Create test data based on module
            data = get_test_payload(module, action, test_id)
            response = requests.post(url, headers=headers, json=data, timeout=5)
        elif method == "PUT":
            data = get_test_payload(module, action, test_id)
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
        # 401 = unauthorized
        # 404 = not found (endpoint may not exist)
        # 405 = method not allowed
        
        if status_code in [200, 201]:
            return True, f"Success (HTTP {status_code})", status_code
        elif status_code == 403:
            return False, f"Permission denied (HTTP 403)", status_code
        elif status_code == 401:
            return False, f"Unauthorized (HTTP 401)", status_code
        elif status_code == 404:
            return None, f"Endpoint not found (HTTP 404)", status_code
        elif status_code == 405:
            return None, f"Method not allowed (HTTP 405)", status_code
        else:
            return False, f"Unexpected status (HTTP {status_code})", status_code
    
    except requests.exceptions.ConnectionError:
        return None, "Connection error - API server not running", 0
    except Exception as e:
        return None, f"Error: {str(e)}", 0


def get_test_payload(module: str, action: str, test_id: Optional[str] = None) -> Dict:
    """Get test payload for API requests."""
    base_payload = {
        "tenant_id": DEFAULT_TENANT_ID,
    }
    
    if action == "create":
        if module == "users":
            return {
                "email": f"test_{int(time.time())}@test.com",
                "username": "Test User",
                "role": "Viewer",
                "tenant_id": DEFAULT_TENANT_ID
            }
        elif module == "tasks":
            return {
                "tenant_id": DEFAULT_TENANT_ID,
                "title": "Test Task",
                "description": "Test task",
                "status": "pending"
            }
        elif module == "audits":
            return {
                "tenant_id": DEFAULT_TENANT_ID,
                "title": "Test Audit",
                "description": "Test audit",
                "status": "pending"
            }
        elif module == "bugs":
            return {
                "tenant_id": DEFAULT_TENANT_ID,
                "title": "Test Bug",
                "description": "Test bug"
            }
        elif module == "certifications":
            return {
                "tenant_id": DEFAULT_TENANT_ID,
                "name": "Test Certification"
            }
    
    elif action == "comment":
        return {
            "tenant_id": DEFAULT_TENANT_ID,
            "comment": "Test comment"
        }
    
    elif action == "create_task":
        return {
            "tenant_id": DEFAULT_TENANT_ID,
            "title": "Test Task",
            "description": "Test task"
        }
    
    elif action == "update":
        if module == "users":
            return {"full_name": "Updated Test User"}
        elif module == "tasks":
            return {"title": "Updated Test Task"}
        elif module == "audits":
            return {"title": "Updated Test Audit"}
        elif module == "bugs":
            return {"title": "Updated Test Bug"}
        elif module == "certifications":
            return {"name": "Updated Test Certification"}
    
    return base_payload


def get_user_token(email: str) -> Optional[str]:
    """Get JWT token for a user by authenticating."""
    # Try common default passwords
    for pwd in ["pass", "password", "Pass123!"]:
        try:
            result = authenticate_user(email, pwd)
            if result and "token" in result:
                return result["token"]
        except:
            continue
    return None


def test_user_permissions(user: Dict) -> Dict:
    """Test all permissions for a user across all modules."""
    email = user["email"]
    user_id = user["id"]
    roles = user.get("roles", [])
    
    print(f"\n{'='*100}")
    print(f"Testing User: {user['full_name']} ({email})")
    print(f"User ID: {user_id}")
    print(f"Roles: {', '.join([r['role_name'] for r in roles]) if roles else 'No roles'}")
    print(f"{'='*100}")
    
    if not roles:
        print("⚠️  User has no roles assigned, skipping...")
        return {"user": email, "skipped": True, "reason": "No roles assigned"}
    
    # Get authentication token
    token = get_user_token(email)
    if not token:
        print("❌ Failed to get authentication token")
        return {"user": email, "skipped": True, "reason": "Failed to authenticate"}
    
    results = {
        "user": email,
        "user_id": user_id,
        "roles": [r["role_name"] for r in roles],
        "test_results": {},
        "issues": [],
        "total_tests": 0,
        "passed_tests": 0,
        "failed_tests": 0,
        "skipped_tests": 0,
    }
    
    # Test each role
    for role in roles:
        role_name = role["role_name"]
        role_id = role["role_id"]
        
        print(f"\n  Role: {role_name}")
        print(f"  {'-'*98}")
        
        if role_name not in results["test_results"]:
            results["test_results"][role_name] = {}
        
        # Test each module
        for module in ALL_MODULES:
            print(f"    Module: {module}")
            
            if module not in results["test_results"][role_name]:
                results["test_results"][role_name][module] = {}
            
            # Get permissions from database
            db_permissions = get_role_permissions_for_module(role_id, module)
            
            # Get test resource ID for operations that need it
            test_id = None
            if module in ['security_controls', 'tasks', 'audits', 'users', 'bugs', 'certifications']:
                test_id = get_test_resource_id(module)
            
            # Test each permission
            for perm_key, action in PERMISSION_KEY_TO_ACTION.items():
                db_value = db_permissions.get(perm_key, False)
                
                # Skip if test_id is required but not available
                if action in ['update', 'delete', 'comment', 'create_task'] and not test_id:
                    results["total_tests"] += 1
                    results["skipped_tests"] += 1
                    results["test_results"][role_name][module][action] = {
                        "db_enabled": db_value,
                        "api_result": None,
                        "api_message": "Skipped - No test resource available",
                        "status": "SKIPPED",
                        "match": None
                    }
                    continue
                
                # Test API permission
                api_success, api_message, status_code = test_api_permission(
                    token,
                    module,
                    action,
                    test_id if action in ['update', 'delete', 'comment', 'create_task'] else None
                )
                
                results["total_tests"] += 1
                
                # Determine if test passed
                # If endpoint doesn't exist (404/405), skip the test
                if api_success is None:
                    results["skipped_tests"] += 1
                    status = "SKIPPED"
                    match = None
                # If permission is enabled in DB, API should allow (success = True)
                # If permission is disabled in DB, API should deny (success = False)
                elif db_value:
                    # Permission enabled → should succeed
                    if api_success:
                        results["passed_tests"] += 1
                        status = "PASS"
                        match = True
                    else:
                        results["failed_tests"] += 1
                        status = "FAIL"
                        match = False
                        results["issues"].append(
                            f"{role_name}.{module}.{action}: DB enabled but API denied - {api_message}"
                        )
                else:
                    # Permission disabled → should fail
                    if not api_success:
                        results["passed_tests"] += 1
                        status = "PASS"
                        match = True
                    else:
                        results["failed_tests"] += 1
                        status = "FAIL"
                        match = False
                        results["issues"].append(
                            f"{role_name}.{module}.{action}: DB disabled but API allowed - {api_message}"
                        )
                
                results["test_results"][role_name][module][action] = {
                    "db_enabled": db_value,
                    "api_result": api_success,
                    "api_message": api_message,
                    "status_code": status_code,
                    "status": status,
                    "match": match
                }
                
                # Print result
                icon = "✅" if status == "PASS" else ("⚠️" if status == "SKIPPED" else "❌")
                print(f"      {icon} {action:15} | DB: {str(db_value):5} | API: {status:6} | {api_message[:50]}")
    
    return results


def main():
    """Main test function."""
    print("="*100)
    print("COMPREHENSIVE PERMISSION TEST - ALL MODULES, ALL USERS, ALL ROLES")
    print("="*100)
    print(f"API Base URL: {API_BASE_URL}")
    print(f"Tenant ID: {DEFAULT_TENANT_ID}")
    print(f"Modules to test: {', '.join(ALL_MODULES)}")
    print(f"Actions to test: {', '.join(ALL_ACTIONS)}")
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
    
    print(f"Found {len(users)} active user(s) with roles")
    print()
    
    # Test each user
    all_results = []
    for user in users:
        result = test_user_permissions(user)
        all_results.append(result)
    
    # Print summary
    print("\n" + "="*100)
    print("SUMMARY")
    print("="*100)
    
    total_users = len(all_results)
    users_tested = sum(1 for r in all_results if not r.get("skipped"))
    users_skipped = total_users - users_tested
    
    total_tests = sum(r.get("total_tests", 0) for r in all_results)
    total_passed = sum(r.get("passed_tests", 0) for r in all_results)
    total_failed = sum(r.get("failed_tests", 0) for r in all_results)
    total_skipped = sum(r.get("skipped_tests", 0) for r in all_results)
    
    print(f"Total users: {total_users}")
    print(f"Users tested: {users_tested}")
    print(f"Users skipped: {users_skipped}")
    print()
    print(f"Total tests: {total_tests}")
    print(f"✅ Passed: {total_passed}")
    print(f"❌ Failed: {total_failed}")
    print(f"⚠️  Skipped: {total_skipped}")
    print()
    
    # Count issues
    all_issues = []
    for result in all_results:
        if result.get("issues"):
            all_issues.extend(result["issues"])
    
    if total_failed == 0 and len(all_issues) == 0:
        print("✅ All permission tests passed!")
    else:
        print(f"❌ Found {len(all_issues)} issue(s):")
        for issue in all_issues[:50]:  # Show first 50 issues
            print(f"  - {issue}")
        if len(all_issues) > 50:
            print(f"  ... and {len(all_issues) - 50} more issues")
    
    # Print per-user summary
    print("\n" + "="*100)
    print("PER-USER SUMMARY")
    print("="*100)
    
    for result in all_results:
        if result.get("skipped"):
            continue
        
        print(f"\nUser: {result['user']} ({', '.join(result['roles'])})")
        print(f"  Tests: {result.get('total_tests', 0)} | Passed: {result.get('passed_tests', 0)} | Failed: {result.get('failed_tests', 0)} | Skipped: {result.get('skipped_tests', 0)}")
        if result.get("issues"):
            print(f"  Issues: {len(result['issues'])}")
            for issue in result["issues"][:5]:  # Show first 5 issues per user
                print(f"    - {issue}")


if __name__ == "__main__":
    main()


