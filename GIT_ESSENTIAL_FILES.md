# Essential Files for Git - Morfis Project

## 🎯 CORE APPLICATION FILES (MUST TRACK)
```
app.py                          # Main Flask application (96K) ⭐
wsgi.py                         # WSGI production config
requirements.txt                # Python dependencies  
runtime.txt                     # Python version
pyproject.toml                  # Python project config
```

## 🌐 FRONTEND FILES (MUST TRACK)
```
templates/
├── index.html                  # Main UI template ⭐
├── step_viewer.html           
└── trajectory.html            

static/
├── css/                       # Your custom styles
├── js/
│   ├── main.js                # Main frontend logic ⭐
│   └── yacv_build123d_viewer.js # YACV integration ⭐
└── models/                    # Any static model files
```

## 🔧 YACV CUSTOMIZATION (MINIMAL TRACKING)
```
yacv_custom/
├── src/                       # Source code modifications ⭐
│   ├── App.vue                # Main YACV app (hidden Models panel)
│   ├── misc/settings.ts       # Settings (light background, cadmodel preload)
│   ├── viewer/ModelViewerWrapper.vue # Viewer (zoom fixes)
│   └── tools/Selection.vue    # Selection logging
├── package.json               # Dependencies ⭐
├── tsconfig.json              # TypeScript config
├── vite.config.ts             # Build config
└── index.html                 # Entry point
```

## 📦 DEPLOYMENT & CONFIG
```
Dockerfile                     # Docker setup
docker-compose.yml            # Docker compose
docker-compose.prod.yml       # Production compose
nginx.conf                    # Nginx config
Procfile                      # Heroku config
run_prod.sh / run_dev.sh      # Run scripts
```

## 📚 DOCUMENTATION
```
README.md                     # Project documentation
LOCAL_DEBUG.md               # Development notes
```

## ❌ DO NOT TRACK (COVERED BY .gitignore)
```
yacv_source_full/             # 1.2GB - Original YACV source
yacv_custom/node_modules/     # 1GB+ - NPM dependencies  
yacv_custom/dist/             # Built frontend files
yacv_custom/frontend/         # Copied build files
__pycache__/                  # Python cache
flask_logs.txt                # Log files
*.pem, keys/                  # Certificates
*cookies*.txt                 # Session files
instance/                     # Flask instance data
```

## 📊 TOTAL SIZE TO TRACK: ~10-15MB instead of 2.7GB!
