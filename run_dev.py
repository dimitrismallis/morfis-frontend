#!/usr/bin/env python3
"""Development environment startup script"""
import os
import subprocess
import sys

# Set development backend URL and port
os.environ["BACKEND_URL"] = "http://localhost:8000"
os.environ["PORT"] = "5000"
backend_url = os.environ["BACKEND_URL"]
port = os.environ["PORT"]
print(f"Starting Flask app with local backend: {backend_url} on port: {port}")

# Run the Flask app
subprocess.run([sys.executable, "app.py"])
