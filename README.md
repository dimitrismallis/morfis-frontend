# Morfis - AI-Powered CAD Design Platform

A Flask-based web application that integrates **YACV (Yet Another CAD Viewer)** for real-time 3D visualization of `build123d` CAD models. Users can interact with an AI system to generate parametric designs and visualize them instantly in an integrated 3D viewer.

## 🎯 Features

- **🤖 AI-Powered Design**: Natural language to CAD model generation
- **🎨 Real-time 3D Visualization**: Integrated YACV viewer with `build123d` support
- **🔧 Interactive Selection**: Click on faces, edges, and vertices for detailed geometric data
- **⚡ Dynamic Updates**: Live model updates as design parameters change
- **🎮 Multiple Object Types**: Test with boxes, cylinders, spheres
- **🖱️ Advanced 3D Controls**: Zoom, pan, rotate with optimized camera controls

## 🏗️ Architecture

```
Morfis Frontend (Flask/HTML/JS)
    ↓ User Input
AI Backend (Future Integration)
    ↓ build123d Code Generation  
YACV Backend (Python/Flask Integration)
    ↓ 3D Model Processing
YACV Frontend (Vue.js/TypeScript)
    ↓ 3D Visualization
User 3D Interaction
```

## 🛠️ Build Process

### Prerequisites

```bash
# Python 3.11+ with pip
python --version  # Should be 3.11+

# Node.js 18+ with npm  
node --version    # Should be 18+
npm --version
```

### 1. 🐍 Backend Setup (Flask + YACV Backend)

```bash
# Install Python dependencies
pip install -r requirements.txt

# This installs:
# - Flask (web framework)
# - build123d (CAD modeling)
# - All YACV backend dependencies
```

### 2. 🎨 Frontend Setup (YACV 3D Viewer)

The YACV frontend needs to be built from TypeScript/Vue.js source:

```bash
# Navigate to YACV customization directory
cd yacv_custom

# Install Node.js dependencies
npm install

# This creates node_modules/ with:
# - Vue.js, TypeScript, Vite
# - Three.js for 3D rendering
# - Model-viewer for CAD display
# - ~1GB of dependencies (ignored by git)
```

### 3. 🔨 Build YACV Frontend

```bash
# Still in yacv_custom/ directory
npm run build

# This process:
# 1. Compiles TypeScript to JavaScript
# 2. Bundles Vue.js components  
# 3. Optimizes assets with Vite
# 4. Outputs to dist/ directory
# 5. Takes ~1-2 minutes

# Copy built files to Flask static directory
cp -r dist/* frontend/

# Built files include:
# - index.html (main viewer page)
# - *.js bundles (compiled TypeScript/Vue)
# - *.css stylesheets 
# - Assets (fonts, images)
```

### 4. 🚀 Run the Application

```bash
# Return to project root
cd ..

# Start the Flask development server
python app.py

# Or for production:
python run_prod.py
```

The application will be available at:
- **Main Interface**: http://localhost:5000
- **YACV API**: http://localhost:5000/yacv/ (integrated)

## 📁 Project Structure

```
morfis/
├── 📱 BACKEND (Flask)
│   ├── app.py                    # Main Flask application
│   ├── requirements.txt          # Python dependencies
│   ├── runtime.txt              # Python version
│   └── templates/
│       └── index.html           # Main UI template
│
├── 🎨 FRONTEND (Static Assets)  
│   └── static/
│       ├── js/
│       │   ├── main.js          # Main frontend logic
│       │   └── yacv_build123d_viewer.js # YACV integration
│       └── css/                 # Stylesheets
│
├── 🔧 YACV CUSTOMIZATION
│   └── yacv_custom/
│       ├── src/                 # Source code (tracked in git)
│       │   ├── App.vue          # Main YACV app
│       │   ├── misc/settings.ts # Configuration  
│       │   ├── viewer/ModelViewerWrapper.vue # 3D viewer
│       │   └── tools/Selection.vue # Selection system
│       ├── package.json         # Node.js dependencies
│       ├── vite.config.ts       # Build configuration
│       ├── node_modules/        # Dependencies (ignored)
│       ├── dist/               # Build output (ignored)  
│       └── frontend/           # Copied to Flask (ignored)
│
└── 📚 DOCUMENTATION
    ├── README.md               # This file
    ├── GIT_ESSENTIAL_FILES.md  # Git tracking guide
    └── .gitignore             # Files to ignore
```

## 🔄 Development Workflow

### Making Changes to YACV Frontend

1. **Edit Source Files** (these are tracked in git):
   ```bash
   # Customize YACV behavior
   vim yacv_custom/src/App.vue
   vim yacv_custom/src/misc/settings.ts
   vim yacv_custom/src/tools/Selection.vue
   ```

2. **Rebuild and Deploy**:
   ```bash
   cd yacv_custom
   npm run build && cp -r dist/* frontend/
   cd ..
   ```

3. **Test Changes**:
   ```bash
   python app.py
   # Visit http://localhost:5000
   ```

### Making Changes to Backend

1. **Edit Flask Application**:
   ```bash
   vim app.py
   vim static/js/main.js
   ```

2. **Restart Flask**:
   ```bash
   python app.py
   ```

## 🎮 Usage

### Testing 3D Viewer

1. **Load the Application**: http://localhost:5000
2. **Auto-loaded Object**: A test box appears automatically
3. **Try Different Shapes**: Click "Show Box", "Show Cylinder", "Show Sphere"
4. **Interactive Selection**:
   - Click the selection tool (cursor icon)
   - Click on faces, edges, or vertices
   - Check browser console for detailed geometric data

### Keyboard Shortcuts (in 3D viewer)

- `S` - Selection mode (any geometry)
- `F` - Face selection only  
- `E` - Edge selection only
- `V` - Vertex selection only
- `B` - Toggle bounding box
- `D` - Toggle distance measurements

## 🔧 Customizations Made

### YACV Frontend Modifications

1. **Hidden Models Panel**: Removed left sidebar for cleaner UI
2. **Light Gray Background**: Changed from dark to light theme
3. **Fixed Zoom Controls**: Improved zoom in/out functionality
4. **Selection Logging**: Detailed console output for selections
5. **Standardized Naming**: All objects use "cadmodel" name for consistency

### Flask Backend Integration

1. **Integrated YACV Routes**: Direct integration instead of separate server
2. **Build123d Execution**: `/api/execute-build123d` endpoint
3. **Object Management**: Standardized object naming and lifecycle
4. **Authentication**: Proper session management for API endpoints

## 🚀 Deployment

### Development
```bash
python app.py  # Debug mode on localhost:5000
```

### Production  
```bash
python run_prod.py  # Production WSGI server
```

### Docker
```bash
docker-compose up  # Full containerized deployment
```

## 🐛 Troubleshooting

### YACV Build Issues

**Problem**: `npm install` fails
```bash
# Solution: Use legacy peer deps
npm install --legacy-peer-deps
```

**Problem**: TypeScript compilation errors
```bash
# Solution: Force rebuild
cd yacv_custom
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
npm run build
```

### 3D Viewer Issues

**Problem**: Objects not appearing
1. Check browser console for errors
2. Verify object creation: `/api/test-yacv` endpoint
3. Check YACV server status in Flask logs

**Problem**: Selection not working
1. Enable selection mode (click cursor icon)
2. Check browser console for selection events
3. Verify raycasting in 3D viewer

### Build Process Issues

**Problem**: Frontend not updating after changes
```bash
# Solution: Force rebuild and copy
cd yacv_custom
npm run build
cp -r dist/* frontend/
# Restart Flask server
```

## 📊 Performance

- **Initial Build**: ~2-3 minutes (includes npm install)
- **Incremental Build**: ~30-60 seconds (npm run build only)
- **Runtime**: ~50-100MB memory usage
- **3D Rendering**: Hardware-accelerated WebGL

## 🤝 Contributing

1. **Make changes** to source files only (not build artifacts)
2. **Test thoroughly** with the 3D viewer
3. **Rebuild frontend** if YACV customizations changed
4. **Update documentation** if architecture changes

## 📋 Dependencies

### Python (Backend)
- Flask 2.3+
- build123d (CAD modeling)
- OCP (OpenCASCADE bindings)

### Node.js (Frontend Build)
- Vue.js 3.0+ (UI framework)
- TypeScript 5.0+ (Type safety)
- Vite 4.0+ (Build tool)
- Three.js (3D graphics)

## 📞 Support

- **Build Issues**: Check `GIT_ESSENTIAL_FILES.md` for git setup
- **3D Viewer Issues**: Check browser console and Flask logs
- **Performance Issues**: Monitor memory usage and WebGL compatibility

---

**🎯 Ready for AI Backend Integration!** The 3D viewer captures detailed selection data and can dynamically update objects based on `build123d` code generation.