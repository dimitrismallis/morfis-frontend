# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies for Build123d and OpenGL (minimal set)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    curl \
    libgl1 \
    libgl1-mesa-dri \
    libglu1-mesa \
    libegl-mesa0 \
    libegl1 \
    mesa-utils \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Install Heroku CLI
RUN curl https://cli-assets.heroku.com/install.sh | sh

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create directories for static files
RUN mkdir -p static/cadmodels static/saved_designs static/trajectories

# Set environment variables
ENV FLASK_APP=main.py
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Set environment variables for headless OpenGL rendering
ENV DISPLAY=:99
ENV LIBGL_ALWAYS_INDIRECT=1
ENV LIBGL_ALWAYS_SOFTWARE=1

# Expose port
EXPOSE 5000

# Create a startup script that starts Xvfb and the application
RUN echo '#!/bin/bash\nXvfb :99 -screen 0 1024x768x24 &\nexec "$@"' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Run the application with Xvfb
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "main:app"] 