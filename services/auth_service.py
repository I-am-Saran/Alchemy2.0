"""
Authentication Service - JWT-based authentication
"""

import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS
from services.supabase_client import supabase


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against a hash."""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """Validate password strength requirements.
    
    Requirements:
    - Minimum 12 characters
    - At least 1 uppercase letter
    - At least 1 number
    - At least 1 special character
    
    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(password) < 12:
        return False, "Password must be at least 12 characters long"
    
    has_upper = any(c.isupper() for c in password)
    has_digit = any(c.isdigit() for c in password)
    has_special = any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" for c in password)
    
    errors = []
    if not has_upper:
        errors.append("1 uppercase letter")
    if not has_digit:
        errors.append("1 number")
    if not has_special:
        errors.append("1 special character")
    
    if errors:
        return False, f"Password must contain: {', '.join(errors)}"
    
    return True, ""


def create_jwt_token(user_id: str, email: str) -> str:
    """Create a JWT token for a user."""
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_jwt_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify a JWT token and return the payload."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def authenticate_user(email: str, password: str) -> Optional[Dict[str, Any]]:
    """Authenticate a user with email and password.
    
    Returns:
        Dict with user info and token if successful
        None if user not found or password incorrect
        Dict with error key if user is inactive
    """
    try:
        resp = (
            supabase
            .table("users")
            .select("id,email,full_name,password,tenant_id,is_active,first_login,last_login,login_count")
            .ilike("email", email.strip().lower())
            .limit(1)
            .execute()
        )
        if not resp.data:
            print(f"[authenticate_user] User not found: {email}")
            return None
        row = resp.data[0]
        user_id = row.get("id")
        user_email = row.get("email")
        full_name = row.get("full_name")
        hashed_password = row.get("password")
        tenant_id = row.get("tenant_id")
        is_active = bool(row.get("is_active", True))
        first_login = row.get("first_login")
        last_login = row.get("last_login")
        login_count = row.get("login_count") or 0

        if not is_active:
            print(f"[authenticate_user] User is inactive: {email}")
            return {"error": "inactive", "message": "Your account is inactive. Please contact your administrator."}
        if not hashed_password:
            print(f"[authenticate_user] User has no password set: {email}")
            return {"error": "no_password", "message": "No password set for this account. Please use SSO login or contact your administrator."}
        if not verify_password(password, hashed_password):
            print(f"[authenticate_user] Password verification failed for: {email}")
            return None

        is_default_password = verify_password("pass", hashed_password)
        is_first_time = is_default_password or (first_login is None) or (first_login == last_login)

        now_iso = datetime.utcnow().isoformat()
        update_data = {"last_login": now_iso, "login_count": int(login_count) + 1}
        if first_login is None:
            update_data["first_login"] = now_iso
        supabase.table("users").update(update_data).eq("id", user_id).execute()

        token = create_jwt_token(user_id, user_email)
        print(f"[authenticate_user] Login successful for: {email}")
        return {
            "user_id": user_id,
            "email": user_email,
            "full_name": full_name,
            "tenant_id": tenant_id or "00000000-0000-0000-0000-000000000001",
            "token": token,
            "requires_password_change": is_first_time,
        }
    except Exception as e:
        print(f"[authenticate_user] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return None


def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    """Get user information from JWT token."""
    payload = verify_jwt_token(token)
    if not payload:
        return None
    
    user_id = payload.get("user_id")
    if not user_id:
        return None
    
    try:
        resp = (
            supabase
            .table("users")
            .select("id,email,full_name,tenant_id,is_active")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
        if not resp.data:
            return None
        row = resp.data[0]
        if not bool(row.get("is_active", True)):
            return None
        return {
            "user_id": row.get("id"),
            "email": row.get("email"),
            "full_name": row.get("full_name"),
            "tenant_id": row.get("tenant_id") or "00000000-0000-0000-0000-000000000001",
        }
    except Exception as e:
        print(f"Error getting user from token: {e}")
        return None

