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

// Trajectory functionality
window.showTrajectoryModal = function () {
    const modalElement = document.getElementById('trajectoryModal');

    // Remove any existing backdrop to prevent the gray background
    const existingBackdrops = document.querySelectorAll('.modal-backdrop');
    existingBackdrops.forEach(backdrop => backdrop.remove());

    // Force the body to not have the modal-open class that adds padding and affects layout
    document.body.classList.remove('modal-open');
    document.body.style.overflow = ''; // Reset overflow
    document.body.style.paddingRight = ''; // Reset padding

    // Initialize Bootstrap modal without backdrop
    const trajectoryModal = new bootstrap.Modal(modalElement, {
        backdrop: false, // Disable backdrop completely
        keyboard: true,  // Allow ESC key to close modal
        focus: true      // Focus on modal when opened
    });

    // When modal is hidden, ensure polling is stopped and clean up styles
    modalElement.addEventListener('hidden.bs.modal', function () {
        // Clear the polling interval if it exists
        if (window.trajectoryPollingInterval) {
            console.log("Stopping trajectory polling when modal is closed");
            clearInterval(window.trajectoryPollingInterval);
            window.trajectoryPollingInterval = null;
        }

        // Remove any backdrop that might have been added
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(backdrop => backdrop.remove());

        // Reset body styles
        document.body.classList.remove('modal-open');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
    });

    // Show the modal
    trajectoryModal.show();

    // Get the container where we'll display the content
    const trajectoryContent = document.getElementById('trajectoryContent');

    // Set fixed size for content area to prevent layout shifts
    trajectoryContent.style.minHeight = '500px';

    // Show loading spinner
    trajectoryContent.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p>Loading trajectory data...</p>
        </div>
    `;

    // Prevent scroll position resets
    document.body.style.overflow = document.body.style.overflow;

    // Initial content load - wait a short delay to ensure modal is fully rendered
    setTimeout(async () => {
        await loadTrajectoryContent();
    }, 100);
}

// Trajectory Modal Functionality
document.addEventListener('DOMContentLoaded', function () {
    // Get the trajectory button
    const trajectoryBtn = document.getElementById('trajectoryBtn');

    // Define the toggleContent function globally so it's available from event handlers
    window.toggleContent = function (element) {
        if (element.classList.contains('content-collapsed')) {
            element.classList.remove('content-collapsed');
        } else {
            element.classList.add('content-collapsed');
        }
    };

    // Add click event listener to trajectory button
    if (trajectoryBtn) {
        trajectoryBtn.addEventListener('click', function () {
            showTrajectoryModal();
        });
    }

    // We now use the global trajectoryPollingInterval from main.js

    // Make loadTrajectoryContent available globally so it can be called from other scripts
    window.loadTrajectoryContent = async function () {
        try {
            // Get the container where we'll display the content
            const trajectoryContent = document.getElementById('trajectoryContent');
            if (!trajectoryContent) return; // Exit if modal is closed

            // Fetch the HTML content dynamically from the backend
            const response = await fetchWithTimeout('/api/trajectory-html', {}, 15000);
            if (!response.ok) {
                throw new Error('Failed to fetch trajectory data');
            }

            const htmlContent = await response.text();

            // Update the content with the fetched HTML
            trajectoryContent.innerHTML = htmlContent;

            // Add click handlers for the message boxes after content is loaded
            setTimeout(() => {
                const messageBoxes = trajectoryContent.querySelectorAll('.message-box');

                if (messageBoxes.length === 0) return; // No message boxes to enhance

                messageBoxes.forEach(box => {
                    // Only add indicator if it doesn't already exist
                    if (!box.querySelector('.expand-indicator')) {
                        // Add an expand/collapse indicator
                        const indicator = document.createElement('div');
                        indicator.className = 'expand-indicator';
                        indicator.innerHTML = '<i class="fas fa-chevron-down"></i>';
                        box.appendChild(indicator);
                    }

                    // Remove existing click handler first to avoid duplicates
                    box.removeEventListener('click', handleMessageBoxClick);

                    // Add the click event handler
                    box.addEventListener('click', handleMessageBoxClick);
                });

                // Initialize Prism syntax highlighting for code blocks
                if (window.Prism) {
                    window.Prism.highlightAll();
                    console.log('Applied Prism syntax highlighting');
                }

                console.log('Added click handlers to', messageBoxes.length, 'message boxes');
            }, 100); // Small delay to ensure DOM is updated

        } catch (error) {
            console.error('Error loading trajectory content:', error);
            const trajectoryContent = document.getElementById('trajectoryContent');
            if (trajectoryContent) {
                // Handle timeout errors with specific message
                const errorMessage = error.message.includes('timed out')
                    ? 'Request timed out while loading trajectory data. Please try again.'
                    : 'Error loading trajectory data. Please try again later.';

                trajectoryContent.innerHTML = `
                    <div class="error-message">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>${errorMessage}</p>
                    </div>
                `;
            }
        }
    }

    // Handler for message box clicks
    function handleMessageBoxClick(e) {
        // Find the message-content div inside this box
        const content = this.querySelector('.message-content');
        const expandIcon = this.querySelector('.expand-indicator i');

        if (content) {
            toggleContent(content);

            // Toggle the icon
            if (expandIcon) {
                if (content.classList.contains('content-collapsed')) {
                    expandIcon.className = 'fas fa-chevron-down';
                } else {
                    expandIcon.className = 'fas fa-chevron-up';
                }
            }
        }
    }

    // This ensures toggleContent function is available globally
    document.addEventListener('click', function (e) {
        // Check if clicked element is a message box or inside one
        const messageBox = e.target.closest('.message-box');
        if (messageBox) {
            const content = messageBox.querySelector('.message-content');
            const expandIcon = messageBox.querySelector('.expand-indicator i');

            if (content) {
                toggleContent(content);

                // Toggle the icon if it exists
                if (expandIcon) {
                    if (content.classList.contains('content-collapsed')) {
                        expandIcon.className = 'fas fa-chevron-down';
                    } else {
                        expandIcon.className = 'fas fa-chevron-up';
                    }
                }

                e.stopPropagation(); // Prevent event from bubbling up
            }
        }
    });
});