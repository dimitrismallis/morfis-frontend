#!/usr/bin/env python3
"""
Local development script for running the Flask app with debugging enabled.
This script initializes the database and runs the app in debug mode.
"""

import os

from app import app, db
from models import UserSession, WaitlistEntry


def init_database():
    """Initialize the database and create tables."""
    with app.app_context():
        # Create all tables
        db.create_all()
        print("Database initialized successfully!")


def run_app():
    """Run the Flask app in debug mode."""
    # Set environment variables for local development
    os.environ.setdefault("FLASK_ENV", "development")
    os.environ.setdefault("FLASK_DEBUG", "1")

    # Initialize database
    init_database()

    # Run the app
    app.run(host="0.0.0.0", port=5000, debug=True, use_reloader=True)


if __name__ == "__main__":
    run_app()
