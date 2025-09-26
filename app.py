import logging
import os
import subprocess
import tempfile
import threading
import time
import uuid
from datetime import datetime, timedelta

import requests
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from flask_sqlalchemy import SQLAlchemy

# Configure logging
logging.basicConfig(level=logging.DEBUG)


app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY") or "your-secret-key-here"

# Session configuration for authentication requirements
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)  # 1 hour timeout
# Use session cookies (expire on browser close)
app.config['SESSION_PERMANENT'] = False

# Configure database
database_url = os.environ.get("DATABASE_URL")
if database_url:
    # Fix Heroku postgres:// URL for SQLAlchemy compatibility
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
else:
    # Use SQLite for local development
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///local_dev.db"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = True

app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Initialize SQLAlchemy if needed for other features
db = SQLAlchemy(app)

# Password protection configuration
SITE_PASSWORD = os.environ.get("SITE_PASSWORD", "morfis2025")


# Authentication middleware
@app.before_request
def check_password_protection():
    """Check if user is authenticated before allowing access to protected routes."""
    # Allow access to login route, logout route, and static files
    if request.endpoint in ["login", "logout", "static"]:
        return

    # Check session timeout (1 hour of inactivity)
    if session.get("authenticated"):
        login_time = session.get("login_time")
        if login_time:
            try:
                login_dt = datetime.fromisoformat(login_time)
                if datetime.utcnow() - login_dt > timedelta(hours=1):
                    # Session expired, clear it
                    session.pop("authenticated", None)
                    session.pop("login_time", None)
            except (ValueError, TypeError):
                # Invalid login_time, clear session
                session.pop("authenticated", None)
                session.pop("login_time", None)
        else:
            # Update login_time if not set (for existing sessions)
            session["login_time"] = datetime.utcnow().isoformat()

    # For API endpoints and POST requests, block if not authenticated
    if not session.get("authenticated"):
        # Block all API endpoints except YACV object endpoints
        if request.endpoint and (
            request.endpoint.startswith(
                "api/") or request.endpoint.startswith("get_")
        ):
            # Allow YACV object endpoints without authentication
            yacv_endpoints = ["yacv_api_object", "yacv_api_object_route", "yacv_frontend_api_object",
                              "yacv_api_updates", "yacv_api_updates_route", "yacv_static_files",
                              "yacv_frontend", "yacv_assets", "yacv_root", "yacv_index_specific",
                              "test_yacv", "handle_geometry_selection"]
            if request.endpoint not in yacv_endpoints:
                return jsonify({"error": "Authentication required"}), 401

        # Block POST requests that could modify data
        if request.method == "POST" and request.endpoint not in ["login", "test_yacv", "handle_geometry_selection"]:
            return jsonify({"error": "Authentication required"}), 401

        # Block specific endpoints that fetch/modify data
        protected_endpoints = [
            "generate_cad",
            "new_design",
            "save_design",
            "rollback",
            "submit_feedback",
            "submit_waitlist",
            "get_trajectory",
            "get_trajectory_html",
            "get_app_config",
            "get_session_stats",
            "execute_build123d",
            "stop_yacv_server",
        ]
        if request.endpoint in protected_endpoints:
            return jsonify({"error": "Authentication required"}), 401

    # For the main page, we'll handle authentication in the template
    # Don't redirect here - let the page load with login overlay if needed


@app.route("/login", methods=["POST"])
def login():
    """Handle user login with password protection."""
    # Handle both form data and JSON requests
    if request.is_json:
        password = request.json.get("password", "")
    else:
        password = request.form.get("password", "")
    if password == SITE_PASSWORD:
        session["authenticated"] = True
        session["login_time"] = datetime.utcnow().isoformat()
        # Explicitly set session.permanent = False to ensure session cookies
        # expire on browser close
        session.permanent = False

        # Return success response for AJAX request
        if (request.headers.get("Content-Type") == "application/json" or
                request.is_json):
            return jsonify({"success": True})

        # Redirect to originally requested page or home
        next_page = request.args.get("next")
        if next_page:
            return redirect(next_page)
        return redirect(url_for("index"))
    else:
        # Return error response for AJAX request
        if (request.headers.get("Content-Type") == "application/json" or
                request.is_json):
            return jsonify({"success": False, "error": "Invalid password"})

        return redirect(url_for("index", error="Invalid password"))


@app.route("/logout")
def logout():
    """Handle user logout."""
    session.pop("authenticated", None)
    session.pop("login_time", None)
    return redirect(url_for("index"))


backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")

# Default design types for fallback
DEFAULT_DESIGN_TYPES = [
    {"id": "empty", "name": "Empty Design",
        "description": "Start with a blank design"},
    {
        "id": "coffee_table",
        "name": "Coffee Table",
        "description": "Start with a coffee table design",
    },
]


def get_session_id():
    """Get or create a unique session ID for the current user."""
    # Check if client requested a tab-specific session
    tab_id = request.headers.get("X-Tab-ID")

    if tab_id:
        # Use tab-specific session ID
        session_key = f"tab_session_{tab_id}"
        if session_key not in session:
            session[session_key] = str(uuid.uuid4())

            # Store session info in database for tracking (optional for debugging)
            try:
                from models import UserSession

                user_session = UserSession(
                    session_id=session[session_key],
                    user_ip=request.remote_addr,
                    user_agent=request.headers.get("User-Agent", ""),
                )
                db.session.add(user_session)
                db.session.commit()
                logging.info(
                    f"Created new tab session: {session[session_key]} for tab: {tab_id}"
                )
            except Exception as e:
                # Gracefully handle database errors for debugging
                logging.debug(
                    f"Database not available for session tracking: {str(e)}")
                logging.info(
                    f"Created new tab session (no DB): {session[session_key]} for tab: {tab_id}"
                )

        return session[session_key]
    else:
        # Use browser-wide session (default behavior)
        if "session_id" not in session:
            session["session_id"] = str(uuid.uuid4())

            # Store session info in database for tracking (optional for debugging)
            try:
                from models import UserSession

                user_session = UserSession(
                    session_id=session["session_id"],
                    user_ip=request.remote_addr,
                    user_agent=request.headers.get("User-Agent", ""),
                )
                db.session.add(user_session)
                db.session.commit()
                logging.info(
                    f"Created new browser session: {session['session_id']}")
            except Exception as e:
                # Gracefully handle database errors for debugging
                logging.debug(
                    f"Database not available for session tracking: {str(e)}")
                logging.info(
                    f"Created new browser session (no DB): "
                    f"{session['session_id']}"
                )

        return session["session_id"]


def update_session_activity():
    """Update the current session's last activity timestamp."""
    try:
        # Update authentication activity time for inactivity timeout
        if session.get("authenticated"):
            session["login_time"] = datetime.utcnow().isoformat()

        session_id = session.get("session_id")
        if session_id:
            from models import UserSession

            user_session = UserSession.query.filter_by(
                session_id=session_id).first()
            if user_session:
                user_session.update_activity()
    except Exception as e:
        # Gracefully handle database errors for debugging
        logging.debug(
            f"Database not available for session activity update: {str(e)}")


def make_backend_request(endpoint, method="GET", data=None):
    """Make a request to the backend with session ID included."""
    session_id = get_session_id()

    # Update session activity
    update_session_activity()

    url = f"{backend_url}/{endpoint}"

    headers = {"Content-Type": "application/json", "X-Session-ID": session_id}

    if method == "POST":
        if data is None:
            data = {}
        data["session_id"] = session_id
        # 6 minutes timeout
        return requests.post(url, json=data, headers=headers, timeout=360)
    else:
        params = {"session_id": session_id}
        # 6 minutes timeout
        return requests.get(url, params=params, headers=headers, timeout=360)


def process_model_data(response_data):
    """Process model data from backend response (new format with 'data' and 'format')."""
    model_data_hex = response_data.get("data")

    # Handle format field - if it's None or empty, default to "stl"
    format_value = response_data.get("format")
    if format_value is None or format_value == "":
        model_format = "stl"
    else:
        model_format = format_value.lower()

    if not model_data_hex:
        return None

    try:
        # Convert hex back to binary
        model_binary_data = bytes.fromhex(model_data_hex)

        save_dir = "static/cadmodels"

        # Determine file extension based on format
        if model_format == "step":
            file_extension = ".step"
        else:
            file_extension = ".stl"  # Default to STL

        model_file_path = os.path.join(save_dir, f"model{file_extension}")

        with open(model_file_path, "wb") as model_file:
            model_file.write(model_binary_data)

        if not os.path.exists(model_file_path):
            logging.error(f"Model file not found at path: {model_file_path}")
            return None

        return {"type": model_format, "path": model_file_path}
    except Exception as e:
        logging.error(f"Error processing model data: {str(e)}")
        return None


@app.route("/")
def index():
    # If YACV frontend requests SSE via root with ?api_updates=true, serve it
    api_updates = request.args.get('api_updates')
    if api_updates in ['t', 'true']:
        return yacv_api_updates()

    # If YACV frontend requests a specific object via ?api_object=<name>, serve GLB
    api_object = request.args.get('api_object')
    if api_object:
        return yacv_api_object(api_object)

    is_authenticated = session.get("authenticated", False)
    error_message = request.args.get("error", "")
    import time
    return render_template(
        "index.html",
        is_authenticated=is_authenticated,
        error_message=error_message,
        timestamp=int(time.time())
    )


@app.route("/step-viewer")
def step_viewer():
    return render_template("step_viewer.html")


@app.route("/static/cadmodels/<filename>")
def serve_cad_file(filename):
    """Serve CAD files with proper CORS headers for 3D viewer"""
    from flask import send_from_directory

    response = send_from_directory("static/cadmodels", filename)

    # Add CORS headers to allow the 3D viewer to access the file
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET"
    response.headers["Access-Control-Allow-Headers"] = "*"

    # Set proper content type based on file extension
    if filename.lower().endswith(".step") or filename.lower().endswith(".stp"):
        response.headers["Content-Type"] = "application/step"
    elif filename.lower().endswith(".stl"):
        response.headers["Content-Type"] = "application/sla"
    else:
        # Default to binary for unknown CAD file types
        response.headers["Content-Type"] = "application/octet-stream"

    return response


@app.route("/generate", methods=["POST"])
def generate_cad():
    try:
        command = request.json.get("command", "")

        # Store the user's command in the current trajectory
        # This is for displaying in the trajectory view
        update_trajectory_with_user_command(command)

        response = make_backend_request(
            "process-prompt", "POST", {"prompt": command})
        response_data = response.json()

        # Extract response text and model data
        answer_text = response_data.get(
            "response", "There was an error processing your request."
        )

        # Update trajectory with the AI's response
        update_trajectory_with_ai_response(answer_text)

        # Process model data using new format (data + format)
        model_info = process_model_data(response_data)

        if not model_info:
            logging.info("No model data received from backend")
            response = {
                "message": answer_text,
                "reset_viewer": True,  # Signal to the frontend to reset/clear the 3D viewer
            }
        else:
            response = {
                "message": answer_text,
                "model": model_info,
            }
        return jsonify(response)
    except Exception as e:
        logging.error(f"Error processing command: {str(e)}")
        return jsonify({"error": "Failed to process command"}), 500


# Global variable to store the current trajectory data
# In a production app, this would be stored in a database
current_trajectory = {"messages": []}


def update_trajectory_with_user_command(command):
    """Add a user command to the trajectory data."""
    timestamp = datetime.now().isoformat()
    current_trajectory["messages"].append(
        {"type": "user", "content": command, "timestamp": timestamp}
    )


def update_trajectory_with_ai_response(response):
    """Add an AI response to the trajectory data."""
    timestamp = datetime.now().isoformat()
    current_trajectory["messages"].append(
        {"type": "system", "content": response, "timestamp": timestamp}
    )


@app.route("/new_design", methods=["POST"])
def new_design():
    try:
        design_type = request.json.get("type", "empty")
        logging.debug(f"Starting new design with type: {design_type}")

        # Reset the trajectory data when starting a new design
        global current_trajectory
        current_trajectory = {"messages": []}

        # Format the command for the trajectory
        formatted_type = design_type.replace("_", " ")
        command = f"Create new {formatted_type} design"

        # Store this command in the trajectory
        update_trajectory_with_user_command(command)

        # Call the backend API
        response = make_backend_request(
            "reset", "POST", {"prompt": design_type})

        if not response.ok:
            logging.error(
                f"Backend API error: {response.status_code} - {response.text}"
            )
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Failed to initialize {design_type} design",
                    }
                ),
                500,
            )

        response_data = response.json()

        # Get the response message from the backend
        answer_text = response_data.get("response")

        # Use the backend's message if available, otherwise generate a fallback message
        if not answer_text or answer_text == "Completed":
            # Generate a fallback welcome message
            if design_type == "empty":
                answer_text = (
                    "Starting with a blank canvas. What would you like to create?"
                )
            else:
                # Format the design type for display (e.g., coffee_table -> coffee table)
                answer_text = f"Starting with a {formatted_type} design. You can modify it or add features."

        # Store the response in the trajectory
        update_trajectory_with_ai_response(answer_text)

        # Check if we need an early return (no model data or special cases)
        if response_data and response_data.get("response") == "Completed":
            return jsonify({"status": "success", "message": answer_text})

        # Process model data using new format (data + format)
        model_info = process_model_data(response_data)

        if model_info:
            return jsonify(
                {
                    "status": "success",
                    "message": answer_text,
                    "model": model_info,
                }
            )

        return jsonify({"status": "success", "message": answer_text})

    except Exception as e:
        logging.error(f"Error starting new design: {str(e)}")
        return jsonify({"error": "Failed to start new design"}), 500


@app.route("/api/config", methods=["GET"])
def get_app_config():
    """Return app configuration data like available design types"""
    try:
        # Fetch design types from backend
        response = make_backend_request("init")
        if response.ok:
            response_data = response.json()
            # The backend returns a list of design types, welcome message, and possibly model data
            backend_design_types = response_data.get("design_types", [])
            welcome_message = response_data.get(
                "message", "Welcome to Morfis - AI CAD Agent"
            )

            logging.debug(f"Backend init response: {response_data}")

            # Format design types in the structure expected by the frontend
            formatted_design_types = []

            # Add each design from the backend with proper formatting
            for design_type in backend_design_types:
                # Format the name for display (e.g., "coffee_table" -> "Coffee Table")
                display_name = design_type.replace("_", " ").title()
                formatted_design_types.append(
                    {
                        "id": design_type,
                        "name": display_name,
                        "description": f"Start with a {design_type.replace('_', ' ')} design",
                    }
                )

            # Create the base configuration structure
            config = {
                "design_types": formatted_design_types,
                "welcome_message": welcome_message,
                "advanced_viewer": (
                    os.environ.get("ADVANCED_VIEWER", "true").lower() == "true"
                ),
            }

            # Process model data using new format (data + format)
            model_info = process_model_data(response_data)
            if model_info:
                # Add the model information to the configuration
                config["model"] = model_info

            return jsonify(config)
        else:
            # Fallback to default if backend request fails
            config = {
                "design_types": DEFAULT_DESIGN_TYPES,
                "welcome_message": "Welcome to Morfis - AI CAD Agent",
                "advanced_viewer": (
                    os.environ.get("ADVANCED_VIEWER", "true").lower() == "true"
                ),
            }
            return jsonify(config)
    except Exception as e:
        logging.error(f"Error fetching app configuration: {str(e)}")
        # Return default design types as fallback
        return jsonify(
            {
                "design_types": DEFAULT_DESIGN_TYPES,
                "welcome_message": "Welcome to Morfis - AI CAD Agent",
                "advanced_viewer": (
                    os.environ.get("ADVANCED_VIEWER", "true").lower() == "true"
                ),
            }
        )


# Route removed - trajectory is now handled via the API endpoint and modal UI


@app.route("/api/trajectory-html")
def get_trajectory_html():
    """Return trajectory data as HTML for direct embedding."""
    try:
        # Try to get trajectory data from the backend
        backend_data = None
        try:
            response = make_backend_request("trajectory")
            if response.ok:
                # Backend directly returns HTML content
                response_data = response.json()
                return response_data.get("html_content")
        except Exception as e:
            logging.warning(f"Error fetching from backend: {str(e)}")

        # Fallback: Use local trajectory data if backend fails
        if current_trajectory["messages"]:
            return generate_trajectory_html(current_trajectory)

        # If no data is available
        return "<div class='no-data'>No trajectory data available yet.</div>"

    except Exception as e:
        logging.error(f"Error generating trajectory HTML: {str(e)}")
        return "<div class='error-message'><i class='fas fa-exclamation-circle'></i><p>Error generating trajectory view</p></div>"


def generate_trajectory_html(trajectory_data):
    """Generate HTML for the trajectory view from JSON data."""
    html = "<div class='trajectory-container'>"
    html += "<div class='trajectory-header'>"
    html += "<h2>Design Trajectory</h2>"
    html += "<p class='subtitle'>Evolution of your design over time</p>"
    html += "</div>"

    # Check if we have trajectory data
    if trajectory_data.get("error"):
        html += f"<div class='error-message'><i class='fas fa-exclamation-circle'></i><p>{trajectory_data['error']}</p></div>"
    elif "messages" in trajectory_data:
        # If we have messages, display them as message boxes
        messages = trajectory_data.get("messages", [])
        html += "<div class='message-list'>"

        for idx, message in enumerate(messages):
            # Determine message type (system, user, etc.)
            msg_type = message.get("type", "system")
            msg_content = message.get("content", "")
            msg_time = message.get("timestamp", "")

            html += f"<div class='message-box {msg_type}-message'>"
            html += f"<div class='message-header'><span class='message-type'>{msg_type.capitalize()}</span>"
            if msg_time:
                html += f"<span class='message-time'>{msg_time}</span>"
            html += "</div>"

            # Make the content collapsible
            html += (
                f"<div class='message-content content-collapsed'>{msg_content}</div>"
            )
            html += "</div>"

        html += "</div>"
    else:
        # Fallback for other data structures
        html += "<div class='no-data'>No trajectory data available yet.</div>"

    html += "</div>"
    return html


@app.route("/api/trajectory")
def get_trajectory():
    """Return trajectory data as JSON."""
    try:
        # Try to get trajectory data from the backend
        url = f"{backend_url}/trajectory"

        try:
            response = make_backend_request("trajectory")
            if response.ok:
                return response.json()
        except Exception as e:
            logging.warning(f"Error fetching from backend: {str(e)}")

        # Fallback: Use local trajectory data if backend connection fails
        if current_trajectory["messages"]:
            return jsonify(current_trajectory)

        # If no data is available
        return jsonify({"messages": []})

    except Exception as e:
        logging.error(f"Error preparing trajectory data: {str(e)}")
        return jsonify({"error": f"Error preparing trajectory data: {str(e)}"})


@app.route("/save_design", methods=["POST"])
def save_design():
    try:
        design_name = request.json.get("name", "")
        if not design_name:
            return (
                jsonify({"status": "error", "message": "Design name is required"}),
                400,
            )

        # Send design name to backend
        try:
            response = make_backend_request(
                "save_design",
                "POST",
                {
                    "prompt": design_name,
                },
            )

            if response.ok:
                logging.info(f"Design saved to backend: {design_name}")
                return jsonify(
                    {
                        "status": "success",
                        "message": f'Design "{design_name}" saved successfully',
                    }
                )
            else:
                error_message = f"Backend returned error: {response.status_code}"
                if response.text:
                    try:
                        error_data = response.json()
                        if "message" in error_data:
                            error_message = error_data["message"]
                    except:
                        error_message = response.text[
                            :100
                        ]  # Truncate long error messages

                logging.error(
                    f"Error saving design to backend: {error_message}")
                return (
                    jsonify(
                        {
                            "status": "error",
                            "message": f"Failed to save design: {error_message}",
                        }
                    ),
                    response.status_code,
                )

        except Exception as e:
            logging.error(f"Error connecting to backend: {str(e)}")
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Failed to connect to backend: {str(e)}",
                    }
                ),
                500,
            )

    except Exception as e:
        logging.error(f"Error processing save design request: {str(e)}")
        return (
            jsonify(
                {"status": "error", "message": f"Failed to save design: {str(e)}"}),
            500,
        )


@app.route("/api/waitlist", methods=["POST"])
def submit_waitlist():
    """Handle waitlist submission by forwarding to backend."""
    print("Waitlist submission received!")
    try:

        data = request.json
        print(f"Waitlist data: {data}")
        # Validate required fields
        required_fields = ["firstName", "lastName", "email", "consent"]
        for field in required_fields:
            if field not in data or not data[field]:
                return (
                    jsonify(
                        {
                            "success": False,
                            "message": f"Missing required field: {field}",
                        }
                    ),
                    400,
                )

        # Validate consent
        if not data["consent"]:
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "You must consent to the data collection",
                    }
                ),
                400,
            )

        # Forward the data to backend
        print(f"Sending waitlist data to backend with session")
        try:
            response = make_backend_request("waitlist", "POST", data)

            if response.ok:
                return (
                    jsonify(
                        {
                            "success": True,
                            "message": "Thank you for joining our waitlist!",
                        }
                    ),
                    201,
                )
            else:
                error_message = "Failed to add to waitlist"
                if response.text:
                    try:
                        error_data = response.json()
                        if "message" in error_data:
                            error_message = error_data["message"]
                    except:
                        error_message = response.text[:100]

                return (
                    jsonify({"success": False, "message": error_message}),
                    response.status_code,
                )
        except Exception as e:
            logging.error(f"Error connecting to backend: {str(e)}")
            return (
                jsonify(
                    {
                        "success": False,
                        "message": "Connection error. Please try again later.",
                    }
                ),
                500,
            )
    except Exception as e:
        logging.error(f"Waitlist submission error: {str(e)}")
        return (
            jsonify({"success": False, "message": "An unexpected error occurred"}),
            500,
        )


@app.route("/rollback", methods=["POST"])
def rollback():
    try:
        message_index = request.json.get("message_index")
        print(message_index)
        response = make_backend_request(
            "rollback", "POST", {"prompt": str(message_index)}
        )
        response_data = response.json()

        # Get the response message if available
        response_message = response_data.get(
            "response", "Rolled back to previous state"
        )

        # Create basic response with at least a status and message
        result = {"status": "success", "message": response_message}

        # Process model data using new format (data + format)
        model_info = process_model_data(response_data)

        if model_info:
            # Add model information to the response
            result["model"] = model_info
        else:
            # No model data, but this is not an error - just add a note to the result
            logging.info(
                "No model data in rollback response - will reset 3D view")
            result["reset_viewer"] = True

        return jsonify(result)
    except Exception as e:
        logging.error(f"Error processing rollback: {str(e)}")
        return jsonify({"error": "Failed to process rollback"}), 500


@app.route("/api/sessions", methods=["GET"])
def get_session_stats():
    """Return session statistics and current session info."""
    try:
        from datetime import timedelta

        from models import UserSession

        # Get current session details
        current_session_id = get_session_id()
        tab_id = request.headers.get("X-Tab-ID")

        # Get total active sessions
        try:
            active_sessions = UserSession.query.filter_by(
                is_active=True).count()
        except:
            active_sessions = 0

        # Get recent sessions (last 24 hours)
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=24)
            recent_sessions = UserSession.query.filter(
                UserSession.last_activity >= cutoff_time
            ).count()
        except:
            recent_sessions = 0

        return jsonify(
            {
                "current_session_id": current_session_id[:8]
                + "...",  # Partial ID for privacy
                "tab_id": tab_id,
                "session_type": "tab-specific" if tab_id else "browser-wide",
                "active_sessions": active_sessions,
                "recent_sessions": recent_sessions,
                "message": f"Session management working - {'tab-specific' if tab_id else 'browser-wide'} session active",
            }
        )
    except Exception as e:
        logging.error(f"Error getting session stats: {str(e)}")
        return jsonify({"error": "Failed to get session statistics"}), 500


@app.route("/api/feedback", methods=["POST"])
def submit_feedback():
    """Handle feedback submission for AI responses."""
    try:
        data = request.json

        # Validate required fields
        message_index = data.get("message_index")
        # "thumbs_up" or "thumbs_down"
        feedback_type = data.get("feedback_type")

        if message_index is None:
            return (
                jsonify(
                    {"status": "error", "message": "Message index is required"}),
                400,
            )

        if feedback_type not in ["thumbs_up", "thumbs_down"]:
            return jsonify({"status": "error", "message": "Invalid feedback type"}), 400

        # Send feedback to backend
        try:
            response = make_backend_request(
                "feedback",
                "POST",
                {
                    "message_index": message_index,
                    "feedback_type": feedback_type,
                    "timestamp": datetime.now().isoformat(),
                },
            )

            if response.ok:
                logging.info(
                    f"Feedback submitted: {feedback_type} for message {message_index}"
                )
                return jsonify(
                    {"status": "success", "message": "Feedback submitted successfully"}
                )
            else:
                error_message = f"Backend returned error: {response.status_code}"
                if response.text:
                    try:
                        error_data = response.json()
                        if "message" in error_data:
                            error_message = error_data["message"]
                    except:
                        error_message = response.text[:100]

                logging.error(
                    f"Error submitting feedback to backend: {error_message}")
                return (
                    jsonify(
                        {
                            "status": "error",
                            "message": f"Failed to submit feedback: {error_message}",
                        }
                    ),
                    response.status_code,
                )

        except Exception as e:
            logging.error(
                f"Error connecting to backend for feedback: {str(e)}")
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": f"Failed to connect to backend: {str(e)}",
                    }
                ),
                500,
            )

    except Exception as e:
        logging.error(f"Error processing feedback request: {str(e)}")
        return (
            jsonify(
                {"status": "error",
                    "message": f"Failed to process feedback: {str(e)}"}
            ),
            500,
        )


# Global storage for YACV server processes
yacv_processes = {}


@app.route("/api/test-yacv", methods=["POST"])
def test_yacv():
    """Test YACV integration with sample Build123d code."""
    try:
        logging.info("🧪 Starting YACV integration test...")

        # Simple single object for testing
        sample_code = """
from build123d import *

# Create a simple box
box = Box(50, 50, 50)

# Clear any existing objects first
clear()

# Show the single object
show(box, names=["cadmodel"])

print("Single test box created and displayed in YACV!")
"""

        # Get the global YACV instance
        yacv = get_or_create_yacv()

        # Clear previous objects for clean state
        logging.info(
            f"🧪 Test: Objects before clear: {yacv.shown_object_names()}")
        yacv.clear()
        logging.info(
            f"🧪 Test: Objects after clear: {yacv.shown_object_names()}")

        # Execute the Build123d code in a safe environment
        exec_globals = {
            "__builtins__": __builtins__,
            "show": yacv.show,
            "clear": yacv.clear,
            "remove": yacv.remove,
        }

        # Debug logging
        logging.info(f"YACV instance: {yacv}")
        logging.info(f"YACV show method: {yacv.show}")
        logging.info(
            f"YACV startup_complete: {yacv.startup_complete.is_set()}")

        # Import Build123d into the execution environment
        try:
            import sys
            logging.info(f"Python executable: {sys.executable}")
            logging.info(f"Python path: {sys.path[:3]}")
            exec("from build123d import *", exec_globals)
        except ImportError as e:
            logging.error(f"Failed to import required modules: {e}")
            return jsonify({"success": False, "error": f"Module import failed: {str(e)}. Please ensure build123d is installed."}), 500

        # Execute the sample code
        exec(sample_code, exec_globals)

        # Store the test object for geometry selection API
        if 'box' in exec_globals:
            stored_build123d_objects['cadmodel'] = exec_globals['box']
            logging.info(
                "🎯 Stored test box as 'cadmodel' for geometry selection")

        # Debug: Check what objects are actually in the YACV instance
        shown_objects = yacv.shown_object_names()
        logging.info(f"🧪 Test: Objects after execution: {shown_objects}")
        logging.info(f"🧪 Test: Successfully completed test")

        return jsonify({
            "success": True,
            "message": "Sample Build123d objects created and displayed in YACV",
            "yacv_url": "/yacv/",
            "shown_objects": shown_objects,
            "session_id": get_session_id()
        })

    except Exception as e:
        logging.error(f"Error executing sample Build123d code: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/execute-build123d", methods=["POST"])
def execute_build123d():
    """Execute Build123d code using integrated YACV."""
    try:
        data = request.json
        code = data.get("code", "")

        if not code.strip():
            return jsonify({"success": False, "error": "No code provided"}), 400

        # Get the global YACV instance
        yacv = get_or_create_yacv()

        # Clear previous objects for clean state
        yacv.clear()
        # Also clear our stored objects
        stored_build123d_objects.clear()

        # Custom show function that stores objects for geometry selection mapping
        def store_and_show(*args, **kwargs):
            # Store any build123d objects with their names
            names = kwargs.get('names', [])
            if names:
                for i, obj in enumerate(args):
                    if i < len(names):
                        object_name = names[i]
                        stored_build123d_objects[object_name] = obj
                        logging.info(
                            f"🎯 Stored build123d object '{object_name}' for geometry selection")

            # Call the original show method
            return yacv.show(*args, **kwargs)

        # Execute the Build123d code in a safe environment
        exec_globals = {
            "__builtins__": __builtins__,
            "show": store_and_show,
            "clear": yacv.clear,
            "remove": yacv.remove,
        }

        # Debug logging
        logging.info(f"YACV instance: {yacv}")
        logging.info(f"YACV show method: {yacv.show}")
        logging.info(
            f"YACV startup_complete: {yacv.startup_complete.is_set()}")

        # Import Build123d into the execution environment
        try:
            import sys
            logging.info(f"Python executable: {sys.executable}")
            logging.info(f"Python path: {sys.path[:3]}")
            exec("from build123d import *", exec_globals)
            # CRITICAL: Don't import yacv_custom.show - it overwrites the instance method!
        except ImportError as e:
            logging.error(f"Failed to import required modules: {e}")
            return jsonify({"success": False, "error": f"Module import failed: {str(e)}. Please ensure build123d is installed."}), 500

        # Execute the user's code
        exec(code, exec_globals)

        # Debug: Check what objects are actually in the YACV instance
        shown_objects = yacv.shown_object_names()
        logging.info(f"🎯 Objects after execution: {shown_objects}")
        logging.info(
            f"🎯 YACV objects dict keys: {list(yacv.objects.keys()) if hasattr(yacv, 'objects') else 'No objects attr'}")

        # Try to get the first object's GLTF data to verify it exists
        if shown_objects:
            try:
                gltf_data = yacv.export(shown_objects[0])
                logging.info(
                    f"🎯 GLTF export successful: {len(gltf_data)} bytes")
            except Exception as e:
                logging.error(f"🎯 GLTF export failed: {e}")

        return jsonify({
            "success": True,
            "message": "Build123d code executed successfully",
            "yacv_url": "/yacv/",
            "shown_objects": shown_objects,
            "session_id": get_session_id()
        })

    except Exception as e:
        logging.error(f"Error executing Build123d code: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/stop-yacv/<session_id>", methods=["POST"])
def stop_yacv_server(session_id):
    """Stop YACV server for a specific session."""
    try:
        if session_id in yacv_processes:
            process = yacv_processes[session_id]
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
            del yacv_processes[session_id]

            return jsonify({"success": True, "message": "YACV server stopped"})
        else:
            return jsonify({"success": False, "error": "No server found for session"}), 404

    except Exception as e:
        logging.error(f"Error stopping YACV server: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500


# =============================================================================
# INTEGRATED YACV ROUTES (Direct Integration)
# =============================================================================

# Global YACV instance for the entire Flask app
global_yacv_instance = None


def get_or_create_yacv():
    """Get or create the global YACV instance (without starting its own server)"""
    global global_yacv_instance
    if global_yacv_instance is None:
        # Set up environment for headless OpenGL (required for Build123d)
        import os
        os.environ['DISPLAY'] = ':99'
        os.environ['LIBGL_ALWAYS_INDIRECT'] = '1'
        os.environ['LIBGL_ALWAYS_SOFTWARE'] = '1'

        # Configure YACV to use Flask server instead of its own server
        os.environ['YACV_HOST'] = 'localhost'
        os.environ['YACV_PORT'] = '5000'  # Use Flask port instead of 32323

        # Create YACV instance without starting its own server
        from yacv_custom.yacv import YACV
        global_yacv_instance = YACV()

        # Manually set the startup_complete event so YACV thinks it's ready
        global_yacv_instance.startup_complete.set()

        # Bind the yacv_custom global instance to this integrated instance so any
        # 'from yacv_custom import show' in executed code uses the same backend instance
        try:
            import yacv_custom as yacv_custom_module
            yacv_custom_module._yacv_instance = global_yacv_instance
            logging.info(
                "Bound yacv_custom global instance to integrated YACV")
        except Exception as e:
            logging.warning(f"Unable to bind yacv_custom global instance: {e}")

        # NOTE: We do NOT call yacv_instance.start() because we handle HTTP through Flask
        logging.info(
            "Created global YACV instance for direct integration (no separate server)")
    return global_yacv_instance


@app.route("/yacv/frontend/<path:filename>")
def yacv_frontend(filename):
    """Serve YACV frontend files directly from Flask"""
    import os

    from flask import make_response, send_from_directory
    yacv_frontend_path = os.path.join(
        os.path.dirname(__file__), "yacv_custom", "frontend")
    response = make_response(send_from_directory(yacv_frontend_path, filename))
    # Force no caching
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


@app.route("/yacv/assets/<path:filename>")
def yacv_assets(filename):
    """Serve YACV assets directly from Flask"""
    import os

    from flask import send_from_directory
    yacv_assets_path = os.path.join(
        os.path.dirname(__file__), "yacv_custom", "assets")
    return send_from_directory(yacv_assets_path, filename)


@app.route("/yacv/")
def yacv_root():
    """Serve YACV main page with API handling for YACV frontend"""
    # If YACV frontend requests SSE via /yacv/?api_updates=true, serve it
    api_updates = request.args.get('api_updates')
    if api_updates in ['t', 'true']:
        return yacv_api_updates()

    # If YACV frontend requests a specific object via /yacv/?api_object=<name>, serve GLB
    api_object = request.args.get('api_object')
    if api_object:
        return yacv_api_object(api_object)

    # Check for malformed dev+ URLs that YACV frontend might be generating
    if 'dev+' in request.url:
        logging.warning(f"🔧 YACV frontend using malformed URL: {request.url}")
        # This is likely a configuration issue in the YACV frontend
        # Return SSE or object data depending on what's being requested
        if 'api_updates' in request.args:
            return yacv_api_updates()
        api_object = request.args.get('api_object')
        if api_object:
            return yacv_api_object(api_object)
        # Otherwise redirect to clean YACV root
        return redirect('/yacv/')

    # Otherwise serve the YACV frontend
    return yacv_index_specific()


# Add missing YACV API routes that the frontend expects
@app.route("/yacv/api/object/<object_name>")
def yacv_api_object_route(object_name):
    """YACV API endpoint that frontend expects for object data"""
    return yacv_api_object(object_name)


@app.route("/yacv/api/updates")
def yacv_api_updates_route():
    """YACV API updates endpoint that frontend expects"""
    return yacv_api_updates()


@app.route("/api/yacv/updates")
def yacv_api_updates():
    """YACV API updates endpoint (Server-Sent Events)"""
    import json

    from flask import Response

    def generate_updates():
        yacv = get_or_create_yacv()

        # Debug: Log initial state
        logging.info(
            f"🎯 SSE: Starting updates stream. Current objects: {yacv.shown_object_names()}")

        # Set up SSE headers
        yield "data: \n\n"  # Initial connection
        yield "retry: 100\n\n"

        # Send existing objects to new clients
        existing_events = yacv.show_events.buffer()
        for event in existing_events:
            if not event.is_remove:  # Only send non-removed objects
                logging.info(f"🎯 SSE: Sending existing event: {event}")
                event_json = event.to_json()
                yield f"data: {event_json}\n\n"

        # Subscribe to YACV events for future updates
        subscription = yacv.show_events.subscribe(yield_timeout=1.0)
        try:
            for data in subscription:
                if data is None:
                    yield ":keep-alive\n\n"
                else:
                    # Debug: Log the event being sent
                    logging.info(f"🎯 SSE: Sending event: {data}")
                    # Send the event data
                    event_json = data.to_json()
                    yield f"data: {event_json}\n\n"
        except GeneratorExit:
            # Generator is being closed by the client; subscription auto-unsubscribes in finally
            pass
        except Exception as e:
            logging.info(f"SSE client disconnected: {e}")

    return Response(generate_updates(), mimetype='text/event-stream',
                    headers={'Cache-Control': 'no-cache'})


@app.route("/yacv/api/object/<object_name>")
@app.route("/api/yacv/objects/<object_name>")
def yacv_api_object(object_name):
    """YACV API endpoint to get object GLTF data"""
    from flask import make_response
    yacv = get_or_create_yacv()

    # Debug: Log what's being requested vs what's available
    available_objects = yacv.shown_object_names()
    logging.info(
        f"🎯 YACV API: Requested object '{object_name}', available: {available_objects}")

    # Export the object
    export_result = yacv.export(object_name)
    if export_result is None:
        logging.error(f"🎯 YACV API: Object '{object_name}' not found!")
        return "Object not found", 404

    glb_data, obj_hash = export_result

    response = make_response(glb_data)
    response.headers['Content-Type'] = 'model/gltf-binary'
    response.headers['Content-Length'] = str(len(glb_data))
    response.headers['Content-Disposition'] = f'attachment; filename="{object_name}.glb"'
    response.headers['E-Tag'] = f'"{obj_hash}"'
    return response


@app.route("/api/yacv/show", methods=["POST"])
def yacv_api_show():
    """API endpoint to show objects in YACV (alternative to subprocess)"""
    try:
        data = request.json
        code = data.get("code", "")

        if not code.strip():
            return jsonify({"success": False, "error": "No code provided"}), 400

        # Get the global YACV instance
        yacv = get_or_create_yacv()

        # Execute the Build123d code in a safe environment
        exec_globals = {
            "__builtins__": __builtins__,
            "show": yacv.show,
            "clear": yacv.clear,
            "remove": yacv.remove,
        }

        # Import Build123d and yacv_custom into the execution environment
        try:
            import sys
            logging.info(f"Python executable: {sys.executable}")
            logging.info(f"Python path: {sys.path[:3]}")
            exec("from build123d import *", exec_globals)
            exec("from yacv_custom import show, clear, remove", exec_globals)
        except ImportError as e:
            logging.error(f"Failed to import required modules: {e}")
            return jsonify({"success": False, "error": f"Module import failed: {str(e)}. Please ensure build123d is installed."}), 500

        # Execute the user's code
        exec(code, exec_globals)

        return jsonify({
            "success": True,
            "message": "Build123d code executed successfully",
            "yacv_url": "/yacv/",
            "shown_objects": yacv.shown_object_names()
        })

    except Exception as e:
        logging.error(f"Error executing Build123d code: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# YACV frontend API compatibility route
@app.route("/yacv/objects/<object_name>")
def yacv_frontend_api_object(object_name):
    """YACV API endpoint for frontend to get object GLTF data"""
    return yacv_api_object(object_name)

# Catch-all route for YACV static files (must be after specific routes)


@app.route("/yacv/index.html")
def yacv_index_specific():
    """Serve YACV index.html with dynamic content and cache-busting"""
    import os
    import time

    from flask import make_response, request

    # Check if this is an API updates request (handle both 't' and 'true')
    api_updates = request.args.get('api_updates')
    if api_updates in ['t', 'true']:
        return yacv_api_updates()

    # Generate fresh HTML with current timestamp
    timestamp = int(time.time())

    # Serve the actual built index.html from dist directory
    from flask import send_from_directory
    yacv_dist_path = os.path.join(
        os.path.dirname(__file__), "yacv_custom", "dist")
    return send_from_directory(yacv_dist_path, "index.html")


@app.route("/dev+http://localhost:5000")
@app.route("/dev+http://localhost:5000/")
def handle_malformed_yacv_url():
    """Handle malformed URLs generated by YACV frontend"""
    logging.warning(
        "🔧 Caught malformed YACV URL, redirecting to proper endpoint")
    # Check what the frontend is actually trying to do
    if 'api_updates' in request.args or request.args.get('api_updates'):
        return yacv_api_updates()
    api_object = request.args.get('api_object')
    if api_object:
        return yacv_api_object(api_object)
    # Default to YACV root
    return redirect('/yacv/')


# Global dictionary to store build123d objects for geometry selection mapping
stored_build123d_objects = {}


@app.route("/api/geometry-selection", methods=["POST"])
def handle_geometry_selection():
    """Handle geometry selection data from frontend and map to build123d objects."""
    logging.info("🔧 Function handle_geometry_selection called")
    try:
        data = request.json
        logging.info(f"🎯 Received geometry selection: {data}")

        action = data.get("action")
        object_name = data.get("objectName", "").replace("?api_object=", "")
        # "face", "edge", or "vertex"
        selection_type = data.get("selectionType")
        geometry_index = data.get("geometryIndex")

        logging.info(
            f"🔍 Parsed data: action={action}, object_name='{object_name}', selection_type={selection_type}, geometry_index={geometry_index}")
        logging.info(
            f"🔍 Available objects: {list(stored_build123d_objects.keys())}")

        # Skip deselect actions - we only care about selections
        if action == "deselect":
            return jsonify({
                "success": True,
                "message": "Deselect action ignored"
            })

        if not object_name or selection_type is None or geometry_index is None:
            return jsonify({
                "success": False,
                "error": f"Missing required fields: objectName='{object_name}', selectionType='{selection_type}', geometryIndex='{geometry_index}'"
            }), 400

        # Find the stored build123d object
        if object_name not in stored_build123d_objects:
            return jsonify({
                "success": False,
                "error": f"Object '{object_name}' not found in stored objects. Available: {list(stored_build123d_objects.keys())}"
            }), 404

        build123d_obj = stored_build123d_objects[object_name]

        # Map the selection to the actual build123d geometry
        try:
            if selection_type == "face":
                if hasattr(build123d_obj, 'faces'):
                    faces_list = build123d_obj.faces()
                    if 0 <= geometry_index < len(faces_list):
                        selected_face = faces_list[geometry_index]
                        return jsonify({
                            "success": True,
                            "selection_type": "face",
                            "geometry_index": geometry_index,
                            "object_name": object_name,
                            "properties": {
                                "area": float(selected_face.area),
                                "center": {
                                    "x": float(selected_face.center().X),
                                    "y": float(selected_face.center().Y),
                                    "z": float(selected_face.center().Z)
                                },
                                "normal": {
                                    "x": float(selected_face.normal_at().X),
                                    "y": float(selected_face.normal_at().Y),
                                    "z": float(selected_face.normal_at().Z)
                                }
                            }
                        })

            elif selection_type == "edge":
                if hasattr(build123d_obj, 'edges'):
                    edges_list = build123d_obj.edges()
                    if 0 <= geometry_index < len(edges_list):
                        selected_edge = edges_list[geometry_index]
                        return jsonify({
                            "success": True,
                            "selection_type": "edge",
                            "geometry_index": geometry_index,
                            "object_name": object_name,
                            "properties": {
                                "length": float(selected_edge.length),
                                "start_point": {
                                    "x": float(selected_edge.start_point().X),
                                    "y": float(selected_edge.start_point().Y),
                                    "z": float(selected_edge.start_point().Z)
                                },
                                "end_point": {
                                    "x": float(selected_edge.end_point().X),
                                    "y": float(selected_edge.end_point().Y),
                                    "z": float(selected_edge.end_point().Z)
                                }
                            }
                        })

            elif selection_type == "vertex":
                if hasattr(build123d_obj, 'vertices'):
                    vertices_list = build123d_obj.vertices()
                    if 0 <= geometry_index < len(vertices_list):
                        selected_vertex = vertices_list[geometry_index]
                        return jsonify({
                            "success": True,
                            "selection_type": "vertex",
                            "geometry_index": geometry_index,
                            "object_name": object_name,
                            "properties": {
                                "position": {
                                    "x": float(selected_vertex.X),
                                    "y": float(selected_vertex.Y),
                                    "z": float(selected_vertex.Z)
                                }
                            }
                        })

            return jsonify({
                "success": False,
                "error": f"Invalid geometry index {geometry_index} for {selection_type}"
            }), 400

        except Exception as e:
            return jsonify({
                "success": False,
                "error": f"Error accessing build123d geometry: {str(e)}"
            }), 500

    except Exception as e:
        logging.error(f"Error handling geometry selection: {str(e)}")
        import traceback
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"success": False, "error": str(e)}), 500

    logging.error(
        "🚨 Function reached end without return - this should never happen!")
    return jsonify({"success": False, "error": "Function completed without proper return"}), 500


@app.route("/yacv/<path:filename>")
def yacv_static_files(filename):
    """Serve YACV static files (JS, CSS, etc.) with hash-based names"""
    import os

    from flask import make_response, send_from_directory

    # Skip objects API to avoid conflicts
    if filename.startswith('objects/'):
        return "Not found", 404

    # Only serve actual files that have extensions
    if '.' not in filename:
        return "Not found", 404

    yacv_dist_path = os.path.join(
        os.path.dirname(__file__), "yacv_custom", "dist")

    try:
        response = make_response(
            send_from_directory(yacv_dist_path, filename))
        # Allow normal caching for static files to prevent multiple loads
        response.headers['Cache-Control'] = 'public, max-age=300'  # 5 minutes
        # Add ETag based on filename for reasonable caching
        import time
        response.headers['ETag'] = f'"{filename}"'
        return response
    except:
        return "File not found", 404


if __name__ == "__main__":
    # Try to create database tables, but don't fail if DB is unavailable
    try:
        with app.app_context():
            db.create_all()
            logging.info("Database tables created successfully")
    except Exception as e:
        logging.warning(
            f"Database not available, continuing without it: {str(e)}")

    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
