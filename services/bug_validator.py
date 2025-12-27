"""
Bug payload validator - validates request payloads against dropdown values
before insert, update, or delete operations.

Per aig.md guidelines: All bug CRUD operations must validate payloads
against bug_dropdowns.json before database operations.
"""
import json
import os
import re
from typing import Dict, Any, List, Optional
from pathlib import Path

# Load dropdown values from JSON file
def _load_dropdowns() -> Dict[str, List[str]]:
    """Load dropdown values from bug_dropdowns.json"""
    try:
        # Get the directory where this file is located
        current_dir = Path(__file__).parent.parent
        json_path = current_dir / "bug_dropdowns.json"
        
        if not json_path.exists():
            raise FileNotFoundError(f"bug_dropdowns.json not found at {json_path}")
        
        with open(json_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        raise RuntimeError(f"Failed to load bug_dropdowns.json: {str(e)}")

# Cache dropdown values
_DROPDOWN_VALUES = None

def get_dropdown_values() -> Dict[str, List[str]]:
    """Get dropdown values (cached)"""
    global _DROPDOWN_VALUES
    if _DROPDOWN_VALUES is None:
        _DROPDOWN_VALUES = _load_dropdowns()
    return _DROPDOWN_VALUES

def validate_bug_payload(payload: Dict[str, Any], operation: str = "create", enhanced: bool = True) -> tuple[bool, Optional[str]]:
    """
    Validate bug payload against dropdown values and additional rules.
    
    Args:
        payload: The bug payload to validate
        operation: Operation type ("create", "update", "delete")
        enhanced: If True, use enhanced validation (required fields, ranges, formats). 
                 If False, only validate dropdown values.
    
    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if payload is valid, False otherwise
        - error_message: Error message if invalid, None if valid
    """
    # Use enhanced validation by default
    if enhanced:
        return validate_bug_payload_enhanced(payload, operation)
    
    # Basic validation (dropdown values only)
    try:
        dropdowns = get_dropdown_values()
        
        # For delete operations, we don't need to validate the payload
        if operation == "delete":
            return True, None
        
        errors = []
        
        # Validate each field that has dropdown values
        for field_name, allowed_values in dropdowns.items():
            if field_name in payload:
                value = payload[field_name]
                
                # Skip validation if value is empty/None (unless required)
                if value is None or value == "" or value == " ---":
                    continue
                
                # Convert to string for comparison
                value_str = str(value).strip()
                
                # Check if value is in allowed list
                if value_str not in allowed_values:
                    errors.append(
                        f"Invalid value '{value_str}' for field '{field_name}'. "
                        f"Allowed values: {', '.join(allowed_values)}"
                    )
        
        if errors:
            return False, "; ".join(errors)
        
        return True, None
    
    except Exception as e:
        return False, f"Validation error: {str(e)}"

def get_field_options(field_name: str) -> List[str]:
    """
    Get allowed options for a specific field.
    
    Args:
        field_name: Name of the field
    
    Returns:
        List of allowed values
    """
    dropdowns = get_dropdown_values()
    return dropdowns.get(field_name, [])

# Required fields for bug creation
REQUIRED_FIELDS = ["Bug ID", "Summary"]

# Field validation rules
def _validate_email(email: str) -> bool:
    """Validate email format"""
    if not email:
        return True  # Empty emails are allowed
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def _validate_url(url: str) -> bool:
    """Validate URL format"""
    if not url:
        return True  # Empty URLs are allowed
    pattern = r'^https?://[^\s/$.?#].[^\s]*$'
    return bool(re.match(pattern, url))

def _validate_numeric_range(value: Any, field_name: str, min_val: Optional[float] = None, max_val: Optional[float] = None) -> tuple[bool, Optional[str]]:
    """Validate numeric value is within range"""
    if value is None or value == "" or value == " ---":
        return True, None
    
    try:
        num_val = float(value)
        if min_val is not None and num_val < min_val:
            return False, f"Field '{field_name}' must be >= {min_val}"
        if max_val is not None and num_val > max_val:
            return False, f"Field '{field_name}' must be <= {max_val}"
        return True, None
    except (ValueError, TypeError):
        return False, f"Field '{field_name}' must be a valid number"

def validate_bug_payload_enhanced(payload: Dict[str, Any], operation: str = "create") -> tuple[bool, Optional[str]]:
    """
    Enhanced validation for bug payloads including:
    - Required fields
    - Dropdown value validation
    - Numeric range validation
    - Email format validation
    - URL format validation
    
    Args:
        payload: The bug payload to validate
        operation: Operation type ("create", "update", "delete")
    
    Returns:
        Tuple of (is_valid, error_message)
        - is_valid: True if payload is valid, False otherwise
        - error_message: Error message if invalid, None if valid
    """
    try:
        # For delete operations, we don't need to validate the payload
        if operation == "delete":
            return True, None
        
        errors = []
        dropdowns = get_dropdown_values()
        
        # Validate required fields for create operation
        if operation == "create":
            for field in REQUIRED_FIELDS:
                value = payload.get(field)
                if value is None or value == "" or value == " ---":
                    errors.append(f"Required field '{field}' is missing or empty")
        
        # Validate dropdown values
        for field_name, allowed_values in dropdowns.items():
            if field_name in payload:
                value = payload[field_name]
                
                # Skip validation if value is empty/None (unless required)
                if value is None or value == "" or value == " ---":
                    continue
                
                # Convert to string for comparison
                value_str = str(value).strip()
                
                # Check if value is in allowed list
                if value_str not in allowed_values:
                    errors.append(
                        f"Invalid value '{value_str}' for field '{field_name}'. "
                        f"Allowed values: {', '.join(allowed_values)}"
                    )
        
        # Validate numeric fields with ranges
        numeric_validations = {
            "%Complete": (0, 100),
            "Actual Hours": (0, None),
            "Hours Left": (0, None),
            "Orig. Est.": (0, None),
            "Bug Age (in days)": (0, None),
            "Number of Comments": (0, None),
        }
        
        for field_name, (min_val, max_val) in numeric_validations.items():
            if field_name in payload:
                is_valid, error_msg = _validate_numeric_range(
                    payload[field_name], field_name, min_val, max_val
                )
                if not is_valid:
                    errors.append(error_msg)
        
        # Validate email fields
        email_fields = ["Assignee", "Reporter"]
        for field_name in email_fields:
            if field_name in payload:
                value = payload[field_name]
                if value and value != " ---" and not _validate_email(str(value)):
                    errors.append(f"Field '{field_name}' must be a valid email address")
        
        # Validate URL field
        if "URL" in payload:
            url_value = payload["URL"]
            if url_value and url_value != " ---" and not _validate_url(str(url_value)):
                errors.append(f"Field 'URL' must be a valid URL (starting with http:// or https://)")
        
        if errors:
            return False, "; ".join(errors)
        
        return True, None
    
    except Exception as e:
        return False, f"Validation error: {str(e)}"

