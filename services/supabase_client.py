import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client

env_url = os.getenv("SUPABASE_URL")
env_key = os.getenv("SUPABASE_KEY")
if not env_url or not env_key:
    env_path = Path(__file__).parent.parent / "alchemy_backend_fastapi" / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        env_url = os.getenv("SUPABASE_URL")
        env_key = os.getenv("SUPABASE_KEY")
if not env_url or not env_key:
    raise Exception("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
supabase: Client = create_client(env_url, env_key)


def verify_supabase_token(authorization_header: Optional[str] = None):
    try:
        if not authorization_header or not authorization_header.lower().startswith("bearer "):
            return None
        
        token = authorization_header.split(" ", 1)[1].strip()
        from services.auth_service import get_user_from_token
        user = get_user_from_token(token)
        
        if user:
            return {
                "status": "success",
                "user": {
                    "id": user.get("user_id"),
                    "email": user.get("email"),
                },
                "user_id": user.get("user_id"),
                "email": user.get("email"),
            }
        return None
    except Exception:
        return None
