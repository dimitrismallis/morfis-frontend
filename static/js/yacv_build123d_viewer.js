// YACV-based Build123d CAD Viewer Component
class YACVBuild123dViewer {
    constructor() {
        this.container = null;
        this.initialized = false;
        this.yacvServer = null;
        this.currentCode = null;
        this.viewerElement = null;
        this.pollInterval = null;
        this.serverUrl = window.location.origin + '/yacv/'; // Use Flask integrated YACV
    }

    async init(container) {
        this.container = container;

        console.log('🚀 Initializing YACV Build123d viewer...');

        try {
            // Create the viewer container
            this.createViewerElement();

            // Try to connect to YACV server (will be started when we execute Build123d code)
            this.initialized = true;
            console.log('✅ YACV Build123d viewer initialized successfully');

        } catch (error) {
            this.initialized = false;
            console.error('❌ Failed to initialize YACV Build123d viewer:', error);
            throw error;
        }
    }

    createViewerElement() {
        // Clear container
        this.container.innerHTML = '';

        // Create the main viewer structure similar to YACV
        const viewerWrapper = document.createElement('div');
        viewerWrapper.className = 'yacv-viewer-wrapper';
        viewerWrapper.style.cssText = `
            width: 100%;
            height: 100%;
            position: relative;
            background: #f8f9fa;
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        // Create iframe for YACV viewer
        this.viewerElement = document.createElement('iframe');
        this.viewerElement.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
            background: white;
        `;

        // Add security attributes for cross-origin content
        this.viewerElement.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms');
        this.viewerElement.setAttribute('loading', 'eager');
        this.viewerElement.setAttribute('referrerpolicy', 'no-referrer');

        this.viewerElement.src = 'about:blank'; // Will be set when server starts

        // Create status bar
        const statusBar = document.createElement('div');
        statusBar.className = 'yacv-status-bar';
        statusBar.style.cssText = `
            background: #f1f3f4;
            padding: 8px 16px;
            font-size: 12px;
            color: #5f6368;
            border-top: 1px solid #e0e0e0;
            text-align: center;
        `;
        statusBar.textContent = 'Ready - Load Build123d code to view CAD models';

        viewerWrapper.appendChild(this.viewerElement);
        viewerWrapper.appendChild(statusBar);
        this.container.appendChild(viewerWrapper);

        // Store reference to status bar for updates
        this.statusBar = statusBar;
    }

    async executeBuild123dCode(code) {
        console.log('🔧 Executing Build123d code...');
        this.currentCode = code;

        try {
            // Update status
            this.updateStatus('Executing Build123d code...', 'processing');

            // Send code to our backend which will execute it with YACV
            const response = await fetch('/api/execute-build123d', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code: code })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            if (result.success) {
                // Use the integrated YACV URL 
                this.lastServerUrl = result.yacv_url || '/yacv/';

                // Connect to integrated YACV viewer immediately (no delay needed)
                this.connectToYACVServer(this.lastServerUrl);

                this.updateStatus(`Connected to integrated YACV - Objects: ${result.shown_objects?.length || 0}`, 'success');
                return result;
            } else {
                throw new Error(result.error || 'Failed to execute Build123d code');
            }

        } catch (error) {
            console.error('❌ Error executing Build123d code:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
            throw error;
        }
    }

    connectToYACVServer(serverUrl) {
        console.log('🔗 [v3.0-NUCLEAR] Connecting to YACV server at:', serverUrl);

        // Store the server URL for later use
        this.lastServerUrl = serverUrl;

        // Add error handling for iframe loading
        this.viewerElement.onload = () => {
            console.log('✅ YACV iframe loaded successfully');
            this.updateStatus('YACV viewer loaded successfully', 'success');
        };

        this.viewerElement.onerror = (error) => {
            console.error('❌ YACV iframe failed to load:', error);
            this.updateStatus('Iframe failed - use "Open in New Window" button', 'error');

            // Show the test connection button
            const testBtn = document.getElementById('testConnectionBtn');
            if (testBtn) {
                testBtn.style.display = 'inline-block';
            }
        };

        // Force complete cache clear by recreating iframe element
        const oldIframe = this.viewerElement;
        const newIframe = document.createElement('iframe');
        newIframe.id = oldIframe.id;
        newIframe.className = oldIframe.className;
        newIframe.style.cssText = oldIframe.style.cssText;

        // Ultimate cache bypass: unique timestamp + random ID
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        // Use minimal params to avoid loading dev plugins in YACV
        newIframe.src = serverUrl + 'index.html?t=' + timestamp + '&r=' + randomId + '&nocache=1';

        // Replace old iframe with new one
        oldIframe.parentNode.replaceChild(newIframe, oldIframe);
        this.viewerElement = newIframe;

        // Add event handlers to new iframe
        this.viewerElement.onload = () => {
            console.log('✅ YACV iframe loaded successfully');
            this.updateStatus('YACV viewer loaded successfully', 'success');
        };

        this.viewerElement.onerror = (error) => {
            console.error('❌ YACV iframe failed to load:', error);
            this.updateStatus('Iframe failed - use "Open in New Window" button', 'error');

            // Show the test connection button
            const testBtn = document.getElementById('testConnectionBtn');
            if (testBtn) {
                testBtn.style.display = 'inline-block';
            }
        };

        // Set initial status
        this.updateStatus('Loading fresh YACV viewer...', 'processing');

        // Set a timeout to show fallback option if iframe doesn't load
        setTimeout(() => {
            // Check if iframe loaded successfully by looking at its content
            try {
                const iframeDoc = this.viewerElement.contentDocument || this.viewerElement.contentWindow.document;
                if (!iframeDoc || iframeDoc.body.innerHTML === '') {
                    console.log('⏰ Iframe loading timeout - showing fallback button');
                    this.updateStatus('Slow loading - try "Open in New Window"', 'processing');

                    const testBtn = document.getElementById('testConnectionBtn');
                    if (testBtn) {
                        testBtn.style.display = 'inline-block';
                    }
                }
            } catch (e) {
                // Cross-origin access blocked, which is expected - show fallback
                console.log('🔒 Cross-origin iframe detected - showing fallback button');
                this.updateStatus('For best experience, use "Open in New Window"', 'processing');

                const testBtn = document.getElementById('testConnectionBtn');
                if (testBtn) {
                    testBtn.style.display = 'inline-block';
                }
            }
        }, 5000); // Wait 5 seconds
    }

    startServerPolling(serverUrl) {
        // Clear any existing polling
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }

        // Polling disabled - YACV server doesn't provide /api/status endpoint
        // The iframe will handle the connection directly to /index.html
        console.log('YACV server should be accessible at:', serverUrl);
    }

    updateStatus(message, type = 'normal') {
        if (!this.statusBar) return;

        this.statusBar.textContent = message;

        // Update status bar styling based on type
        const colors = {
            normal: '#5f6368',
            processing: '#1976d2',
            success: '#388e3c',
            error: '#d32f2f'
        };

        this.statusBar.style.color = colors[type] || colors.normal;
    }

    clearModel() {
        console.log('🧹 Clearing YACV viewer...');

        // Reset viewer
        this.viewerElement.src = 'about:blank';

        // Clear polling
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }

        this.updateStatus('Ready - Load Build123d code to view CAD models', 'normal');
    }

    destroy() {
        console.log('🗑️ Destroying YACV Build123d viewer...');

        // Clear polling
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }

        // Clear container
        if (this.container) {
            this.container.innerHTML = '';
        }

        this.initialized = false;
    }

    // Method to load a predefined example
    async loadExample(exampleName = 'box_with_hole') {
        const examples = {
            box_with_hole: `
# Build123d Example: Box with Hole
from build123d import *

# Create a simple box with a cylindrical hole
with BuildPart() as example:
    Box(10, 10, 5)  # 10x10x5 box
    Cylinder(2, 5, mode=Mode.SUBTRACT)  # Subtract a cylinder (hole)

# Set color for the part
example.color = (0.2, 0.6, 0.8, 1.0)  # Blue color (RGBA)

# Show the part in YACV viewer
# 'show' function is already available in the execution environment
show(example)
`,
            simple_bracket: `
# Build123d Example: Simple Bracket
from build123d import *

# Create a bracket-like shape
with BuildPart() as bracket:
    with BuildSketch() as sk:
        Rectangle(20, 15)
        Circle(3, mode=Mode.SUBTRACT)
    
    extrude(amount=5)
    
    # Add mounting holes
    with Locations((8, 6, 0), (-8, 6, 0)):
        Cylinder(1.5, 5, mode=Mode.SUBTRACT)

# Set color
bracket.color = (0.8, 0.4, 0.2, 1.0)  # Orange color

# Show the bracket
# 'show' function is already available in the execution environment
show(bracket)
`,
            gear: `
# Build123d Example: Simple Gear
from build123d import *
import math

# Create a simple gear
with BuildPart() as gear:
    # Base cylinder
    Cylinder(15, 3)
    
    # Add teeth around the circumference
    with Locations([Location((12 * math.cos(i * math.pi / 8), 
                             12 * math.sin(i * math.pi / 8), 0)) 
                    for i in range(16)]):
        Box(2, 1, 3)
    
    # Center hole
    Cylinder(3, 3, mode=Mode.SUBTRACT)

# Set color
gear.color = (0.6, 0.6, 0.6, 1.0)  # Gray color

# Show the gear
# 'show' function is already available in the execution environment
show(gear)
`
        };

        if (examples[exampleName]) {
            await this.executeBuild123dCode(examples[exampleName]);
        } else {
            console.error('❌ Example not found:', exampleName);
            throw new Error(`Example '${exampleName}' not found`);
        }
    }
}

// Global viewer instance
window.yacvBuild123dViewer = null;

// Initialize function
function initYACVBuild123dViewer(container) {
    if (window.yacvBuild123dViewer) {
        window.yacvBuild123dViewer.destroy();
    }

    window.yacvBuild123dViewer = new YACVBuild123dViewer();
    return window.yacvBuild123dViewer.init(container);
}

// Export for global access
window.initYACVBuild123dViewer = initYACVBuild123dViewer;

