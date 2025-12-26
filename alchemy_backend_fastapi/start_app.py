#!/usr/bin/env python3
"""
Simple script to start the FastAPI backend server.
Usage: python start_app.py
"""

import uvicorn
import sys
import os

# Add the backend directory to the path so imports work
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    # Start the server
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )

