let scene, camera, renderer, controls;
let currentModel;
let axisHelper, axisScene, axisCamera, axisRenderer;

function initViewer() {
    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f7f8);

    // Camera setup - positioned further away for a better view
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / 2 / window.innerHeight, 0.1, 1000); // Reduced FOV for less distortion
    camera.position.z = 12; // Increased distance from 5 to 12 for a more zoomed-out view

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth / 2, window.innerHeight);
    document.getElementById('modelViewer').appendChild(renderer.domElement);

    // Controls setup
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Soft Lighting - Higher ambient, lower directional for softer feel
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.1); // Higher ambient light for overall softness
    scene.add(ambientLight);

    // Add multiple directional lights with reduced intensity for softer shadows
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.5); // Reduced intensity for softer light
    frontLight.position.set(0, 0, 5);
    scene.add(frontLight);

    const topLight = new THREE.DirectionalLight(0xffffff, 0.4); // Reduced intensity for softer light
    topLight.position.set(0, 5, 0);
    scene.add(topLight);

    const backLight = new THREE.DirectionalLight(0xffffff, 0.3); // Reduced intensity for softer light
    backLight.position.set(0, 0, -5);
    scene.add(backLight);

    const sideLight1 = new THREE.DirectionalLight(0xffffff, 0.3); // Reduced intensity for softer light
    sideLight1.position.set(5, 0, 0);
    scene.add(sideLight1);

    const sideLight2 = new THREE.DirectionalLight(0xffffff, 0.3); // Reduced intensity for softer light
    sideLight2.position.set(-5, 0, 0);
    scene.add(sideLight2);

    // Initialize axis helper
    initAxisHelper();

    // Animation loop
    animate();

    // Window resize handler
    window.addEventListener('resize', onWindowResize, false);

    // No reset view button
}

function initAxisHelper() {
    // Create a separate div for the axis helper
    const axisContainer = document.createElement('div');
    axisContainer.style.position = 'absolute';
    axisContainer.style.bottom = '20px';
    axisContainer.style.left = '20px';
    axisContainer.style.width = '120px';
    axisContainer.style.height = '120px';
    axisContainer.style.zIndex = '100';
    axisContainer.style.backgroundColor = 'rgba(240, 240, 240, 0.9)'; // More opaque background
    axisContainer.style.borderRadius = '8px';
    axisContainer.style.padding = '5px';
    axisContainer.style.border = '1px solid #ccc';
    axisContainer.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)'; // Add shadow for better visibility
    document.getElementById('modelViewer').appendChild(axisContainer);

    // Create a separate scene for the axis
    axisScene = new THREE.Scene();
    axisScene.background = new THREE.Color(0xf0f0f0); // Match the background color

    // Setup camera for axis scene - using orthographic camera to avoid perspective distortion
    axisCamera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 100); // Wider view to accommodate labels at ends
    axisCamera.position.set(0, 0, 4); // Moved further back for better visibility
    axisCamera.lookAt(0, 0, 0);

    // Setup renderer for axis scene
    axisRenderer = new THREE.WebGLRenderer({ antialias: true });
    axisRenderer.setSize(110, 110); // Slightly smaller than container to leave room for padding
    axisRenderer.setClearColor(0xf0f0f0, 1); // Solid background color
    axisContainer.appendChild(axisRenderer.domElement);

    // Create custom axis helper with X, Y, Z labels
    axisHelper = createCustomAxisHelper(0.8); // Smaller size to ensure it fits within the view
    axisScene.add(axisHelper);

    // Add some light to the axis scene
    const axisLight = new THREE.DirectionalLight(0xffffff, 1);
    axisLight.position.set(1, 1, 1);
    axisScene.add(axisLight);

    // Add ambient light to ensure visibility
    const axisAmbient = new THREE.AmbientLight(0xffffff, 0.7); // Increased ambient light
    axisScene.add(axisAmbient);
}

function createCustomAxisHelper(size) {
    const group = new THREE.Group();

    // X Axis (Red) - Positive
    const xAxisGeometry = new THREE.CylinderGeometry(0.04, 0.04, size, 10); // Thicker axis
    const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
    xAxis.rotation.z = -Math.PI / 2;
    xAxis.position.x = size / 2;
    group.add(xAxis);

    // X Axis (Red) - Negative
    const xNegAxisGeometry = new THREE.CylinderGeometry(0.04, 0.04, size, 10); // Thicker axis
    const xNegAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.5, transparent: true }); // Semitransparent for negative
    const xNegAxis = new THREE.Mesh(xNegAxisGeometry, xNegAxisMaterial);
    xNegAxis.rotation.z = Math.PI / 2;
    xNegAxis.position.x = -size / 2;
    group.add(xNegAxis);

    // X Label
    const xLabelCanvas = document.createElement('canvas');
    xLabelCanvas.width = 96; // Larger canvas
    xLabelCanvas.height = 96; // Larger canvas
    const xContext = xLabelCanvas.getContext('2d');
    xContext.fillStyle = 'red';
    xContext.font = 'Bold 90px Arial'; // Bigger font
    xContext.textAlign = 'center';
    xContext.fillText('X', 48, 60); // Centered in the larger canvas
    const xLabelTexture = new THREE.CanvasTexture(xLabelCanvas);

    const xLabelMaterial = new THREE.SpriteMaterial({ map: xLabelTexture });
    const xLabelSprite = new THREE.Sprite(xLabelMaterial);
    xLabelSprite.position.set(size + 0.15, 0, 0); // Positioned at the end of the axis
    xLabelSprite.scale.set(0.4, 0.4, 0.4); // Larger scale for bigger appearance
    group.add(xLabelSprite);

    // -X Label
    const xNegLabelCanvas = document.createElement('canvas');
    xNegLabelCanvas.width = 96;
    xNegLabelCanvas.height = 96;
    const xNegContext = xNegLabelCanvas.getContext('2d');
    xNegContext.fillStyle = 'rgba(255, 0, 0, 0.7)'; // Semi-transparent red
    xNegContext.font = 'Bold 90px Arial';
    xNegContext.textAlign = 'center';
    xNegContext.fillText('-X', 48, 60);
    const xNegLabelTexture = new THREE.CanvasTexture(xNegLabelCanvas);

    const xNegLabelMaterial = new THREE.SpriteMaterial({ map: xNegLabelTexture });
    const xNegLabelSprite = new THREE.Sprite(xNegLabelMaterial);
    xNegLabelSprite.position.set(-size - 0.15, 0, 0); // Positioned at the end of negative axis
    xNegLabelSprite.scale.set(0.4, 0.4, 0.4);
    group.add(xNegLabelSprite);

    // Y Axis (Green) - Positive
    const yAxisGeometry = new THREE.CylinderGeometry(0.04, 0.04, size, 10); // Thicker axis
    const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
    yAxis.position.y = size / 2;
    group.add(yAxis);

    // Y Axis (Green) - Negative
    const yNegAxisGeometry = new THREE.CylinderGeometry(0.04, 0.04, size, 10); // Thicker axis
    const yNegAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, opacity: 0.5, transparent: true }); // Semitransparent for negative
    const yNegAxis = new THREE.Mesh(yNegAxisGeometry, yNegAxisMaterial);
    yNegAxis.rotation.z = Math.PI; // Flip 180 degrees
    yNegAxis.position.y = -size / 2;
    group.add(yNegAxis);

    // Y Label
    const yLabelCanvas = document.createElement('canvas');
    yLabelCanvas.width = 96; // Larger canvas
    yLabelCanvas.height = 96; // Larger canvas
    const yContext = yLabelCanvas.getContext('2d');
    yContext.fillStyle = 'green';
    yContext.font = 'Bold 90px Arial'; // Bigger font
    yContext.textAlign = 'center';
    yContext.fillText('Y', 48, 60); // Centered in the larger canvas
    const yLabelTexture = new THREE.CanvasTexture(yLabelCanvas);

    const yLabelMaterial = new THREE.SpriteMaterial({ map: yLabelTexture });
    const yLabelSprite = new THREE.Sprite(yLabelMaterial);
    yLabelSprite.position.set(0, size + 0.15, 0); // Positioned at the end of the axis
    yLabelSprite.scale.set(0.4, 0.4, 0.4); // Larger scale for bigger appearance
    group.add(yLabelSprite);

    // -Y Label
    const yNegLabelCanvas = document.createElement('canvas');
    yNegLabelCanvas.width = 96;
    yNegLabelCanvas.height = 96;
    const yNegContext = yNegLabelCanvas.getContext('2d');
    yNegContext.fillStyle = 'rgba(0, 255, 0, 0.7)'; // Semi-transparent green
    yNegContext.font = 'Bold 90px Arial';
    yNegContext.textAlign = 'center';
    yNegContext.fillText('-Y', 48, 60);
    const yNegLabelTexture = new THREE.CanvasTexture(yNegLabelCanvas);

    const yNegLabelMaterial = new THREE.SpriteMaterial({ map: yNegLabelTexture });
    const yNegLabelSprite = new THREE.Sprite(yNegLabelMaterial);
    yNegLabelSprite.position.set(0, -size - 0.15, 0); // Positioned at the end of negative axis
    yNegLabelSprite.scale.set(0.4, 0.4, 0.4);
    group.add(yNegLabelSprite);

    // Z Axis (Blue) - Positive
    const zAxisGeometry = new THREE.CylinderGeometry(0.04, 0.04, size, 10); // Thicker axis
    const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
    zAxis.rotation.x = Math.PI / 2;
    zAxis.position.z = size / 2;
    group.add(zAxis);

    // Z Axis (Blue) - Negative
    const zNegAxisGeometry = new THREE.CylinderGeometry(0.04, 0.04, size, 10); // Thicker axis
    const zNegAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, opacity: 0.5, transparent: true }); // Semitransparent for negative
    const zNegAxis = new THREE.Mesh(zNegAxisGeometry, zNegAxisMaterial);
    zNegAxis.rotation.x = -Math.PI / 2;
    zNegAxis.position.z = -size / 2;
    group.add(zNegAxis);

    // Z Label
    const zLabelCanvas = document.createElement('canvas');
    zLabelCanvas.width = 96; // Larger canvas
    zLabelCanvas.height = 96; // Larger canvas
    const zContext = zLabelCanvas.getContext('2d');
    zContext.fillStyle = 'blue';
    zContext.font = 'Bold 90px Arial'; // Bigger font
    zContext.textAlign = 'center';
    zContext.fillText('Z', 48, 60); // Centered in the larger canvas
    const zLabelTexture = new THREE.CanvasTexture(zLabelCanvas);

    const zLabelMaterial = new THREE.SpriteMaterial({ map: zLabelTexture });
    const zLabelSprite = new THREE.Sprite(zLabelMaterial);
    zLabelSprite.position.set(0, 0, size + 0.15); // Positioned at the end of the axis
    zLabelSprite.scale.set(0.4, 0.4, 0.4); // Larger scale for bigger appearance
    group.add(zLabelSprite);

    // -Z Label
    const zNegLabelCanvas = document.createElement('canvas');
    zNegLabelCanvas.width = 96;
    zNegLabelCanvas.height = 96;
    const zNegContext = zNegLabelCanvas.getContext('2d');
    zNegContext.fillStyle = 'rgba(0, 0, 255, 0.7)'; // Semi-transparent blue
    zNegContext.font = 'Bold 90px Arial';
    zNegContext.textAlign = 'center';
    zNegContext.fillText('-Z', 48, 60);
    const zNegLabelTexture = new THREE.CanvasTexture(zNegLabelCanvas);

    const zNegLabelMaterial = new THREE.SpriteMaterial({ map: zNegLabelTexture });
    const zNegLabelSprite = new THREE.Sprite(zNegLabelMaterial);
    zNegLabelSprite.position.set(0, 0, -size - 0.15); // Positioned at the end of negative axis
    zNegLabelSprite.scale.set(0.4, 0.4, 0.4);
    group.add(zNegLabelSprite);

    return group;
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);

    // Update the axis helper to match the main scene rotation
    if (axisHelper) {
        // Copy the camera's quaternion to rotate the axis helper the same way as the scene
        axisHelper.quaternion.copy(camera.quaternion).invert();

        // Render the axis scene
        axisRenderer.render(axisScene, axisCamera);
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / 2 / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth / 2, window.innerHeight);

    // We don't need to resize the axis renderer as it has a fixed size
}

function resetView() {
    camera.position.set(0, 0, 12); // Increased from 5 to 12 to match initial camera position
    controls.reset();
}

function updateModel(modelData) {
    // Remove existing model if any
    if (currentModel) {
        scene.remove(currentModel);
    }

    // Get the color from localStorage or use default purple
    let modelColor = localStorage.getItem('morfis_model_color') || '#9146FF';

    // Convert hex to decimal for Three.js
    const hexColor = parseInt(modelColor.replace(/^#/, ''), 16);

    // Calculate emissive color (darker version of main color)
    let r = (hexColor >> 16) & 255;
    let g = (hexColor >> 8) & 255;
    let b = hexColor & 255;

    // Make emissive color 1/3 as bright
    const emissiveR = r / 3;
    const emissiveG = g / 3;
    const emissiveB = b / 3;

    // Create emissive hex color
    const emissiveHex = (Math.floor(emissiveR) << 16) | (Math.floor(emissiveG) << 8) | Math.floor(emissiveB);

    if (modelData.type === 'stl') {
        const loader = new THREE.STLLoader();
        loader.load(modelData.path, function (geometry) {
            // Center the geometry
            geometry.center();

            const material = new THREE.MeshStandardMaterial({
                color: hexColor,     // Use the user-selected color
                metalness: 0.2,      // Reduced metalness for less harsh reflections
                roughness: 0.5,      // Increased roughness for softer light diffusion
                flatShading: false,  // Smooth shading for better detail
                emissive: emissiveHex, // Emissive based on selected color
                emissiveIntensity: 0.12 // Slightly increased for subtle glow
            });

            currentModel = new THREE.Mesh(geometry, material);

            // Scale the model to fit the view but leave more space around it
            const bbox = new THREE.Box3().setFromObject(currentModel);
            const size = new THREE.Vector3();
            bbox.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 3 / maxDim;  // Scale to fit in a 3x3x3 box (smaller than before to show more space around)
            currentModel.scale.set(scale, scale, scale);

            scene.add(currentModel);

            // Reset camera to show the entire model
            resetView();
        });
    } else {
        // Fallback to cube for other types
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: hexColor,     // Use the user-selected color
            metalness: 0.2,      // Reduced metalness for less harsh reflections
            roughness: 0.5,      // Increased roughness for softer light diffusion
            flatShading: false,  // Smooth shading for better detail
            emissive: emissiveHex, // Emissive based on selected color
            emissiveIntensity: 0.12 // Slightly increased for subtle glow
        });
        currentModel = new THREE.Mesh(geometry, material);
        scene.add(currentModel);
    }
}

function resetViewer() {
    // Remove existing model if any
    if (currentModel) {
        scene.remove(currentModel);
        currentModel = null;
    }

    // Reset camera position
    camera.position.set(0, 0, 12); // Increased from 5 to 12 to match initial camera position
    controls.reset();

    // Render the empty scene
    renderer.render(scene, camera);

    // Make sure to render the axis helper too
    if (axisHelper && axisRenderer && axisScene && axisCamera) {
        axisHelper.quaternion.copy(camera.quaternion).invert();
        axisRenderer.render(axisScene, axisCamera);
    }
}

// Function to update the model color based on user selection
function updateModelColor(color) {
    if (!currentModel) return;

    // Convert hex to decimal
    const hexColor = parseInt(color.replace(/^#/, ''), 16);

    // Determine emissive color (darker version of main color)
    let r = (hexColor >> 16) & 255;
    let g = (hexColor >> 8) & 255;
    let b = hexColor & 255;

    // Make emissive color 1/3 as bright
    const emissiveR = r / 3;
    const emissiveG = g / 3;
    const emissiveB = b / 3;

    // Create hex for emissive color
    const emissiveHex = (Math.floor(emissiveR) << 16) | (Math.floor(emissiveG) << 8) | Math.floor(emissiveB);

    // Update material colors
    if (currentModel.material) {
        if (Array.isArray(currentModel.material)) {
            // If the model has multiple materials
            currentModel.material.forEach(material => {
                material.color.setHex(hexColor);
                material.emissive.setHex(emissiveHex);
            });
        } else {
            // Single material
            currentModel.material.color.setHex(hexColor);
            currentModel.material.emissive.setHex(emissiveHex);
        }
    }
}

// Make functions available globally
window.updateModelColor = updateModelColor;

// Initialize the viewer when the page loads
document.addEventListener('DOMContentLoaded', initViewer);