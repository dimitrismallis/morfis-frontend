#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting Docker-based Frontend Deployment to AWS..."

# Configuration
REGION="eu-west-1"
DOCKER_IMAGE_NAME="morfis-frontend"
CONTAINER_NAME="morfis-frontend"
NGINX_CONTAINER_NAME="morfis-nginx"

# Auto-detect your single running instance
echo "🔍 Finding your running EC2 instance..."
INSTANCE_ID=$(aws ec2 describe-instances \
    --region $REGION \
    --filters "Name=instance-state-name,Values=running" \
    --query 'Reservations[0].Instances[0].InstanceId' \
    --output text)

if [ "$INSTANCE_ID" = "None" ] || [ "$INSTANCE_ID" = "null" ] || [ -z "$INSTANCE_ID" ]; then
    echo "❌ No running EC2 instance found in region $REGION"
    exit 1
fi

echo "✅ Found running instance: $INSTANCE_ID"

# Get instance details
INSTANCE_IP=$(aws ec2 describe-instances \
    --region $REGION \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

KEY_NAME=$(aws ec2 describe-instances \
    --region $REGION \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].KeyName' \
    --output text)

echo "✅ Instance IP: $INSTANCE_IP"
echo "✅ Key name: $KEY_NAME"

# Check for key file
KEY_FILE="keys/${KEY_NAME}.pem"
if [ ! -f "$KEY_FILE" ]; then
    echo "❌ Key file not found: $KEY_FILE"
    exit 1
fi

echo "✅ Key file found: $KEY_FILE"

# Ensure security group allows HTTP traffic
echo "🔧 Ensuring security group allows HTTP traffic..."
SECURITY_GROUP_ID=$(aws ec2 describe-instances \
    --region $REGION \
    --instance-ids $INSTANCE_ID \
    --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' \
    --output text)

# Add HTTP rule if it doesn't exist
aws ec2 authorize-security-group-ingress \
    --region $REGION \
    --group-id $SECURITY_GROUP_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 2>/dev/null || echo "HTTP rule already exists"

echo "✅ Security group configured for HTTP access"

# Test SSH connection
echo "🔑 Testing SSH connection..."
ssh -i "$KEY_FILE" -o ConnectTimeout=10 -o StrictHostKeyChecking=no ec2-user@$INSTANCE_IP "echo 'SSH connection successful'" || {
    echo "❌ SSH connection failed"
    exit 1
}

# Create deployment commands
DEPLOY_COMMANDS=$(cat << SSH_EOF
#!/bin/bash
set -e

# Set variables for remote deployment
DOCKER_IMAGE_NAME="$DOCKER_IMAGE_NAME"
CONTAINER_NAME="$CONTAINER_NAME"
NGINX_CONTAINER_NAME="$NGINX_CONTAINER_NAME"

echo "🐳 Installing Docker if not present..."

# Install Docker
if ! command -v docker &> /dev/null; then
    sudo yum update -y
    sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -a -G docker ec2-user
    echo "✅ Docker installed and started"
else
    echo "✅ Docker already installed"
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed"
else
    echo "✅ Docker Compose already installed"
fi

# Start Docker if not running
sudo systemctl start docker

echo "📁 Setting up application directory..."
cd /home/ec2-user

# Stop any existing services and clean up
echo "🛑 Stopping any existing services and containers..."

# Stop systemd services that might be using ports
sudo systemctl stop morfis-frontend 2>/dev/null || true
sudo systemctl stop nginx 2>/dev/null || true

# Stop Docker containers
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true
docker stop $NGINX_CONTAINER_NAME 2>/dev/null || true
docker rm $NGINX_CONTAINER_NAME 2>/dev/null || true

# Kill any processes using port 80 and 5000
echo "🔍 Freeing up ports 80 and 5000..."
sudo fuser -k 80/tcp 2>/dev/null || true
sudo fuser -k 5000/tcp 2>/dev/null || true

# Remove existing installation
if [ -d "morfis-frontend" ]; then
    echo "🗑️ Removing existing installation..."
    sudo rm -rf morfis-frontend
fi

echo "📦 Cloning frontend repository..."
git clone https://github.com/dimitrismallis/morfis-frontend.git morfis-frontend
cd morfis-frontend

echo "🔍 Verifying frontend calls correct endpoint..."
grep -n "api/config" static/js/main.js || echo "⚠️ Frontend not calling /api/config"

echo "🔧 Configuring application for ngrok backend..."

# Update app.py to use ngrok backend
sed -i 's|backend_url = os.environ.get("BACKEND_URL", ".*")|backend_url = os.environ.get("BACKEND_URL", "https://morfis.ngrok.app")|' app.py || true

# No endpoint changes needed - app works exactly like on Heroku

echo "🐳 Building Docker image..."
echo "📝 Docker image name: '$DOCKER_IMAGE_NAME'"
echo "📝 Current directory: $(pwd)"

# Validate image name
if [ -z "$DOCKER_IMAGE_NAME" ]; then
    echo "❌ Docker image name is empty!"
    exit 1
fi

# Use modern buildx with explicit arguments
echo "📝 Building with Docker buildx..."
/usr/bin/docker buildx build --tag "$DOCKER_IMAGE_NAME" . || {
    echo "❌ Docker build failed"
    echo "📋 Checking Dockerfile..."
    ls -la Dockerfile
    exit 1
}

echo "🌐 Creating Docker network..."
docker network create morfis-network 2>/dev/null || echo "Network already exists"

echo "🚀 Starting application container..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    --network morfis-network \
    -p 5000:5000 \
    -e BACKEND_URL=https://morfis.ngrok.app \
    $DOCKER_IMAGE_NAME gunicorn --bind 0.0.0.0:5000 --timeout 420 --workers 4 main:app

echo "🌐 Setting up Nginx reverse proxy..."

# Create Nginx configuration
sudo mkdir -p /etc/nginx
sudo tee /etc/nginx/nginx.conf > /dev/null << 'NGINX_EOF'
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    sendfile        on;
    keepalive_timeout  65;
    client_max_body_size 100M;
    
    # Timeouts for long AI generation requests
    proxy_connect_timeout       360s;
    proxy_send_timeout          360s;
    proxy_read_timeout          360s;
    fastcgi_send_timeout        360s;
    fastcgi_read_timeout        360s;
    
    server {
        listen 80;
        server_name _;
        
        # Main application (frontend)
        location / {
            proxy_pass http://morfis-frontend:5000;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            # Timeouts for long requests
            proxy_connect_timeout       360s;
            proxy_send_timeout          360s;
            proxy_read_timeout          360s;
        }
        
        # Direct backend access (for debugging)
        location /backend/ {
            proxy_pass https://morfis.ngrok.app/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            # Timeouts for long requests
            proxy_connect_timeout       360s;
            proxy_send_timeout          360s;
            proxy_read_timeout          360s;
        }
        
        # Static files optimization
        location /static/ {
            proxy_pass http://morfis-frontend:5000/static/;
            expires 1d;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINX_EOF

# Run Nginx in Docker
docker run -d \
    --name $NGINX_CONTAINER_NAME \
    --restart unless-stopped \
    --network morfis-network \
    -p 80:80 \
    -v /etc/nginx/nginx.conf:/etc/nginx/nginx.conf:ro \
    nginx:alpine

echo "🧪 Testing deployment..."
sleep 5

# Test local endpoints
echo "Testing Flask app..."
curl -f http://localhost:5000/init || echo "⚠️ Flask app test failed"

echo "Testing Nginx proxy..."
curl -f http://localhost/init || echo "⚠️ Nginx proxy test failed"

echo "✅ Docker-based deployment complete!"
echo "🌐 Frontend should be available at: http://$INSTANCE_IP"
echo "📊 Check container status with: docker ps"
echo "📋 View logs with: docker logs $CONTAINER_NAME"

SSH_EOF
)

# Execute deployment on the remote instance
echo "🚀 Executing Docker deployment on $INSTANCE_IP..."
ssh -i "$KEY_FILE" -o StrictHostKeyChecking=no ec2-user@$INSTANCE_IP "$DEPLOY_COMMANDS"

echo ""
echo "🎉 Docker-based deployment completed successfully!"
echo "🌐 Frontend URL: http://$INSTANCE_IP"
echo ""
echo "📊 To check status:"
echo "   ssh -i $KEY_FILE ec2-user@$INSTANCE_IP 'docker ps'"
echo ""
echo "📋 To view logs:"
echo "   ssh -i $KEY_FILE ec2-user@$INSTANCE_IP 'docker logs morfis-frontend'"
echo ""
echo "🔄 To restart:"
echo "   ssh -i $KEY_FILE ec2-user@$INSTANCE_IP 'docker restart morfis-frontend morfis-nginx'"
