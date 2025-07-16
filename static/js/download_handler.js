// Helper function to add timeout to fetch requests
function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutMs);

    const fetchOptions = {
        ...options,
        signal: controller.signal
    };

    return fetch(url, fetchOptions)
        .then(response => {
            clearTimeout(timeoutId);
            return response;
        })
        .catch(error => {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
            }
            throw error;
        });
}

// Download Handler functionality
class DownloadHandler {
    constructor() {
        this.currentModelData = null;
        this.init();
    }

    init() {
        const downloadBtn = document.getElementById('downloadModelBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.handleDownload());
            // Initially hide the button until a model is loaded
            this.setButtonState(false);
        }
    }

    setButtonState(enabled) {
        const downloadBtn = document.getElementById('downloadModelBtn');
        if (downloadBtn) {
            if (enabled) {
                downloadBtn.disabled = false;
                downloadBtn.classList.remove('hidden');
            } else {
                downloadBtn.disabled = true;
                downloadBtn.classList.add('hidden');
            }
        }
    }

    setCurrentModel(modelData) {
        this.currentModelData = modelData;
        this.setButtonState(!!modelData);
    }

    clearCurrentModel() {
        this.currentModelData = null;
        this.setButtonState(false);
    }

    async handleDownload() {
        if (!this.currentModelData) {
            this.showNotification('No model available for download', 'error');
            return;
        }

        try {
            // Show loading state
            const downloadBtn = document.getElementById('downloadModelBtn');
            const originalText = downloadBtn.innerHTML;
            downloadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Downloading...';
            downloadBtn.disabled = true;

            if (this.currentModelData.path) {
                // For STEP files from backend
                await this.downloadFromPath(this.currentModelData.path);
            } else if (this.currentModelData.vertices && this.currentModelData.faces) {
                // For STL data generated from vertices/faces
                await this.downloadAsSTL(this.currentModelData);
            } else {
                throw new Error('Unknown model format');
            }

            this.showNotification('Model downloaded successfully!', 'success');

        } catch (error) {
            console.error('Download error:', error);
            // Handle timeout errors with specific message
            if (error.message.includes('timed out')) {
                this.showNotification('Download timed out. Please try again.', 'error');
            } else {
                this.showNotification('Failed to download model', 'error');
            }
        } finally {
            // Reset button state
            const downloadBtn = document.getElementById('downloadModelBtn');
            downloadBtn.innerHTML = '<i class="fas fa-download"></i>Download';
            downloadBtn.disabled = false;
        }
    }

    async downloadFromPath(modelPath) {
        // Download STEP file from the server
        const modelUrl = `${window.location.origin}/${modelPath}`;

        try {
            const response = await fetchWithTimeout(modelUrl, {}, 120000);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const filename = this.extractFilename(modelPath) || 'model.step';

            this.downloadBlob(blob, filename);
        } catch (error) {
            // Preserve timeout error information
            if (error.message.includes('timed out')) {
                throw new Error(`Download timed out: ${error.message}`);
            } else {
                throw new Error(`Failed to download from path: ${error.message}`);
            }
        }
    }

    async downloadAsSTL(modelData) {
        // Generate STL file from vertices and faces
        try {
            const stlContent = this.generateSTLContent(modelData);
            const blob = new Blob([stlContent], { type: 'model/stl' });
            const filename = 'model.stl';

            this.downloadBlob(blob, filename);
        } catch (error) {
            throw new Error(`Failed to generate STL: ${error.message}`);
        }
    }

    generateSTLContent(modelData) {
        const vertices = modelData.vertices;
        const faces = modelData.faces;

        if (!vertices || !faces) {
            throw new Error('Invalid model data: missing vertices or faces');
        }

        let stlContent = 'solid model\n';

        // Process faces (assuming triangular faces)
        for (let i = 0; i < faces.length; i += 3) {
            const v1Index = faces[i] * 3;
            const v2Index = faces[i + 1] * 3;
            const v3Index = faces[i + 2] * 3;

            const v1 = [vertices[v1Index], vertices[v1Index + 1], vertices[v1Index + 2]];
            const v2 = [vertices[v2Index], vertices[v2Index + 1], vertices[v2Index + 2]];
            const v3 = [vertices[v3Index], vertices[v3Index + 1], vertices[v3Index + 2]];

            // Calculate normal vector
            const normal = this.calculateNormal(v1, v2, v3);

            stlContent += `  facet normal ${normal[0].toFixed(6)} ${normal[1].toFixed(6)} ${normal[2].toFixed(6)}\n`;
            stlContent += '    outer loop\n';
            stlContent += `      vertex ${v1[0].toFixed(6)} ${v1[1].toFixed(6)} ${v1[2].toFixed(6)}\n`;
            stlContent += `      vertex ${v2[0].toFixed(6)} ${v2[1].toFixed(6)} ${v2[2].toFixed(6)}\n`;
            stlContent += `      vertex ${v3[0].toFixed(6)} ${v3[1].toFixed(6)} ${v3[2].toFixed(6)}\n`;
            stlContent += '    endloop\n';
            stlContent += '  endfacet\n';
        }

        stlContent += 'endsolid model\n';
        return stlContent;
    }

    calculateNormal(v1, v2, v3) {
        // Calculate two edge vectors
        const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]];
        const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]];

        // Cross product to get normal
        const normal = [
            edge1[1] * edge2[2] - edge1[2] * edge2[1],
            edge1[2] * edge2[0] - edge1[0] * edge2[2],
            edge1[0] * edge2[1] - edge1[1] * edge2[0]
        ];

        // Normalize
        const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2]);
        if (length > 0) {
            normal[0] /= length;
            normal[1] /= length;
            normal[2] /= length;
        }

        return normal;
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    extractFilename(path) {
        if (!path) return null;
        const parts = path.split('/');
        return parts[parts.length - 1];
    }

    showNotification(message, type) {
        // Create a simple notification
        const notification = document.createElement('div');
        notification.className = `download-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s ease;
            ${type === 'success' ? 'background-color: #28a745;' : 'background-color: #dc3545;'}
        `;

        document.body.appendChild(notification);

        // Fade in
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the download handler when the page loads
let downloadHandler = null;

document.addEventListener('DOMContentLoaded', function () {
    downloadHandler = new DownloadHandler();
});

// Global functions to interface with the download handler
function setCurrentModelForDownload(modelData) {
    if (downloadHandler) {
        downloadHandler.setCurrentModel(modelData);
    }
}

function clearCurrentModelForDownload() {
    if (downloadHandler) {
        downloadHandler.clearCurrentModel();
    }
} 