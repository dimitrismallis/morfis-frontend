# Morfis Frontend

A Flask web application for 3D design generation and visualization.

## Features

- 3D CAD model generation from text prompts
- Interactive 3D viewer
- Design trajectory tracking
- Session management
- PostgreSQL database integration

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd MorfisFrontend
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env with your actual values
   ```

4. **Set up database**
   - Install PostgreSQL
   - Create a database
   - Update `DATABASE_URL` in your `.env` file

5. **Run the application**
   ```bash
   python main.py
   ```

## Docker Deployment

### Quick Start with Docker Compose

1. **Build and run with Docker Compose**
   ```bash
   # Development setup
   docker-compose up --build
   
   # Production setup
   docker-compose -f docker-compose.prod.yml up --build
   ```

2. **Access the application**
   - Web app: http://localhost:5000
   - Database: localhost:5432

### Manual Docker Build

1. **Build the Docker image**
   ```bash
   docker build -t morfis-frontend .
   ```

2. **Run the container**
   ```bash
   docker run -p 5000:5000 \
     -e FLASK_SECRET_KEY=your-secret-key \
     -e DATABASE_URL=postgresql://user:pass@host:5432/db \
     -e BACKEND_URL=https://your-backend-url.com \
     morfis-frontend
   ```

### Production Docker Setup

1. **Create environment file**
   ```bash
   cp env.example .env
   # Edit with production values
   ```

2. **Run production stack**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **With custom domain and SSL**
   - Place SSL certificates in `./ssl/` directory
   - Uncomment HTTPS section in `nginx.conf`
   - Update server_name in nginx configuration

### Docker Environment Variables

- `FLASK_SECRET_KEY`: Secret key for Flask sessions
- `DATABASE_URL`: PostgreSQL connection string
- `BACKEND_URL`: URL of your backend API
- `POSTGRES_DB`: Database name (default: morfis)
- `POSTGRES_USER`: Database user (default: postgres)
- `POSTGRES_PASSWORD`: Database password

## Deployment Options

### Heroku

1. **Install Heroku CLI**
2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

4. **Add PostgreSQL addon**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

5. **Set environment variables**
   ```bash
   heroku config:set FLASK_SECRET_KEY=your-secret-key
   heroku config:set FLASK_ENV=production
   heroku config:set BACKEND_URL=https://your-backend-url.com
   ```

6. **Deploy**
   ```bash
   git push heroku main
   ```

### Railway

1. **Connect your GitHub repository to Railway**
2. **Set environment variables in Railway dashboard**
3. **Deploy automatically**

### Render

1. **Connect your GitHub repository to Render**
2. **Create a new Web Service**
3. **Set build command**: `pip install -r requirements.txt`
4. **Set start command**: `gunicorn main:app`
5. **Set environment variables**

### DigitalOcean App Platform

1. **Connect your GitHub repository**
2. **Choose Python as the environment**
3. **Set build command**: `pip install -r requirements.txt`
4. **Set run command**: `gunicorn main:app`
5. **Configure environment variables**

### Kubernetes Deployment

1. **Create namespace**
   ```bash
   kubectl create namespace morfis
   ```

2. **Apply configurations**
   ```bash
   kubectl apply -f k8s/
   ```

3. **Access the application**
   ```bash
   kubectl port-forward -n morfis svc/morfis-frontend 5000:80
   ```

## Environment Variables

- `FLASK_SECRET_KEY`: Secret key for Flask sessions
- `DATABASE_URL`: PostgreSQL connection string
- `BACKEND_URL`: URL of your backend API
- `FLASK_ENV`: Set to 'production' for production deployment

## File Structure

```
MorfisFrontend/
├── app.py                    # Main Flask application
├── main.py                   # Entry point for local development
├── models.py                 # Database models
├── requirements.txt          # Python dependencies
├── Procfile                  # Heroku deployment configuration
├── runtime.txt               # Python version specification
├── wsgi.py                   # WSGI entry point
├── Dockerfile                # Docker image definition
├── docker-compose.yml        # Development Docker setup
├── docker-compose.prod.yml   # Production Docker setup
├── nginx.conf                # Nginx reverse proxy configuration
├── .dockerignore             # Docker build exclusions
├── static/                   # Static files (CSS, JS, images)
├── templates/                # HTML templates
└── env.example               # Environment variables template
```

## Database Setup

The application uses PostgreSQL. Make sure to:

1. Install PostgreSQL
2. Create a database
3. Set the `DATABASE_URL` environment variable
4. Run database migrations (if any)

## Static Files

The application serves static files from the `static/` directory:
- CSS files in `static/css/`
- JavaScript files in `static/js/`
- Images in `static/images/`
- CAD models in `static/cadmodels/`
- Saved designs in `static/saved_designs/`

## Backend Integration

The application communicates with a backend API for CAD model generation. Update the `BACKEND_URL` environment variable to point to your backend service.

## Docker Commands Reference

```bash
# Build image
docker build -t morfis-frontend .

# Run container
docker run -p 5000:5000 morfis-frontend

# Run with environment variables
docker run -p 5000:5000 \
  -e FLASK_SECRET_KEY=secret \
  -e DATABASE_URL=postgresql://... \
  morfis-frontend

# Run with docker-compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Remove volumes (careful - deletes data)
docker-compose down -v
``` 