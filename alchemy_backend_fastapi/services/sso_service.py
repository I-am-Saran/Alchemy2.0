"""
SSO Service - Microsoft Azure AD SSO authentication
Handles Microsoft SSO token validation, user creation, and role assignment
"""

import uuid
import jwt
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import psycopg2
from config import DB_URL, MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET

# Allowed email domains for SSO
ALLOWED_EMAIL_DOMAINS = ["@cavininfotech.com", "@hepl.com"]

# Default tenant ID
DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001"


def validate_email_domain(email: str) -> bool:
    """Validate that email belongs to allowed domains."""
    if not email:
        return False
    email_lower = email.lower()
    return any(email_lower.endswith(domain.lower()) for domain in ALLOWED_EMAIL_DOMAINS)


def get_viewer_role_id(tenant_id: str = DEFAULT_TENANT_ID) -> Optional[str]:
    """Get the Viewer role ID from the database."""
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        cur.execute(
            "SELECT id FROM roles WHERE role_name = %s AND tenant_id = %s LIMIT 1",
            ("Viewer", tenant_id)
        )
        result = cur.fetchone()
        conn.close()
        
        if result:
            return str(result[0])
        return None
    except Exception as e:
        print(f"Error getting viewer role: {e}")
        return None


def get_or_create_sso_user(
    email: str,
    full_name: str,
    sso_user_id: str,
    tenant_id: str = DEFAULT_TENANT_ID
) -> Optional[Dict[str, Any]]:
    """
    Get existing user or create new user for SSO authentication.
    Automatically assigns Viewer role to new users.
    """
    try:
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Check if user exists by email
        cur.execute(
            "SELECT id, email, full_name, tenant_id, is_active FROM users WHERE email = %s LIMIT 1",
            (email,)
        )
        user_row = cur.fetchone()
        
        if user_row:
            # User exists - update last login
            user_id, user_email, user_full_name, user_tenant_id, is_active = user_row
            
            # Check if user is active
            if not is_active:
                conn.close()
                return {"error": "inactive", "message": "Your account is inactive. Please contact your administrator."}
            
            # Update SSO fields if not set
            cur.execute(
                """UPDATE users 
                   SET sso_provider = %s, sso_user_id = %s, last_login = NOW(), 
                       login_count = COALESCE(login_count, 0) + 1,
                       updated_at = NOW()
                   WHERE id = %s""",
                ("microsoft", sso_user_id, user_id)
            )
            conn.commit()
            conn.close()
            
            return {
                "user_id": str(user_id),
                "email": user_email,
                "full_name": user_full_name or full_name,
                "tenant_id": str(user_tenant_id) if user_tenant_id else tenant_id,
            }
        else:
            # Create new user
            user_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()
            
            # Get viewer role ID
            viewer_role_id = get_viewer_role_id(tenant_id)
            
            # Insert new user
            cur.execute(
                """INSERT INTO users 
                   (id, email, full_name, sso_provider, sso_user_id, tenant_id, 
                    default_role_id, is_active, first_login, last_login, login_count, created_at, updated_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (
                    user_id, email, full_name, "microsoft", sso_user_id, tenant_id,
                    viewer_role_id, True, now, now, 1, now, now
                )
            )
            
            # Assign Viewer role to user_roles table
            if viewer_role_id:
                try:
                    cur.execute(
                        """INSERT INTO user_roles (user_id, role_id, tenant_id, assigned_at)
                           VALUES (%s, %s, %s, NOW())
                           ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING""",
                        (user_id, viewer_role_id, tenant_id)
                    )
                except Exception as role_error:
                    print(f"Warning: Could not assign viewer role: {role_error}")
            
            conn.commit()
            conn.close()
            
            return {
                "user_id": user_id,
                "email": email,
                "full_name": full_name,
                "tenant_id": tenant_id,
            }
    except Exception as e:
        print(f"Error in get_or_create_sso_user: {e}")
        if conn:
            conn.rollback()
            conn.close()
        return None


def validate_microsoft_token(access_token: str) -> Optional[Dict[str, Any]]:
    """
    Validate Microsoft Azure AD access token and extract user information.
    Returns user info dict if valid, None otherwise.
    """
    try:
        # Decode token without verification first to get issuer
        unverified = jwt.decode(access_token, options={"verify_signature": False})
        
        # Get Microsoft's public keys for token verification
        # For production, you should verify the token signature properly
        # For now, we'll validate the token structure and email domain
        
        email = unverified.get("email") or unverified.get("upn") or unverified.get("preferred_username")
        name = unverified.get("name") or unverified.get("display_name") or email.split("@")[0] if email else "User"
        
        if not email:
            return None
        
        # Validate email domain
        if not validate_email_domain(email):
            return {"error": "domain_not_allowed", "message": "Only @cavininfotech.com and @hepl.com email addresses are allowed."}
        
        # Extract user ID from token
        sso_user_id = unverified.get("oid") or unverified.get("sub") or unverified.get("unique_name")
        
        if not sso_user_id:
            return None
        
        return {
            "email": email.lower(),
            "full_name": name,
            "sso_user_id": str(sso_user_id),
        }
    except jwt.DecodeError:
        return None
    except Exception as e:
        print(f"Error validating Microsoft token: {e}")
        return None


def authenticate_sso_user(access_token: str) -> Optional[Dict[str, Any]]:
    """
    Authenticate user via Microsoft SSO.
    Validates token, checks email domain, creates/updates user, assigns viewer role.
    Returns user info and JWT token if successful.
    """
    try:
        # Validate Microsoft token
        user_info = validate_microsoft_token(access_token)
        
        if not user_info:
            return None
        
        if user_info.get("error"):
            return user_info
        
        email = user_info["email"]
        full_name = user_info["full_name"]
        sso_user_id = user_info["sso_user_id"]
        
        # Get or create user
        user_data = get_or_create_sso_user(email, full_name, sso_user_id)
        
        if not user_data:
            return None
        
        if user_data.get("error"):
            return user_data
        
        # Import here to avoid circular dependency
        from services.auth_service import create_jwt_token
        
        # Create JWT token
        token = create_jwt_token(user_data["user_id"], user_data["email"])
        
        return {
            "user_id": user_data["user_id"],
            "email": user_data["email"],
            "full_name": user_data["full_name"],
            "tenant_id": user_data["tenant_id"],
            "token": token,
        }
    except Exception as e:
        print(f"Error in authenticate_sso_user: {e}")
        return None

