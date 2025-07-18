/**
 * Mobile Input Modal Handler
 * Provides centered modal input for text fields on touch devices (iPad/iPhone)
 * Addresses keyboard overlay issues by moving input to center of screen
 */

class MobileInputModal {
    constructor() {
        this.modal = null;
        this.currentInput = null;
        this.originalValue = '';
        this.isVisible = false;
        this.isTouchDevice = this.detectTouchDevice();

        if (this.isTouchDevice) {
            this.init();
        }
    }

    /**
     * Detect if device supports touch (iPad/iPhone)
     */
    detectTouchDevice() {
        return (
            ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (navigator.msMaxTouchPoints > 0) ||
            /iPad|iPhone|iPod/.test(navigator.userAgent)
        );
    }

    /**
     * Initialize the mobile input modal system
     */
    init() {
        // Create modal HTML structure
        this.createModalHTML();

        // Set up event listeners
        this.setupEventListeners();

        // Monitor for dynamically added inputs
        this.observeNewInputs();

        console.log('Mobile Input Modal initialized for touch device');
    }

    /**
     * Create the modal HTML structure
     */
    createModalHTML() {
        const modalHTML = `
            <div class="mobile-input-modal" id="mobileInputModal">
                <div class="mobile-input-container">
                    <div class="mobile-input-header">
                        <h3 class="mobile-input-title" id="mobileInputTitle">Enter Text</h3>
                        <button class="mobile-input-close" id="mobileInputClose" type="button">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="mobile-input-content">
                        <input type="text" class="mobile-input-field" id="mobileInputField" />
                        <div class="mobile-input-counter" id="mobileInputCounter" style="display: none;"></div>
                    </div>
                    <div class="mobile-input-actions">
                        <button class="mobile-input-btn cancel" id="mobileInputCancel" type="button">
                            Cancel
                        </button>
                        <button class="mobile-input-btn confirm" id="mobileInputConfirm" type="button">
                            Done
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to document body
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Get modal references
        this.modal = document.getElementById('mobileInputModal');
        this.modalField = document.getElementById('mobileInputField');
        this.modalTitle = document.getElementById('mobileInputTitle');
        this.modalCounter = document.getElementById('mobileInputCounter');
        this.closeBtn = document.getElementById('mobileInputClose');
        this.cancelBtn = document.getElementById('mobileInputCancel');
        this.confirmBtn = document.getElementById('mobileInputConfirm');
    }

    /**
     * Set up event listeners for modal interactions
     */
    setupEventListeners() {
        // Close modal events
        this.closeBtn.addEventListener('click', () => this.hideModal(false));
        this.cancelBtn.addEventListener('click', () => this.hideModal(false));
        this.confirmBtn.addEventListener('click', () => this.hideModal(true));

        // Click outside to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hideModal(false);
            }
        });

        // Keyboard events
        this.modalField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.hideModal(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideModal(false);
            }
        });

        // Character counter for textareas
        this.modalField.addEventListener('input', () => {
            this.updateCharacterCounter();
        });

        // Set up focus listeners for existing inputs
        this.setupInputListeners();
    }

    /**
     * Set up focus listeners for all text inputs
     */
    setupInputListeners() {
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea');

        inputs.forEach(input => {
            this.addInputListener(input);
        });
    }

    /**
     * Add focus listener to a specific input
     */
    addInputListener(input) {
        // Skip if already has listener
        if (input.hasAttribute('data-mobile-modal-listener')) {
            return;
        }

        input.setAttribute('data-mobile-modal-listener', 'true');

        input.addEventListener('focus', (e) => {
            // Small delay to ensure mobile keyboard doesn't interfere
            setTimeout(() => {
                this.showModal(e.target);
            }, 100);
        });
    }

    /**
     * Observe for dynamically added inputs
     */
    observeNewInputs() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node is an input
                        if (this.isTextInput(node)) {
                            this.addInputListener(node);
                        }

                        // Check for inputs within the added node
                        const inputs = node.querySelectorAll && node.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea');
                        if (inputs) {
                            inputs.forEach(input => this.addInputListener(input));
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Check if element is a text input
     */
    isTextInput(element) {
        const tagName = element.tagName.toLowerCase();
        const type = element.type ? element.type.toLowerCase() : '';

        return (
            tagName === 'textarea' ||
            (tagName === 'input' && ['text', 'email', 'password', 'search', 'url', 'tel'].includes(type))
        );
    }

    /**
     * Show the mobile input modal
     */
    showModal(inputElement) {
        if (this.isVisible) return;

        this.currentInput = inputElement;
        this.originalValue = inputElement.value;
        this.isVisible = true;

        // Blur the original input to hide mobile keyboard
        inputElement.blur();

        // Configure modal based on input type
        this.configureModal(inputElement);

        // Show modal with animation
        this.modal.classList.add('show');

        // Focus on modal input after animation
        setTimeout(() => {
            this.modalField.focus();
            // Set cursor to end of text
            this.modalField.setSelectionRange(this.modalField.value.length, this.modalField.value.length);
        }, 200);

        // Prevent body scroll
        document.body.style.overflow = 'hidden';
    }

    /**
     * Configure modal based on input characteristics
     */
    configureModal(inputElement) {
        const isTextarea = inputElement.tagName.toLowerCase() === 'textarea';
        const isPassword = inputElement.type === 'password';
        const placeholder = inputElement.placeholder || 'Enter text';
        const maxLength = inputElement.maxLength > 0 ? inputElement.maxLength : null;

        // Set title based on input context
        let title = 'Enter Text';
        if (inputElement.id === 'commandInput') {
            title = 'Describe Your Design';
        } else if (inputElement.id === 'designName') {
            title = 'Design Name';
        } else if (inputElement.id === 'password') {
            title = 'Enter Password';
        } else if (inputElement.getAttribute('aria-label')) {
            title = inputElement.getAttribute('aria-label');
        } else if (inputElement.closest('.form-group')?.querySelector('label')) {
            title = inputElement.closest('.form-group').querySelector('label').textContent;
        }

        this.modalTitle.textContent = title;

        // Configure input field
        if (isTextarea) {
            // Replace input with textarea
            const textarea = document.createElement('textarea');
            textarea.className = 'mobile-input-field textarea';
            textarea.id = 'mobileInputField';
            textarea.placeholder = placeholder;
            textarea.value = this.originalValue;

            if (maxLength) {
                textarea.maxLength = maxLength;
            }

            this.modalField.parentNode.replaceChild(textarea, this.modalField);
            this.modalField = textarea;

            // Re-attach event listeners
            this.reattachFieldListeners();
        } else {
            // Configure input type
            this.modalField.type = isPassword ? 'password' : 'text';
            this.modalField.placeholder = placeholder;
            this.modalField.value = this.originalValue;
            this.modalField.className = 'mobile-input-field';

            if (maxLength) {
                this.modalField.maxLength = maxLength;
            }
        }

        // Show/hide character counter
        if (maxLength && isTextarea) {
            this.modalCounter.style.display = 'block';
            this.updateCharacterCounter();
        } else {
            this.modalCounter.style.display = 'none';
        }
    }

    /**
     * Re-attach event listeners to modal field after replacing element
     */
    reattachFieldListeners() {
        // Keyboard events
        this.modalField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && this.modalField.tagName.toLowerCase() !== 'textarea') {
                e.preventDefault();
                this.hideModal(true);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hideModal(false);
            }
        });

        // Character counter
        this.modalField.addEventListener('input', () => {
            this.updateCharacterCounter();
        });
    }

    /**
     * Update character counter display
     */
    updateCharacterCounter() {
        if (this.modalCounter.style.display === 'none') return;

        const current = this.modalField.value.length;
        const max = this.modalField.maxLength;

        if (max > 0) {
            this.modalCounter.textContent = `${current}/${max}`;

            // Change color when approaching limit
            if (current > max * 0.9) {
                this.modalCounter.style.color = '#dc3545';
            } else if (current > max * 0.8) {
                this.modalCounter.style.color = '#ffc107';
            } else {
                this.modalCounter.style.color = '#6e6e80';
            }
        }
    }

    /**
     * Hide the mobile input modal
     */
    hideModal(saveChanges = false) {
        if (!this.isVisible) return;

        this.isVisible = false;

        // Save or revert changes
        if (saveChanges && this.currentInput) {
            this.currentInput.value = this.modalField.value;

            // Trigger input and change events
            this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.currentInput.dispatchEvent(new Event('change', { bubbles: true }));

            // Handle form submission for command input and single-line inputs
            const form = this.currentInput.closest('form');
            if (form && this.currentInput.id === 'commandInput') {
                // For command input, trigger form submission
                setTimeout(() => {
                    form.dispatchEvent(new Event('submit'));
                }, 50);
            } else if (this.modalField.tagName.toLowerCase() !== 'textarea' && form) {
                // For other single-line inputs, also submit if they're in a form
                setTimeout(() => {
                    form.dispatchEvent(new Event('submit'));
                }, 50);
            }
        }

        // Hide modal with animation
        this.modal.classList.remove('show');

        // Clean up
        setTimeout(() => {
            document.body.style.overflow = '';
            this.currentInput = null;
            this.originalValue = '';

            // Reset modal field to input if it was changed to textarea
            if (this.modalField.tagName.toLowerCase() === 'textarea') {
                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'mobile-input-field';
                input.id = 'mobileInputField';

                this.modalField.parentNode.replaceChild(input, this.modalField);
                this.modalField = input;

                // Re-attach base event listeners
                this.reattachFieldListeners();
            }
        }, 300);
    }

    /**
     * Get field titles based on context
     */
    getFieldTitle(inputElement) {
        // Common input identifiers and their titles
        const titleMap = {
            'commandInput': 'Describe Your Design',
            'designName': 'Design Name',
            'password': 'Enter Password',
            'email': 'Email Address',
            'username': 'Username',
            'search': 'Search'
        };

        return titleMap[inputElement.id] || 'Enter Text';
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on touch devices
    if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || /iPad|iPhone|iPod/.test(navigator.userAgent)) {
        window.mobileInputModal = new MobileInputModal();
    }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileInputModal;
} 