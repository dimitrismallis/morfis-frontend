// Integrated 3D Viewer - Supports both simple Three.js and advanced O3DV viewer
class IntegratedViewer {
    constructor() {
        this.mode = 'simple';
        this.container = null;
        this.initialized = false;

        // Simple viewer variables
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.currentModel = null;
        this.axisHelper = null;
        this.axisScene = null;
        this.axisCamera = null;
        this.axisRenderer = null;

        // Advanced viewer variables
        this.advancedViewer = null;
    }

    async init(container, config = {}) {
        this.container = container;
        // Always use advanced viewer for consistent unlimited rotation across all file types
        this.mode = 'advanced';

        console.log(`🚀 Initializing ${this.mode} viewer (forced for unlimited rotation)...`);

        try {
            await this.initAdvancedViewer();
            this.initialized = true;
            console.log(`✅ ${this.mode} viewer initialized successfully`);
        } catch (error) {
            console.error(`❌ Failed to initialize ${this.mode} viewer:`, error);
            // If advanced fails, show error - don't fall back to simple viewer
            throw error;
        }
    }

    async initSimpleViewer() {
        // Clear container
        this.container.innerHTML = '';

        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf7f7f8);

        // Camera setup
        this.camera = new THREE.PerspectiveCamera(60,
            this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.camera.position.z = 12;

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        // Controls setup - Using OrbitControls with unlimited rotation settings
        // Advanced viewer (O3DV) handles its own rotation for STEP files
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Configure for unlimited rotation - this is the key fix
        this.controls.minPolarAngle = 0; // Allow full vertical rotation  
        this.controls.maxPolarAngle = Math.PI; // Allow 180° vertical (orbit style)
        this.controls.enableRotate = true;
        this.controls.enableZoom = true;
        this.controls.enablePan = true;

        // Remove azimuth constraints for full horizontal rotation
        // Don't set minAzimuthAngle or maxAzimuthAngle for 360° horizontal rotation

        // Smooth rotation behavior
        this.controls.rotateSpeed = 1.0;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;

        // Set target at origin for proper rotation center
        this.controls.target.set(0, 0, 0);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.1);
        this.scene.add(ambientLight);

        const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
        frontLight.position.set(0, 0, 5);
        this.scene.add(frontLight);

        const topLight = new THREE.DirectionalLight(0xffffff, 0.4);
        topLight.position.set(0, 5, 0);
        this.scene.add(topLight);

        const backLight = new THREE.DirectionalLight(0xffffff, 0.3);
        backLight.position.set(0, 0, -5);
        this.scene.add(backLight);

        const sideLight1 = new THREE.DirectionalLight(0xffffff, 0.3);
        sideLight1.position.set(5, 0, 0);
        this.scene.add(sideLight1);

        const sideLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
        sideLight2.position.set(-5, 0, 0);
        this.scene.add(sideLight2);

        // Initialize axis helper for simple viewer
        this.initSimpleAxisHelper();

        // Animation loop
        this.animateSimple();

        // Window resize handler
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    async initAdvancedViewer() {
        // Clear container
        this.container.innerHTML = '';

        // Create the exact same structure as the original step viewer
        const viewerElement = document.createElement('div');
        viewerElement.id = 'viewer';
        viewerElement.style.width = '100%';
        viewerElement.style.height = '100%';
        viewerElement.style.border = 'none';
        viewerElement.style.outline = 'none';
        viewerElement.style.position = 'relative';

        this.container.appendChild(viewerElement);

        // Load O3DV library if not already loaded
        if (typeof OV === 'undefined') {
            await this.loadOnline3DViewer();
        }

        // Get current color or use default
        const currentColor = this.pendingColor || localStorage.getItem('selectedColor') || '#FF4500';
        const hexColor = currentColor.replace('#', '');
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);

        console.log(`🎨 Initializing viewer with color: ${currentColor} (RGB: ${r}, ${g}, ${b})`);

        // Create O3DV viewer with color configuration
        this.viewerConfig = {
            backgroundColor: new OV.RGBAColor(248, 249, 250, 255),
            defaultColor: new OV.RGBColor(r, g, b),
            edgeSettings: new OV.EdgeSettings(
                true,
                new OV.RGBColor(50, 50, 50),
                50
            )
        };

        // Make sure container has proper sizing
        console.log('📏 Container dimensions:', this.container.clientWidth, 'x', this.container.clientHeight);
        console.log('📏 Viewer element dimensions:', viewerElement.clientWidth, 'x', viewerElement.clientHeight);

        // Create viewer with the dedicated viewer element, just like the original
        this.advancedViewer = new OV.EmbeddedViewer(viewerElement, this.viewerConfig);

        console.log('📋 Viewer created with edges enabled by default...');



        // Initialize 3D orientation axis for advanced viewer
        this.initAdvancedAxisHelper();

        // Delay camera tracking initialization to ensure viewer is fully ready
        setTimeout(() => {
            console.log('🧭 Initializing 3D orientation axis...');
            this.trackAdvancedCameraChanges();

            // Force a resize to ensure proper viewer dimensions
            if (this.advancedViewer && typeof this.advancedViewer.Resize === 'function') {
                this.advancedViewer.Resize();
                console.log('🔄 Forced viewer resize after initialization');
            }
        }, 2000);

        // Don't load any default model - wait for backend to send models

        // Window resize handler
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }

    loadOnline3DViewer() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            const cdnUrls = [
                '/static/js/libs/o3dv.min.js',
                'https://unpkg.com/online-3d-viewer@0.16.0/build/engine/o3dv.min.js',
                'https://cdn.jsdelivr.net/npm/online-3d-viewer@0.16.0/build/engine/o3dv.min.js'
            ];

            let urlIndex = 0;

            const tryNextUrl = () => {
                if (urlIndex >= cdnUrls.length) {
                    reject(new Error('All CDN sources failed'));
                    return;
                }

                script.src = cdnUrls[urlIndex];
                console.log(`🔄 Trying CDN ${urlIndex + 1}: ${script.src}`);
                urlIndex++;
            };

            script.onload = () => {
                console.log('✅ Online3DViewer library loaded successfully');
                setTimeout(() => {
                    if (typeof OV !== 'undefined') {
                        console.log('✅ OV object is available');
                        resolve();
                    } else {
                        console.log('❌ OV object not found, trying next CDN...');
                        tryNextUrl();
                    }
                }, 1000);
            };

            script.onerror = () => {
                console.log(`❌ Failed to load from: ${script.src}`);
                tryNextUrl();
            };

            tryNextUrl();
            document.head.appendChild(script);
        });
    }

    initSimpleAxisHelper() {
        // Create axis helper container for simple viewer
        const axisContainer = document.createElement('div');
        axisContainer.style.position = 'absolute';
        axisContainer.style.bottom = '20px';
        axisContainer.style.left = '20px';
        axisContainer.style.width = '120px';
        axisContainer.style.height = '120px';
        axisContainer.style.zIndex = '100';
        axisContainer.style.backgroundColor = 'rgba(240, 240, 240, 0.9)';
        axisContainer.style.borderRadius = '8px';
        axisContainer.style.padding = '5px';
        axisContainer.style.border = '1px solid #ccc';
        axisContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
        this.container.appendChild(axisContainer);

        // Create a separate scene for the axis
        this.axisScene = new THREE.Scene();
        this.axisScene.background = new THREE.Color(0xf0f0f0);

        // Setup camera for axis scene
        this.axisCamera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 100);
        this.axisCamera.position.set(0, 0, 4);
        this.axisCamera.lookAt(0, 0, 0);

        // Setup renderer for axis scene
        this.axisRenderer = new THREE.WebGLRenderer({ antialias: true });
        this.axisRenderer.setSize(110, 110);
        this.axisRenderer.setClearColor(0xf0f0f0, 1);
        axisContainer.appendChild(this.axisRenderer.domElement);

        // Create custom axis helper
        this.axisHelper = this.createCustomAxisHelper(0.8);
        this.axisScene.add(this.axisHelper);

        // Add lighting to axis scene
        const axisLight = new THREE.DirectionalLight(0xffffff, 1);
        axisLight.position.set(1, 1, 1);
        this.axisScene.add(axisLight);

        const axisAmbient = new THREE.AmbientLight(0xffffff, 0.7);
        this.axisScene.add(axisAmbient);
    }

    initAdvancedAxisHelper() {
        // Create the 3D orientation axis HTML for advanced viewer
        const axisHTML = `
            <div class="orientation-axis" id="orientation-axis" style="
                position: absolute;
                bottom: 20px;
                left: 20px;
                width: 120px;
                height: 120px;
                background: transparent;
                border: none;
                border-radius: 8px;
                box-shadow: none;
                z-index: 1000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Inter', sans-serif;
                font-weight: 600;
                font-size: 11px;
                overflow: hidden;
            ">
                <div class="axis-cube" id="axis-cube" style="
                    position: relative;
                    width: 60px;
                    height: 60px;
                    transform-style: preserve-3d;
                    transform: rotateX(-15deg) rotateY(25deg);
                    transition: transform 0.3s ease;
                ">
                    <div class="axis-face front" style="
                        position: absolute;
                        width: 60px;
                        height: 60px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #adb5bd;
                        font-size: 12px;
                        font-weight: 700;
                        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                        background: linear-gradient(135deg, #28a745, #20c997);
                        color: white;
                        transform: translateZ(30px);
                    ">Y</div>
                    <div class="axis-face back" style="
                        position: absolute;
                        width: 60px;
                        height: 60px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #adb5bd;
                        font-size: 12px;
                        font-weight: 700;
                        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                        background: linear-gradient(135deg, #90d4aa, #6abf83);
                        color: white;
                        transform: translateZ(-30px) rotateY(180deg);
                    ">-Y</div>
                    <div class="axis-face right" style="
                        position: absolute;
                        width: 60px;
                        height: 60px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #adb5bd;
                        font-size: 12px;
                        font-weight: 700;
                        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                        background: linear-gradient(135deg, #dc3545, #e74c3c);
                        color: white;
                        transform: rotateY(90deg) translateZ(30px);
                    ">X</div>
                    <div class="axis-face left" style="
                        position: absolute;
                        width: 60px;
                        height: 60px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #adb5bd;
                        font-size: 12px;
                        font-weight: 700;
                        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                        background: linear-gradient(135deg, #ff8a95, #ff6b7a);
                        color: white;
                        transform: rotateY(-90deg) translateZ(30px);
                    ">-X</div>
                    <div class="axis-face top" style="
                        position: absolute;
                        width: 60px;
                        height: 60px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #adb5bd;
                        font-size: 12px;
                        font-weight: 700;
                        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                        background: linear-gradient(135deg, #007bff, #0056b3);
                        color: white;
                        transform: rotateX(-90deg) translateZ(30px);
                    ">Z</div>
                    <div class="axis-face bottom" style="
                        position: absolute;
                        width: 60px;
                        height: 60px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 1px solid #adb5bd;
                        font-size: 12px;
                        font-weight: 700;
                        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                        background: linear-gradient(135deg, #74b9ff, #4a9eff);
                        color: white;
                        transform: rotateX(90deg) translateZ(30px);
                    ">-Z</div>
                </div>
            </div>
        `;

        this.container.insertAdjacentHTML('beforeend', axisHTML);
    }

    createCustomAxisHelper(size) {
        const group = new THREE.Group();

        // X Axis (Red)
        const xAxisGeometry = new THREE.CylinderGeometry(0.04, 0.04, size, 10);
        const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
        xAxis.rotation.z = -Math.PI / 2;
        xAxis.position.x = size / 2;
        group.add(xAxis);

        // X Label
        const xLabelCanvas = document.createElement('canvas');
        xLabelCanvas.width = 96;
        xLabelCanvas.height = 96;
        const xContext = xLabelCanvas.getContext('2d');
        xContext.fillStyle = 'red';
        xContext.font = 'Bold 90px Arial';
        xContext.textAlign = 'center';
        xContext.fillText('X', 48, 60);
        const xLabelTexture = new THREE.CanvasTexture(xLabelCanvas);

        const xLabelMaterial = new THREE.SpriteMaterial({ map: xLabelTexture });
        const xLabelSprite = new THREE.Sprite(xLabelMaterial);
        xLabelSprite.position.set(size + 0.15, 0, 0);
        xLabelSprite.scale.set(0.4, 0.4, 0.4);
        group.add(xLabelSprite);

        // Y Axis (Green)
        const yAxisGeometry = new THREE.CylinderGeometry(0.04, 0.04, size, 10);
        const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
        yAxis.position.y = size / 2;
        group.add(yAxis);

        // Y Label
        const yLabelCanvas = document.createElement('canvas');
        yLabelCanvas.width = 96;
        yLabelCanvas.height = 96;
        const yContext = yLabelCanvas.getContext('2d');
        yContext.fillStyle = 'green';
        yContext.font = 'Bold 90px Arial';
        yContext.textAlign = 'center';
        yContext.fillText('Y', 48, 60);
        const yLabelTexture = new THREE.CanvasTexture(yLabelCanvas);

        const yLabelMaterial = new THREE.SpriteMaterial({ map: yLabelTexture });
        const yLabelSprite = new THREE.Sprite(yLabelMaterial);
        yLabelSprite.position.set(0, size + 0.15, 0);
        yLabelSprite.scale.set(0.4, 0.4, 0.4);
        group.add(yLabelSprite);

        // Z Axis (Blue)
        const zAxisGeometry = new THREE.CylinderGeometry(0.04, 0.04, size, 10);
        const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
        zAxis.rotation.x = Math.PI / 2;
        zAxis.position.z = size / 2;
        group.add(zAxis);

        // Z Label
        const zLabelCanvas = document.createElement('canvas');
        zLabelCanvas.width = 96;
        zLabelCanvas.height = 96;
        const zContext = zLabelCanvas.getContext('2d');
        zContext.fillStyle = 'blue';
        zContext.font = 'Bold 90px Arial';
        zContext.textAlign = 'center';
        zContext.fillText('Z', 48, 60);
        const zLabelTexture = new THREE.CanvasTexture(zLabelCanvas);

        const zLabelMaterial = new THREE.SpriteMaterial({ map: zLabelTexture });
        const zLabelSprite = new THREE.Sprite(zLabelMaterial);
        zLabelSprite.position.set(0, 0, size + 0.15);
        zLabelSprite.scale.set(0.4, 0.4, 0.4);
        group.add(zLabelSprite);

        return group;
    }

    trackAdvancedCameraChanges() {
        // Method 1: Try to access underlying three.js camera through multiple paths
        if (this.advancedViewer && this.advancedViewer.GetViewer) {
            const underlyingViewer = this.advancedViewer.GetViewer();
            console.log('🎥 Underlying viewer structure:', underlyingViewer);

            // Try different paths to access the camera
            const possibleCameraPaths = [
                () => underlyingViewer.camera,
                () => underlyingViewer.GetCamera && underlyingViewer.GetCamera(),
                () => underlyingViewer.viewer && underlyingViewer.viewer.camera,
                () => underlyingViewer.scene && underlyingViewer.scene.camera,
                () => underlyingViewer.renderer && underlyingViewer.renderer.camera,
                () => underlyingViewer.navigation && underlyingViewer.navigation.camera
            ];

            for (let i = 0; i < possibleCameraPaths.length; i++) {
                try {
                    const camera = possibleCameraPaths[i]();
                    if (camera && (camera.position || camera.rotation)) {
                        console.log('🎯 Found camera at path', i, ':', camera);
                        this.startAdvancedCameraTracking(camera, underlyingViewer);
                        return;
                    }
                } catch (e) {
                    console.log(`⚠️ Camera path ${i} failed:`, e.message);
                }
            }
        }

        // Method 2: Enhanced mouse tracking with better sensitivity
        console.log('🖱️ Setting up enhanced mouse-based rotation tracking...');
        this.setupEnhancedMouseTracking();
    }

    startAdvancedCameraTracking(camera, viewer) {
        console.log('🎥 Starting advanced camera tracking...');
        let lastMatrix = null;
        let lastPosition = null;
        let lastRotation = null;

        const updateLoop = () => {
            try {
                let rotationChanged = false;

                // Try multiple ways to detect camera changes
                if (camera.matrix && camera.matrix.elements) {
                    const currentMatrix = camera.matrix.elements.join(',');
                    if (currentMatrix !== lastMatrix) {
                        lastMatrix = currentMatrix;
                        rotationChanged = true;
                    }
                }

                if (camera.position && camera.rotation) {
                    const posKey = `${camera.position.x},${camera.position.y},${camera.position.z}`;
                    const rotKey = `${camera.rotation.x},${camera.rotation.y},${camera.rotation.z}`;

                    if (posKey !== lastPosition || rotKey !== lastRotation) {
                        lastPosition = posKey;
                        lastRotation = rotKey;
                        rotationChanged = true;
                    }
                }

                if (rotationChanged) {
                    // Calculate orientation from camera matrix or rotation
                    if (camera.matrix && camera.matrix.elements) {
                        this.updateAxisFromMatrix(camera.matrix.elements);
                    } else if (camera.rotation) {
                        this.updateAdvancedAxisOrientation(camera.rotation.x, camera.rotation.y, camera.rotation.z);
                    }
                }
            } catch (error) {
                console.log('⚠️ Camera tracking error:', error);
            }

            requestAnimationFrame(updateLoop);
        };
        updateLoop();
    }

    updateAxisFromMatrix(matrixElements) {
        // Extract rotation from transformation matrix with proper coordinate system handling
        const m = matrixElements;

        // Create a more stable rotation extraction
        // Use the camera's forward vector to determine orientation
        const forward = {
            x: -m[8],  // -Z component (camera looks down -Z)
            y: -m[9],  // -Y component 
            z: -m[10] // -Z component
        };

        const up = {
            x: m[4],   // Y component
            y: m[5],   // Y component  
            z: m[6]    // Y component
        };

        const right = {
            x: m[0],   // X component
            y: m[1],   // X component
            z: m[2]    // X component
        };

        // Calculate stable Euler angles from the camera vectors
        let rotX = Math.atan2(forward.y, Math.sqrt(forward.x * forward.x + forward.z * forward.z));
        let rotY = Math.atan2(-forward.x, -forward.z);
        let rotZ = Math.atan2(right.y, up.y);

        // Apply the rotation with proper coordinate system conversion
        this.updateAdvancedAxisOrientation(rotX, rotY, rotZ);
    }

    setupEnhancedMouseTracking() {
        const viewerElement = document.getElementById('viewer') || this.container;
        let isRotating = false;

        // Use more stable rotation tracking
        let cameraRotation = {
            pitch: -15,  // X rotation (up/down)
            yaw: 25,     // Y rotation (left/right)  
            roll: 0      // Z rotation (tilt)
        };

        let lastMouseX = 0;
        let lastMouseY = 0;

        // Much more conservative sensitivity
        const sensitivity = 0.15;
        const smoothingFactor = 0.08;

        let targetRotation = { ...cameraRotation };

        // Only add fallback mouse tracking - let O3DV handle the actual rotation
        // This is just for the axis cube tracking when camera tracking fails
        console.log('📝 Setting up fallback mouse tracking for axis cube only (O3DV handles actual rotation)');

        viewerElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                isRotating = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isRotating) {
                const deltaX = e.clientX - lastMouseX;
                const deltaY = e.clientY - lastMouseY;

                // Only update for significant movements
                if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
                    // Update target rotation with very conservative sensitivity
                    targetRotation.yaw += deltaX * sensitivity;
                    targetRotation.pitch -= deltaY * sensitivity;

                    // Allow full vertical rotation without clamping
                    // No pitch constraints - enable full 360-degree rotation freedom

                    // Normalize yaw to 0-360 range
                    targetRotation.yaw = ((targetRotation.yaw % 360) + 360) % 360;

                    lastMouseX = e.clientX;
                    lastMouseY = e.clientY;
                }
            }
        });

        document.addEventListener('mouseup', () => {
            isRotating = false;
        });

        // Smooth animation loop with better interpolation
        const smoothUpdate = () => {
            // Smooth interpolation towards target rotation
            cameraRotation.pitch += (targetRotation.pitch - cameraRotation.pitch) * smoothingFactor;
            cameraRotation.yaw += (targetRotation.yaw - cameraRotation.yaw) * smoothingFactor;
            cameraRotation.roll += (targetRotation.roll - cameraRotation.roll) * smoothingFactor;

            // Convert to radians and apply with proper coordinate system
            const pitchRad = cameraRotation.pitch * Math.PI / 180;
            const yawRad = cameraRotation.yaw * Math.PI / 180;
            const rollRad = cameraRotation.roll * Math.PI / 180;

            this.updateAdvancedAxisOrientation(pitchRad, yawRad, rollRad);

            requestAnimationFrame(smoothUpdate);
        };
        smoothUpdate();
    }

    updateAdvancedAxisOrientation(rotX, rotY, rotZ) {
        const axisCube = document.getElementById('axis-cube');
        if (!axisCube) return;

        // Convert radians to degrees
        const degX = rotX * 180 / Math.PI;
        const degY = rotY * 180 / Math.PI;
        const degZ = rotZ * 180 / Math.PI;

        // Apply rotation with proper coordinate system mapping
        // Fix: Remove inversions to make axis cube rotate in same direction as model
        const finalX = degX;   // Don't invert pitch
        const finalY = -degY;  // Invert yaw to match camera movement
        const finalZ = degZ;   // Keep roll as-is

        axisCube.style.transform = `rotateX(${finalX}deg) rotateY(${finalY}deg) rotateZ(${finalZ}deg)`;
    }

    animateSimple() {
        if (this.mode !== 'simple') return;

        const animate = () => {
            requestAnimationFrame(animate);

            if (this.controls) {
                this.controls.update();
            }

            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }

            if (this.axisRenderer && this.axisScene && this.axisCamera && this.axisHelper) {
                // Sync axis with main camera
                this.axisHelper.rotation.copy(this.camera.rotation);
                this.axisRenderer.render(this.axisScene, this.axisCamera);
            }
        };
        animate();
    }

    onWindowResize() {
        if (this.mode === 'simple' && this.camera && this.renderer) {
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);

            // OrbitControls don't need special resize handling
        } else if (this.mode === 'advanced' && this.advancedViewer) {
            this.advancedViewer.Resize();
        }
    }

    updateModel(modelData) {
        if (this.mode === 'simple') {
            this.updateSimpleModel(modelData);
        } else if (this.mode === 'advanced') {
            this.updateAdvancedModel(modelData);
        }

        // Update download handler with current model data
        if (typeof setCurrentModelForDownload === 'function') {
            setCurrentModelForDownload(modelData);
        }
    }

    updateSimpleModel(modelData) {
        // Remove existing model
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
            this.currentModel = null;
        }

        if (!modelData || !modelData.vertices || !modelData.faces) {
            return;
        }

        // Create geometry from model data
        const geometry = new THREE.BufferGeometry();
        const vertices = new Float32Array(modelData.vertices);
        const indices = new Uint32Array(modelData.faces);

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.computeVertexNormals();

        // Create material
        const material = new THREE.MeshLambertMaterial({
            color: modelData.color || 0x9146FF,
            side: THREE.DoubleSide
        });

        // Create mesh
        this.currentModel = new THREE.Mesh(geometry, material);
        this.scene.add(this.currentModel);

        // Center and scale model
        const box = new THREE.Box3().setFromObject(this.currentModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 5 / maxDim;

        this.currentModel.scale.setScalar(scale);
        this.currentModel.position.copy(center.multiplyScalar(-scale));

        // Apply currently selected color
        this.applyCurrentColor();
    }

    updateAdvancedModel(modelData) {
        if (!this.advancedViewer) return;

        // For advanced viewer, handle STEP files and other formats from backend
        if (modelData && modelData.path) {
            const modelUrl = `${window.location.origin}/${modelData.path}`;
            console.log('📂 Loading backend model in advanced viewer:', modelUrl);
            this.lastModelUrl = modelUrl;

            // Set up color configuration before loading
            const currentColor = this.pendingColor || localStorage.getItem('selectedColor') || '#FF4500';
            const hexColor = currentColor.replace('#', '');
            const r = parseInt(hexColor.substr(0, 2), 16);
            const g = parseInt(hexColor.substr(2, 2), 16);
            const b = parseInt(hexColor.substr(4, 2), 16);

            console.log(`🎨 Setting up model with color: ${currentColor} (RGB: ${r}, ${g}, ${b})`);

            this.advancedViewer.LoadModelFromUrlList([modelUrl]);

            // Clear pending color and apply color after model loads
            this.pendingColor = null;
            setTimeout(() => {
                this.applyCurrentColor();
            }, 1000);
        } else if (modelData && modelData.type === 'reset') {
            // Clear the viewer if backend sends reset signal
            console.log('🔄 Clearing advanced viewer');
            // O3DV doesn't have a direct clear method, but we can reload with empty array
            this.advancedViewer.LoadModelFromUrlList([]);
        } else {
            console.log('📭 Advanced viewer: No compatible model data from backend');
        }
    }

    resetView() {
        if (this.mode === 'simple' && this.camera && this.controls) {
            this.camera.position.set(0, 0, 12);
            this.controls.reset();
        } else if (this.mode === 'advanced' && this.advancedViewer) {
            if (typeof this.advancedViewer.FitToWindow === 'function') {
                this.advancedViewer.FitToWindow();
            }
        }
    }

    clearModel() {
        if (this.mode === 'simple') {
            // Simple viewer: Remove the current model from the scene
            if (this.currentModel && this.scene) {
                this.scene.remove(this.currentModel);
                this.currentModel = null;
            }
        } else if (this.mode === 'advanced' && this.advancedViewer) {
            // Advanced viewer: Try multiple methods to clear

            // Method 1: Load empty model list
            this.advancedViewer.LoadModelFromUrlList([]);

            // Method 2: Try to clear the underlying viewer if available
            try {
                const viewer = this.advancedViewer.GetViewer();
                if (viewer && viewer.Clear) {
                    viewer.Clear();
                } else if (viewer && viewer.scene) {
                    // Clear all children from the scene
                    while (viewer.scene.children.length > 0) {
                        viewer.scene.remove(viewer.scene.children[0]);
                    }
                }
            } catch (error) {
                console.error('Error clearing advanced viewer:', error);
            }

            // Method 3: Force a recreation of the viewer container
            const viewerElement = this.container.querySelector('#viewer');
            if (viewerElement) {
                const parent = viewerElement.parentNode;
                const newViewerElement = document.createElement('div');
                newViewerElement.id = 'viewer';
                newViewerElement.style.width = '100%';
                newViewerElement.style.height = '100%';
                newViewerElement.style.border = 'none';
                newViewerElement.style.outline = 'none';
                newViewerElement.style.position = 'relative';

                parent.removeChild(viewerElement);
                parent.appendChild(newViewerElement);

                // Recreate the viewer
                this.advancedViewer = new OV.EmbeddedViewer(newViewerElement, this.viewerConfig);

                // Recreate axis helper
                const orientationAxis = document.getElementById('orientation-axis');
                if (orientationAxis) {
                    orientationAxis.remove();
                }
                this.initAdvancedAxisHelper();

                // Restart camera tracking
                setTimeout(() => {
                    this.trackAdvancedCameraChanges();
                }, 1000);
            }

            this.lastModelUrl = null;
        }

        // Clear download handler when model is cleared
        if (typeof clearCurrentModelForDownload === 'function') {
            clearCurrentModelForDownload();
        }
    }

    applyCurrentColor() {
        // Get the currently selected color from the color selector
        const activeColorOption = document.querySelector('.color-option.active');
        if (activeColorOption) {
            const color = activeColorOption.dataset.color;
            this.updateModelColor(color);
        } else {
            // Fallback to saved color in localStorage
            const savedColor = localStorage.getItem('morfis_model_color');
            if (savedColor) {
                this.updateModelColor(savedColor);
            }
        }
    }

    updateModelColor(color) {
        if (this.mode === 'simple' && this.currentModel) {
            // Simple viewer: Update Three.js material color
            this.currentModel.material.color.setHex(color.replace('#', '0x'));
        } else if (this.mode === 'advanced' && this.advancedViewer && this.lastModelUrl) {
            // Advanced viewer: For immediate color changes, always recreate with new color
            this.recreateAdvancedViewerWithColor(color, this.lastModelUrl);
        }
    }

    async recreateAdvancedViewerWithColor(color, modelUrl) {
        // Store the pending color
        this.pendingColor = color;

        // Clear the current viewer but keep the container structure
        const viewerElement = this.container.querySelector('#viewer');
        if (viewerElement) {
            viewerElement.innerHTML = '';
        }

        // Remove the axis helper temporarily
        const orientationAxis = document.getElementById('orientation-axis');
        if (orientationAxis) {
            orientationAxis.remove();
        }

        // Convert color to RGB
        const hexColor = color.replace('#', '');
        const r = parseInt(hexColor.substr(0, 2), 16);
        const g = parseInt(hexColor.substr(2, 2), 16);
        const b = parseInt(hexColor.substr(4, 2), 16);

        // Update the viewer configuration with new color
        this.viewerConfig.defaultColor = new OV.RGBColor(r, g, b);

        // Create new viewer with updated configuration
        this.advancedViewer = new OV.EmbeddedViewer(viewerElement, this.viewerConfig);

        // Recreate the axis helper
        this.initAdvancedAxisHelper();

        // Set up camera tracking again
        setTimeout(() => {
            this.trackAdvancedCameraChanges();
        }, 1000);

        // Reload the model with the new color
        if (modelUrl) {
            this.advancedViewer.LoadModelFromUrlList([modelUrl]);
        }

        // Clear pending color
        this.pendingColor = null;
    }

    destroy() {
        if (this.mode === 'simple') {
            if (this.renderer && this.container.contains(this.renderer.domElement)) {
                this.container.removeChild(this.renderer.domElement);
            }
            if (this.axisRenderer) {
                const axisContainer = this.axisRenderer.domElement.parentNode;
                if (axisContainer && axisContainer.parentNode === this.container) {
                    this.container.removeChild(axisContainer);
                }
            }
        } else if (this.mode === 'advanced') {
            // Clean up advanced viewer
            const orientationAxis = document.getElementById('orientation-axis');
            if (orientationAxis && orientationAxis.parentNode === this.container) {
                this.container.removeChild(orientationAxis);
            }
        }
        this.initialized = false;
    }

    async loadSTL(file) {
        console.log('Loading STL file:', file.name);

        // Use O3DV for STL files too, for consistent unlimited rotation
        this.mode = 'advanced';
        this.container.innerHTML = '<div id="online_3d_viewer" style="width: 100%; height: 100%;"></div>';

        try {
            // Initialize O3DV for STL files using the same OV namespace
            this.advancedViewer = new OV.EmbeddedViewer('online_3d_viewer', {
                backgroundColor: new OV.RGBAColor(248, 249, 250, 255),
                defaultColor: new OV.RGBColor(200, 200, 200),
                edgeSettings: new OV.EdgeSettings(false, new OV.RGBColor(0, 0, 0), 1)
            });

            // Create temporary URL for the file
            const fileUrl = URL.createObjectURL(file);

            // Load the STL file with O3DV
            this.advancedViewer.LoadModelFromUrlList([fileUrl]);

            // Initialize axis helper for STL files too
            this.initAdvancedAxisHelper();

            // Set up camera tracking for STL files
            setTimeout(() => {
                console.log('🧭 Initializing STL axis tracking...');
                this.trackAdvancedCameraChanges();

                // Auto-fit the model to view
                if (this.advancedViewer && typeof this.advancedViewer.FitToWindow === 'function') {
                    this.advancedViewer.FitToWindow();
                }
            }, 2000);

            // Clean up the URL after a delay
            setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);

        } catch (error) {
            console.error('Error loading STL with O3DV:', error);
            this.showError(`Failed to load STL file: ${error.message}`);
        }
    }
}

// Global viewer instance
window.integratedViewer = null;

// Initialize function to be called from main.js
function initIntegratedViewer(container, config) {
    if (window.integratedViewer) {
        window.integratedViewer.destroy();
    }

    window.integratedViewer = new IntegratedViewer();
    return window.integratedViewer.init(container, config);
}

// Update model function for compatibility
function updateModel(modelData) {
    if (window.integratedViewer && window.integratedViewer.initialized) {
        window.integratedViewer.updateModel(modelData);
    }
}

// Reset view function for compatibility
function resetView() {
    if (window.integratedViewer && window.integratedViewer.initialized) {
        window.integratedViewer.resetView();
    }
}

// Clear model function for compatibility
function clearModel() {
    if (window.integratedViewer && window.integratedViewer.initialized) {
        window.integratedViewer.clearModel();
    }
}

// Reset viewer function that clears models and resets view (for new designs)
function resetViewer() {
    if (window.integratedViewer && window.integratedViewer.initialized) {
        window.integratedViewer.clearModel();
        window.integratedViewer.resetView();
    }
}

// Update model color function for compatibility
function updateModelColor(color) {
    if (window.integratedViewer && window.integratedViewer.initialized) {
        window.integratedViewer.updateModelColor(color);
    }
} 