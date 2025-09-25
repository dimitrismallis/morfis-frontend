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
        # Block all API endpoints
        if request.endpoint and (
            request.endpoint.startswith(
                "api/") or request.endpoint.startswith("get_")
        ):
            return jsonify({"error": "Authentication required"}), 401

        # Block POST requests that could modify data
        if request.method == "POST" and request.endpoint not in ["login"]:
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
    is_authenticated = session.get("authenticated", False)
    error_message = request.args.get("error", "")
    return render_template(
        "index.html", is_authenticated=is_authenticated, error_message=error_message
    )


@app.route("/step-viewer")
def step_viewer():
    return render_template("step_viewer.html")


@app.route("/yacv-demo")
def yacv_demo():
    return render_template("yacv_demo.html")


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


@app.route("/api/execute-build123d", methods=["POST"])
def execute_build123d():
    """Execute Build123d code using YACV server."""
    try:
        data = request.json
        code = data.get("code", "")

        if not code.strip():
            return jsonify({"success": False, "error": "No code provided"}), 400

        # Get session ID for isolation
        session_id = get_session_id()

        # Create a temporary directory for this session
        temp_dir = tempfile.mkdtemp(prefix=f"yacv_session_{session_id[:8]}_")
        script_path = os.path.join(temp_dir, "build123d_script.py")

        # Copy YACV frontend files to the temp directory
        import shutil
        yacv_frontend_path = "/usr/local/python/current/lib/python3.12/site-packages/yacv_server/frontend"
        frontend_dest = os.path.join(temp_dir, "frontend")

        if os.path.exists(yacv_frontend_path):
            shutil.copytree(yacv_frontend_path, frontend_dest)

            # Add custom CSS to hide everything until model loads, plus hide control buttons
            custom_css = """
/* Hide the model control buttons (faces, edges, vertices) */
.v-expansion-panel-title > .v-btn-toggle {
    display: none !important;
}

/* Adjust spacing since buttons are hidden */
.model-name {
    margin-left: 16px;
}

/* Hide everything until model is loaded - more targeted approach */
body {
    background: white !important;
}

/* Hide the main Vue app container until model loads */
#app {
    opacity: 0 !important;
    transition: opacity 0.3s ease;
}

/* Show when model-loaded class is added */
#app.model-loaded {
    opacity: 1 !important;
}

/* Also ensure main content is hidden */
.v-main {
    visibility: hidden;
}

.v-main.model-loaded {
    visibility: visible;
}
"""

            # Inject CSS into the main HTML file
            index_html_path = os.path.join(frontend_dest, 'index.html')
            if os.path.exists(index_html_path):
                with open(index_html_path, 'r') as f:
                    content = f.read()

                # Add CSS styles and JavaScript in the head section
                css_styles = f'<style>\n{custom_css}\n</style>'

                # Add JavaScript to show content only when model actually loads
                js_script = '''
<script>
// Smart model loading detection
window.addEventListener('load', function() {
    console.log('🎭 YACV: Initializing smart visibility control');
    
    let modelLoaded = false;
    
    // Function to show the content
    function showContent() {
        if (modelLoaded) return; // Prevent multiple calls
        
        const app = document.getElementById('app');
        const mainElements = document.querySelectorAll('.v-main');
        
        if (app) {
            app.classList.add('model-loaded');
            console.log('🎨 YACV: App made visible');
        }
        
        mainElements.forEach(main => {
            main.classList.add('model-loaded');
        });
        
        modelLoaded = true;
        console.log('✅ YACV: Interface revealed after model load');
    }
    
    // Observe for actual 3D content (canvas elements indicate WebGL/3D rendering)
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === 1) { // Element node
                        // Look for canvas (3D rendering) or specific YACV content indicators
                        if (node.tagName === 'CANVAS' || 
                            (node.querySelector && node.querySelector('canvas')) ||
                            (node.classList && (
                                node.classList.contains('threejs-canvas') ||
                                node.classList.contains('viewer-canvas') ||
                                node.classList.contains('model-viewer')
                            ))) {
                            console.log('🎨 YACV: 3D canvas detected, showing interface');
                            showContent();
                            observer.disconnect();
                            return;
                        }
                    }
                }
            }
        });
    });
    
    // Start observing
    if (document.body) {
        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: false 
        });
    }
    
    // Fallback: Show after 3 seconds if no canvas detected (for safety)
    setTimeout(function() {
        if (!modelLoaded) {
            console.log('🕐 YACV: Fallback timeout, showing interface');
            showContent();
        }
    }, 3000);
});
</script>'''

                content = content.replace(
                    '</head>', f'  {css_styles}\n  {js_script}\n</head>')

                with open(index_html_path, 'w') as f:
                    f.write(content)

            logging.info(f"Copied YACV frontend files to {frontend_dest}")

        # Write the Build123d code to a temporary file
        with open(script_path, 'w') as f:
            # Indent the user's code properly
            indented_code = '\n'.join(
                ['    ' + line for line in code.split('\n')])

            # Add necessary imports and YACV server setup
            f.write(f"""#!/usr/bin/env python3
import os
import sys

print("Starting Build123d script...")

# Set up YACV server environment
os.environ['YACV_HOST'] = 'localhost'
os.environ['YACV_PORT'] = '{32323 + hash(session_id) % 1000}'
os.environ['YACV_GRACEFUL_SECS_CONNECT'] = '120'  # Wait longer for frontend connection

try:
    # Import YACV server first
    import yacv_server
    print("YACV server imported successfully")
    
    # Ensure we're in the right directory for frontend files
    import os
    print(f"Current working directory: {{os.getcwd()}}")
    print(f"Frontend files should be at: {{os.path.join(os.getcwd(), 'frontend')}}")
    
    # Create YACV instance explicitly
    yacv_instance = yacv_server.YACV()
    print(f"YACV server instance created on port {{os.environ['YACV_PORT']}}")
    
    # User's Build123d code
{indented_code}

    print("Build123d code executed successfully")
    print("YACV server is running and waiting for frontend connections...")
    print(f"Server URL: http://localhost:{{os.environ['YACV_PORT']}}")
    
    # Keep server alive indefinitely until manual termination
    import time
    while True:
        time.sleep(10)
        print("YACV server still active...")
    
except KeyboardInterrupt:
    print("YACV server stopped by user")
except Exception as e:
    print(f"Error executing Build123d code: {{e}}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
""")

        # Start YACV server in background
        server_port = 32323 + hash(session_id) % 1000
        server_url = f"http://localhost:{server_port}"

        # Kill any existing process for this session
        if session_id in yacv_processes:
            try:
                yacv_processes[session_id].terminate()
                yacv_processes[session_id].wait(timeout=5)
            except:
                pass

        # Create a minimal clean environment for subprocess
        env = {
            'PATH': '/usr/local/python/current/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
            'DISPLAY': ':99',
            'LIBGL_ALWAYS_INDIRECT': '1',
            'LIBGL_ALWAYS_SOFTWARE': '1',
            'YACV_HOST': 'localhost',
            'YACV_PORT': str(32323 + hash(session_id) % 1000),
            # Point to copied frontend
            'FRONTEND_BASE_PATH': os.path.join(temp_dir, "frontend"),
            'PYDEVD_DISABLE_FILE_VALIDATION': '1',
            'PYTHONUNBUFFERED': '1',
            'HOME': '/tmp',
            'PYTHONDONTWRITEBYTECODE': '1'  # Don't create .pyc files
        }

        # Start new process with clean environment
        process = subprocess.Popen([
            '/usr/local/python/current/bin/python3', '-u', script_path
        ], cwd=temp_dir, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, env=env)

        yacv_processes[session_id] = process

        # Wait a moment to see if the script starts successfully
        time.sleep(2)

        # Check if process is still running
        if process.poll() is not None:
            # Process ended, check for errors
            stdout, stderr = process.communicate()
            logging.error(f"Build123d script failed: {stderr}")
            return jsonify({
                "success": False,
                "error": f"Script execution failed: {stderr[:500]}"
            }), 500

        logging.info(
            f"Build123d script started successfully for session {session_id}")

        return jsonify({
            "success": True,
            "server_url": server_url,
            "session_id": session_id,
            "message": "Build123d code executed successfully"
        })

    except Exception as e:
        logging.error(f"Error executing Build123d code: {str(e)}")
        return jsonify({
            "success": False,
            "error": f"Failed to execute Build123d code: {str(e)}"
        }), 500


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
