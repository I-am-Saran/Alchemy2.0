"""
Authentication Service - JWT-based authentication
"""

import jwt  # PyJWT library
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple
import psycopg2
from config import DB_URL, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS


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
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Get user by email (case-insensitive) - also get first_login and last_login
        cur.execute(
            "SELECT id, email, full_name, password, tenant_id, is_active, first_login, last_login FROM users WHERE LOWER(email) = LOWER(%s)",
            (email,)
        )
        user_row = cur.fetchone()
        
        if not user_row:
            conn.close()
            print(f"[authenticate_user] User not found: {email}")
            return None
        
        user_id, user_email, full_name, hashed_password, tenant_id, is_active, first_login, last_login = user_row
        
        # Check if user is active - CRITICAL: Block inactive users from logging in
        if not is_active:
            conn.close()
            print(f"[authenticate_user] User is inactive: {email}")
            return {"error": "inactive", "message": "Your account is inactive. Please contact your administrator."}
        
        # Check if user has a password set
        if not hashed_password:
            conn.close()
            print(f"[authenticate_user] User has no password set: {email}")
            return {"error": "no_password", "message": "No password set for this account. Please use SSO login or contact your administrator."}
        
        # Verify password
        if not verify_password(password, hashed_password):
            conn.close()
            print(f"[authenticate_user] Password verification failed for: {email}")
            return None
        
        # Check if user is first-time user (password is default "pass" or first_login is NULL)
        # Default password is "pass" - check if current password matches this
        is_default_password = verify_password("pass", hashed_password)
        # Also check if this is their first login (first_login is NULL or equals last_login)
        is_first_time = is_default_password or (first_login is None) or (first_login == last_login)
        
        # Update last_login and first_login if needed
        if first_login is None:
            cur.execute(
                "UPDATE users SET first_login = NOW(), last_login = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = %s",
                (user_id,)
            )
        else:
            cur.execute(
                "UPDATE users SET last_login = NOW(), login_count = COALESCE(login_count, 0) + 1 WHERE id = %s",
                (user_id,)
            )
        conn.commit()
        conn.close()
        
        # Create JWT token
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
    except psycopg2.Error as e:
        print(f"[authenticate_user] Database error: {e}")
        return None
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
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        cur.execute(
            "SELECT id, email, full_name, tenant_id FROM users WHERE id = %s AND is_active = TRUE",
            (user_id,)
        )
        user_row = cur.fetchone()
        conn.close()
        
        if not user_row:
            return None
        
        user_id, email, full_name, tenant_id = user_row
        
        return {
            "user_id": user_id,
            "email": email,
            "full_name": full_name,
            "tenant_id": tenant_id or "00000000-0000-0000-0000-000000000001",
        }
    except Exception as e:
        print(f"Error getting user from token: {e}")
        return None

