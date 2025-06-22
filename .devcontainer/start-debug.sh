#!/bin/bash

# Start Flask with debugging enabled
echo "Starting Flask application with debugging..."

# Set environment variables
export FLASK_APP=main.py
export FLASK_ENV=development
export FLASK_DEBUG=1
export PYTHONPATH=/workspace

# Start Flask with debugpy for remote debugging
python -m debugpy --listen 0.0.0.0:5678 --wait-for-client main.py 