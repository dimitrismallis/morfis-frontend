#!/usr/bin/env python3
"""Production environment startup script"""
import os
import subprocess
import sys

# Set production backend URL and port
os.environ["BACKEND_URL"] = "https://morfis.ngrok.app"
os.environ["PORT"] = "5000"
backend_url = os.environ["BACKEND_URL"]
port = os.environ["PORT"]
print(f"Starting Flask app with production backend: {backend_url} " f"on port: {port}")

# Run the Flask app
subprocess.run([sys.executable, "app.py"])
