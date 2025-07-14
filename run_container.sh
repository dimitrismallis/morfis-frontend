#!/bin/bash

# Morfis Frontend Container Runner
# This script helps you run the Morfis website as a container

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to setup environment for production
setup_env() {
    if [ ! -f .env ]; then
        print_info "Creating .env file from env.example..."
        cp env.example .env
        print_warning "Please edit .env file with your actual values before running production mode"
        print_info "Generated .env file with default values"
    else
        print_info ".env file already exists"
    fi
}

# Function to run development container
run_dev() {
    print_info "Starting Morfis Frontend in DEVELOPMENT mode..."
    print_info "This includes:"
    print_info "  • Flask web application (container name: morfisfrontend)"
    print_info "  • PostgreSQL database (container name: morfisfrontend-db)"
    print_info "  • Default development settings"
    
    echo
    print_info "Building and starting containers..."
    docker compose up --build
}

# Function to run development container in background
run_dev_background() {
    print_info "Starting Morfis Frontend in DEVELOPMENT mode (background)..."
    print_info "This includes:"
    print_info "  • Flask web application (container name: morfisfrontend)"
    print_info "  • PostgreSQL database (container name: morfisfrontend-db)"
    print_info "  • Default development settings"
    print_info "  • Running in detached mode"
    
    echo
    print_info "Building and starting containers in background..."
    docker compose up --build -d
    
    echo
    print_success "Containers started in background!"
    print_info "Web application (local):  http://localhost:5001"
    print_info "Web application (remote): http://10.186.4.16:5001"
    print_info "Container name: morfisfrontend"
    print_info "Use './run_container.sh logs' to view logs"
    print_info "Use './run_container.sh stop' to stop containers"
}

# Function to run production container
run_prod() {
    print_info "Starting Morfis Frontend in PRODUCTION mode..."
    setup_env
    
    print_info "This includes:"
    print_info "  • Flask web application"
    print_info "  • PostgreSQL database with custom settings"
    print_info "  • Nginx reverse proxy"
    print_info "  • Health checks and resource limits"
    
    echo
    print_info "Building and starting containers..."
    docker compose -f docker-compose.prod.yml up --build
}

# Function to stop containers
stop_containers() {
    print_info "Stopping all containers..."
    
    # Stop development containers
    if docker compose ps -q > /dev/null 2>&1; then
        docker compose down
        print_success "Development containers stopped"
    fi
    
    # Stop production containers
    if docker compose -f docker-compose.prod.yml ps -q > /dev/null 2>&1; then
        docker compose -f docker-compose.prod.yml down
        print_success "Production containers stopped"
    fi
}

# Function to clean up containers and volumes
cleanup() {
    print_warning "This will remove all containers, networks, and volumes"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cleaning up..."
        docker compose down -v --remove-orphans
        docker compose -f docker-compose.prod.yml down -v --remove-orphans
        print_success "Cleanup completed"
    else
        print_info "Cleanup cancelled"
    fi
}

# Function to show logs
show_logs() {
    print_info "Showing container logs..."
    if docker compose ps -q > /dev/null 2>&1; then
        docker compose logs -f
    elif docker compose -f docker-compose.prod.yml ps -q > /dev/null 2>&1; then
        docker compose -f docker-compose.prod.yml logs -f
    else
        print_error "No running containers found"
    fi
}

# Function to show help
show_help() {
    echo "Morfis Frontend Container Runner"
    echo
    echo "Usage: $0 [COMMAND]"
    echo
    echo "Commands:"
    echo "  dev       Start in development mode (default)"
    echo "  bg        Start in development mode (background/detached)"
    echo "  prod      Start in production mode"
    echo "  stop      Stop all containers"
    echo "  cleanup   Remove all containers and volumes"
    echo "  logs      Show container logs"
    echo "  help      Show this help message"
    echo
    echo "Examples:"
    echo "  $0                # Start in development mode"
    echo "  $0 dev            # Start in development mode"
    echo "  $0 bg             # Start in background (container name: morfisfrontend)"
    echo "  $0 prod           # Start in production mode"
    echo "  $0 stop           # Stop all containers"
    echo
    echo "Access URLs:"
    echo "  Development (local):  http://localhost:5001"
    echo "  Development (remote): http://10.186.4.16:5001"
    echo "  Production:           http://localhost:80 (or https://localhost:443)"
}

# Main script logic
main() {
    print_info "Morfis Frontend Container Runner"
    echo
    
    # Check if Docker is running
    check_docker
    
    # Handle command line arguments
    case "${1:-dev}" in
        "dev"|"development")
            run_dev
            ;;
        "bg"|"background"|"detach")
            run_dev_background
            ;;
        "prod"|"production")
            run_prod
            ;;
        "stop")
            stop_containers
            ;;
        "cleanup"|"clean")
            cleanup
            ;;
        "logs"|"log")
            show_logs
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            echo
            show_help
            exit 1
            ;;
    esac
}

# Trap Ctrl+C and cleanup
trap 'echo; print_info "Received interrupt signal. Stopping..."; exit 0' INT

# Run main function
main "$@" 