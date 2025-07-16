#!/bin/bash
# Production environment script
export BACKEND_URL="https://morfis.ngrok.app"
export PORT="5000"
echo "Starting Flask app with production backend: $BACKEND_URL on port: $PORT"
python app.py 