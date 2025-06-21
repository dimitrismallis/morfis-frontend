# Local Development and Debugging Guide

This guide explains how to run the Morfis Flask application locally for development and debugging.

## Prerequisites

- Python 3.11+ (already available in the dev container)
- All dependencies installed (`pip install -r requirements.txt`)

## Option 1: Debug Mode (Recommended for Development)

For debugging with breakpoints in the main `app.py`:

```bash
python run_debug.py
```

**Features:**
- ✅ Debug mode enabled
- ✅ Breakpoints work in `app.py` (your main development file)
- ✅ No database setup required (graceful fallback)
- ✅ Graceful error handling
- ✅ Detailed logging
- ✅ Hot reloading disabled for better debugging

**Access:** http://localhost:5001

## Option 2: Full Application with Database

For testing the complete application with database functionality:

```bash
python run_local.py
```

**Features:**
- ✅ Full application features
- ✅ SQLite database (auto-created)
- ✅ Session tracking
- ✅ Waitlist functionality
- ⚠️ Requires database setup

**Access:** http://localhost:5000

## Option 3: Docker Compose (Production-like)

For testing the production setup:

```bash
docker-compose up --build
```

**Features:**
- ✅ PostgreSQL database
- ✅ Production-like environment
- ✅ All features enabled
- ❌ No debugging support

## Debugging Tips

### Setting Breakpoints

1. Open `app.py` in VS Code (your main development file)
2. Click in the left margin to set a breakpoint (red dot)
3. Run the debug version: `python run_debug.py`
4. Trigger the code path that hits your breakpoint
5. The debugger will pause execution

### Common Debug Points in app.py

- **Line ~120** - `generate_cad()` function (CAD generation)
- **Line ~95** - `make_backend_request()` function (API calls)
- **Line ~50** - `get_session_id()` function (session management)
- **Line ~85** - `update_session_activity()` function (session tracking)

### Environment Variables

You can set these environment variables for debugging:

```bash
export FLASK_SECRET_KEY="your-debug-secret"
export FLASK_ENV="development"
export FLASK_DEBUG="1"
```

### Logging

The app includes detailed logging:
- All API requests are logged
- Session creation is logged
- Database errors are handled gracefully (debug level)
- Errors are logged with full stack traces

## Troubleshooting

### Port Already in Use
```bash
# Find the process using port 5000 or 5001
lsof -i :5000
lsof -i :5001
# Kill the process
kill -9 <PID>
```

### Database Issues
The app now handles database errors gracefully. If the database is not available:
- Sessions still work (stored in Flask session)
- All functionality continues to work
- Database errors are logged at debug level

### Backend Connection Issues
The app will gracefully handle backend connection failures and use fallback responses.

## File Structure

- `app.py` - **Main application file** (develop here!)
- `run_debug.py` - Script to run app.py in debug mode (port 5001)
- `run_local.py` - Full version with database (port 5000)
- `models.py` - Database models
- `static/` - Static files (CSS, JS, images)
- `templates/` - HTML templates

## Key Changes for Debugging

The main `app.py` has been improved to:
- Handle database errors gracefully
- Work without database setup
- Provide better logging for debugging
- Maintain all functionality even without database

## Port Configuration

- **Debug version**: http://localhost:5001 (no database required)
- **Full version**: http://localhost:5000 (with database)
- **Docker version**: http://localhost:5000 (production-like) 