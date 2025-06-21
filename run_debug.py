#!/usr/bin/env python3
"""
Simple script to run the main app.py in debug mode.
This allows you to debug the main application file directly.
"""

import os

# Set debug environment variables
os.environ.setdefault('FLASK_ENV', 'development')
os.environ.setdefault('FLASK_DEBUG', '1')

if __name__ == '__main__':
    # Import and run the main app
    from app import app
    
    print("Starting Flask app in debug mode...")
    print("You can now set breakpoints in app.py!")
    print("Access the app at: http://localhost:5001")
    print("Press Ctrl+C to stop")
    
    app.run(
        host='0.0.0.0', 
        port=5001, 
        debug=True,
        use_reloader=False  # Disable reloader for better debugging
    ) 