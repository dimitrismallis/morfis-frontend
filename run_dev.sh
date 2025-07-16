#!/bin/bash
# Development environment script
export BACKEND_URL="http://localhost:8000"
export PORT="5000"
echo "Starting Flask app with local backend: $BACKEND_URL on port: $PORT"
python app.py 