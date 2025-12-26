# backend/main.py
# Import config first to ensure environment variables are loaded
import config  # noqa: F401 - Ensures config is loaded before other imports

from fastapi import FastAPI, HTTPException, Request, Header, Query, File, UploadFile, Path, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
# COMMENTED OUT FOR LOCAL DEVELOPMENT - Using local PostgreSQL instead
# from services.supabase_client import supabase
from services.db_service import local_db as supabase  # Use local DB service
from services.formatters import normalize_control, normalize_control_list, normalize_action
from services.auth_service import authenticate_user, verify_jwt_token, get_user_from_token, verify_password, validate_password_strength
from services.rbac_service import (
    get_user_roles,
    check_permission,
    get_all_roles,
    create_role,
    update_role_permissions,
    assign_role_to_user,
    remove_role_from_user,
    get_role_permissions,
    is_superadmin,
    get_role_id_by_name,
)
from services.auth_service import hash_password
from services.user_service import get_user_tenant_id
from services.certification_validator import validate_certification_payload, get_field_options
from utils.error_handler import handle_api_error, log_error, format_error_response, handle_endpoint_error
from utils.permission_checker import require_permission
import json
import os
import logging

# Helper function to get user department by email
def get_user_department_by_email(email: str) -> Optional[str]:
    """Get user's department by email. Returns None if user not found or department not set."""
    try:
        if not email or not email.strip():
            return None
        resp = supabase.table("users").select("department").eq("email", email.strip().lower()).limit(1).execute()
        if resp.data and len(resp.data) > 0:
            return resp.data[0].get("department")
        return None
    except Exception:
        return None

# Helper function to get user department and department_owner by email
def get_user_department_info_by_email(email: str) -> Dict[str, Optional[str]]:
    """Get user's department and department_owner by email. Returns dict with department and department_owner."""
    try:
        if not email or not email.strip():
            return {"department": None, "department_owner": None}
        resp = supabase.table("users").select("department, department_owner").eq("email", email.strip().lower()).limit(1).execute()
        if resp.data and len(resp.data) > 0:
            user_data = resp.data[0]
            return {
                "department": user_data.get("department"),
                "department_owner": user_data.get("department_owner")
            }
        return {"department": None, "department_owner": None}
    except Exception:
        return {"department": None, "department_owner": None}
import smtplib
from email.message import EmailMessage
from datetime import datetime, timezone
import time
import uuid
import random
import string


app = FastAPI()

# Allow your frontend origin
# In development, allow all origins. In production, specify exact origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all in development (restrict in production)
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ===========================
# Existing Controls API
# ===========================
@app.get("/api/controls")
async def get_controls():
    endpoint = "/api/controls"
    try:
        resp = supabase.table("controls").select("*").execute()
        data = resp.data or []
        formatted = [normalize_control(row) for row in data]
        return {"status": "success", "data": formatted}
    except HTTPException:
        raise
    except Exception as e:
        error_response, status_code = handle_api_error(
            e,
            endpoint,
            context={"operation": "get_controls", "table": "controls"},
            include_traceback=False,
            user_message="Failed to fetch controls"
        )
        raise HTTPException(status_code=status_code, detail=error_response["error"])
    
def auth_guard(authorization: Optional[str]) -> Dict[str, Any]:
    """Verify JWT token and return user information."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    
    # Verify JWT token
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    
    user_id = user.get("user_id")
    tenant_id = user.get("tenant_id") or "00000000-0000-0000-0000-000000000001"
    
    return {"token": token, "user": user, "user_id": user_id, "tenant_id": tenant_id}


@app.get("/api/security-controls")
@require_permission("security_controls_retrieve")
async def get_security_controls(
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    certification: Optional[str] = Query(None, description="Filter by certification name"),
    Authorization: Optional[str] = Header(default=None)
):
    """Fetch security controls filtered by certification parameter. Soft deleted items only visible to Super Admin."""
    endpoint = "/api/security-controls"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        # Certification is required - return empty if not provided
        if not certification:
            return {"data": [], "error": None}
        
        # Normalize certification name for case-insensitive exact matching
        cert_trimmed = certification.strip()
        
        # Build database query with filtering by certification column at database level
        # Use ILIKE without wildcards for case-insensitive exact match (equivalent to LOWER(certification) = LOWER('CADP'))
        query = (
            supabase.table("security_controls")
            .select("*")
            .eq("tenant_id", tenant_id)
            .ilike("certification", cert_trimmed)
        )
        
        # Filter out soft deleted items unless user is superadmin
        # Try to filter by is_deleted, but handle gracefully if column doesn't exist
        try:
            if not is_admin:
                query = query.eq("is_deleted", False)
            
            # Execute query
            resp = query.execute()
            if getattr(resp, "error", None):
                error_str = str(resp.error).lower()
                error_dict = resp.error if isinstance(resp.error, dict) else {}
                error_type = error_dict.get("type", "").lower() if isinstance(error_dict, dict) else ""
                
                # Check if error is about missing is_deleted column (backward compatibility)
                is_deleted_error = (
                    "is_deleted" in error_str and (
                        "column" in error_str or 
                        "does not exist" in error_str or 
                        "undefinedcolumn" in error_str or
                        error_type == "undefinedcolumn"
                    )
                )
                
                if is_deleted_error:
                    # Retry without the is_deleted filter
                    query = (
                        supabase.table("security_controls")
                        .select("*")
                        .eq("tenant_id", tenant_id)
                        .ilike("certification", cert_trimmed)
                    )
                    resp = query.execute()
                    if getattr(resp, "error", None):
                        raise HTTPException(status_code=400, detail=str(resp.error))
                else:
                    raise HTTPException(status_code=400, detail=str(resp.error))
        except HTTPException:
            raise
        except Exception as query_error:
            # If query execution fails (e.g., due to missing column), try without is_deleted filter
            error_str = str(query_error).lower()
            if "is_deleted" in error_str or "undefinedcolumn" in error_str:
                # Retry without the is_deleted filter
                query = (
                    supabase.table("security_controls")
                    .select("*")
                    .eq("tenant_id", tenant_id)
                    .ilike("certification", cert_trimmed)
                )
                resp = query.execute()
                if getattr(resp, "error", None):
                    raise HTTPException(status_code=400, detail=str(resp.error))
            else:
                raise
        
        data = resp.data or []
        
        # Batch fetch user departments to avoid N+1 queries
        owner_emails = set()
        for row in data:
            owner = row.get("owner")
            if owner and owner.strip():
                owner_emails.add(owner.strip().lower())
        
        # Fetch departments for all unique owners in one query
        department_map = {}
        if owner_emails:
            try:
                # Fetch all users and filter in Python (more efficient than N+1 individual queries)
                # If there are many users, we could optimize further with email filtering,
                # but for most cases this is acceptable
                users_resp = supabase.table("users").select("email, department").execute()
                if users_resp.data:
                    for user in users_resp.data:
                        email = user.get("email")
                        if email:
                            email_lower = email.strip().lower()
                            if email_lower in owner_emails:
                                department_map[email_lower] = user.get("department")
            except Exception:
                # If batch fetch fails, departments will remain empty (graceful degradation)
                pass
        
        # Format results
        formatted = []
        for row in data:
            normalized = normalize_control_list(row)
            # Populate department from batch-fetched map
            if not normalized.get("department") and normalized.get("owner"):
                owner_email = normalized.get("owner")
                if owner_email:
                    owner_department = department_map.get(owner_email.strip().lower())
                    if owner_department:
                        normalized["department"] = owner_department
            formatted.append(normalized)
        
        return {"data": formatted, "error": None}
    except Exception as e:
        error_response, status_code = handle_api_error(
            e,
            endpoint,
            context={"operation": "get_security_controls", "table": "security_controls"},
            include_traceback=False,
            user_message="Failed to fetch security controls"
        )
        return error_response


@app.get("/api/users/search")
async def search_users(q: str = Query(default=""), Authorization: Optional[str] = Header(default=None)):
    """Search users by email substring from 'users' table."""
    endpoint = "/api/users/search"
    try:
        _ = auth_guard(Authorization)
        query = q.strip()
        if not query:
            return {"data": [], "error": None}
        resp = (
            supabase
            .table("users")
            .select("id,email,full_name,department")
            .ilike("email", f"%{query}%")
            .limit(10)
            .execute()
        )
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        return {"data": resp.data or [], "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "search_users", return_dict=True, query=q)


@app.post("/api/security-controls/{record_id}/comments")
@require_permission("security_controls_comment")
async def add_comment(
    record_id: str,
    payload: Dict[str, Any],
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    endpoint = f"/api/security-controls/{record_id}/comments"
    try:
        _ = auth_guard(Authorization)
        # Expect a single comment object: { text, time, author }
        new_comment = payload.get("comment")
        if not new_comment or not isinstance(new_comment, dict):
            raise HTTPException(status_code=400, detail="Missing or invalid 'comment' in payload")

        # Load existing comments
        # Select all columns to avoid PostgREST case-sensitivity issues with 'Comments' column
        resp = (
            supabase
            .table("security_controls")
            .select("*")
            .eq("id", record_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Record not found")
        row = rows[0]

        raw = row.get("Comments")
        try:
            existing = json.loads(raw) if isinstance(raw, str) else (raw or [])
            if not isinstance(existing, list):
                existing = []
        except Exception:
            existing = []

        existing.append(new_comment)

        # Write to canonical 'Comments' column and update Review_Date
        # Note: updated_at column doesn't exist in security_controls table per code comments
        current_timestamp = datetime.now(timezone.utc).isoformat()
        update_payload = {
            "Comments": json.dumps(existing),
            "Review_Date": current_timestamp  # Update last review date when comment is added
        }
        
        update_resp = (
            supabase
            .table("security_controls")
            .update(update_payload)
            .eq("id", record_id)
            .execute()
        )
        
        # If update failed due to Review_Date column issue, retry with only Comments
        if getattr(update_resp, "error", None):
            error_msg = str(update_resp.error).lower()
            # Check if error is about Review_Date column not existing or invalid
            if any(keyword in error_msg for keyword in ["review_date", "column", "does not exist", "unknown"]):
                # Retry with only Comments field
                update_payload_minimal = {"Comments": json.dumps(existing)}
                update_resp = (
                    supabase
                    .table("security_controls")
                    .update(update_payload_minimal)
                    .eq("id", record_id)
                    .execute()
                )
            # If still has error after retry, raise it
            if getattr(update_resp, "error", None):
                raise HTTPException(status_code=400, detail=str(update_resp.error))
        return {"data": update_resp.data or [], "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "add_comment", return_dict=True, record_id=record_id)


@app.get("/api/security-controls/{record_id}/comments")
@require_permission("security_controls_retrieve")
async def get_comments(
    record_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Fetch comments for a specific security control."""
    endpoint = f"/api/security-controls/{record_id}/comments"
    try:
        _ = auth_guard(Authorization)
        # Use select("*") to avoid PostgREST case-sensitivity issues with 'Comments' column
        resp = (
            supabase
            .table("security_controls")
            .select("*")
            .eq("id", record_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Record not found")
        
        row = rows[0]
        raw = row.get("Comments")
        try:
            comments = json.loads(raw) if isinstance(raw, str) else (raw or [])
            if not isinstance(comments, list):
                comments = []
        except Exception:
            comments = []
        
        return {"data": comments, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_comments", return_dict=True, record_id=record_id)


@app.post("/api/security-controls/{record_id}/tasks")
@require_permission("security_controls_create_task")
async def add_task(
    record_id: str,
    payload: Dict[str, Any],
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    endpoint = f"/api/security-controls/{record_id}/tasks"
    try:
        _ = auth_guard(Authorization)
        # Expect a single task object: { text, type, time, author }
        new_task = payload.get("task")
        if not new_task or not isinstance(new_task, dict):
            raise HTTPException(status_code=400, detail="Missing or invalid 'task' in payload")

        # Load existing tasks
        resp = (
            supabase
            .table("security_controls")
            .select("task")
            .eq("id", record_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Record not found")
        row = rows[0]

        raw = row.get("task")
        try:
            existing = json.loads(raw) if isinstance(raw, str) else (raw or [])
            if not isinstance(existing, list):
                existing = []
        except Exception:
            existing = []

        existing.append(new_task)

        update_payload = {"task": json.dumps(existing)}
        update_resp = (
            supabase
            .table("security_controls")
            .update(update_payload)
            .eq("id", record_id)
            .execute()
        )
        if getattr(update_resp, "error", None):
            raise HTTPException(status_code=400, detail=str(update_resp.error))
        return {"data": update_resp.data or [], "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "add_task", return_dict=True, record_id=record_id)

@app.put("/api/security-controls/{record_id}")
@require_permission("security_controls_update")
async def update_security_control_put(
    record_id: str,
    request: Request,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Update a security control by ID using PUT method. Cannot update soft deleted items unless Super Admin."""
    endpoint = f"/api/security-controls/{record_id}"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        payload: Dict[str, Any] = await request.json()
        
        # Verify record exists (including soft deleted for Super Admin)
        # Try to check is_deleted, but handle gracefully if column doesn't exist
        try:
            exist_query = (
                supabase
                .table("security_controls")
                .select("id, is_deleted")
                .eq("id", record_id)
                .eq("tenant_id", tenant_id)
            )
            exist = exist_query.limit(1).execute()
            
            if getattr(exist, "error", None):
                error_str = str(exist.error).lower()
                error_dict = exist.error if isinstance(exist.error, dict) else {}
                error_type = error_dict.get("type", "").lower() if isinstance(error_dict, dict) else ""
                
                # If error is about missing is_deleted column, retry without it
                if "is_deleted" in error_str and (
                    "column" in error_str or 
                    "does not exist" in error_str or 
                    "undefinedcolumn" in error_str or
                    error_type == "undefinedcolumn"
                ):
                    exist_query = (
                        supabase
                        .table("security_controls")
                        .select("id")
                        .eq("id", record_id)
                        .eq("tenant_id", tenant_id)
                    )
                    exist = exist_query.limit(1).execute()
                    if getattr(exist, "error", None):
                        raise HTTPException(status_code=400, detail=str(exist.error))
                else:
                    raise HTTPException(status_code=400, detail=str(exist.error))
        except HTTPException:
            raise
        except Exception as query_error:
            # If query fails due to missing column, try without is_deleted
            error_str = str(query_error).lower()
            if "is_deleted" in error_str or "undefinedcolumn" in error_str:
                exist_query = (
                    supabase
                    .table("security_controls")
                    .select("id")
                    .eq("id", record_id)
                    .eq("tenant_id", tenant_id)
                )
                exist = exist_query.limit(1).execute()
                if getattr(exist, "error", None):
                    raise HTTPException(status_code=400, detail=str(exist.error))
            else:
                raise
        
        if not exist.data:
            raise HTTPException(status_code=404, detail="Record not found")
        
        # Check if record is soft deleted - only Super Admin can update soft deleted items
        # Only check if is_deleted field exists in the response
        if exist.data[0].get("is_deleted") is not None:
            if exist.data[0].get("is_deleted") and not is_admin:
                raise HTTPException(status_code=400, detail="Cannot update a deleted security control")

        # Prepare update payload (exclude soft delete fields from payload)
        update_payload = {k: v for k, v in payload.items() if k not in ("is_deleted", "deleted_at", "deleted_by")}

        new_id = payload.get("id")
        if new_id and str(new_id).strip() and new_id != record_id:
            dup = (
                supabase
                .table("security_controls")
                .select("id")
                .eq("id", new_id)
                .eq("tenant_id", tenant_id)
                .limit(1)
                .execute()
            )
            if dup.data and len(dup.data) > 0:
                raise HTTPException(status_code=400, detail="Control ID already exists")
            update_payload["id"] = new_id

        # Auto-populate department from owner's department if owner is set
        if "owner" in update_payload and update_payload.get("owner"):
            owner_email = update_payload.get("owner")
            owner_department = get_user_department_by_email(owner_email)
            if owner_department:
                update_payload["department"] = owner_department

        # Normalize responsible_team to reponsible_team (database column name has typo)
        if "responsible_team" in update_payload:
            update_payload["reponsible_team"] = update_payload.pop("responsible_team")

        # Always persist to canonical columns per requirement
        # Handle Comments field - ensure it's a JSON string
        if "Comments" in payload or "comments" in payload:
            comments_value = payload.get("Comments") or payload.get("comments")
            # If it's a dict or list, convert to JSON string
            if isinstance(comments_value, (dict, list)):
                update_payload["Comments"] = json.dumps(comments_value)
            elif isinstance(comments_value, str):
                # If it's already a string, use it as-is (might already be JSON)
                update_payload["Comments"] = comments_value
            else:
                # If None or empty, set to empty JSON array
                update_payload["Comments"] = json.dumps([])
            update_payload.pop("comments", None)
        
        # Handle task field - ensure it's a JSON string
        if "task" in payload:
            task_value = payload.get("task")
            # If it's a dict or list, convert to JSON string
            if isinstance(task_value, (dict, list)):
                update_payload["task"] = json.dumps(task_value)
            elif isinstance(task_value, str):
                # If it's already a string, use it as-is (might already be JSON)
                update_payload["task"] = task_value
            # If None, don't include it (let database use default)

        # Drop legacy/non-existent columns that may be present from normalized payload
        for legacy_key in ("Comments_1", "Comments2", "Comments 2", "updated_at"):
            update_payload.pop(legacy_key, None)

        # Note: security_controls table does not have updated_at column, so we don't set it

        resp = (
            supabase
            .table("security_controls")
            .update(update_payload)
            .eq("id", record_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        return {"data": resp.data[0] if resp.data else None, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "update_security_control_put", return_dict=True, record_id=record_id)


@app.get("/api/security-controls/{record_id}")
@require_permission("security_controls_retrieve")
async def get_security_control_by_id(
    record_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Fetch security control details. Soft deleted items only visible to Super Admin."""
    endpoint = f"/api/security-controls/{record_id}"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        query = (
            supabase
            .table("security_controls")
            .select("*")
            .eq("id", record_id)
            .eq("tenant_id", tenant_id)
        )
        
        # Filter out soft deleted items unless user is superadmin
        # Try to filter by is_deleted, but handle gracefully if column doesn't exist
        try:
            if not is_admin:
                query = query.eq("is_deleted", False)
            
            resp = query.limit(1).execute()
            if getattr(resp, "error", None):
                error_str = str(resp.error).lower()
                error_dict = resp.error if isinstance(resp.error, dict) else {}
                error_type = error_dict.get("type", "").lower() if isinstance(error_dict, dict) else ""
                
                # Check if error is about missing is_deleted column (backward compatibility)
                is_deleted_error = (
                    "is_deleted" in error_str and (
                        "column" in error_str or 
                        "does not exist" in error_str or 
                        "undefinedcolumn" in error_str or
                        error_type == "undefinedcolumn"
                    )
                )
                
                if is_deleted_error:
                    # Retry without the is_deleted filter
                    query = (
                        supabase
                        .table("security_controls")
                        .select("*")
                        .eq("id", record_id)
                        .eq("tenant_id", tenant_id)
                    )
                    resp = query.limit(1).execute()
                    if getattr(resp, "error", None):
                        raise HTTPException(status_code=400, detail=str(resp.error))
                else:
                    raise HTTPException(status_code=400, detail=str(resp.error))
        except HTTPException:
            raise
        except Exception as query_error:
            # If query execution fails (e.g., due to missing column), try without is_deleted filter
            error_str = str(query_error).lower()
            if "is_deleted" in error_str or "undefinedcolumn" in error_str:
                # Retry without the is_deleted filter
                query = (
                    supabase
                    .table("security_controls")
                    .select("*")
                    .eq("id", record_id)
                    .eq("tenant_id", tenant_id)
                )
                resp = query.limit(1).execute()
                if getattr(resp, "error", None):
                    raise HTTPException(status_code=400, detail=str(resp.error))
            else:
                raise
        
        rows = resp.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Record not found")
        return {"data": normalize_control(rows[0]), "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_security_control_by_id", return_dict=True, record_id=record_id)


@app.post("/api/security-controls")
@require_permission("security_controls_create")
async def create_security_control(
    request: Request,
    Authorization: Optional[str] = Header(default=None)
):
    """Create a new security control."""
    endpoint = "/api/security-controls"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        _ = auth_guard(Authorization)
        tenant_id = payload.get("tenant_id", "00000000-0000-0000-0000-000000000001")
        
        if "id" not in payload or not payload["id"]:
            def _gen_id():
                y = datetime.now().year
                l = "".join(random.choice(string.ascii_uppercase) for _ in range(2))
                n = f"{random.randint(0,99):02d}"
                return f"{l}{n}{y}"
            _candidate = _gen_id()
            for _ in range(20):
                chk = supabase.table("security_controls").select("id").eq("id", _candidate).limit(1).execute()
                if not (chk.data or []):
                    break
                _candidate = _gen_id()
            payload["id"] = _candidate
        if "uuid" not in payload or not payload["uuid"]:
            # UUID will be auto-generated by database, but we can set it explicitly
            payload["uuid"] = str(uuid.uuid4())
        
        # Set tenant_id
        payload["tenant_id"] = tenant_id
        
        # Auto-populate department from owner's department if owner is set
        if "owner" in payload and payload.get("owner"):
            owner_email = payload.get("owner")
            owner_department = get_user_department_by_email(owner_email)
            if owner_department:
                payload["department"] = owner_department
        
        # Normalize responsible_team to reponsible_team (database column name has typo)
        if "responsible_team" in payload:
            payload["reponsible_team"] = payload.pop("responsible_team")
        
        # Initialize Comments as empty array if not provided
        if "Comments" not in payload and "comments" not in payload:
            payload["Comments"] = json.dumps([])
        elif "comments" in payload:
            # Normalize to canonical Comments column
            payload["Comments"] = payload.get("comments")
            payload.pop("comments", None)
        
        # Initialize task as empty array if not provided
        if "task" not in payload:
            payload["task"] = json.dumps([])
        
        # Set is_deleted to False for new records (if column exists)
        payload["is_deleted"] = False
        
        # Drop legacy/non-existent columns
        for legacy_key in ("Comments_1", "Comments2", "Comments 2", "updated_at", "deleted_at", "deleted_by"):
            payload.pop(legacy_key, None)
        
        resp = (
            supabase
            .table("security_controls")
            .insert(payload)
            .execute()
        )
        if getattr(resp, "error", None):
            error_str = str(resp.error)
            # If is_deleted column doesn't exist, retry without it
            if "is_deleted" in error_str.lower() and ("column" in error_str.lower() or "does not exist" in error_str.lower()):
                payload.pop("is_deleted", None)
                resp = (
                    supabase
                    .table("security_controls")
                    .insert(payload)
                    .execute()
                )
                if getattr(resp, "error", None):
                    raise HTTPException(status_code=400, detail=str(resp.error))
            else:
                raise HTTPException(status_code=400, detail=error_str)
        
        created_record = resp.data[0] if resp.data else None
        if not created_record:
            raise HTTPException(status_code=400, detail="Failed to create security control")
        
        return {"data": created_record, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "create_security_control", return_dict=True, tenant_id=payload.get("tenant_id"))


@app.delete("/api/security-controls/{record_id}")
@require_permission("security_controls_delete")
async def delete_security_control(
    record_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Delete a security control.
    If column "is_deleted" exists, perform a soft delete (set is_deleted=True).
    Otherwise, perform a hard delete as a fallback.
    """
    endpoint = f"/api/security-controls/{record_id}"
    try:
        # Get user info
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")

        # Fetch record (select all to avoid referencing non-existent columns)
        existing = (
            supabase
            .table("security_controls")
            .select("*")
            .eq("id", record_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        rows = existing.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Security control not found")

        row = rows[0]
        has_soft_delete_column = "is_deleted" in row

        # If we have soft delete column and it's already deleted, block
        if has_soft_delete_column and row.get("is_deleted"):
            raise HTTPException(status_code=400, detail="Security control is already deleted")

        if has_soft_delete_column:
            # Soft delete: set is_deleted=True, deleted_at=now, deleted_by=user_id
            update_data = {
                "is_deleted": True,
                "deleted_at": datetime.now(timezone.utc).isoformat(),
                "deleted_by": user_id,
            }

            resp = (
                supabase
                .table("security_controls")
                .eq("id", record_id)
                .eq("tenant_id", tenant_id)
                .update(update_data)
                .execute()
            )
            if getattr(resp, "error", None):
                raise HTTPException(status_code=400, detail=str(resp.error))
        else:
            # Fallback: hard delete when is_deleted column doesn't exist
            resp = (
                supabase
                .table("security_controls")
                .eq("id", record_id)
                .eq("tenant_id", tenant_id)
                .delete()
                .execute()
            )
            # If delete succeeded but affected rows == 0, treat as not found
            if getattr(resp, "rowcount", 0) == 0:
                raise HTTPException(status_code=404, detail="Security control not found or already removed")
            if getattr(resp, "error", None):
                raise HTTPException(status_code=400, detail=str(resp.error))

        return {"data": {"success": True, "message": "Security control deleted successfully"}, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "delete_security_control", return_dict=True, record_id=record_id, tenant_id=tenant_id)


@app.patch("/api/security-controls/{record_id}/status")
async def update_security_control_status(
    record_id: str,
    request: Request,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Update only the status of a security control. Accessible to all authenticated users."""
    endpoint = f"/api/security-controls/{record_id}/status"
    try:
        # Authenticate user (required but no permission check needed)
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        
        payload: Dict[str, Any] = await request.json()
        
        # Validate that status is provided
        if "Status" not in payload and "status" not in payload:
            raise HTTPException(status_code=400, detail="Status field is required")
        
        # Get the status value (handle both "Status" and "status" keys)
        new_status = payload.get("Status") or payload.get("status")
        if not new_status or not str(new_status).strip():
            raise HTTPException(status_code=400, detail="Status cannot be empty")
        
        # Verify record exists
        try:
            exist_query = (
                supabase
                .table("security_controls")
                .select("id, is_deleted")
                .eq("id", record_id)
                .eq("tenant_id", tenant_id)
            )
            exist = exist_query.limit(1).execute()
            
            if getattr(exist, "error", None):
                error_str = str(exist.error).lower()
                error_dict = exist.error if isinstance(exist.error, dict) else {}
                error_type = error_dict.get("type", "").lower() if isinstance(error_dict, dict) else ""
                
                # If error is about missing is_deleted column, retry without it
                if "is_deleted" in error_str and (
                    "column" in error_str or 
                    "does not exist" in error_str or 
                    "undefinedcolumn" in error_str or
                    error_type == "undefinedcolumn"
                ):
                    exist_query = (
                        supabase
                        .table("security_controls")
                        .select("id")
                        .eq("id", record_id)
                        .eq("tenant_id", tenant_id)
                    )
                    exist = exist_query.limit(1).execute()
                    if getattr(exist, "error", None):
                        raise HTTPException(status_code=400, detail=str(exist.error))
                else:
                    raise HTTPException(status_code=400, detail=str(exist.error))
        except HTTPException:
            raise
        except Exception as query_error:
            # If query fails due to missing column, try without is_deleted
            error_str = str(query_error).lower()
            if "is_deleted" in error_str or "undefinedcolumn" in error_str:
                exist_query = (
                    supabase
                    .table("security_controls")
                    .select("id")
                    .eq("id", record_id)
                    .eq("tenant_id", tenant_id)
                )
                exist = exist_query.limit(1).execute()
                if getattr(exist, "error", None):
                    raise HTTPException(status_code=400, detail=str(exist.error))
            else:
                raise
        
        if not exist.data:
            raise HTTPException(status_code=404, detail="Security control not found")
        
        # Check if record is soft deleted - don't allow status updates on deleted items
        if exist.data[0].get("is_deleted") is not None:
            if exist.data[0].get("is_deleted"):
                raise HTTPException(status_code=400, detail="Cannot update status of a deleted security control")
        
        # Update only the Status field
        update_payload = {"Status": str(new_status).strip()}
        
        resp = (
            supabase
            .table("security_controls")
            .update(update_payload)
            .eq("id", record_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        return {
            "data": {
                "id": record_id,
                "Status": new_status,
                "message": "Status updated successfully"
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "update_security_control_status", return_dict=True, record_id=record_id, tenant_id=tenant_id)


# ============================
# 👤 USERS MODULE ENDPOINTS
# ============================
@app.get("/api/users")
@require_permission("users_retrieve")
async def get_users(
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """
    Returns JSON: { status, data: [ { id, email, full_name, department, department_owner, role, last_login, login_count, is_active, profile_pic_url, created_at, updated_at, sso_provider, sso_user_id } ] }

    - Orders by last_login desc if available, otherwise returns as-is.
    - Does not modify or delete existing code; adds only this endpoint.
    """
    endpoint = "/api/users"
    try:
        # Try to order by last_login if column exists, otherwise just select all
        try:
            # First check if last_login column exists by trying to order by it
            resp = supabase.table("users").select("*").order("last_login", desc=True).execute()
        except Exception as order_error:
            # If ordering fails, try without order
            try:
                resp = supabase.table("users").select("*").execute()
            except Exception as select_error:
                # If that also fails, return empty array
                return {"status": "success", "data": []}

        # The execute() method returns a Response object with .data attribute
        rows = resp.data if hasattr(resp, 'data') else (resp if isinstance(resp, list) else [])
        if not isinstance(rows, list):
            rows = []
        
        # For frontend convenience, include a derived 'name' field if missing
        for r in rows:
            if isinstance(r, dict):
                if "name" not in r or not r.get("name"):
                    r["name"] = r.get("full_name") or (r.get("email") or "").split("@")[0]
        
        return {"status": "success", "data": rows}
    except HTTPException:
        raise
    except Exception as e:
        error_response, status_code = handle_api_error(
            e,
            endpoint,
            context={"operation": "get_users", "table": "users"},
            include_traceback=False,
            user_message="Failed to fetch users"
        )
        raise HTTPException(status_code=status_code, detail=error_response["error"])

@app.post("/api/users")
@require_permission("users_create")
async def create_user(
    request: Request,
    Authorization: Optional[str] = Header(default=None)
):
    """
    Creates a user record in the `users` table.
    Accepts JSON: { username, email, role, department?, department_owner?, password? }
    - Stores basic profile fields with bcrypted password.
    - If password is not provided, defaults to "pass" and is bcrypted.
    - Returns { status, data: inserted_row }
    """
    endpoint = "/api/users"
    try:
        payload = await request.json()
        email = (payload.get("email") or "").strip().lower()
        full_name = (payload.get("username") or payload.get("name") or "").strip()
        role = (payload.get("role") or "Viewer").strip()
        department = (payload.get("department") or "").strip()

        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        # Prevent duplicates by email
        existing = supabase.table("users").select("id").eq("email", email).execute()
        if (existing.data or []):
            raise HTTPException(status_code=409, detail="User with this email already exists")

        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        # Generate UUID for user id (required by schema)
        user_id = str(uuid.uuid4())
        
        # Handle sso_user_id - must be UUID or NULL, not empty string
        sso_user_id = payload.get("sso_user_id") or None
        if sso_user_id == "":
            sso_user_id = None
        
        # Hash password if provided, otherwise set default password "pass"
        password = payload.get("password") or "pass"
        hashed_password = hash_password(password)
        
        department_owner = (payload.get("department_owner") or "").strip() or None
        
        to_insert = {
            "id": user_id,
            "email": email,
            "full_name": full_name or email.split("@")[0],
            "role": role or "Viewer",
            "department": department or None,
            "department_owner": department_owner,
            "password": hashed_password,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "sso_provider": (payload.get("sso_provider") or "manual"),
            "sso_user_id": sso_user_id,
            "login_count": 0,
        }
        resp = supabase.table("users").insert(to_insert, returning="representation").execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=500, detail=str(resp.error))
        inserted = (resp.data or [None])[0]
        
        # Assign role to user in user_roles table
        # Map role name from payload to actual role name
        role_name_mapping = {
            "QA": "Contributor",
            "DEV": "Contributor",
            "PM": "Contributor",
            "Others": "Viewer",
            "Viewer": "Viewer",
            "Contributor": "Contributor",
            "Admin": "Admin",
            "Super Admin": "Super Admin",
            "Internal Auditor": "Internal Auditor",
            "External Auditor": "External Auditor",
        }
        mapped_role_name = role_name_mapping.get(role, "Viewer")
        tenant_id = payload.get("tenant_id") or "00000000-0000-0000-0000-000000000001"
        
        # Get role ID by name
        role_id = get_role_id_by_name(mapped_role_name, tenant_id)
        if role_id:
            # Assign role to user
            assign_success = assign_role_to_user(user_id, role_id, tenant_id, None)
            if not assign_success:
                print(f"Warning: Failed to assign role {mapped_role_name} to user {user_id}")
        else:
            print(f"Warning: Role '{mapped_role_name}' not found for tenant {tenant_id}")
        
        return {"status": "success", "data": inserted}
    except HTTPException:
        raise
    except Exception as e:
        error_response, status_code = handle_api_error(
            e,
            endpoint,
            context={"operation": "create_user", "email": payload.get("email") if 'payload' in locals() else None},
            include_traceback=False,
            user_message="Failed to create user"
        )
        # error_response is {"data": None, "error": {...}}, so we need to pass the error dict as detail
        error_detail = error_response.get("error", {"message": "Failed to create user"})
        raise HTTPException(status_code=status_code, detail=error_detail)

@app.get("/api/users/{user_id}")
@require_permission("users_retrieve")
async def get_user(
    user_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """
    Gets a user by `id` or `email` from the `users` table.
    Returns { status, data: user_object } when found.
    """
    endpoint = f"/api/users/{user_id}"
    try:
        # Try by numeric id first
        user = None
        try:
            uid_int = int(user_id)
            resp = supabase.table("users").select("*").eq("id", uid_int).execute()
            if (getattr(resp, "data", None) or []):
                user = resp.data[0]
        except Exception:
            pass

        if not user:
            # Fallback: try by id as string and email
            resp = supabase.table("users").select("*").eq("id", user_id).execute()
            if not (getattr(resp, "data", None) or []):
                resp = supabase.table("users").select("*").eq("email", user_id).execute()
            if (getattr(resp, "data", None) or []):
                user = resp.data[0]

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Add derived 'name' field if missing
        if "name" not in user or not user.get("name"):
            user["name"] = user.get("full_name") or (user.get("email") or "").split("@")[0]

        return {"status": "success", "data": user}
    except HTTPException:
        raise
    except Exception as e:
        error_response, status_code = handle_api_error(
            e,
            endpoint,
            context={"operation": "get_user", "user_id": user_id},
            include_traceback=False,
            user_message="Failed to fetch user"
        )
        raise HTTPException(status_code=status_code, detail=error_response["error"])

@app.put("/api/users/{user_id}")
@require_permission("users_update")
async def update_user(
    user_id: str,
    request: Request,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """
    Updates a user by `id` or `email` in the `users` table.
    Accepts JSON: { name, full_name, email, role, department, department_owner, is_active, password? }
    - If password is provided, it will be bcrypted before storing.
    Returns { status, data: updated_user } when update succeeds.
    """
    endpoint = f"/api/users/{user_id}"
    try:
        payload = await request.json()
        
        # Validate email if provided
        if "email" in payload:
            email = (payload.get("email") or "").strip().lower()
            if email:
                # Check if email is already taken by another user
                # Get all users with this email
                existing_resp = supabase.table("users").select("id").eq("email", email).execute()
                existing_users = existing_resp.data or []
                # Check if any user with this email has a different ID
                for existing_user in existing_users:
                    if existing_user.get("id") != user_id:
                        raise HTTPException(status_code=409, detail="Email already in use by another user")

        # Prepare update payload - only include valid fields that exist in the table
        # Note: users table has full_name, not name
        update_payload = {}
        valid_fields = ["full_name", "email", "role", "department", "department_owner", "is_active", "password"]
        for field in valid_fields:
            if field in payload:
                if field == "password":
                    # Hash password before storing
                    update_payload["password"] = hash_password(payload["password"])
                elif field == "department_owner":
                    # Normalize empty strings to None for department_owner
                    dept_owner = (payload.get("department_owner") or "").strip() or None
                    update_payload["department_owner"] = dept_owner
                elif field == "department":
                    # Normalize empty strings to None for department
                    dept = (payload.get("department") or "").strip() or None
                    update_payload["department"] = dept
                else:
                    update_payload[field] = payload[field]

        # Handle name field - map to full_name if provided
        if "name" in payload and "full_name" not in payload:
            update_payload["full_name"] = payload["name"]

        if not update_payload:
            raise HTTPException(status_code=400, detail="No valid fields to update")

        # Add updated_at timestamp
        update_payload["updated_at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")

        # Try to find user by id (numeric or string) or email
        user_found = False
        updated_user = None
        
        # First, try to find the user to verify they exist
        try:
            # Try by UUID/string id first
            find_resp = supabase.table("users").select("id").eq("id", user_id).execute()
            if (getattr(find_resp, "data", None) or []):
                # User found, now update
                resp = supabase.table("users").update(update_payload).eq("id", user_id).execute()
                if (getattr(resp, "data", None) or []):
                    user_found = True
                    updated_user = resp.data[0]
        except Exception as e1:
            # If UUID lookup fails, try by email
            try:
                find_resp = supabase.table("users").select("id").eq("email", user_id).execute()
                if (getattr(find_resp, "data", None) or []):
                    found_id = find_resp.data[0].get("id")
                    resp = supabase.table("users").update(update_payload).eq("id", found_id).execute()
                    if (getattr(resp, "data", None) or []):
                        user_found = True
                        updated_user = resp.data[0]
            except Exception as e2:
                pass

        if not user_found:
            raise HTTPException(status_code=404, detail="User not found")

        # If role was updated, sync it to user_roles table
        if "role" in update_payload:
            role = update_payload.get("role")
            # Get the actual user_id (might be different from user_id parameter if found by email)
            actual_user_id = updated_user.get("id") or user_id
            user_tenant_id = updated_user.get("tenant_id") or tenant_id or "00000000-0000-0000-0000-000000000001"
            
            # Map role name from payload to actual role name (same mapping as create_user)
            role_name_mapping = {
                "QA": "Contributor",
                "DEV": "Contributor",
                "PM": "Contributor",
                "Others": "Viewer",
                "Viewer": "Viewer",
                "Contributor": "Contributor",
                "Admin": "Admin",
                "Super Admin": "Super Admin",
                "Internal Auditor": "Internal Auditor",
                "External Auditor": "External Auditor",
            }
            mapped_role_name = role_name_mapping.get(role, "Viewer")
            
            # Get role ID by name
            role_id = get_role_id_by_name(mapped_role_name, user_tenant_id)
            if role_id:
                # Remove all existing roles for this user in this tenant
                existing_roles = get_user_roles(actual_user_id, user_tenant_id)
                for existing_role in existing_roles:
                    existing_role_id = existing_role.get("role_id")
                    if existing_role_id:
                        success, _ = remove_role_from_user(actual_user_id, existing_role_id, user_tenant_id)
                        if not success:
                            print(f"Warning: Failed to remove existing role {existing_role_id} from user {actual_user_id}")
                
                # Assign the new role
                auth_data = auth_guard(Authorization) if Authorization else None
                assigned_by = None
                if auth_data:
                    assigned_by = auth_data.get("user", {}).get("user_id") or auth_data.get("user", {}).get("id")
                
                assign_success = assign_role_to_user(actual_user_id, role_id, user_tenant_id, assigned_by)
                if not assign_success:
                    print(f"Warning: Failed to assign role {mapped_role_name} to user {actual_user_id} during update")
            else:
                print(f"Warning: Role '{mapped_role_name}' not found for tenant {user_tenant_id}")

        # Add derived 'name' field if missing
        if "name" not in updated_user or not updated_user.get("name"):
            updated_user["name"] = updated_user.get("full_name") or (updated_user.get("email") or "").split("@")[0]

        return {"status": "success", "data": updated_user}
    except HTTPException:
        raise
    except Exception as e:
        error_response, status_code = handle_api_error(
            e,
            endpoint,
            context={"operation": "update_user", "user_id": user_id},
            include_traceback=False,
            user_message="Failed to update user"
        )
        raise HTTPException(status_code=status_code, detail=error_response["error"])

@app.delete("/api/users/{user_id}")
@require_permission("users_delete")
async def delete_user(
    user_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """
    Deletes a user by `id` or `email` from the `users` table.
    Returns { status } when deletion succeeds.
    """
    endpoint = f"/api/users/{user_id}"
    try:
        # First, verify the user exists
        user_found = None
        
        # Try to find user by numeric id
        try:
            uid_int = int(user_id)
            find_resp = supabase.table("users").select("id").eq("id", uid_int).limit(1).execute()
            if find_resp and getattr(find_resp, "data", None) and len(find_resp.data) > 0:
                user_found = find_resp.data[0].get("id")
        except Exception:
            pass

        # Try to find user by string id
        if not user_found:
            try:
                find_resp = supabase.table("users").select("id").eq("id", user_id).limit(1).execute()
                if find_resp and getattr(find_resp, "data", None) and len(find_resp.data) > 0:
                    user_found = find_resp.data[0].get("id")
            except Exception:
                pass

        # Try to find user by email
        if not user_found:
            try:
                find_resp = supabase.table("users").select("id").eq("email", user_id).limit(1).execute()
                if find_resp and getattr(find_resp, "data", None) and len(find_resp.data) > 0:
                    user_found = find_resp.data[0].get("id")
            except Exception:
                pass

        if not user_found:
            raise HTTPException(status_code=404, detail="User not found")

        # Now delete the user using the found id
        deleted = False
        try:
            resp = supabase.table("users").eq("id", user_found).delete().execute()
            # Check if there's no error (successful delete)
            if resp and not getattr(resp, "error", None):
                deleted = True
        except Exception as e:
            # If delete fails, raise an error
            raise HTTPException(status_code=400, detail=f"Failed to delete user: {str(e)}")

        if not deleted:
            raise HTTPException(status_code=400, detail="Delete operation did not succeed")

        return {"status": "success"}
    except HTTPException:
        raise
    except Exception as e:
        error_response, status_code = handle_api_error(
            e,
            endpoint,
            context={"operation": "delete_user", "user_id": user_id},
            include_traceback=False,
            user_message="Failed to delete user"
        )
        raise HTTPException(status_code=status_code, detail=error_response["error"])

@app.post("/api/invite")
async def invite_user(request: Request):
    """
    Sends an invitation email via Supabase Admin if available; also upserts a user row.
    Accepts JSON: { email, name, role }
    Returns { status, message }
    """
    try:
        payload = await request.json()
        email = (payload.get("email") or "").strip().lower()
        name = (payload.get("name") or "").strip()
        role = (payload.get("role") or "Viewer").strip()

        if not email:
            raise HTTPException(status_code=400, detail="Email is required")

        # Try Supabase Admin invite (requires service role key)
        try:
            admin = getattr(supabase, "auth", None)
            admin = getattr(admin, "admin", None)
            if admin and hasattr(admin, "invite_user_by_email"):
                resp = admin.invite_user_by_email(email)
                if getattr(resp, "error", None):
                    logging.warning(f"Supabase admin invite error: {resp.error}")
                else:
                    logging.info(f"Invitation queued for {email}")
            else:
                logging.warning("Supabase admin invite not available in client")
        except Exception as e:
            logging.warning(f"Admin invite attempt failed: {e}")

        # Attempt direct SMTP email as a fallback
        email_sent = False
        try:
            smtp_host = os.getenv("SMTP_HOST")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            smtp_user = os.getenv("SMTP_USER")
            smtp_pass = os.getenv("SMTP_PASS")
            smtp_from = os.getenv("SMTP_FROM", smtp_user or "noreply@example.com")

            if smtp_host and smtp_from:
                msg = EmailMessage()
                msg["Subject"] = "You're invited to Alchemy QA"
                msg["From"] = smtp_from
                msg["To"] = email
                msg.set_content(
                    f"Hello {name or email},\n\n" \
                    f"You have been invited to Alchemy QA with role '{role}'. " \
                    f"Please check your inbox for the Supabase invite or use the app's login with Microsoft (Azure).\n\n" \
                    f"Thanks,\nAlchemy QA Team"
                )

                with smtplib.SMTP(smtp_host, smtp_port) as server:
                    server.starttls()
                    if smtp_user and smtp_pass:
                        server.login(smtp_user, smtp_pass)
                    server.send_message(msg)
                email_sent = True
            else:
                logging.info("SMTP not configured; skipping direct email send")
        except Exception as e:
            logging.warning(f"SMTP send failed: {e}")

        # Upsert into users table as inactive until first login
        now = datetime.now(timezone.utc).isoformat(timespec="seconds")
        upsert = {
            "email": email,
            "full_name": name or email.split("@")[0],
            "role": role,
            "is_active": False,
            "created_at": now,
            "updated_at": now,
            "sso_provider": "azure",
            "sso_user_id": payload.get("sso_user_id") or "",
            "login_count": 0,
        }
        supabase.table("users").upsert(upsert).execute()

        return {"status": "success", "message": "Invitation processed", "email_sent": email_sent}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
# ============================

# ===========================
# Transtracker Save API
# ===========================
class TranstrackerEntry(BaseModel):
    applicationtype: str
    productsegregated: Optional[str] = None
    productowner: str
    spoc: str
    projects_products: Optional[str] = None
    buildnumber: Optional[str] = None
    buildreceiveddate: str
    year: Optional[int] = None
    monthname: Optional[str] = None
    quarternumber: Optional[int] = None
    monthnumber: Optional[int] = None
    weeknumber: Optional[int] = None
    dayname: Optional[str] = None
    y_q: Optional[str] = None
    y_q_m_w: Optional[str] = None
    m_y: Optional[str] = None
    buildreceivedtime: Optional[str] = None
    buildmailfrom: Optional[str] = None
    maildetails: Optional[str] = None
    testreportsentdate: Optional[str] = None
    testreportsenttime: Optional[str] = None
    testreportsentby: Optional[str] = None
    signoffstatus: str
    signoffrationale: Optional[str] = None
    totalopenbugs: int
    blocker: Optional[int] = None
    high: Optional[int] = None
    med: Optional[int] = None
    low: Optional[int] = None
    sit: Optional[str] = None
    sitactualhours: Optional[float] = None
    pt: Optional[str] = None
    ptactualhours: Optional[float] = None
    cbt: Optional[str] = None
    cbtactualhours: Optional[float] = None
    android: Optional[str] = None
    androidactualhours: Optional[float] = None
    ios: Optional[str] = None
    iosactualhours: Optional[float] = None
    securitytesting: Optional[str] = None
    totaltTestCases: Optional[int] = None
    automatedTestCases: Optional[int] = None
    manualexecutiontime: Optional[float] = None
    automationexecutiontime: Optional[float] = None
    timesaved: Optional[float] = None
    timesavedpercent: Optional[float] = None


@app.post("/api/transtracker")
async def create_transtracker(entry: TranstrackerEntry):
    endpoint = "/api/transtracker"
    try:
        data_dict = entry.dict()
        resp = supabase.table("transtrackers").insert(data_dict).execute()
        if resp.error:
            raise HTTPException(status_code=400, detail=resp.error.message)
        return {"status": "success", "data": resp.data}
    except HTTPException:
        raise
    except Exception as e:
        error_response, status_code = handle_api_error(
            e,
            endpoint,
            context={"operation": "create_transtracker", "table": "transtrackers"},
            include_traceback=False,
            user_message="Failed to create transtracker entry"
        )
        raise HTTPException(status_code=status_code, detail=error_response["error"])

@app.get("/api/transtracker/all")
async def get_all_transtrackers():
    endpoint = "/api/transtracker/all"
    try:
        resp = supabase.table("transtrackers").select("*").execute()
        if resp.error:
            raise HTTPException(status_code=400, detail=resp.error.message)
        return {"status": "success", "data": resp.data}
    except HTTPException:
        raise
    except Exception as e:
        error_response, status_code = handle_api_error(
            e,
            endpoint,
            context={"operation": "get_all_transtrackers", "table": "transtrackers"},
            include_traceback=False,
            user_message="Failed to fetch transtrackers"
        )
        raise HTTPException(status_code=status_code, detail=error_response["error"])


def _count_table(table_name: str, select_col: str = '"id"'):
    """
    Counts records in a Supabase table.

    - select_col: the column to select/count (use quotes for columns with spaces, e.g. '"Bug ID"').
    - Returns: (count: int, error_msg: Optional[str])
    """
    import logging

    try:
        logging.info(f"📊 Querying table: {table_name} using column {select_col!r}")

        # Try the requested column first
        resp = supabase.table(table_name).select(select_col, count="exact").execute()

        # If selection returned an error, try a sensible fallback
        if hasattr(resp, "error") and resp.error:
            logging.warning(f"⚠️ Column {select_col!r} failed on {table_name}: {resp.error}")

            # Choose fallback column depending on table type
            if "bug" in table_name.lower() or table_name.lower().startswith("bugs"):
                fallback_col = '"Bug ID"'
            else:
                fallback_col = '"id"'

            logging.info(f"Trying fallback column {fallback_col!r} for table {table_name}")
            resp = supabase.table(table_name).select(fallback_col, count="exact").execute()

            if hasattr(resp, "error") and resp.error:
                error_msg = f"Both {select_col!r} and fallback {fallback_col!r} failed: {resp.error}"
                logging.error(error_msg)
                return 0, error_msg

        # Extract exact count if available
        if hasattr(resp, "count") and resp.count is not None:
            count = int(resp.count)
            logging.info(f"✅ {table_name}: count={count} (from resp.count)")
            return count, None

        # Some supabase clients return a dict
        if isinstance(resp, dict) and resp.get("count") is not None:
            count = int(resp["count"])
            logging.info(f"✅ {table_name}: count={count} (from dict count)")
            return count, None

        # Fallback: try to get data list and count
        data = getattr(resp, "data", None)
        if data is None and isinstance(resp, dict):
            data = resp.get("data", [])
        if data is None:
            data = []

        count = len(data or [])
        logging.info(f"✅ {table_name}: count={count} (from data length fallback)")
        return count, None

    except Exception as e:
        error_msg = f"Exception while counting {table_name}: {str(e)}"
        logging.exception(f"❌ Error counting table {table_name}: {e}")
        return 0, error_msg


@app.get("/api/counts")
def get_counts():
    """
    Returns JSON: { status, data: { total_bugs, users, transactions, security_alerts } }
    """
    try:
        logging.info("Starting /api/counts request")
        
        # Use '*' for select to avoid column name issues (e.g., "Bug ID")
        total_bugs, err_bugs = _count_table("Bugs_file", select_col="*")
        total_users, err_users = _count_table("users")
        # Fallbacks for transaction tracker naming variants
        transaction_tracker, err_trans = _count_table("transtrackers")
        if transaction_tracker == 0:
            alt_count, _ = _count_table("transtracker")
            if alt_count == 0:
                alt_count2, _ = _count_table("transactions")
                transaction_tracker = alt_count2
            else:
                transaction_tracker = alt_count
        security_controls, err_sec = _count_table("security_controls")

        response = {
            "status": "success",
            "data": {
                "total_bugs": total_bugs,
                "users": total_users,
                "transactions": transaction_tracker,
                "security_alerts": security_controls,
            },
        }
        logging.info(f"✅ /api/counts response: {response}")
        return response

    except Exception as e:
        error_detail = f"Error in /api/counts: {str(e)}"
        logging.exception(error_detail)
        return {"status": "error", "detail": error_detail}, 500



# Helper functions for priority stats
PRIORITY_COLUMN_CANDIDATES = ["Priority", "priority", "severity", "Severity"]

def _classify_priority_value(val: Any) -> str:
    s = str(val or "").strip().lower()
    if any(k in s for k in ["critical", "crit", "p0", "p1", "high"]):
        return "high"
    if any(k in s for k in ["medium", "med", "p2"]):
        return "medium"
    return "low"


def _pick_priority_value(row: Dict[str, Any]) -> Any:
    if not isinstance(row, dict):
        return None
    for c in PRIORITY_COLUMN_CANDIDATES:
        if c in row:
            return row[c]
    # try normalized keys
    normalized_keys = {k.strip().lower().replace(" ", "_"): k for k in row.keys()}
    for candidate in ("priority", "bug_priority", "severity"):
        if candidate in normalized_keys:
            return row[normalized_keys[candidate]]
    # fallback first non-null
    for v in row.values():
        if v is not None:
            return v
    return None


def _normalize_resp_to_rows(resp: Any) -> List[Dict[str, Any]]:
    if resp is None:
        return []
    if isinstance(resp, dict):
        return resp.get("data") or []
    return getattr(resp, "data", None) or []


@app.get("/api/priority-stats")
def get_priority_stats() -> Dict[str, Any]:
    if not supabase:
        logging.error("Supabase client not configured")
        raise HTTPException(status_code=500, detail="Supabase client not configured on server")

    try:
        try:
            resp = supabase.table("Bugs_file").select("*").limit(5000).execute()
        except:
            resp = supabase.from_("Bugs_file").select("*").limit(5000).execute()
    except Exception:
        logging.exception("Supabase query to Bugs_file failed")
        raise HTTPException(status_code=500, detail="Supabase query failed")

    # check for error field
    if isinstance(resp, dict) and resp.get("error"):
        logging.error("Supabase returned error for Bugs_file: %r", resp.get("error"))
        raise HTTPException(status_code=500, detail="Supabase error while reading Bugs table")

    rows = _normalize_resp_to_rows(resp)
    logging.debug("Fetched %d rows from Bugs_file", len(rows))

    high = medium = low = 0
    for r in rows:
        val = _pick_priority_value(r)
        cls = _classify_priority_value(val)
        if cls == "high":
            high += 1
        elif cls == "medium":
            medium += 1
        else:
            low += 1

    total = high + medium + low
    data_map = {"high": int(high), "medium": int(medium), "low": int(low), "total": int(total)}
    bar_data = [
        {"priority": "High", "count": int(high)},
        {"priority": "Medium", "count": int(medium)},
        {"priority": "Low", "count": int(low)},
    ]

    return {"status": "success", "data_map": data_map, "bar_data": bar_data}


# ============================
# 🔐 RBAC MODULE ENDPOINTS
# ============================

@app.get("/api/roles")
@require_permission("roles_retrieve")
async def get_roles(tenant_id: str = Query(...), Authorization: Optional[str] = Header(default=None)):
    """Get all roles for a tenant."""
    endpoint = "/api/roles"
    try:
        _ = auth_guard(Authorization)
        roles = get_all_roles(tenant_id)
        return {"data": roles, "error": None}
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_roles", return_dict=True, tenant_id=tenant_id)


@app.get("/api/roles/{role_id}")
async def get_role(role_id: str, tenant_id: str = Query(...), Authorization: Optional[str] = Header(default=None)):
    """Get a specific role with its permissions.
    
    Users can always fetch roles that are assigned to them. Other roles require roles_retrieve permission.
    """
    endpoint = f"/api/roles/{role_id}"
    try:
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        current_user_id = user.get("user_id") or user.get("id")
        user_tenant_id = user.get("tenant_id") or tenant_id or "00000000-0000-0000-0000-000000000001"
        
        # Check if user has this role assigned
        user_roles = get_user_roles(current_user_id, user_tenant_id)
        user_has_role = False
        for user_role in user_roles:
            role_id_from_user = user_role.get("role_id")
            if not role_id_from_user and user_role.get("roles"):
                roles_data = user_role.get("roles")
                if isinstance(roles_data, dict):
                    role_id_from_user = roles_data.get("id")
                elif isinstance(roles_data, list) and len(roles_data) > 0:
                    role_id_from_user = roles_data[0].get("id")
            
            if role_id_from_user == role_id:
                user_has_role = True
                break
        
        # If user doesn't have this role, check if they have roles_retrieve permission
        if not user_has_role:
            from services.rbac_service import check_permission, is_superadmin
            
            if not is_superadmin(current_user_id, user_tenant_id):
                has_permission = check_permission(current_user_id, user_tenant_id, "roles", "retrieve")
                if not has_permission:
                    raise HTTPException(status_code=403, detail="You do not have permission to retrieve this role")
        
        # Get role
        resp = supabase.table("roles").select("*").eq("id", role_id).eq("tenant_id", tenant_id).limit(1).execute()
        role = resp.data[0] if resp.data else None
        if not role:
            raise HTTPException(status_code=404, detail="Role not found")
        
        # Get permissions
        permissions = get_role_permissions(role_id, tenant_id)
        role["permissions"] = permissions
        
        return {"data": role, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_role", return_dict=True, role_id=role_id, tenant_id=tenant_id)


@app.post("/api/roles")
@require_permission("roles_create")
async def create_role_endpoint(request: Request, Authorization: Optional[str] = Header(default=None)):
    """Create a new role."""
    endpoint = "/api/roles"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        
        tenant_id = payload.get("tenant_id")
        role_name = payload.get("role_name")
        role_description = payload.get("role_description")
        
        if not tenant_id or not role_name:
            raise HTTPException(status_code=400, detail="tenant_id and role_name are required")
        
        role = create_role(tenant_id, role_name, role_description, user_id)
        if not role:
            raise HTTPException(status_code=400, detail="Failed to create role")
        
        return {"data": role, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "create_role", return_dict=True, tenant_id=payload.get("tenant_id"), role_name=payload.get("role_name"))


@app.put("/api/roles/{role_id}")
@require_permission("roles_update")
async def update_role_endpoint(
    role_id: str,
    request: Request,
    Authorization: Optional[str] = Header(default=None)
):
    """Update a role."""
    endpoint = f"/api/roles/{role_id}"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        _ = auth_guard(Authorization)
        tenant_id = payload.get("tenant_id")
        role_name = payload.get("role_name")
        role_description = payload.get("role_description")
        is_active = payload.get("is_active", True)
        
        if not tenant_id:
            raise HTTPException(status_code=400, detail="tenant_id is required")
        
        # Check if role exists
        resp = supabase.table("roles").select("*").eq("id", role_id).eq("tenant_id", tenant_id).limit(1).execute()
        if not resp.data:
            raise HTTPException(status_code=404, detail="Role not found")
        
        # Update role
        update_data = {}
        if role_name is not None:
            update_data["role_name"] = role_name
        if role_description is not None:
            update_data["role_description"] = role_description
        if is_active is not None:
            update_data["is_active"] = is_active
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        resp = supabase.table("roles").eq("id", role_id).eq("tenant_id", tenant_id).update(update_data).execute()
        
        if resp.error:
            raise HTTPException(status_code=400, detail=f"Failed to update role: {resp.error}")
        
        updated_role = resp.data[0] if resp.data else None
        return {"data": updated_role, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "update_role", return_dict=True, role_id=role_id, tenant_id=payload.get("tenant_id"))


@app.put("/api/roles/{role_id}/permissions")
@require_permission("roles_update")
async def update_role_permissions_endpoint(
    role_id: str,
    request: Request,
    Authorization: Optional[str] = Header(default=None)
):
    """Update permissions for a role."""
    endpoint = f"/api/roles/{role_id}/permissions"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        _ = auth_guard(Authorization)
        tenant_id = payload.get("tenant_id")
        module_name = payload.get("module_name")
        permissions = payload.get("permissions", {})
        
        if not tenant_id or not module_name:
            raise HTTPException(status_code=400, detail="tenant_id and module_name are required")
        
        success, error_msg = update_role_permissions(role_id, tenant_id, module_name, permissions)
        if not success:
            detail = error_msg or "Failed to update permissions. Check server logs for details."
            raise HTTPException(status_code=400, detail=detail)
        
        return {"data": {"success": True}, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "update_role_permissions", return_dict=True, role_id=role_id, module_name=payload.get("module_name"), tenant_id=payload.get("tenant_id"))


@app.get("/api/users/{user_id}/roles")
async def get_user_roles_endpoint(
    user_id: str,
    tenant_id: str = Query(...),
    Authorization: Optional[str] = Header(default=None)
):
    """Get all roles assigned to a user.
    
    Users can always fetch their own roles. Other users require roles_retrieve permission.
    """
    endpoint = f"/api/users/{user_id}/roles"
    try:
        auth_data = auth_guard(Authorization)
        # auth_guard returns {"user": {"user_id": ..., "email": ..., "tenant_id": ...}}
        user = auth_data.get("user", {})
        current_user_id = user.get("user_id") or user.get("id")
        
        # Allow users to fetch their own roles without permission check
        # Otherwise, require roles_retrieve permission
        if current_user_id and current_user_id != user_id:
            # Check permission for fetching other users' roles
            from services.rbac_service import check_permission, is_superadmin
            
            # Get tenant_id from user or use provided
            user_tenant_id = user.get("tenant_id") or tenant_id or "00000000-0000-0000-0000-000000000001"
            
            # Check if superadmin or has roles_retrieve permission
            if not is_superadmin(current_user_id, user_tenant_id):
                has_permission = check_permission(current_user_id, user_tenant_id, "roles", "retrieve")
                if not has_permission:
                    raise HTTPException(status_code=403, detail="You do not have permission to retrieve roles")
        
        roles = get_user_roles(user_id, tenant_id)
        return {"data": roles, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_user_roles", return_dict=True, user_id=user_id, tenant_id=tenant_id)


@app.get("/api/users/{user_id}/permissions")
async def get_user_permissions_endpoint(
    user_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get all roles and permissions for a user in one call.
    
    This endpoint combines /api/users/{user_id}/roles and multiple /api/roles/{role_id} calls
    to reduce the number of API calls needed on login.
    
    Users can always fetch their own permissions. Other users require roles_retrieve permission.
    """
    endpoint = f"/api/users/{user_id}/permissions"
    try:
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        current_user_id = user.get("user_id") or user.get("id")
        
        # Allow users to fetch their own permissions without permission check
        # Otherwise, require roles_retrieve permission
        if current_user_id and current_user_id != user_id:
            from services.rbac_service import check_permission, is_superadmin
            user_tenant_id = user.get("tenant_id") or tenant_id or "00000000-0000-0000-0000-000000000001"
            if not is_superadmin(current_user_id, user_tenant_id):
                has_permission = check_permission(current_user_id, user_tenant_id, "roles", "retrieve")
                if not has_permission:
                    raise HTTPException(status_code=403, detail="You do not have permission to retrieve permissions")
        
        # Get user roles
        roles = get_user_roles(user_id, tenant_id)
        
        # Get permissions for each role and merge them
        permsByModule = {}
        userRoles = []
        
        print(f"[get_user_permissions] Processing {len(roles)} role(s) for user_id={user_id}, tenant_id={tenant_id}")
        
        for userRole in roles:
            # Extract role_id from different possible structures
            roleId = userRole.get("role_id")
            if not roleId and userRole.get("roles"):
                roles_data = userRole.get("roles")
                if isinstance(roles_data, dict):
                    roleId = roles_data.get("id")
                elif isinstance(roles_data, list) and len(roles_data) > 0:
                    roleId = roles_data[0].get("id")
            
            if not roleId:
                continue
            
            # Get role details
            try:
                rolePerms = get_role_permissions(roleId, tenant_id)
                print(f"[get_user_permissions] Role {roleId} has {len(rolePerms)} permission(s)")
                
                # Build role info
                roleInfo = userRole.get("roles")
                if isinstance(roleInfo, dict):
                    roleName = roleInfo.get("role_name") or roleInfo.get("name")
                elif isinstance(roleInfo, list) and len(roleInfo) > 0:
                    roleName = roleInfo[0].get("role_name") or roleInfo[0].get("name")
                else:
                    roleName = userRole.get("role_name") or "Unknown"
                
                userRoles.append({
                    "role_id": roleId,
                    "role_name": roleName,
                    **userRole
                })
                
                # Merge permissions (OR logic - if any role has permission, user has it)
                for perm in rolePerms:
                    moduleName = perm.get("module_name")
                    if not moduleName:
                        continue
                    
                    # Normalize module name to lowercase for consistent comparison
                    moduleNameLower = moduleName.lower()
                    
                    # Use lowercase as key for consistent module name handling
                    if moduleNameLower not in permsByModule:
                        permsByModule[moduleNameLower] = {
                            "can_create": False,
                            "can_retrieve": False,
                            "can_update": False,
                            "can_delete": False,
                            "can_comment": False,
                            "can_create_task": False,
                        }
                    
                    # Helper function to check if a permission value is True
                    # Handles both boolean True and string "true" values
                    def is_permission_enabled(value):
                        if value is True:
                            return True
                        if isinstance(value, str) and value.lower() == "true":
                            return True
                        if isinstance(value, bool) and value:
                            return True
                        # Handle PostgreSQL boolean strings
                        if isinstance(value, str) and value.lower() in ("t", "true", "1", "yes"):
                            return True
                        return False
                    
                    # Merge permissions - check each permission field
                    can_create_val = perm.get("can_create")
                    can_retrieve_val = perm.get("can_retrieve")
                    can_update_val = perm.get("can_update")
                    can_delete_val = perm.get("can_delete")
                    can_comment_val = perm.get("can_comment")
                    can_create_task_val = perm.get("can_create_task")
                    
                    permsByModule[moduleNameLower]["can_create"] = permsByModule[moduleNameLower]["can_create"] or is_permission_enabled(can_create_val)
                    permsByModule[moduleNameLower]["can_retrieve"] = permsByModule[moduleNameLower]["can_retrieve"] or is_permission_enabled(can_retrieve_val)
                    permsByModule[moduleNameLower]["can_update"] = permsByModule[moduleNameLower]["can_update"] or is_permission_enabled(can_update_val)
                    permsByModule[moduleNameLower]["can_delete"] = permsByModule[moduleNameLower]["can_delete"] or is_permission_enabled(can_delete_val)
                    permsByModule[moduleNameLower]["can_comment"] = permsByModule[moduleNameLower]["can_comment"] or is_permission_enabled(can_comment_val)
                    permsByModule[moduleNameLower]["can_create_task"] = permsByModule[moduleNameLower]["can_create_task"] or is_permission_enabled(can_create_task_val)
                    
                    # Debug logging for security_controls module
                    if moduleNameLower == "security_controls":
                        print(f"[get_user_permissions] Merging security_controls permissions from role {roleId}:")
                        print(f"  can_create: {can_create_val} (type: {type(can_create_val)}) -> {is_permission_enabled(can_create_val)}")
                        print(f"  can_retrieve: {can_retrieve_val} (type: {type(can_retrieve_val)}) -> {is_permission_enabled(can_retrieve_val)}")
                        print(f"  can_update: {can_update_val} (type: {type(can_update_val)}) -> {is_permission_enabled(can_update_val)}")
                        print(f"  Final merged: {permsByModule[moduleNameLower]}")
            except Exception as roleErr:
                logging.warning(f"Error fetching role {roleId} permissions: {roleErr}")
                continue
        
        print(f"[get_user_permissions] Final permissions for user_id={user_id}: {list(permsByModule.keys())}")
        if "security_controls" in permsByModule:
            print(f"[get_user_permissions] security_controls permissions: {permsByModule['security_controls']}")
        
        return {
            "data": {
                "user_roles": userRoles,
                "permissions": permsByModule
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_user_permissions", return_dict=True, user_id=user_id, tenant_id=tenant_id)


@app.post("/api/users/{user_id}/roles")
@require_permission("roles_update")
async def assign_role_to_user_endpoint(
    user_id: str,
    request: Request,
    Authorization: Optional[str] = Header(default=None)
):
    """Assign a role to a user."""
    endpoint = f"/api/users/{user_id}/roles"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        auth_data = auth_guard(Authorization)
        assigned_by = auth_data.get("user", {}).get("id") or auth_data.get("user", {}).get("user", {}).get("id")
        
        role_id = payload.get("role_id")
        tenant_id = payload.get("tenant_id")
        
        if not role_id or not tenant_id:
            raise HTTPException(status_code=400, detail="role_id and tenant_id are required")
        
        success = assign_role_to_user(user_id, role_id, tenant_id, assigned_by)
        if not success:
            raise HTTPException(status_code=400, detail="Failed to assign role")
        
        return {"data": {"success": True}, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "assign_role_to_user", return_dict=True, user_id=user_id, role_id=payload.get("role_id"))


@app.delete("/api/users/{user_id}/roles/{role_id}")
@require_permission("roles_update")
async def remove_role_from_user_endpoint(
    user_id: str,
    role_id: str,
    tenant_id: str = Query(...),
    Authorization: Optional[str] = Header(default=None)
):
    """Remove a role from a user."""
    endpoint = f"/api/users/{user_id}/roles/{role_id}"
    try:
        _ = auth_guard(Authorization)
        success, error_message = remove_role_from_user(user_id, role_id, tenant_id)
        if not success:
            raise HTTPException(status_code=400, detail=error_message or "Failed to remove role")
        
        return {"data": {"success": True}, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "remove_role_from_user", return_dict=True, user_id=user_id, role_id=role_id, tenant_id=tenant_id)


@app.get("/api/permissions/check")
async def check_permission_endpoint(
    module: str = Query(...),
    action: str = Query(...),
    tenant_id: str = Query(...),
    Authorization: Optional[str] = Header(default=None)
):
    """Check if current user has permission for an action on a module."""
    endpoint = "/api/permissions/check"
    try:
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        
        if not user_id:
            return {"data": {"has_permission": False}, "error": "User ID not found"}
        
        has_permission = check_permission(user_id, tenant_id, module, action)
        return {"data": {"has_permission": has_permission}, "error": None}
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "check_permission", return_dict=True, module=module, action=action, tenant_id=tenant_id)


# ============================
# 📋 TASKS MODULE ENDPOINTS
# ============================

@app.get("/api/tasks")
@require_permission("tasks_retrieve")
async def get_tasks(
    control_id: Optional[str] = Query(None),
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get all tasks, optionally filtered by control_id. Soft deleted items only visible to Super Admin."""
    endpoint = "/api/tasks"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        query = supabase.table("tasks").select("*").eq("tenant_id", tenant_id)
        if control_id:
            query = query.eq("control_id", control_id)
        
        # Filter out soft deleted items unless user is superadmin
        # Note: If is_deleted column doesn't exist yet, the query will return an error
        # We'll handle it gracefully by checking the error message
        if not is_admin:
            query = query.eq("is_deleted", False)
        
        resp = query.execute()
        if getattr(resp, "error", None):
            error_str = str(resp.error)
            # If error is about missing column, skip the filter (backward compatibility)
            if "is_deleted" in error_str.lower() and ("column" in error_str.lower() or "does not exist" in error_str.lower()):
                # Retry without the is_deleted filter
                query = supabase.table("tasks").select("*").eq("tenant_id", tenant_id)
                if control_id:
                    query = query.eq("control_id", control_id)
                resp = query.execute()
                if getattr(resp, "error", None):
                    error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                    raise HTTPException(status_code=400, detail=error_detail)
            else:
                error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                raise HTTPException(status_code=400, detail=error_detail)
        
        return {"data": resp.data or [], "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_tasks", return_dict=True, control_id=control_id, tenant_id=tenant_id)


@app.get("/api/tasks/control/{control_id}")
@require_permission("tasks_retrieve")
async def get_tasks_by_control(
    control_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get tasks for a specific control. Soft deleted items only visible to Super Admin."""
    endpoint = f"/api/tasks/control/{control_id}"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        query = supabase.table("tasks").select("*").eq("control_id", control_id).eq("tenant_id", tenant_id)
        
        # Filter out soft deleted items unless user is superadmin
        if not is_admin:
            query = query.eq("is_deleted", False)
        
        resp = query.execute()
        if getattr(resp, "error", None):
            error_str = str(resp.error)
            # If error is about missing column, skip the filter (backward compatibility)
            if "is_deleted" in error_str.lower() and ("column" in error_str.lower() or "does not exist" in error_str.lower()):
                # Retry without the is_deleted filter
                query = supabase.table("tasks").select("*").eq("control_id", control_id).eq("tenant_id", tenant_id)
                resp = query.execute()
                if getattr(resp, "error", None):
                    error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                    raise HTTPException(status_code=400, detail=error_detail)
            else:
                error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                raise HTTPException(status_code=400, detail=error_detail)
        
        return {"data": resp.data or [], "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_tasks_by_control", return_dict=True, control_id=control_id, tenant_id=tenant_id)


@app.get("/api/tasks/{task_id}")
@require_permission("tasks_retrieve")
async def get_task(
    task_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get a single task by ID. Soft deleted items only visible to Super Admin."""
    endpoint = f"/api/tasks/{task_id}"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        query = supabase.table("tasks").select("*").eq("id", task_id).eq("tenant_id", tenant_id)
        
        # Filter out soft deleted items unless user is superadmin
        if not is_admin:
            query = query.eq("is_deleted", False)
        
        resp = query.limit(1).execute()
        if getattr(resp, "error", None):
            error_str = str(resp.error)
            # If error is about missing column, skip the filter (backward compatibility)
            if "is_deleted" in error_str.lower() and ("column" in error_str.lower() or "does not exist" in error_str.lower()):
                # Retry without the is_deleted filter
                query = supabase.table("tasks").select("*").eq("id", task_id).eq("tenant_id", tenant_id)
                resp = query.limit(1).execute()
                if getattr(resp, "error", None):
                    error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                    raise HTTPException(status_code=400, detail=error_detail)
            else:
                error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                raise HTTPException(status_code=400, detail=error_detail)
        
        if not resp.data or len(resp.data) == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        
        return {"data": resp.data[0], "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_task", return_dict=True, task_id=task_id, tenant_id=tenant_id)


@app.post("/api/tasks")
@require_permission("tasks_create")
async def create_task(
    request: Request,
    Authorization: Optional[str] = Header(default=None)
):
    """Create a new task and update security control if control_id is provided."""
    endpoint = "/api/tasks"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        tenant_id = payload.get("tenant_id", "00000000-0000-0000-0000-000000000001")
        control_id = payload.get("control_id")
        control_uuid = payload.get("control_uuid")
        
        # Add tenant_id and timestamps
        payload["tenant_id"] = tenant_id
        # Generate UUID for task ID if not provided
        if "id" not in payload or not payload["id"]:
            payload["id"] = str(uuid.uuid4())
        if "created_at" not in payload:
            payload["created_at"] = datetime.now(timezone.utc).isoformat()
        if "updated_at" not in payload:
            payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        # Note: department column doesn't exist in tasks table, so we skip auto-populating it
        # if "assigned_to" in payload and payload.get("assigned_to"):
        #     assigned_to_email = payload.get("assigned_to")
        #     assigned_department = get_user_department_by_email(assigned_to_email)
        #     if assigned_department:
        #         payload["department"] = assigned_department
        
        # Ensure control_id is set if provided - this links the task to the security control
        if control_id:
            payload["control_id"] = control_id
        
        # Ensure control_uuid is set if provided - this links the task to the security control UUID
        # If control_uuid is not provided but control_id is, fetch UUID from security_controls
        # Note: control_uuid is stored as UUID type in the database (foreign key to security_controls.uuid)
        if control_uuid:
            payload["control_uuid"] = control_uuid
        elif control_id:
            # Fetch UUID from security_controls table
            try:
                control_resp = (
                    supabase
                    .table("security_controls")
                    .select("uuid")
                    .eq("id", control_id)
                    .limit(1)
                    .execute()
                )
                if control_resp.data and len(control_resp.data) > 0:
                    control_uuid_value = control_resp.data[0].get("uuid")
                    if control_uuid_value:
                        # Convert to string - Supabase/PostgreSQL will handle UUID type conversion
                        payload["control_uuid"] = str(control_uuid_value)
            except Exception as e:
                # Log error but don't fail task creation
                print(f"Warning: Failed to fetch UUID for control_id {control_id}: {e}")
        
        # Filter payload to only include valid task table columns that actually exist in the database
        # Based on actual database schema, not schema.sql which may have extra columns
        valid_task_columns = {
            "id", "control_id", "control_uuid", "task_name", "task_note",
            "task_priority", "task_type", "task_status", "attachment",
            "assigned_to", "created_at", "updated_at", "comments", "tenant_id"
        }
        # Remove any columns that don't exist: audit_id, control_stage, audit_owner, 
        # department, is_deleted, deleted_at, deleted_by
        filtered_payload = {k: v for k, v in payload.items() if k in valid_task_columns}
        
        # Debug: Log what we're trying to insert (remove in production)
        print(f"[DEBUG] Filtered payload keys: {list(filtered_payload.keys())}")
        print(f"[DEBUG] Original payload keys: {list(payload.keys())}")
        
        resp = supabase.table("tasks").insert(filtered_payload).execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        created_task = resp.data[0] if resp.data else None
        if not created_task:
            raise HTTPException(status_code=400, detail="Failed to create task")
        
        task_id = created_task.get("id")
        
        # If control_id is provided, update the security control's task field
        if control_id and task_id:
            try:
                # Get current security control
                control_resp = (
                    supabase
                    .table("security_controls")
                    .select("*")
                    .eq("id", control_id)
                    .limit(1)
                    .execute()
                )
                
                if control_resp.data and len(control_resp.data) > 0:
                    # Get existing tasks array from security control
                    raw_tasks = control_resp.data[0].get("task")
                    try:
                        existing_tasks = json.loads(raw_tasks) if isinstance(raw_tasks, str) else (raw_tasks or [])
                        if not isinstance(existing_tasks, list):
                            existing_tasks = []
                    except Exception:
                        existing_tasks = []
                    
                    # Add new task reference to the array
                    # Store task ID and basic info
                    task_ref = {
                        "id": task_id,
                        "task_name": created_task.get("task_name", ""),
                        "task_status": created_task.get("task_status", ""),
                        "created_at": created_task.get("created_at", ""),
                    }
                    
                    # Check if task ID already exists (avoid duplicates)
                    if not any(t.get("id") == task_id for t in existing_tasks if isinstance(t, dict)):
                        existing_tasks.append(task_ref)
                    
                    # Update security control with new task array
                    update_resp = (
                        supabase
                        .table("security_controls")
                        .update({"task": json.dumps(existing_tasks)})
                        .eq("id", control_id)
                        .execute()
                    )
                    
                    if getattr(update_resp, "error", None):
                        print(f"Warning: Failed to update security control task field: {update_resp.error}")
            except Exception as e:
                # Log error but don't fail the task creation
                print(f"Warning: Failed to update security control with task reference: {e}")
        
        return {"data": created_task, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "create_task", return_dict=True, tenant_id=payload.get("tenant_id"))


@app.put("/api/tasks/{task_id}")
@require_permission("tasks_update")
async def update_task(
    task_id: str,
    request: Request,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Update an existing task. Soft deleted tasks cannot be updated (except by Super Admin)."""
    endpoint = f"/api/tasks/{task_id}"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        # Use tenant_id from query param (for permission check) or from payload
        tenant_id = payload.get("tenant_id", tenant_id)
        
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        # Verify task exists and belongs to tenant
        existing = supabase.table("tasks").select("id, is_deleted").eq("id", task_id).eq("tenant_id", tenant_id).limit(1).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Prevent updating soft deleted tasks (unless superadmin)
        if existing.data[0].get("is_deleted") and not is_admin:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Update updated_at
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        # Don't allow changing tenant_id or id
        payload.pop("tenant_id", None)
        payload.pop("id", None)
        
        # Note: department column doesn't exist in tasks table, so we skip auto-populating it
        # if "assigned_to" in payload and payload.get("assigned_to"):
        #     assigned_to_email = payload.get("assigned_to")
        #     assigned_department = get_user_department_by_email(assigned_to_email)
        #     if assigned_department:
        #         payload["department"] = assigned_department
        
        # Filter payload to only include valid task table columns that actually exist in the database
        # Based on actual database schema, not schema.sql which may have extra columns
        valid_task_columns = {
            "id", "control_id", "control_uuid", "task_name", "task_note",
            "task_priority", "task_type", "task_status", "attachment",
            "assigned_to", "created_at", "updated_at", "comments", "tenant_id"
        }
        # Remove any columns that don't exist: audit_id, control_stage, audit_owner, 
        # is_deleted, deleted_at, deleted_by
        filtered_payload = {k: v for k, v in payload.items() if k in valid_task_columns}
        
        resp = supabase.table("tasks").eq("id", task_id).eq("tenant_id", tenant_id).update(filtered_payload).execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        return {"data": resp.data[0] if resp.data else None, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "update_task", return_dict=True, task_id=task_id, tenant_id=payload.get("tenant_id"))


@app.delete("/api/tasks/{task_id}")
@require_permission("tasks_delete")
async def delete_task(
    task_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Soft delete a task (sets is_deleted=True). Only Super Admin can see soft deleted items."""
    endpoint = f"/api/tasks/{task_id}"
    try:
        # Get user info
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        
        # Verify task exists and belongs to tenant (including soft deleted)
        existing = supabase.table("tasks").select("id, is_deleted").eq("id", task_id).eq("tenant_id", tenant_id).limit(1).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Check if already soft deleted
        if existing.data[0].get("is_deleted"):
            raise HTTPException(status_code=400, detail="Task is already deleted")
        
        # Soft delete: set is_deleted=True, deleted_at=now, deleted_by=user_id
        from datetime import datetime, timezone
        update_data = {
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": user_id,
        }
        
        resp = supabase.table("tasks").eq("id", task_id).eq("tenant_id", tenant_id).update(update_data).execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        return {"data": {"success": True, "message": "Task deleted successfully"}, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "delete_task", return_dict=True, task_id=task_id, tenant_id=tenant_id)


@app.post("/api/tasks/{task_id}/comments")
@require_permission("tasks_comment")
async def add_task_comment(
    task_id: str,
    request: Request,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Add a comment to a task."""
    endpoint = f"/api/tasks/{task_id}/comments"
    try:
        _ = auth_guard(Authorization)
        payload = await request.json()
        
        # Expect a single comment object: { text, time, author }
        new_comment = payload.get("comment")
        if not new_comment or not isinstance(new_comment, dict):
            raise HTTPException(status_code=400, detail="Missing or invalid 'comment' in payload")

        # Load existing task
        resp = (
            supabase
            .table("tasks")
            .select("*")
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Task not found")
        row = rows[0]

        # Parse existing comments
        raw = row.get("comments")
        try:
            existing = json.loads(raw) if isinstance(raw, str) and raw.strip() else (raw if isinstance(raw, list) else [])
            if not isinstance(existing, list):
                existing = []
        except Exception:
            existing = []

        # Add new comment
        existing.append(new_comment)

        # Update task with new comments and updated_at timestamp
        update_payload = {
            "comments": json.dumps(existing),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        update_resp = (
            supabase
            .table("tasks")
            .update(update_payload)
            .eq("id", task_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if getattr(update_resp, "error", None):
            raise HTTPException(status_code=400, detail=str(update_resp.error))
        return {"data": update_resp.data or [], "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "add_task_comment", return_dict=True, task_id=task_id, tenant_id=tenant_id)


# ============================
# 🔍 AUDITS MODULE ENDPOINTS
# ============================

@app.get("/api/audits")
@require_permission("audits_retrieve")
async def get_audits(
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get all audits. Soft deleted items only visible to Super Admin."""
    endpoint = "/api/audits"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        query = supabase.table("audits").select("*").eq("tenant_id", tenant_id)
        
        # Filter out soft deleted items unless user is superadmin
        if not is_admin:
            query = query.eq("is_deleted", False)
        
        resp = query.execute()
        if getattr(resp, "error", None):
            error_str = str(resp.error)
            # If error is about missing table, return empty array (table doesn't exist yet)
            if "does not exist" in error_str.lower() and "relation" in error_str.lower():
                return {"data": [], "error": None}
            # If error is about missing column, skip the filter (backward compatibility)
            if "is_deleted" in error_str.lower() and ("column" in error_str.lower() or "does not exist" in error_str.lower()):
                # Retry without the is_deleted filter
                query = supabase.table("audits").select("*").eq("tenant_id", tenant_id)
                resp = query.execute()
                if getattr(resp, "error", None):
                    error_str_retry = str(resp.error)
                    # If still about missing table, return empty array
                    if "does not exist" in error_str_retry.lower() and "relation" in error_str_retry.lower():
                        return {"data": [], "error": None}
                    error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                    raise HTTPException(status_code=400, detail=error_detail)
            else:
                error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                raise HTTPException(status_code=400, detail=error_detail)
        
        return {"data": resp.data or [], "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_audits", return_dict=True, tenant_id=tenant_id)


@app.get("/api/audits/{audit_id}")
@require_permission("audits_retrieve")
async def get_audit(
    audit_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get a single audit by ID. Soft deleted items only visible to Super Admin."""
    endpoint = f"/api/audits/{audit_id}"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        query = supabase.table("audits").select("*").eq("id", audit_id).eq("tenant_id", tenant_id)
        
        # Filter out soft deleted items unless user is superadmin
        if not is_admin:
            query = query.eq("is_deleted", False)
        
        resp = query.limit(1).execute()
        if getattr(resp, "error", None):
            error_str = str(resp.error)
            # If error is about missing column, skip the filter (backward compatibility)
            if "is_deleted" in error_str.lower() and ("column" in error_str.lower() or "does not exist" in error_str.lower()):
                # Retry without the is_deleted filter
                query = supabase.table("audits").select("*").eq("id", audit_id).eq("tenant_id", tenant_id)
                resp = query.limit(1).execute()
                if getattr(resp, "error", None):
                    error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                    raise HTTPException(status_code=400, detail=error_detail)
            else:
                error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                raise HTTPException(status_code=400, detail=error_detail)
        
        if not resp.data or len(resp.data) == 0:
            raise HTTPException(status_code=404, detail="Audit not found")
        
        return {"data": resp.data[0], "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_audit", return_dict=True, audit_id=audit_id, tenant_id=tenant_id)


@app.post("/api/audits")
@require_permission("audits_create")
async def create_audit(
    request: Request,
    Authorization: Optional[str] = Header(default=None)
):
    """Create a new audit."""
    endpoint = "/api/audits"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        tenant_id = payload.get("tenant_id", "00000000-0000-0000-0000-000000000001")
        
        # Add tenant_id and timestamps
        payload["tenant_id"] = tenant_id
        # Generate UUID for audit ID if not provided
        if "id" not in payload or not payload["id"]:
            payload["id"] = str(uuid.uuid4())
        if "created_at" not in payload:
            payload["created_at"] = datetime.now(timezone.utc).isoformat()
        if "updated_at" not in payload:
            payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        # Ensure is_deleted is False for new audits
        payload["is_deleted"] = False
        
        resp = supabase.table("audits").insert(payload).execute()
        if getattr(resp, "error", None):
            error_str = str(resp.error)
            # Check if the error is about the table not existing
            if "does not exist" in error_str.lower() or "relation" in error_str.lower():
                raise HTTPException(
                    status_code=503,
                    detail="The audits table does not exist in the database. Please run the database migration to create the audits table."
                )
            raise HTTPException(status_code=400, detail=error_str)
        
        created_audit = resp.data[0] if resp.data else None
        if not created_audit:
            raise HTTPException(status_code=400, detail="Failed to create audit")
        
        return {"data": created_audit, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "create_audit", return_dict=True, tenant_id=payload.get("tenant_id"))


@app.put("/api/audits/{audit_id}")
@require_permission("audits_update")
async def update_audit(
    audit_id: str,
    request: Request,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Update an existing audit. Soft deleted audits cannot be updated (except by Super Admin)."""
    endpoint = f"/api/audits/{audit_id}"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        # Use tenant_id from query param (for permission check) or from payload
        tenant_id = payload.get("tenant_id", tenant_id)
        
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        # Verify audit exists and belongs to tenant
        existing = supabase.table("audits").select("id, is_deleted").eq("id", audit_id).eq("tenant_id", tenant_id).limit(1).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Audit not found")
        
        # Prevent updating soft deleted audits (unless superadmin)
        if existing.data[0].get("is_deleted") and not is_admin:
            raise HTTPException(status_code=404, detail="Audit not found")
        
        # Update updated_at
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        # Don't allow changing tenant_id or id
        payload.pop("tenant_id", None)
        payload.pop("id", None)
        
        resp = supabase.table("audits").eq("id", audit_id).eq("tenant_id", tenant_id).update(payload).execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        return {"data": resp.data[0] if resp.data else None, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "update_audit", return_dict=True, audit_id=audit_id, tenant_id=payload.get("tenant_id"))


@app.delete("/api/audits/{audit_id}")
@require_permission("audits_delete")
async def delete_audit(
    audit_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Soft delete an audit (sets is_deleted=True). Only Super Admin can see soft deleted items."""
    endpoint = f"/api/audits/{audit_id}"
    try:
        # Get user info
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        
        # Verify audit exists and belongs to tenant (including soft deleted)
        existing = supabase.table("audits").select("id, is_deleted").eq("id", audit_id).eq("tenant_id", tenant_id).limit(1).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Audit not found")
        
        # Check if already soft deleted
        if existing.data[0].get("is_deleted"):
            raise HTTPException(status_code=400, detail="Audit is already deleted")
        
        # Soft delete: set is_deleted=True, deleted_at=now, deleted_by=user_id
        from datetime import datetime, timezone
        update_data = {
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": user_id,
        }
        
        resp = supabase.table("audits").eq("id", audit_id).eq("tenant_id", tenant_id).update(update_data).execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        return {"data": {"success": True, "message": "Audit deleted successfully"}, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "delete_audit", return_dict=True, audit_id=audit_id, tenant_id=tenant_id)


@app.post("/api/audits/{audit_id}/comments")
@require_permission("audits_comment")
async def add_audit_comment(
    audit_id: str,
    request: Request,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Add a comment to an audit."""
    endpoint = f"/api/audits/{audit_id}/comments"
    try:
        _ = auth_guard(Authorization)
        payload = await request.json()
        
        # Expect a single comment object: { text, time, author }
        new_comment = payload.get("comment")
        if not new_comment or not isinstance(new_comment, dict):
            raise HTTPException(status_code=400, detail="Missing or invalid 'comment' in payload")

        # Load existing audit
        resp = (
            supabase
            .table("audits")
            .select("*")
            .eq("id", audit_id)
            .eq("tenant_id", tenant_id)
            .limit(1)
            .execute()
        )
        rows = resp.data or []
        if not rows:
            raise HTTPException(status_code=404, detail="Audit not found")
        row = rows[0]

        # Parse existing comments
        raw = row.get("comments")
        try:
            existing = json.loads(raw) if isinstance(raw, str) and raw.strip() else (raw if isinstance(raw, list) else [])
            if not isinstance(existing, list):
                existing = []
        except Exception:
            existing = []

        # Add new comment
        existing.append(new_comment)

        # Update audit with new comments and updated_at timestamp
        update_payload = {
            "comments": json.dumps(existing),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        update_resp = (
            supabase
            .table("audits")
            .update(update_payload)
            .eq("id", audit_id)
            .eq("tenant_id", tenant_id)
            .execute()
        )
        if getattr(update_resp, "error", None):
            raise HTTPException(status_code=400, detail=str(update_resp.error))
        return {"data": update_resp.data or [], "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "add_audit_comment", return_dict=True, audit_id=audit_id, tenant_id=tenant_id)


# ============================
# 🎯 ACTIONS MODULE ENDPOINTS
# ============================
@app.get("/api/actions")
@require_permission("actions_retrieve")
async def get_actions(
    control_id: Optional[str] = Query(None),
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get all actions, optionally filtered by control_id. Soft deleted items only visible to Super Admin."""
    endpoint = "/api/actions"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        query = supabase.table("actions").select("*").eq("tenant_id", tenant_id)
        if control_id:
            query = query.eq("control_id", control_id)
        
        # Filter out soft deleted items unless user is superadmin
        if not is_admin:
            query = query.eq("is_deleted", False)
        
        resp = query.execute()
        if getattr(resp, "error", None):
            error_str = str(resp.error)
            # If error is about missing column, skip the filter (backward compatibility)
            if "is_deleted" in error_str.lower() and ("column" in error_str.lower() or "does not exist" in error_str.lower()):
                # Retry without is_deleted filter
                query = supabase.table("actions").select("*").eq("tenant_id", tenant_id)
                if control_id:
                    query = query.eq("control_id", control_id)
                resp = query.execute()
            else:
                raise HTTPException(status_code=400, detail=str(resp.error))
        
        actions = resp.data or []
        formatted = [normalize_action(row) for row in actions]
        return {"status": "success", "data": formatted}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_actions", return_dict=True, control_id=control_id, tenant_id=tenant_id)


@app.get("/api/actions/{action_id}")
@require_permission("actions_retrieve")
async def get_action(
    action_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get a single action by ID. Soft deleted items only visible to Super Admin."""
    endpoint = f"/api/actions/{action_id}"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        query = supabase.table("actions").select("*").eq("id", action_id).eq("tenant_id", tenant_id)
        
        # Filter out soft deleted items unless user is superadmin
        if not is_admin:
            query = query.eq("is_deleted", False)
        
        resp = query.execute()
        if getattr(resp, "error", None):
            error_str = str(resp.error)
            # If error is about missing column, skip the filter (backward compatibility)
            if "is_deleted" in error_str.lower() and ("column" in error_str.lower() or "does not exist" in error_str.lower()):
                query = supabase.table("actions").select("*").eq("id", action_id).eq("tenant_id", tenant_id)
                resp = query.execute()
            else:
                raise HTTPException(status_code=400, detail=str(resp.error))
        
        if not resp.data or len(resp.data) == 0:
            raise HTTPException(status_code=404, detail="Action not found")
        
        action = normalize_action(resp.data[0])
        return {"status": "success", "data": action}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_action", return_dict=True, action_id=action_id, tenant_id=tenant_id)


@app.post("/api/actions")
@require_permission("actions_create")
async def create_action(
    request: Request,
    Authorization: Optional[str] = Header(default=None)
):
    """Create a new action."""
    endpoint = "/api/actions"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        tenant_id = payload.get("tenant_id", "00000000-0000-0000-0000-000000000001")
        
        # Add tenant_id and timestamps
        payload["tenant_id"] = tenant_id
        # Generate UUID for action ID if not provided
        if "id" not in payload or not payload["id"]:
            payload["id"] = str(uuid.uuid4())
        if "created_at" not in payload:
            payload["created_at"] = datetime.now(timezone.utc).isoformat()
        if "updated_at" not in payload:
            payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        # Ensure is_deleted is False for new actions
        payload["is_deleted"] = False
        
        # Ensure required fields
        if not payload.get("action_name"):
            raise HTTPException(status_code=400, detail="action_name is required")
        
        resp = supabase.table("actions").insert(payload).execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        created_action = resp.data[0] if resp.data else None
        if not created_action:
            raise HTTPException(status_code=400, detail="Failed to create action")
        
        action = normalize_action(created_action)
        return {"status": "success", "data": action}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "create_action", return_dict=True, tenant_id=payload.get("tenant_id"))


@app.put("/api/actions/{action_id}")
@require_permission("actions_update")
async def update_action(
    action_id: str,
    request: Request,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Update an existing action. Soft deleted actions cannot be updated (except by Super Admin)."""
    endpoint = f"/api/actions/{action_id}"
    payload: Dict[str, Any] = {}
    try:
        payload = await request.json()
        # Use tenant_id from query param (for permission check) or from payload
        tenant_id = payload.get("tenant_id", tenant_id)
        
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        # Verify action exists and belongs to tenant
        existing = supabase.table("actions").select("id, is_deleted").eq("id", action_id).eq("tenant_id", tenant_id).limit(1).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Action not found")
        
        # Prevent updating soft deleted actions (unless superadmin)
        if existing.data[0].get("is_deleted") and not is_admin:
            raise HTTPException(status_code=404, detail="Action not found")
        
        # Update updated_at
        payload["updated_at"] = datetime.now(timezone.utc).isoformat()
        # Don't allow changing tenant_id or id
        payload.pop("tenant_id", None)
        payload.pop("id", None)
        
        resp = supabase.table("actions").eq("id", action_id).eq("tenant_id", tenant_id).update(payload).execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        action = normalize_action(resp.data[0]) if resp.data else None
        return {"status": "success", "data": action}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "update_action", return_dict=True, action_id=action_id, tenant_id=payload.get("tenant_id"))


@app.delete("/api/actions/{action_id}")
@require_permission("actions_delete")
async def delete_action(
    action_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Soft delete an action (sets is_deleted=True). Only Super Admin can see soft deleted items."""
    endpoint = f"/api/actions/{action_id}"
    try:
        # Get user info
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        
        # Verify action exists and belongs to tenant (including soft deleted)
        existing = supabase.table("actions").select("id, is_deleted").eq("id", action_id).eq("tenant_id", tenant_id).limit(1).execute()
        if not existing.data or len(existing.data) == 0:
            raise HTTPException(status_code=404, detail="Action not found")
        
        # Check if already soft deleted
        if existing.data[0].get("is_deleted"):
            raise HTTPException(status_code=400, detail="Action is already deleted")
        
        # Soft delete: set is_deleted=True, deleted_at=now, deleted_by=user_id
        update_data = {
            "is_deleted": True,
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_by": user_id,
        }
        
        resp = supabase.table("actions").eq("id", action_id).eq("tenant_id", tenant_id).update(update_data).execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        return {"status": "success", "data": {"success": True, "message": "Action deleted successfully"}}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "delete_action", return_dict=True, action_id=action_id, tenant_id=tenant_id)


# ============================
# 🏆 CERTIFICATIONS MODULE ENDPOINTS
# ============================
@app.get("/api/certifications")
@require_permission("certifications_retrieve")
async def get_certifications(
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get all unique certifications from security_controls table. Soft deleted items only visible to Super Admin."""
    endpoint = "/api/certifications"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = auth_data.get("user_id") or user.get("user_id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        # Get unique certification values from security_controls
        query = (
            supabase.table("security_controls")
            .select("certification")
            .eq("tenant_id", tenant_id)
        )
        
        # Try to filter out soft deleted items unless user is superadmin
        resp = None
        if not is_admin:
            try:
                query_with_filter = query.eq("is_deleted", False)
                resp = query_with_filter.execute()
                if getattr(resp, "error", None):
                    error_str = str(resp.error).lower()
                    error_dict = resp.error if isinstance(resp.error, dict) else {}
                    error_type = error_dict.get("type", "").lower() if isinstance(error_dict, dict) else ""
                    
                    is_deleted_error = (
                        "is_deleted" in error_str and (
                            "column" in error_str or 
                            "does not exist" in error_str or 
                            "undefinedcolumn" in error_str or
                            error_type == "undefinedcolumn"
                        )
                    )
                    
                    if is_deleted_error:
                        resp = None
                    else:
                        error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                        raise HTTPException(status_code=400, detail=error_detail)
            except HTTPException:
                raise
            except Exception as e:
                error_str = str(e).lower()
                is_deleted_error = (
                    "is_deleted" in error_str and (
                        "column" in error_str or 
                        "does not exist" in error_str or 
                        "undefinedcolumn" in error_str or
                        "undefined column" in error_str
                    )
                )
                if is_deleted_error:
                    resp = None
                else:
                    raise
        
        # Execute query without is_deleted filter if previous attempt failed or wasn't tried
        if resp is None:
            query = (
                supabase.table("security_controls")
                .select("certification")
                .eq("tenant_id", tenant_id)
            )
            resp = query.execute()
            if getattr(resp, "error", None):
                error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                raise HTTPException(status_code=400, detail=error_detail)
        
        # Extract unique certification values
        certifications = set()
        if resp.data:
            for row in resp.data:
                cert_value = row.get("certification")
                if cert_value and str(cert_value).strip():
                    certifications.add(str(cert_value).strip())
        
        # Return as sorted list
        return {"data": sorted(list(certifications)), "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_certifications", return_dict=True, tenant_id=tenant_id)


@app.get("/api/certifications/from-controls")
@require_permission("security_controls_retrieve")
async def get_certifications_from_controls(
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get unique certification values from security_controls table.
    
    This endpoint returns all unique certification values that exist in security_controls,
    which may include certifications (like CADP) that don't exist in the certifications table.
    """
    endpoint = "/api/certifications/from-controls"
    try:
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = auth_data.get("user_id") or user.get("user_id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        # Get unique certification values from security_controls
        # Note: security_controls table may not have is_deleted column, so we handle that gracefully
        query = (
            supabase.table("security_controls")
            .select("certification")
            .eq("tenant_id", tenant_id)
        )
        
        # Try to filter out soft deleted items unless user is superadmin
        # If is_deleted column doesn't exist, we'll catch the error and retry without the filter
        resp = None
        if not is_admin:
            try:
                query_with_filter = query.eq("is_deleted", False)
                resp = query_with_filter.execute()
                # Check if error is about missing is_deleted column
                if getattr(resp, "error", None):
                    error_str = str(resp.error).lower()
                    error_dict = resp.error if isinstance(resp.error, dict) else {}
                    error_type = error_dict.get("type", "").lower() if isinstance(error_dict, dict) else ""
                    
                    # Check if error is about missing is_deleted column (backward compatibility)
                    is_deleted_error = (
                        "is_deleted" in error_str and (
                            "column" in error_str or 
                            "does not exist" in error_str or 
                            "undefinedcolumn" in error_str or
                            error_type == "undefinedcolumn"
                        )
                    )
                    
                    if is_deleted_error:
                        # Column doesn't exist, retry without filter
                        resp = None
                    else:
                        error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                        raise HTTPException(status_code=400, detail=error_detail)
            except HTTPException:
                raise
            except Exception as e:
                # Catch database exceptions about missing columns
                error_str = str(e).lower()
                error_message = str(e)
                
                # Check if this is a database error about missing is_deleted column
                is_deleted_error = (
                    "is_deleted" in error_str and (
                        "column" in error_str or 
                        "does not exist" in error_str or 
                        "undefinedcolumn" in error_str or
                        "undefined column" in error_str
                    )
                )
                
                if is_deleted_error:
                    # Column doesn't exist, we'll retry without filter below
                    resp = None
                    print(f"[get_certifications_from_controls] is_deleted column not found, querying without filter")
                else:
                    # Re-raise if it's a different error
                    raise
        
        # Execute query without is_deleted filter if previous attempt failed or wasn't tried
        if resp is None:
            # Rebuild query without is_deleted filter
            query = (
                supabase.table("security_controls")
                .select("certification")
                .eq("tenant_id", tenant_id)
            )
            resp = query.execute()
            if getattr(resp, "error", None):
                error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                raise HTTPException(status_code=400, detail=error_detail)
        
        # Extract unique certification values
        certifications = set()
        if resp.data:
            for row in resp.data:
                cert_value = row.get("certification")
                if cert_value and str(cert_value).strip():
                    certifications.add(str(cert_value).strip())
        
        # Return as sorted list
        return {"data": sorted(list(certifications)), "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_certifications_from_controls", return_dict=True, tenant_id=tenant_id)


@app.get("/api/certifications/dropdowns")
async def get_certification_dropdowns():
    """Get all dropdown options for certifications."""
    try:
        from services.certification_validator import get_dropdown_values
        return {"data": get_dropdown_values(), "error": None}
    except Exception as e:
        return {"data": {}, "error": str(e)}


@app.get("/api/certifications/dropdowns/{field_name}")
async def get_certification_field_options(field_name: str):
    """Get dropdown options for a specific certification field."""
    try:
        from services.certification_validator import get_field_options
        options = get_field_options(field_name)
        return {"data": options, "error": None}
    except Exception as e:
        return {"data": [], "error": str(e)}


@app.get("/api/certifications/{certification_name}")
@require_permission("certifications_retrieve")
async def get_certification(
    certification_name: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get security controls for a specific certification name from security_controls table. Soft deleted items only visible to Super Admin."""
    endpoint = f"/api/certifications/{certification_name}"
    try:
        # Get user info to check if superadmin
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = auth_data.get("user_id") or user.get("user_id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        # Query security_controls table filtering by certification column
        query = (
            supabase.table("security_controls")
            .select("*")
            .eq("tenant_id", tenant_id)
            .ilike("certification", certification_name.strip())
        )
        
        # Try to filter out soft deleted items unless user is superadmin
        resp = None
        if not is_admin:
            try:
                query_with_filter = query.eq("is_deleted", False)
                resp = query_with_filter.execute()
                if getattr(resp, "error", None):
                    error_str = str(resp.error).lower()
                    error_dict = resp.error if isinstance(resp.error, dict) else {}
                    error_type = error_dict.get("type", "").lower() if isinstance(error_dict, dict) else ""
                    
                    is_deleted_error = (
                        "is_deleted" in error_str and (
                            "column" in error_str or 
                            "does not exist" in error_str or 
                            "undefinedcolumn" in error_str or
                            error_type == "undefinedcolumn"
                        )
                    )
                    
                    if is_deleted_error:
                        resp = None
                    else:
                        error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                        raise HTTPException(status_code=400, detail=error_detail)
            except HTTPException:
                raise
            except Exception as e:
                error_str = str(e).lower()
                is_deleted_error = (
                    "is_deleted" in error_str and (
                        "column" in error_str or 
                        "does not exist" in error_str or 
                        "undefinedcolumn" in error_str or
                        "undefined column" in error_str
                    )
                )
                if is_deleted_error:
                    resp = None
                else:
                    raise
        
        # Execute query without is_deleted filter if previous attempt failed or wasn't tried
        if resp is None:
            query = (
                supabase.table("security_controls")
                .select("*")
                .eq("tenant_id", tenant_id)
                .ilike("certification", certification_name.strip())
            )
            resp = query.execute()
            if getattr(resp, "error", None):
                error_detail = str(resp.error) if isinstance(resp.error, (str, dict)) else repr(resp.error)
                raise HTTPException(status_code=400, detail=error_detail)
        
        if not resp.data or len(resp.data) == 0:
            raise HTTPException(status_code=404, detail=f"No security controls found for certification: {certification_name}")
        
        return {"data": resp.data, "error": None}
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_certification", return_dict=True, certification_id=certification_name, tenant_id=tenant_id)


@app.post("/api/certifications")
@require_permission("certifications_create")
async def create_certification(
    request: Request,
    Authorization: Optional[str] = Header(default=None)
):
    """Create certification - Not implemented. Certifications are stored in security_controls table."""
    endpoint = "/api/certifications"
    raise HTTPException(
        status_code=501, 
        detail="Create operation not supported. Certifications are read-only values from security_controls table."
    )


@app.put("/api/certifications/{certification_id}")
@require_permission("certifications_update")
async def update_certification(
    certification_id: str,
    request: Request,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Update certification - Not implemented. Certifications are stored in security_controls table."""
    endpoint = f"/api/certifications/{certification_id}"
    raise HTTPException(
        status_code=501, 
        detail="Update operation not supported. Certifications are read-only values from security_controls table."
    )


@app.delete("/api/certifications/{certification_id}")
@require_permission("certifications_delete")
async def delete_certification(
    certification_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Delete certification - Not implemented. Certifications are stored in security_controls table."""
    endpoint = f"/api/certifications/{certification_id}"
    raise HTTPException(
        status_code=501, 
        detail="Delete operation not supported. Certifications are read-only values from security_controls table."
    )
async def get_certification_field_options(field_name: str):
    """Get dropdown options for a specific field."""
    try:
        from services.certification_validator import get_field_options
        options = get_field_options(field_name)
        return {"data": options, "error": None}
    except Exception as e:
        return {"data": [], "error": str(e)}


# ============================
# 📊 DASHBOARD ENDPOINTS
# ============================

@app.get("/api/dashboard/tasks/metrics")
@require_permission("dashboard_retrieve")
async def get_task_metrics(
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get task metrics: counts by status, priority, and type."""
    endpoint = "/api/dashboard/tasks/metrics"
    try:
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        query = supabase.table("tasks").select("*").eq("tenant_id", tenant_id)
        if not is_admin:
            query = query.eq("is_deleted", False)
        
        resp = query.execute()
        if getattr(resp, "error", None):
            error_str = str(resp.error)
            if "is_deleted" in error_str.lower() and ("column" in error_str.lower() or "does not exist" in error_str.lower()):
                query = supabase.table("tasks").select("*").eq("tenant_id", tenant_id)
                resp = query.execute()
                if getattr(resp, "error", None):
                    raise HTTPException(status_code=400, detail=str(resp.error))
            else:
                raise HTTPException(status_code=400, detail=str(resp.error))
        
        tasks = resp.data or []
        
        # Calculate metrics
        total_tasks = len(tasks)
        
        # Tasks vs Assignees with Ageing
        tasks_vs_assignees_ageing = {}  # {assignee: {age_bucket: count}}
        
        # Tasks vs Assignee vs Priority matrix
        tasks_vs_assignee_vs_priority = {}  # {assignee: {priority: count}}
        
        # Task Priority vs Ageing vs Assignee (3D matrix)
        priority_vs_ageing_vs_assignee = {}  # {priority: {age_bucket: {assignee: count}}}
        
        for task in tasks:
            assignee = task.get("assigned_to") or "Unassigned"
            priority = task.get("task_priority") or "Unknown"
            
            # Calculate ageing
            created_at_str = task.get("created_at") or task.get("updated_at")
            age_days = None
            age_bucket = "Unknown"
            
            if created_at_str:
                try:
                    from datetime import datetime, timezone
                    if isinstance(created_at_str, str):
                        try:
                            created_date = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                        except:
                            try:
                                created_date = datetime.strptime(created_at_str.split('T')[0], '%Y-%m-%d')
                            except:
                                created_date = datetime.strptime(created_at_str, '%Y-%m-%d %H:%M:%S')
                    else:
                        created_date = created_at_str
                    
                    if created_date.tzinfo is None:
                        created_date = created_date.replace(tzinfo=timezone.utc)
                    
                    age_days = (datetime.now(timezone.utc) - created_date).days
                    
                    # Age buckets
                    if age_days < 30:
                        age_bucket = "0-30 days"
                    elif age_days < 90:
                        age_bucket = "31-90 days"
                    elif age_days < 180:
                        age_bucket = "91-180 days"
                    elif age_days < 365:
                        age_bucket = "181-365 days"
                    else:
                        age_bucket = "365+ days"
                except Exception:
                    age_bucket = "Unknown"
            
            # Tasks vs Assignees with Ageing
            if assignee not in tasks_vs_assignees_ageing:
                tasks_vs_assignees_ageing[assignee] = {}
            tasks_vs_assignees_ageing[assignee][age_bucket] = tasks_vs_assignees_ageing[assignee].get(age_bucket, 0) + 1
            
            # Tasks vs Assignee vs Priority
            if assignee not in tasks_vs_assignee_vs_priority:
                tasks_vs_assignee_vs_priority[assignee] = {}
            tasks_vs_assignee_vs_priority[assignee][priority] = tasks_vs_assignee_vs_priority[assignee].get(priority, 0) + 1
            
            # Priority vs Ageing vs Assignee
            if priority not in priority_vs_ageing_vs_assignee:
                priority_vs_ageing_vs_assignee[priority] = {}
            if age_bucket not in priority_vs_ageing_vs_assignee[priority]:
                priority_vs_ageing_vs_assignee[priority][age_bucket] = {}
            priority_vs_ageing_vs_assignee[priority][age_bucket][assignee] = priority_vs_ageing_vs_assignee[priority][age_bucket].get(assignee, 0) + 1
        
        # Format Tasks vs Assignees with Ageing
        formatted_tasks_vs_assignees_ageing = []
        for assignee, age_buckets in tasks_vs_assignees_ageing.items():
            for age_bucket, count in age_buckets.items():
                formatted_tasks_vs_assignees_ageing.append({
                    "assignee": assignee,
                    "age_bucket": age_bucket,
                    "count": count
                })
        
        # Format Tasks vs Assignee vs Priority
        formatted_tasks_vs_assignee_vs_priority = []
        for assignee, priorities in tasks_vs_assignee_vs_priority.items():
            for priority, count in priorities.items():
                formatted_tasks_vs_assignee_vs_priority.append({
                    "assignee": assignee,
                    "priority": priority,
                    "count": count
                })
        
        # Format Priority vs Ageing vs Assignee
        formatted_priority_vs_ageing_vs_assignee = []
        for priority, age_buckets in priority_vs_ageing_vs_assignee.items():
            for age_bucket, assignees in age_buckets.items():
                for assignee, count in assignees.items():
                    formatted_priority_vs_ageing_vs_assignee.append({
                        "priority": priority,
                        "age_bucket": age_bucket,
                        "assignee": assignee,
                        "count": count
                    })
        
        return {
            "data": {
                "total": total_tasks,
                "tasks_vs_assignees_ageing": formatted_tasks_vs_assignees_ageing,
                "tasks_vs_assignee_vs_priority": formatted_tasks_vs_assignee_vs_priority,
                "priority_vs_ageing_vs_assignee": formatted_priority_vs_ageing_vs_assignee
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_task_metrics", return_dict=True, tenant_id=tenant_id)


@app.get("/api/dashboard/controls/metrics")
@require_permission("dashboard_retrieve")
async def get_controls_metrics(
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get aggregated controls metrics (collective, not grouped by certification)."""
    endpoint = "/api/dashboard/controls/metrics"
    try:
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        # Query security_controls - don't filter by is_deleted in SQL since column may not exist
        query = supabase.table("security_controls").select("*").eq("tenant_id", tenant_id)
        
        resp = query.execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        controls = resp.data or []
        
        # Filter out soft-deleted items in Python (if is_deleted column exists)
        # This handles cases where the column doesn't exist yet
        if not is_admin:
            filtered_controls = []
            for control in controls:
                # If is_deleted column exists and is True, skip it
                # If column doesn't exist (None), include the control
                is_deleted = control.get("is_deleted")
                if is_deleted is not True:
                    filtered_controls.append(control)
            controls = filtered_controls
        
        # Aggregate metrics collectively (not by certification)
        total_controls = len(controls)
        
        # Status vs Assignee matrix
        status_vs_assignee = {}  # {status: {assignee: count}}
        # Status vs Domain matrix
        status_vs_domain = {}  # {status: {domain: count}}
        # Department + Dept Owner vs Status matrix
        dept_deptowner_vs_status = {}  # {(department, dept_owner): {status: count}}
        
        # Aggregate all controls collectively
        for control in controls:
            control_status = control.get("Status") or "Unknown"
            control_domain = control.get("control_domain") or "Unknown"
            control_owner = control.get("owner") or "Unassigned"
            
            # Get department and department_owner from control or from owner's user record
            control_department = control.get("department")
            control_dept_owner = None
            
            # If department is not set on control, try to get it from owner's user record
            if not control_department and control_owner and control_owner != "Unassigned":
                dept_info = get_user_department_info_by_email(control_owner)
                if not control_department:
                    control_department = dept_info.get("department")
                control_dept_owner = dept_info.get("department_owner")
            
            # Use "Unknown" if department is still not set
            control_department = control_department or "Unknown"
            control_dept_owner = control_dept_owner or "Unknown"
            
            # Status vs Assignee matrix
            if control_status not in status_vs_assignee:
                status_vs_assignee[control_status] = {}
            status_vs_assignee[control_status][control_owner] = status_vs_assignee[control_status].get(control_owner, 0) + 1
            
            # Status vs Domain matrix
            if control_status not in status_vs_domain:
                status_vs_domain[control_status] = {}
            status_vs_domain[control_status][control_domain] = status_vs_domain[control_status].get(control_domain, 0) + 1
            
            # Department + Dept Owner vs Status matrix
            dept_key = (control_department, control_dept_owner)
            if dept_key not in dept_deptowner_vs_status:
                dept_deptowner_vs_status[dept_key] = {}
            dept_deptowner_vs_status[dept_key][control_status] = dept_deptowner_vs_status[dept_key].get(control_status, 0) + 1
        
        # Format Status vs Assignee matrix
        formatted_status_vs_assignee = []
        for status, assignees in status_vs_assignee.items():
            for assignee, count in assignees.items():
                formatted_status_vs_assignee.append({
                    "status": status,
                    "assignee": assignee,
                    "count": count
                })
        
        # Format Status vs Domain matrix
        formatted_status_vs_domain = []
        for status, domains in status_vs_domain.items():
            for domain, count in domains.items():
                if domain != "Unknown":
                    formatted_status_vs_domain.append({
                        "status": status,
                        "domain": domain,
                        "count": count
                    })
        
        # Format Department + Dept Owner vs Status matrix
        formatted_dept_deptowner_vs_status = []
        for (department, dept_owner), statuses in dept_deptowner_vs_status.items():
            for status, count in statuses.items():
                formatted_dept_deptowner_vs_status.append({
                    "department": department,
                    "dept_owner": dept_owner,
                    "status": status,
                    "count": count
                })
        
        # Calculate compliance rate
        compliance_rate = 0
        if total_controls > 0:
            active_statuses = ["Active", "Implemented", "Complete", "Compliant"]
            active_count = sum(
                item["count"] for item in formatted_status_vs_assignee
                if item["status"] in active_statuses
            )
            compliance_rate = round((active_count / total_controls) * 100, 1)
        
        return {
            "data": {
                "total_controls": total_controls,
                "status_vs_assignee": formatted_status_vs_assignee,
                "status_vs_domain": formatted_status_vs_domain,
                "dept_deptowner_vs_status": formatted_dept_deptowner_vs_status,
                "compliance_rate": compliance_rate
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_controls_metrics", return_dict=True, tenant_id=tenant_id)


@app.get("/api/dashboard/metrics")
@require_permission("dashboard_retrieve")
async def get_combined_dashboard_metrics(
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get combined dashboard metrics: both task and controls metrics in one call.
    
    This endpoint combines /api/dashboard/tasks/metrics and /api/dashboard/controls/metrics
    to reduce the number of API calls needed on login.
    """
    endpoint = "/api/dashboard/metrics"
    try:
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        # Get task metrics
        task_query = supabase.table("tasks").select("*").eq("tenant_id", tenant_id)
        if not is_admin:
            task_query = task_query.eq("is_deleted", False)
        
        task_resp = task_query.execute()
        if getattr(task_resp, "error", None):
            error_str = str(task_resp.error)
            if "is_deleted" in error_str.lower() and ("column" in error_str.lower() or "does not exist" in error_str.lower()):
                task_query = supabase.table("tasks").select("*").eq("tenant_id", tenant_id)
                task_resp = task_query.execute()
                if getattr(task_resp, "error", None):
                    raise HTTPException(status_code=400, detail=str(task_resp.error))
            else:
                raise HTTPException(status_code=400, detail=str(task_resp.error))
        
        tasks = task_resp.data or []
        total_tasks = len(tasks)
        
        # Get controls metrics
        control_query = supabase.table("security_controls").select("*").eq("tenant_id", tenant_id)
        control_resp = control_query.execute()
        if getattr(control_resp, "error", None):
            raise HTTPException(status_code=400, detail=str(control_resp.error))
        
        controls = control_resp.data or []
        if not is_admin:
            filtered_controls = []
            for control in controls:
                is_deleted = control.get("is_deleted")
                if is_deleted is not True:
                    filtered_controls.append(control)
            controls = filtered_controls
        
        total_controls = len(controls)
        
        # Calculate compliance rate
        compliance_rate = 0
        if total_controls > 0:
            active_statuses = ["Active", "Implemented", "Complete", "Compliant"]
            active_count = sum(1 for control in controls if control.get("Status") in active_statuses)
            compliance_rate = round((active_count / total_controls) * 100, 1)
        
        return {
            "data": {
                "tasks": {
                    "total": total_tasks
                },
                "controls": {
                    "total_controls": total_controls,
                    "compliance_rate": compliance_rate
                }
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_combined_dashboard_metrics", return_dict=True, tenant_id=tenant_id)


@app.get("/api/dashboard/controls/by-certifications")
@require_permission("dashboard_retrieve")
async def get_controls_by_certifications(
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get detailed controls metrics grouped by certifications (ISO_27001, NIST_CSF, SOC_2, GDPR, PCI_DSS, HIPAA)."""
    endpoint = "/api/dashboard/controls/by-certifications"
    try:
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = user.get("id") or user.get("user", {}).get("id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        # Query security_controls - don't filter by is_deleted in SQL since column may not exist
        query = supabase.table("security_controls").select("*").eq("tenant_id", tenant_id)
        
        resp = query.execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        controls = resp.data or []
        
        # Filter out soft-deleted items in Python (if is_deleted column exists)
        # This handles cases where the column doesn't exist yet
        if not is_admin:
            filtered_controls = []
            for control in controls:
                # If is_deleted column exists and is True, skip it
                # If column doesn't exist (None), include the control
                is_deleted = control.get("is_deleted")
                if is_deleted is not True:
                    filtered_controls.append(control)
            controls = filtered_controls
        
        # Certification columns in security_controls table
        cert_columns = ["ISO_27001", "NIST_CSF", "SOC_2", "GDPR", "PCI_DSS", "HIPAA", "IT_Act_2000"]
        
        # Detailed metrics per certification
        cert_metrics = {}
        
        for cert in cert_columns:
            cert_metrics[cert] = {
                "total_controls": 0,
                "by_status": {},
                "by_priority": {},
                "by_domain": {},
                "by_owner": {},
                "controls_list": []
            }
        
        for control in controls:
            control_status = control.get("Status") or "Unknown"
            control_priority = control.get("Priority") or "Unknown"
            control_domain = control.get("control_domain") or "Unknown"
            control_owner = control.get("owner") or "Unassigned"
            control_id = control.get("id") or ""
            
            for cert in cert_columns:
                cert_value = control.get(cert)
                if cert_value and str(cert_value).strip() and str(cert_value).strip().lower() not in ["", "n/a", "none", "null"]:
                    # Increment total
                    cert_metrics[cert]["total_controls"] += 1
                    
                    # Count by status
                    cert_metrics[cert]["by_status"][control_status] = cert_metrics[cert]["by_status"].get(control_status, 0) + 1
                    
                    # Count by priority
                    cert_metrics[cert]["by_priority"][control_priority] = cert_metrics[cert]["by_priority"].get(control_priority, 0) + 1
                    
                    # Count by domain
                    cert_metrics[cert]["by_domain"][control_domain] = cert_metrics[cert]["by_domain"].get(control_domain, 0) + 1
                    
                    # Count by owner
                    cert_metrics[cert]["by_owner"][control_owner] = cert_metrics[cert]["by_owner"].get(control_owner, 0) + 1
                    
                    # Add to controls list (for reference)
                    cert_metrics[cert]["controls_list"].append({
                        "id": control_id,
                        "status": control_status,
                        "priority": control_priority,
                        "domain": control_domain,
                        "owner": control_owner
                    })
        
        # Additional metrics: Status vs Assignee matrix and Aging
        status_assignee_matrix = {}  # {cert: {status: {assignee: count}}}
        aging_by_assignee = {}  # {cert: {assignee: {age_bucket: count}}}
        
        for cert in cert_columns:
            status_assignee_matrix[cert] = {}
            aging_by_assignee[cert] = {}
        
        for control in controls:
            control_status = control.get("Status") or "Unknown"
            control_owner = control.get("owner") or "Unassigned"
            control_id = control.get("id") or ""
            
            # Calculate aging - try multiple date fields
            created_at_str = control.get("created_at") or control.get("Date") or control.get("Review_Date") or control.get("last_review_date")
            
            age_days = None
            if created_at_str:
                try:
                    if isinstance(created_at_str, str):
                        # Try ISO format first
                        try:
                            created_date = datetime.fromisoformat(created_at_str.replace('Z', '+00:00'))
                        except:
                            # Try other common formats
                            try:
                                created_date = datetime.strptime(created_at_str.split('T')[0], '%Y-%m-%d')
                            except:
                                created_date = datetime.strptime(created_at_str, '%Y-%m-%d %H:%M:%S')
                    else:
                        created_date = created_at_str
                    
                    # Ensure timezone aware
                    if created_date.tzinfo is None:
                        created_date = created_date.replace(tzinfo=timezone.utc)
                    
                    age_days = (datetime.now(timezone.utc) - created_date).days
                except Exception as e:
                    # If date parsing fails, skip aging calculation for this control
                    age_days = None
            
            # Age buckets
            age_bucket = "Unknown"
            if age_days is not None:
                if age_days < 30:
                    age_bucket = "0-30 days"
                elif age_days < 90:
                    age_bucket = "31-90 days"
                elif age_days < 180:
                    age_bucket = "91-180 days"
                elif age_days < 365:
                    age_bucket = "181-365 days"
                else:
                    age_bucket = "365+ days"
            
            for cert in cert_columns:
                cert_value = control.get(cert)
                if cert_value and str(cert_value).strip() and str(cert_value).strip().lower() not in ["", "n/a", "none", "null"]:
                    # Status vs Assignee matrix
                    if control_status not in status_assignee_matrix[cert]:
                        status_assignee_matrix[cert][control_status] = {}
                    status_assignee_matrix[cert][control_status][control_owner] = status_assignee_matrix[cert][control_status].get(control_owner, 0) + 1
                    
                    # Aging by assignee
                    if control_owner not in aging_by_assignee[cert]:
                        aging_by_assignee[cert][control_owner] = {}
                    aging_by_assignee[cert][control_owner][age_bucket] = aging_by_assignee[cert][control_owner].get(age_bucket, 0) + 1
        
        # Format response
        formatted_metrics = []
        for cert in cert_columns:
            metrics = cert_metrics[cert]
            
            # Format status vs assignee matrix
            status_assignee_data = []
            for status, assignees in status_assignee_matrix[cert].items():
                for assignee, count in assignees.items():
                    status_assignee_data.append({
                        "status": status,
                        "assignee": assignee,
                        "count": count
                    })
            
            # Format aging by assignee
            aging_data = []
            for assignee, age_buckets in aging_by_assignee[cert].items():
                for age_bucket, count in age_buckets.items():
                    aging_data.append({
                        "assignee": assignee,
                        "age_bucket": age_bucket,
                        "count": count
                    })
            
            formatted_metrics.append({
                "certification": cert,
                "total_controls": metrics["total_controls"],
                "by_status": [
                    {"status": status, "count": count}
                    for status, count in sorted(metrics["by_status"].items(), key=lambda x: x[1], reverse=True)
                ],
                "by_priority": [
                    {"priority": priority, "count": count}
                    for priority, count in sorted(metrics["by_priority"].items(), key=lambda x: x[1], reverse=True)
                ],
                "by_domain": [
                    {"domain": domain, "count": count}
                    for domain, count in sorted(metrics["by_domain"].items(), key=lambda x: x[1], reverse=True)
                    if domain != "Unknown"
                ],
                "by_owner": [
                    {"owner": owner, "count": count}
                    for owner, count in sorted(metrics["by_owner"].items(), key=lambda x: x[1], reverse=True)
                    if owner != "Unassigned"
                ][:5],  # Top 5 owners
                "status_vs_assignee": status_assignee_data,  # Status vs Assignee matrix
                "aging_by_assignee": aging_data,  # Aging grouped by assignee
                "compliance_rate": 0  # Will calculate based on status
            })
            
            # Calculate compliance rate (Active/Complete controls / Total)
            total = metrics["total_controls"]
            if total > 0:
                active_count = sum(
                    count for status, count in metrics["by_status"].items()
                    if status in ["Active", "Implemented", "Complete", "Compliant"]
                )
                formatted_metrics[-1]["compliance_rate"] = round((active_count / total) * 100, 1)
        
        return {
            "data": {
                "total_controls": len(controls),
                "by_certification": formatted_metrics
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_controls_by_certifications", return_dict=True, tenant_id=tenant_id)


@app.get("/api/dashboard/certifications/metrics")
@require_permission("dashboard_retrieve")
async def get_certifications_metrics(
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """Get certifications metrics: counts by status, type, and expiry information."""
    endpoint = "/api/dashboard/certifications/metrics"
    try:
        auth_data = auth_guard(Authorization)
        user = auth_data.get("user", {})
        user_id = auth_data.get("user_id") or user.get("user_id")
        is_admin = is_superadmin(user_id, tenant_id) if user_id else False
        
        query = supabase.table("certifications").select("*").eq("tenant_id", tenant_id)
        if not is_admin:
            query = query.eq("is_deleted", False)
        
        resp = query.execute()
        if getattr(resp, "error", None):
            raise HTTPException(status_code=400, detail=str(resp.error))
        
        certifications = resp.data or []
        
        # Calculate metrics
        status_counts = {}
        type_counts = {}
        expiry_counts = {"expired": 0, "expiring_soon": 0, "active": 0, "no_expiry": 0}
        total_certs = len(certifications)
        
        today = datetime.now(timezone.utc).date()
        
        for cert in certifications:
            # Status counts
            status = cert.get("status") or "Unknown"
            status_counts[status] = status_counts.get(status, 0) + 1
            
            # Type counts
            cert_type = cert.get("certification_type") or "Unknown"
            type_counts[cert_type] = type_counts.get(cert_type, 0) + 1
            
            # Expiry analysis
            expiry_date_str = cert.get("expiry_date")
            if expiry_date_str:
                try:
                    if isinstance(expiry_date_str, str):
                        expiry_date = datetime.fromisoformat(expiry_date_str.replace('Z', '+00:00')).date()
                    else:
                        expiry_date = expiry_date_str
                    
                    days_until_expiry = (expiry_date - today).days
                    
                    if days_until_expiry < 0:
                        expiry_counts["expired"] += 1
                    elif days_until_expiry <= 30:
                        expiry_counts["expiring_soon"] += 1
                    else:
                        expiry_counts["active"] += 1
                except:
                    expiry_counts["no_expiry"] += 1
            else:
                expiry_counts["no_expiry"] += 1
        
        return {
            "data": {
                "total": total_certs,
                "by_status": [{"status": k, "count": v} for k, v in status_counts.items()],
                "by_type": [{"type": k, "count": v} for k, v in type_counts.items()],
                "by_expiry": [
                    {"category": k, "count": v}
                    for k, v in expiry_counts.items()
                    if v > 0
                ]
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "get_certifications_metrics", return_dict=True, tenant_id=tenant_id)


# ============================
# 🔐 AUTHENTICATION ENDPOINTS
# ============================

class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/api/auth/login")
async def login(payload: LoginRequest):
    """Login with email and password. Returns JWT token.
    
    Blocks inactive users from logging in.
    """
    endpoint = "/api/auth/login"
    try:
        result = authenticate_user(payload.email, payload.password)
        
        # Check if result indicates inactive user
        if result and result.get("error") == "inactive":
            raise HTTPException(
                status_code=403,
                detail=result.get("message", "Your account is inactive. Please contact your administrator.")
            )
        
        # Check if user has no password set
        if result and result.get("error") == "no_password":
            raise HTTPException(
                status_code=400,
                detail=result.get("message", "No password set for this account. Please use SSO login or contact your administrator.")
            )
        
        # Check if authentication failed (user not found or wrong password)
        if not result:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        return {
            "data": {
                "token": result["token"],
                "user": {
                    "id": result["user_id"],
                    "email": result["email"],
                    "full_name": result["full_name"],
                    "tenant_id": result["tenant_id"],
                },
                "requires_password_change": result.get("requires_password_change", False),
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "login", return_dict=True, email=payload.email)


@app.post("/api/auth/logout")
async def logout(Authorization: Optional[str] = Header(default=None)):
    """Logout (client-side token removal)."""
    # JWT tokens are stateless, so logout is handled client-side
    return {"data": {"message": "Logged out successfully"}, "error": None}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@app.post("/api/auth/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    Authorization: Optional[str] = Header(default=None)
):
    """Allow authenticated users to change their own password.
    
    Validates current password and updates to new password.
    Requires valid JWT token in Authorization header.
    """
    endpoint = "/api/auth/change-password"
    try:
        # Get user from token
        if not Authorization or not Authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization token")
        
        token = Authorization.replace("Bearer ", "")
        user_info = get_user_from_token(token)
        
        if not user_info:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user_id = user_info["user_id"]
        
        # Validate new password strength
        is_valid, error_msg = validate_password_strength(payload.new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Verify current password and update to new password
        import psycopg2
        from config import DB_URL
        
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        # Get current password hash
        cur.execute("SELECT password FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        
        if not row:
            conn.close()
            raise HTTPException(status_code=404, detail="User not found")
        
        current_hashed_password = row[0]
        
        # Verify current password
        if not verify_password(payload.current_password, current_hashed_password):
            conn.close()
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        
        # Check if new password is same as current password
        if verify_password(payload.new_password, current_hashed_password):
            conn.close()
            raise HTTPException(status_code=400, detail="New password must be different from current password")
        
        # Update password
        new_hashed_password = hash_password(payload.new_password)
        cur.execute(
            "UPDATE users SET password = %s, updated_at = NOW() WHERE id = %s",
            (new_hashed_password, user_id)
        )
        conn.commit()
        conn.close()
        
        return {
            "data": {
                "message": "Password changed successfully",
                "password_changed": True
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "change_password", return_dict=True)


@app.get("/api/auth/check-password-change")
async def check_password_change(
    Authorization: Optional[str] = Header(default=None)
):
    """Check if the authenticated user needs to change their password.
    
    Returns requires_password_change flag.
    """
    endpoint = "/api/auth/check-password-change"
    try:
        # Get user from token
        if not Authorization or not Authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing or invalid authorization token")
        
        token = Authorization.replace("Bearer ", "")
        user_info = get_user_from_token(token)
        
        if not user_info:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        user_id = user_info["user_id"]
        
        # Check if password is default or first login
        import psycopg2
        from config import DB_URL
        
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()
        
        cur.execute(
            "SELECT password, first_login, last_login FROM users WHERE id = %s",
            (user_id,)
        )
        row = cur.fetchone()
        conn.close()
        
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        
        hashed_password, first_login, last_login = row
        
        # Check if password is default "pass" or first login
        is_default_password = verify_password("pass", hashed_password)
        is_first_time = is_default_password or (first_login is None) or (first_login == last_login)
        
        return {
            "data": {
                "requires_password_change": is_first_time
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "check_password_change", return_dict=True)


class SSOLoginRequest(BaseModel):
    access_token: str


@app.post("/api/auth/sso/login")
async def sso_login(payload: SSOLoginRequest):
    """Login with Microsoft SSO. Returns JWT token.
    
    Validates Microsoft access token, checks email domain (@cavininfotech.com or @hepl.com),
    creates/updates user in database, assigns Viewer role by default.
    """
    endpoint = "/api/auth/sso/login"
    try:
        from services.sso_service import authenticate_sso_user
        
        result = authenticate_sso_user(payload.access_token)
        
        # Check if result indicates inactive user or domain not allowed
        if result and result.get("error"):
            error_type = result.get("error")
            if error_type == "inactive":
                raise HTTPException(
                    status_code=403,
                    detail=result.get("message", "Your account is inactive. Please contact your administrator.")
                )
            elif error_type == "domain_not_allowed":
                raise HTTPException(
                    status_code=403,
                    detail=result.get("message", "Only @cavininfotech.com and @hepl.com email addresses are allowed.")
                )
        
        # Check if authentication failed
        if not result:
            raise HTTPException(status_code=401, detail="Invalid SSO token or authentication failed")
        
        return {
            "data": {
                "token": result["token"],
                "user": {
                    "id": result["user_id"],
                    "email": result["email"],
                    "full_name": result["full_name"],
                    "tenant_id": result["tenant_id"],
                }
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "sso_login", return_dict=True)


# --- Admin endpoint to update all user passwords ---
@app.post("/api/admin/update-all-passwords")
@require_permission("users_update")  # Requires user update permission
async def update_all_passwords(
    force: bool = Query(False, description="Force update even if password is already bcrypted"),
    Authorization: Optional[str] = Header(default=None)
):
    """
    Admin endpoint to update all users in the database with bcrypted password "pass".
    This ensures all users have a password set for login.
    """
    endpoint = "/api/admin/update-all-passwords"
    try:
        from scripts.update_user_passwords import update_all_user_passwords
        
        result = update_all_user_passwords(force=force)
        
        if result["success"]:
            return {
                "data": {
                    "updated": result["updated"],
                    "skipped": result["skipped"],
                    "total": result["total"],
                    "message": f"Successfully updated {result['updated']} user passwords"
                },
                "error": None
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to update passwords"))
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "update_all_passwords", return_dict=True)

# --- Admin endpoint to backfill user roles ---
@app.post("/api/admin/backfill-user-roles")
@require_permission("users_update")  # Requires user update permission
async def backfill_user_roles_endpoint(
    force: bool = Query(False, description="Force update even if role is already assigned"),
    Authorization: Optional[str] = Header(default=None)
):
    """
    Admin endpoint to backfill user_roles table for all existing users.
    Maps the 'role' field in users table to actual role assignments.
    """
    endpoint = "/api/admin/backfill-user-roles"
    try:
        from scripts.backfill_user_roles import backfill_user_roles
        
        result = backfill_user_roles(force=force)
        
        if result["success"]:
            return {
                "data": {
                    "updated": result["updated"],
                    "skipped": result["skipped"],
                    "errors": result.get("errors", 0),
                    "total": result["total"],
                    "message": f"Successfully processed {result['updated']} user role assignments"
                },
                "error": None
            }
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Failed to backfill user roles"))
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, endpoint, "backfill_user_roles", return_dict=True)

# --- Debug endpoint to check user permissions ---
@app.get("/api/debug/user-permissions/{user_id}")
async def debug_user_permissions(
    user_id: str,
    tenant_id: str = Query('00000000-0000-0000-0000-000000000001'),
    Authorization: Optional[str] = Header(default=None)
):
    """
    Debug endpoint to check a user's permissions.
    Returns detailed information about user roles and permissions.
    """
    try:
        from services.rbac_service import get_user_roles, get_role_permissions, is_superadmin
        
        # Check if requesting user is superadmin
        auth_data = auth_guard(Authorization)
        current_user = auth_data.get("user", {})
        current_user_id = current_user.get("user_id")
        
        if not is_superadmin(current_user_id, tenant_id):
            raise HTTPException(status_code=403, detail="Only superadmin can access debug endpoints")
        
        # Get user roles
        user_roles = get_user_roles(user_id, tenant_id)
        
        # Get all permissions for each role
        all_permissions = []
        for user_role in user_roles:
            role_id = user_role.get("role_id")
            if not role_id and user_role.get("roles"):
                roles_data = user_role.get("roles")
                if isinstance(roles_data, dict):
                    role_id = roles_data.get("id")
                elif isinstance(roles_data, list) and len(roles_data) > 0:
                    role_id = roles_data[0].get("id")
            
            if role_id:
                permissions = get_role_permissions(role_id, tenant_id)
                all_permissions.extend(permissions)
        
        # Check specific permission
        from services.rbac_service import check_permission
        has_security_controls_retrieve = check_permission(user_id, tenant_id, "security_controls", "retrieve")
        
        return {
            "data": {
                "user_id": user_id,
                "tenant_id": tenant_id,
                "is_superadmin": is_superadmin(user_id, tenant_id),
                "user_roles": user_roles,
                "all_permissions": all_permissions,
                "security_controls_retrieve": has_security_controls_retrieve,
                "security_controls_permissions": [
                    p for p in all_permissions if p.get("module_name", "").lower() == "security_controls"
                ]
            },
            "error": None
        }
    except HTTPException:
        raise
    except Exception as e:
        return handle_endpoint_error(e, f"/api/debug/user-permissions/{user_id}", "debug_user_permissions", return_dict=True)

# --- debug endpoint to inspect raw supabase response quickly ---
@app.get("/api/raw-probe")
def raw_probe() -> Dict[str, Any]:
    if not supabase:
        raise HTTPException(status_code=500, detail="Supabase client not configured")

    try:
        try:
            r = supabase.table("Bugs_file").select("*").limit(5).execute()
        except:
            r = supabase.from_("Bugs_file").select("*").limit(5).execute()

        if isinstance(r, dict):
            return {"repr": repr(r), "keys": list(r.keys()), "data_len": len(r.get("data") or []), "data_sample": (r.get("data") or [])[:3], "error": r.get("error")}
        else:
            return {"repr": repr(r), "data_len": len(getattr(r, "data", []) or []), "data_sample": getattr(r, "data", None)[:3] if getattr(r, "data", None) else [], "error": getattr(r, "error", None)}
    except Exception:
        logging.exception("raw-probe failed")
        raise HTTPException(status_code=500, detail="raw-probe failed; see server logs")

