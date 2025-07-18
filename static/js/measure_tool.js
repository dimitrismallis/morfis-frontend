/**
 * Measuring Tool for Online3DViewer
 * Based on best practices from 3dViewMeasurement repository
 * Properly scaled and integrated measuring functionality
 */

class MeasureTool {
    constructor(viewer) {
        this.viewer = viewer;
        this.isActive = false;
        this.measurements = [];
        this.currentMeasurement = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Visual settings
        this.pointSize = 0.02; // Much smaller points
        this.lineWidth = 2;
        this.labelScale = 0.1;

        // Try to get the underlying Three.js scene and camera
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.canvas = null;

        this.initializeThreeJSReferences();
        this.setupEventListeners();
    }

    initializeThreeJSReferences() {
        // Try to access the underlying Three.js objects from Online3DViewer
        if (this.viewer && this.viewer.GetViewer) {
            const underlyingViewer = this.viewer.GetViewer();
            console.log('🔍 Analyzing Online3DViewer structure for measuring tool...');

            // More comprehensive search for Three.js objects
            const paths = {
                scene: [
                    () => underlyingViewer.scene,
                    () => underlyingViewer.GetScene && underlyingViewer.GetScene(),
                    () => underlyingViewer.viewer && underlyingViewer.viewer.scene,
                    () => underlyingViewer.drawer && underlyingViewer.drawer.scene,
                    () => underlyingViewer.model && underlyingViewer.model.scene,
                    () => underlyingViewer.navigation && underlyingViewer.navigation.scene
                ],
                camera: [
                    () => underlyingViewer.camera,
                    () => underlyingViewer.GetCamera && underlyingViewer.GetCamera(),
                    () => underlyingViewer.viewer && underlyingViewer.viewer.camera,
                    () => underlyingViewer.drawer && underlyingViewer.drawer.camera,
                    () => underlyingViewer.navigation && underlyingViewer.navigation.camera
                ],
                renderer: [
                    () => underlyingViewer.renderer,
                    () => underlyingViewer.GetRenderer && underlyingViewer.GetRenderer(),
                    () => underlyingViewer.viewer && underlyingViewer.viewer.renderer,
                    () => underlyingViewer.drawer && underlyingViewer.drawer.renderer
                ]
            };

            // Find scene
            for (let i = 0; i < paths.scene.length; i++) {
                try {
                    const scene = paths.scene[i]();
                    if (scene && scene.add && typeof scene.add === 'function') {
                        this.scene = scene;
                        console.log(`✅ Found Three.js scene for measuring tool`);
                        break;
                    }
                } catch (e) { continue; }
            }

            // Find camera
            for (let i = 0; i < paths.camera.length; i++) {
                try {
                    const camera = paths.camera[i]();
                    if (camera && camera.position && camera.updateProjectionMatrix) {
                        this.camera = camera;
                        console.log(`✅ Found Three.js camera for measuring tool`);
                        break;
                    }
                } catch (e) { continue; }
            }

            // Find renderer
            for (let i = 0; i < paths.renderer.length; i++) {
                try {
                    const renderer = paths.renderer[i]();
                    if (renderer && renderer.domElement) {
                        this.renderer = renderer;
                        this.canvas = renderer.domElement;
                        console.log(`✅ Found Three.js renderer for measuring tool`);
                        break;
                    }
                } catch (e) { continue; }
            }
        }

        if (!this.scene || !this.camera || !this.renderer) {
            console.warn('⚠️ Could not access Three.js objects from Online3DViewer');
            console.warn('Debug - Found objects:', {
                scene: !!this.scene,
                camera: !!this.camera,
                renderer: !!this.renderer
            });
            this.setupFallbackMode();
        } else {
            console.log('✅ Successfully integrated with Online3DViewer Three.js objects');
            console.log('📊 Three.js objects:', {
                scene: this.scene.constructor.name,
                camera: this.camera.constructor.name,
                renderer: this.renderer.constructor.name,
                sceneChildren: this.scene.children.length
            });
            this.setupProperMeasurement();
        }
    }

    setupProperMeasurement() {
        // Create a group to hold all measurement objects
        this.measurementGroup = new THREE.Group();
        this.measurementGroup.name = 'MeasurementGroup';
        this.scene.add(this.measurementGroup);

        // Calculate proper scaling based on scene size
        this.calculateScaling();
    }

    calculateScaling() {
        // Calculate the size of the scene to properly scale measurement points
        const box = new THREE.Box3();
        this.scene.traverse((object) => {
            if (object.isMesh) {
                box.expandByObject(object);
            }
        });

        if (!box.isEmpty()) {
            const size = box.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);

            // Scale points relative to model size
            this.pointSize = maxDimension * 0.01; // 1% of largest dimension
            this.labelScale = maxDimension * 0.05; // 5% of largest dimension

            console.log(`📏 Calculated measurement scale: points=${this.pointSize.toFixed(3)}, labels=${this.labelScale.toFixed(3)}`);
        }
    }

    setupFallbackMode() {
        console.log('🔄 Setting up fallback measurement mode...');
        this.fallbackMode = true;
        this.fallbackMeasurements = [];
    }

    setupEventListeners() {
        // Find the canvas element for proper mouse coordinate calculation
        // Online3DViewer creates canvas inside the viewer div
        const viewerDiv = document.getElementById('viewer');

        if (viewerDiv) {
            console.log('✅ Setting up click listener on viewer div');

            // Add event listener with capture to ensure we get the events
            viewerDiv.addEventListener('click', (event) => {
                console.log('🎯 Viewer div clicked, tool active:', this.isActive);
                if (this.isActive) {
                    event.preventDefault();
                    event.stopPropagation();
                    this.handleClick(event);
                }
            }, true); // Use capture phase

            // Also add a direct listener to catch all clicks for debugging
            viewerDiv.addEventListener('click', (event) => {
                if (this.isActive) {
                    console.log('🔍 Click event details:', {
                        target: event.target.tagName,
                        currentTarget: event.currentTarget.id,
                        clientX: event.clientX,
                        clientY: event.clientY,
                        measureToolActive: this.isActive
                    });
                }
            });

            // Also try to find the actual canvas for better coordinate calculation
            const canvas = viewerDiv.querySelector('canvas');
            if (canvas) {
                this.canvas = canvas;
                console.log('✅ Found Online3DViewer canvas element');

                // Also add listener to canvas directly
                canvas.addEventListener('click', (event) => {
                    console.log('🖼️ Canvas clicked directly');
                    if (this.isActive) {
                        event.preventDefault();
                        event.stopPropagation();
                        this.handleClick(event);
                    }
                }, true);
            } else {
                console.warn('⚠️ Canvas element not found in viewer div');
            }
        } else {
            console.error('❌ Viewer div not found!');
        }

        // Set up the measure button
        const measureBtn = document.getElementById('measure-btn');
        if (measureBtn) {
            measureBtn.addEventListener('click', () => {
                console.log('🔘 Measure button clicked');
                this.toggle();
            });
            console.log('✅ Measure button listener set up');
        } else {
            console.error('❌ Measure button not found!');
        }
    }

    toggle() {
        this.isActive = !this.isActive;
        const measureBtn = document.getElementById('measure-btn');

        if (this.isActive) {
            // Try to refresh canvas reference when activating
            this.refreshCanvasReference();

            measureBtn.classList.add('measuring');
            measureBtn.classList.remove('active');
            measureBtn.innerHTML = '<i class="fas fa-ruler"></i> Click 1st Point';
            console.log('📏 Measure tool activated - click first point on model');
            this.currentMeasurement = null;
        } else {
            measureBtn.classList.remove('measuring', 'active');
            measureBtn.innerHTML = '<i class="fas fa-ruler"></i> Measure';
            console.log('📏 Measure tool deactivated');
            this.currentMeasurement = null;
        }
    }

    refreshCanvasReference() {
        // Try to find the canvas element again
        const canvas = document.querySelector('#viewer canvas');
        if (canvas) {
            this.canvas = canvas;
            console.log('🔄 Canvas reference refreshed');
        } else {
            console.warn('⚠️ Canvas not found during refresh');
        }
    }

    handleClick(event) {
        console.log('🔥 CLICK DETECTED!', event.clientX, event.clientY);

        // Show immediate visual feedback regardless of raycasting success
        this.showTemporaryClickIndicator(event);

        if (this.fallbackMode) {
            console.log('📱 Using fallback mode');
            this.handleFallbackClick(event);
            return;
        }

        if (!this.scene || !this.camera || !this.renderer) {
            console.warn('⚠️ Cannot measure: Three.js objects not available - switching to fallback');
            this.handleFallbackClick(event);
            return;
        }

        // Calculate mouse position relative to the correct element
        let rect;
        let targetElement = this.canvas;

        if (!targetElement) {
            // Fallback to viewer div if canvas not found
            targetElement = document.getElementById('viewer');
        }

        if (!targetElement) {
            console.warn('⚠️ No target element found for coordinate calculation');
            return;
        }

        rect = targetElement.getBoundingClientRect();

        // Calculate normalized device coordinates (-1 to +1)
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        console.log('🖱️ Mouse coordinates:', {
            clientX: event.clientX,
            clientY: event.clientY,
            rectLeft: rect.left,
            rectTop: rect.top,
            rectWidth: rect.width,
            rectHeight: rect.height,
            normalizedX: this.mouse.x,
            normalizedY: this.mouse.y
        });

        // Perform raycasting
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // Get all objects in the scene - try multiple approaches
        const allObjects = [];

        // Method 1: Direct scene traversal
        this.scene.traverse((object) => {
            if (object.isMesh && !object.name.includes('measurement')) {
                allObjects.push(object);
                console.log('🎲 Found mesh object:', object.name || 'unnamed', object.geometry?.type);
            }
        });

        // Method 2: Check scene children directly
        this.scene.children.forEach((child, index) => {
            console.log(`🔍 Scene child ${index}:`, child.type, child.name, child.children?.length || 0);
            if (child.isMesh && !allObjects.includes(child)) {
                allObjects.push(child);
            }
        });

        // Method 3: Try to access Online3DViewer model objects specifically
        if (this.viewer && this.viewer.GetViewer) {
            const underlyingViewer = this.viewer.GetViewer();
            console.log('🎥 Checking underlying viewer for model objects...');

            // Try to find model or mesh objects in the viewer
            const modelPaths = [
                () => underlyingViewer.model,
                () => underlyingViewer.models,
                () => underlyingViewer.meshes,
                () => underlyingViewer.viewer && underlyingViewer.viewer.model,
                () => underlyingViewer.scene && underlyingViewer.scene.children
            ];

            modelPaths.forEach((getPath, index) => {
                try {
                    const result = getPath();
                    if (result) {
                        console.log(`🎯 Model path ${index} found:`, result);
                        if (Array.isArray(result)) {
                            result.forEach(obj => {
                                if (obj && obj.isMesh && !allObjects.includes(obj)) {
                                    allObjects.push(obj);
                                }
                            });
                        } else if (result.isMesh && !allObjects.includes(result)) {
                            allObjects.push(result);
                        }
                    }
                } catch (e) {
                    // Continue to next path
                }
            });
        }

        console.log('🎯 Total objects available for intersection:', allObjects.length);
        allObjects.forEach((obj, i) => {
            console.log(`  ${i}: ${obj.type} ${obj.name || 'unnamed'} - visible: ${obj.visible}, material: ${obj.material?.type}`);
        });

        // Try intersecting with all objects, including recursive search
        const intersects = this.raycaster.intersectObjects(allObjects, true);

        console.log('📍 Intersections found:', intersects.length);

        if (intersects.length > 0) {
            const intersection = intersects[0];
            const point = intersection.point.clone();

            console.log('✅ Intersection point:', point);
            console.log('🎯 Intersected object:', intersection.object);

            this.addMeasurementPoint(point);
        } else {
            console.log('⚠️ No intersection found with primary method - trying alternatives');

            // Try alternative raycasting methods
            const alternativePoint = this.tryAlternativeRaycasting(event);

            if (alternativePoint) {
                console.log('✅ Alternative raycasting successful:', alternativePoint);
                this.addMeasurementPoint(alternativePoint);
            } else {
                console.log('⚠️ All raycasting methods failed - using screen coordinates');
                console.log('📊 Debug info:', {
                    cameraPosition: this.camera.position,
                    mouseCoords: this.mouse,
                    rayDirection: this.raycaster.ray.direction,
                    rayOrigin: this.raycaster.ray.origin,
                    sceneChildren: this.scene.children.length
                });

                // Create a 3D point at a reasonable distance from camera
                this.createEstimated3DPoint(event);
            }
        }
    }

    tryAlternativeRaycasting(event) {
        console.log('🔄 Trying alternative raycasting methods...');

        // Method 1: Try intersecting with the entire scene
        const sceneIntersects = this.raycaster.intersectObject(this.scene, true);
        if (sceneIntersects.length > 0) {
            console.log('✅ Scene intersection found');
            return sceneIntersects[0].point.clone();
        }

        // Method 2: Try with different raycaster settings
        const altRaycaster = new THREE.Raycaster();
        altRaycaster.setFromCamera(this.mouse, this.camera);
        altRaycaster.far = 1000; // Extend far distance
        altRaycaster.near = 0.0001; // Extremely close near distance to match camera settings

        const altIntersects = altRaycaster.intersectObject(this.scene, true);
        if (altIntersects.length > 0) {
            console.log('✅ Alternative raycaster found intersection');
            return altIntersects[0].point.clone();
        }

        // Method 3: Project onto a virtual plane
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);
        const distance = 5; // Reasonable distance from camera
        const point3D = this.camera.position.clone().add(cameraDirection.multiplyScalar(distance));

        console.log('📍 Created virtual point at distance 5 from camera');
        return point3D;
    }

    createEstimated3DPoint(event) {
        console.log('🎯 Creating estimated 3D point from screen coordinates');

        // Get camera direction and create a point at reasonable distance
        const cameraDirection = new THREE.Vector3();
        this.camera.getWorldDirection(cameraDirection);

        // Calculate position based on mouse coordinates and camera
        const distance = 5;
        const point3D = new THREE.Vector3();

        // Project mouse coordinates into 3D space
        point3D.set(this.mouse.x, this.mouse.y, 0.5);
        point3D.unproject(this.camera);

        // Get direction from camera to unprojected point
        const direction = point3D.sub(this.camera.position).normalize();

        // Place point at reasonable distance
        const finalPoint = this.camera.position.clone().add(direction.multiplyScalar(distance));

        console.log('📍 Estimated 3D point:', finalPoint);
        this.addMeasurementPoint(finalPoint);
    }

    showTemporaryClickIndicator(event) {
        // Create a temporary visual indicator at click position
        const indicator = document.createElement('div');
        indicator.style.position = 'fixed';
        indicator.style.left = event.clientX + 'px';
        indicator.style.top = event.clientY + 'px';
        indicator.style.width = '20px';
        indicator.style.height = '20px';
        indicator.style.backgroundColor = 'red';
        indicator.style.borderRadius = '50%';
        indicator.style.border = '3px solid white';
        indicator.style.zIndex = '999999';
        indicator.style.pointerEvents = 'none';
        indicator.style.transform = 'translate(-50%, -50%)';
        indicator.style.animation = 'clickPulse 0.5s ease-out';

        // Add animation if not exists
        if (!document.getElementById('click-indicator-style')) {
            const style = document.createElement('style');
            style.id = 'click-indicator-style';
            style.textContent = `
                @keyframes clickPulse {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(indicator);

        // Remove after animation
        setTimeout(() => {
            if (indicator.parentNode) {
                indicator.parentNode.removeChild(indicator);
            }
        }, 500);
    }

    addMeasurementPoint(point) {
        if (!this.currentMeasurement) {
            // Start new measurement
            this.currentMeasurement = {
                id: 'measurement_' + Date.now(),
                points: [point],
                objects: []
            };

            // Create first point marker
            const pointMarker = this.createPointMarker(point, 0x00ff00); // Green for first point
            this.currentMeasurement.objects.push(pointMarker);

            // Update button to show we're waiting for second point
            const measureBtn = document.getElementById('measure-btn');
            if (measureBtn) {
                measureBtn.innerHTML = '<i class="fas fa-ruler"></i> Click 2nd Point';
            }

            console.log('✅ First measurement point added! Click second point to complete measurement.');
            console.log('📍 Point coordinates:', point);

        } else if (this.currentMeasurement.points.length === 1) {
            // Complete measurement with second point
            this.currentMeasurement.points.push(point);

            // Create second point marker
            const pointMarker = this.createPointMarker(point, 0xff0000); // Red for second point
            this.currentMeasurement.objects.push(pointMarker);

            // Create line
            const line = this.createMeasurementLine(this.currentMeasurement.points[0], point);
            this.currentMeasurement.objects.push(line);

            // Calculate and display distance
            const distance = this.currentMeasurement.points[0].distanceTo(point);
            const label = this.createDistanceLabel(this.currentMeasurement.points[0], point, distance);
            this.currentMeasurement.objects.push(label);

            // Save completed measurement
            this.measurements.push(this.currentMeasurement);
            this.currentMeasurement = null;

            // Reset button text for next measurement
            const measureBtn = document.getElementById('measure-btn');
            if (measureBtn) {
                measureBtn.innerHTML = '<i class="fas fa-ruler"></i> Click 1st Point';
            }

            console.log(`📏 Measurement completed: ${distance.toFixed(3)} units`);
        }
    }

    createPointMarker(point, color) {
        const geometry = new THREE.SphereGeometry(this.pointSize, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            depthTest: false,
            depthWrite: false
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(point);
        sphere.name = 'measurement_point';
        sphere.renderOrder = 999; // Render on top

        // Add a subtle pulsing animation for better visibility
        sphere.userData = {
            originalScale: 1,
            time: 0,
            animate: true
        };

        this.measurementGroup.add(sphere);
        this.animatePoint(sphere);

        return sphere;
    }

    animatePoint(sphere) {
        if (!sphere.userData.animate) return;

        sphere.userData.time += 0.1;
        const scale = 1 + 0.3 * Math.sin(sphere.userData.time);
        sphere.scale.setScalar(scale);

        // Stop animation after a few cycles
        if (sphere.userData.time > Math.PI * 6) {
            sphere.scale.setScalar(1);
            sphere.userData.animate = false;
        } else {
            requestAnimationFrame(() => this.animatePoint(sphere));
        }
    }

    createMeasurementLine(point1, point2) {
        const geometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
        const material = new THREE.LineBasicMaterial({
            color: 0xffff00,
            linewidth: this.lineWidth,
            depthTest: false,
            depthWrite: false
        });
        const line = new THREE.Line(geometry, material);
        line.name = 'measurement_line';
        line.renderOrder = 998; // Render on top but below points

        this.measurementGroup.add(line);
        return line;
    }

    createDistanceLabel(point1, point2, distance) {
        // Calculate midpoint
        const midpoint = new THREE.Vector3().addVectors(point1, point2).multiplyScalar(0.5);

        // Create canvas for text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;

        // Style text
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = 'white';
        context.font = 'bold 48px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        // Format distance with appropriate units
        let displayText = `${distance.toFixed(3)} units`;
        if (distance < 0.01) {
            displayText = `${(distance * 1000).toFixed(1)} mm`;
        } else if (distance < 1) {
            displayText = `${(distance * 100).toFixed(1)} cm`;
        } else {
            displayText = `${distance.toFixed(3)} m`;
        }

        context.fillText(displayText, canvas.width / 2, canvas.height / 2);

        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({
            map: texture,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(midpoint);
        sprite.scale.set(this.labelScale, this.labelScale * 0.25, 1);
        sprite.name = 'measurement_label';
        sprite.renderOrder = 1000; // Render on top of everything

        this.measurementGroup.add(sprite);
        return sprite;
    }

    handleFallbackClick(event) {
        console.log('🔄 Handling fallback click');

        // Simplified fallback for when Three.js integration isn't available
        const rect = document.getElementById('viewer').getBoundingClientRect();
        const screenPoint = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };

        if (!this.currentMeasurement) {
            this.currentMeasurement = {
                points: [screenPoint],
                elements: []
            };

            const marker = this.createFallbackMarker(screenPoint, '#00ff00');
            this.currentMeasurement.elements.push(marker);

            // Update button to show we're waiting for second point
            const measureBtn = document.getElementById('measure-btn');
            if (measureBtn) {
                measureBtn.innerHTML = '<i class="fas fa-ruler"></i> Click 2nd Point';
            }

            console.log('✅ First fallback point added! Click second point to complete measurement.');

        } else if (this.currentMeasurement.points.length === 1) {
            this.currentMeasurement.points.push(screenPoint);

            const marker = this.createFallbackMarker(screenPoint, '#ff0000');
            this.currentMeasurement.elements.push(marker);

            // Calculate screen distance
            const dx = this.currentMeasurement.points[1].x - this.currentMeasurement.points[0].x;
            const dy = this.currentMeasurement.points[1].y - this.currentMeasurement.points[0].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const label = this.createFallbackLabel(this.currentMeasurement.points[0], this.currentMeasurement.points[1], distance);
            this.currentMeasurement.elements.push(label);

            this.fallbackMeasurements.push(this.currentMeasurement);
            this.currentMeasurement = null;

            // Reset button text for next measurement
            const measureBtn = document.getElementById('measure-btn');
            if (measureBtn) {
                measureBtn.innerHTML = '<i class="fas fa-ruler"></i> Click 1st Point';
            }

            console.log(`📏 Fallback measurement completed: ${distance.toFixed(1)} pixels`);
        }
    }

    createFallbackMarker(point, color) {
        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.left = point.x + 'px';
        marker.style.top = point.y + 'px';
        marker.style.width = '12px';
        marker.style.height = '12px';
        marker.style.backgroundColor = color;
        marker.style.borderRadius = '50%';
        marker.style.border = '3px solid white';
        marker.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        marker.style.zIndex = '10000';
        marker.style.pointerEvents = 'none';
        marker.style.transform = 'translate(-50%, -50%)';
        marker.style.animation = 'pulse 1s ease-in-out 3';

        // Add pulse animation
        if (!document.getElementById('fallback-marker-style')) {
            const style = document.createElement('style');
            style.id = 'fallback-marker-style';
            style.textContent = `
                @keyframes pulse {
                    0% { transform: translate(-50%, -50%) scale(1); }
                    50% { transform: translate(-50%, -50%) scale(1.3); }
                    100% { transform: translate(-50%, -50%) scale(1); }
                }
            `;
            document.head.appendChild(style);
        }

        const viewerContainer = document.getElementById('viewer');
        viewerContainer.style.position = 'relative';
        viewerContainer.appendChild(marker);

        return marker;
    }

    createFallbackLabel(point1, point2, distance) {
        const midX = (point1.x + point2.x) / 2;
        const midY = (point1.y + point2.y) / 2;

        const label = document.createElement('div');
        label.style.position = 'absolute';
        label.style.left = midX + 'px';
        label.style.top = midY + 'px';
        label.style.background = 'rgba(0, 0, 0, 0.8)';
        label.style.color = 'white';
        label.style.padding = '4px 8px';
        label.style.borderRadius = '4px';
        label.style.fontSize = '12px';
        label.style.fontFamily = 'Arial, sans-serif';
        label.style.zIndex = '10001';
        label.style.pointerEvents = 'none';
        label.style.transform = 'translate(-50%, -50%)';
        label.textContent = `${distance.toFixed(1)} px`;

        const viewerContainer = document.getElementById('viewer');
        viewerContainer.appendChild(label);

        return label;
    }

    clearMeasurements() {
        // Clear 3D measurements
        if (this.measurementGroup) {
            // Remove all children from measurement group
            while (this.measurementGroup.children.length > 0) {
                const child = this.measurementGroup.children[0];
                this.measurementGroup.remove(child);

                // Dispose geometry and material
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        }

        // Clear fallback measurements
        if (this.fallbackMeasurements) {
            this.fallbackMeasurements.forEach(measurement => {
                measurement.elements.forEach(element => {
                    if (element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                });
            });
            this.fallbackMeasurements = [];
        }

        // Reset state
        this.measurements = [];
        this.currentMeasurement = null;

        console.log('🧹 All measurements cleared');
    }
}

// Initialize the measuring tool when the viewer is ready
let measureTool = null;

function initMeasureTool() {
    if (typeof viewer !== 'undefined' && viewer) {
        // Wait a bit more for Online3DViewer to fully render
        setTimeout(() => {
            measureTool = new MeasureTool(viewer);
            console.log('📏 Enhanced measuring tool initialized');

            // Make the tool available globally
            window.measureTool = measureTool;

            // Try to find canvas after initialization
            const canvas = document.querySelector('#viewer canvas');
            if (canvas && measureTool) {
                measureTool.canvas = canvas;
                console.log('✅ Canvas element found and assigned to measuring tool');
            }
        }, 1000);
    } else {
        console.warn('⚠️ Viewer not available for measuring tool');
    }
}

// Make functions available globally
window.initMeasureTool = initMeasureTool; 