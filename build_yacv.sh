#!/bin/bash

# YACV Build and Deploy Script
# This script handles the complete build and deployment process for YACV frontend

set -e  # Exit on any error

echo "🔨 Starting YACV Build and Deploy Process..."
echo "================================================"

# Change to YACV directory
cd /workspace/yacv_custom

echo "📦 Step 1: Installing/updating dependencies..."
npm install --legacy-peer-deps

echo "🏗️  Step 2: Building YACV frontend..."
npm run build

echo "🧹 Step 3: Cleaning old static files..."
# Remove old YACV files from static directory (keep main Flask app files)
cd /workspace
find static/ -name "*.js" -not -path "static/js/*" -delete 2>/dev/null || true
find static/ -name "*.css" -not -path "static/css/*" -delete 2>/dev/null || true
find static/ -name "*.map" -not -path "static/js/*" -delete 2>/dev/null || true
find static/ -name "*.ttf" -delete 2>/dev/null || true
find static/ -name "*.ico" -not -path "static/images/*" -delete 2>/dev/null || true
find static/ -name "*.jpg" -not -path "static/images/*" -delete 2>/dev/null || true
find static/ -name "*.html" -not -path "static/templates/*" -delete 2>/dev/null || true
rm -rf static/pyodide-v0.28.2/ 2>/dev/null || true

echo "📋 Step 4: Copying fresh YACV build files..."
cp -r yacv_custom/dist/* static/

echo "🧪 Step 5: Verifying build..."
# Check if key files exist
if [ -f "static/index.html" ] && [ -f "static/style-"*.css ]; then
    echo "✅ Build files copied successfully"
else
    echo "❌ Build verification failed - files missing"
    exit 1
fi

echo "================================================"
echo "🎉 YACV Build Complete!"
echo ""
echo "📊 Build Summary:"
echo "- YACV source: /workspace/yacv_custom/src/"
echo "- YACV dist:   /workspace/yacv_custom/dist/"
echo "- Static dir:  /workspace/static/"
echo ""
echo "🚀 Next Steps:"
echo "1. Start your Flask app: python3 app.py"
echo "2. Access YACV at: http://localhost:5000/yacv/"
echo "3. Refresh browser (Ctrl+F5 for hard refresh)"
echo ""
echo "💡 To rebuild after changes:"
echo "- Run this script again: ./build_yacv.sh"
