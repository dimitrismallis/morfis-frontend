FROM python:3.12-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    curl \
    git \
    vim \
    nano \
    htop \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
ARG USERNAME=vscode
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Set working directory
WORKDIR /workspace

# Upgrade pip and setuptools first
RUN pip install --upgrade pip setuptools wheel

# Install Python development dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install development tools
RUN pip install --no-cache-dir \
    debugpy \
    pytest \
    pytest-cov \
    black \
    flake8 \
    isort \
    mypy \
    pre-commit

# Create directories for static files
RUN mkdir -p static/cadmodels static/saved_designs static/trajectories

# Set environment variables
ENV FLASK_APP=main.py
ENV FLASK_ENV=development
ENV FLASK_DEBUG=1
ENV PYTHONPATH=/workspace
ENV PYTHONUNBUFFERED=1

# Switch to non-root user
USER $USERNAME

# Expose port
EXPOSE 5000 