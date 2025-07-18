// Function to initialize the main Morfis application

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

async function initializeMorfisApp() {
    // Generate or retrieve tab-specific ID for independent sessions per tab
    // Use Broadcast Channel API to detect duplicate tabs
    let tabId = sessionStorage.getItem('tabId');

    if (!tabId) {
        // First time loading, create new tab ID
        tabId = 'tab_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        sessionStorage.setItem('tabId', tabId);
    } else {
        // Check if another tab with same ID is already active
        try {
            if (typeof BroadcastChannel !== 'undefined') {
                const channel = new BroadcastChannel('morfis-tab-check');
                let responseReceived = false;

                // Listen for responses from other tabs
                const responseHandler = (event) => {
                    if (event.data.type === 'tab-exists' && event.data.tabId === tabId) {
                        // Another tab with same ID exists, create new session
                        responseReceived = true;
                        tabId = 'tab_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                        sessionStorage.setItem('tabId', tabId);
                        console.log('Duplicate tab detected, created new session:', tabId);
                    }
                };

                channel.addEventListener('message', responseHandler);

                // Ask if any tab with this ID already exists
                channel.postMessage({ type: 'check-tab', tabId: tabId });

                // Wait briefly for responses
                await new Promise(resolve => setTimeout(resolve, 50));

                // Set up ongoing duplicate detection for future duplicates
                channel.addEventListener('message', (event) => {
                    if (event.data.type === 'check-tab' && event.data.tabId === tabId) {
                        // Another tab is checking for our ID, tell them we exist
                        channel.postMessage({ type: 'tab-exists', tabId: tabId });
                    }
                });
            } else {
                // Fallback: use localStorage with timestamp for older browsers
                const timestamp = Date.now();
                const lastActivity = localStorage.getItem('morfis-last-activity-' + tabId);

                if (lastActivity && (timestamp - parseInt(lastActivity)) < 5000) {
                    // Another tab was active recently with same ID, create new session
                    tabId = 'tab_' + Math.random().toString(36).substr(2, 9) + '_' + timestamp;
                    sessionStorage.setItem('tabId', tabId);
                    console.log('Duplicate tab detected (fallback), created new session:', tabId);
                }

                // Update activity timestamp for this tab
                localStorage.setItem('morfis-last-activity-' + tabId, timestamp.toString());

                // Periodically update activity to indicate this tab is alive
                setInterval(() => {
                    localStorage.setItem('morfis-last-activity-' + tabId, Date.now().toString());
                }, 2000);
            }
        } catch (error) {
            console.warn('Error in duplicate tab detection:', error);
            // Continue with existing tabId if detection fails
        }
    }

    // Set up default headers for requests to our backend only
    const originalFetch = window.fetch;
    window.fetch = function (url, options = {}) {
        // Only add X-Tab-ID header for requests to our own backend (relative URLs or same origin)
        const isOwnBackend = !url.startsWith('http') || url.startsWith(window.location.origin);

        if (isOwnBackend) {
            options.headers = options.headers || {};
            options.headers['X-Tab-ID'] = tabId;
        }

        return originalFetch(url, options);
    };

    // Calculate scrollbar width and add it as a CSS variable to prevent layout shifts
    const calculateScrollbarWidth = () => {
        // Create a div with scrollbar
        const outer = document.createElement('div');
        outer.style.visibility = 'hidden';
        outer.style.overflow = 'scroll';
        document.body.appendChild(outer);

        // Create an inner div
        const inner = document.createElement('div');
        outer.appendChild(inner);

        // Calculate the width difference
        const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

        // Remove the divs
        outer.parentNode.removeChild(outer);

        // Set the scrollbar width as a CSS variable
        document.documentElement.style.setProperty('--scrollbar-width', scrollbarWidth + 'px');
        console.log('Scrollbar width calculated:', scrollbarWidth);
    };

    // Calculate actual viewport height to fix iPad viewport issues
    let baseViewportHeight = window.innerHeight; // Store the initial height without keyboard
    let isKeyboardVisible = false;

    const setViewportHeight = (forceUpdate = false) => {
        const currentHeight = window.innerHeight;

        // If keyboard is visible and this isn't a forced update, don't change the viewport height
        if (isKeyboardVisible && !forceUpdate) {
            console.log('Keyboard is visible, skipping viewport height update');
            return;
        }

        // Use the current height (which excludes browser UI elements)
        const vh = forceUpdate ? baseViewportHeight : currentHeight;
        document.documentElement.style.setProperty('--app-height', `${vh}px`);
        console.log('Viewport height set to:', vh);
    };

    // Detect keyboard show/hide on mobile devices
    const detectKeyboard = () => {
        const currentHeight = window.innerHeight;
        const heightDifference = baseViewportHeight - currentHeight;

        // If viewport height decreased by more than 150px, keyboard is likely visible
        if (heightDifference > 150) {
            if (!isKeyboardVisible) {
                isKeyboardVisible = true;
                console.log('Keyboard detected as visible');
                // Don't update viewport height when keyboard appears
            }
        } else {
            if (isKeyboardVisible) {
                isKeyboardVisible = false;
                console.log('Keyboard detected as hidden');
                // Restore original viewport height when keyboard disappears
                setTimeout(() => setViewportHeight(true), 100);
            }
        }
    };

    // Set initial viewport height
    setViewportHeight();

    // Handle window resize with keyboard detection
    window.addEventListener('resize', () => {
        detectKeyboard();
        if (!isKeyboardVisible) {
            setViewportHeight();
        }
    });

    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
        // Reset base height after orientation change
        setTimeout(() => {
            baseViewportHeight = window.innerHeight;
            setViewportHeight(true);
            isKeyboardVisible = false; // Reset keyboard state after orientation change
        }, 200);
    });

    // Enhanced keyboard detection for iOS
    window.addEventListener('focusin', () => {
        // Small delay to let the keyboard animation start
        setTimeout(detectKeyboard, 300);
    });

    window.addEventListener('focusout', () => {
        // Delay to let keyboard hide animation complete
        setTimeout(() => {
            isKeyboardVisible = false;
            setViewportHeight(true);
        }, 300);
    });

    // Fallback viewport change detection (but ignore when keyboard is visible)
    let initialViewportHeight = window.innerHeight;

    const handleViewportChange = () => {
        const currentHeight = window.innerHeight;

        // Don't handle viewport changes when keyboard is visible
        if (isKeyboardVisible) {
            return;
        }

        // Only update if there's a significant change (more than 50px)
        if (Math.abs(currentHeight - initialViewportHeight) > 50) {
            setViewportHeight();
            initialViewportHeight = currentHeight;
            baseViewportHeight = currentHeight; // Update base height
        }
    };

    // Check viewport height on scroll (but ignore when keyboard is visible)
    let scrollTimer;
    window.addEventListener('scroll', () => {
        if (!isKeyboardVisible) {
            clearTimeout(scrollTimer);
            scrollTimer = setTimeout(handleViewportChange, 150);
        }
    }, { passive: true });

    // Visual feedback mode detection
    window.addEventListener('touchend', () => {
        if (!isKeyboardVisible) {
            setTimeout(handleViewportChange, 300);
        }
    }, { passive: true });

    // Calculate scrollbar width on load
    calculateScrollbarWidth();

    const commandForm = document.getElementById('commandForm');
    const commandInput = document.getElementById('commandInput');
    const conversationContainer = document.getElementById('conversationContainer');
    const designDropdown = document.getElementById('designDropdown'); // Container for dynamic design options
    let loadingMessage = null;
    let messageIndex = 0;
    let isWaitingForResponse = false; // Track if we're waiting for a response
    window.trajectoryPollingInterval = null; // Global reference for trajectory polling

    // Auto-expand functionality for textarea
    function adjustTextareaHeight() {
        // Get current content to check for multiline
        const content = commandInput.value;
        const lineCount = (content.match(/\n/g) || []).length + 1;

        // Always reset to auto height first to get proper scrollHeight calculation
        commandInput.style.height = 'auto';

        if (lineCount > 1 || commandInput.scrollHeight > 52) {
            // For multi-line content or overflowing content, use scrollHeight
            const newHeight = Math.min(commandInput.scrollHeight, 150); // Max 150px
            commandInput.style.height = newHeight + 'px';

            // Add overflow class if content exceeds max height
            if (commandInput.scrollHeight > 150) {
                commandInput.classList.add('overflow');
            } else {
                commandInput.classList.remove('overflow');
            }
        } else {
            // For single line, keep fixed height
            commandInput.style.height = '52px';
            commandInput.classList.remove('overflow');
        }
    }

    // Initialize textarea height with consistent sizing
    commandInput.style.height = '52px'; // Set initial height directly
    adjustTextareaHeight();

    // Adjust height when typing or pasting
    commandInput.addEventListener('input', adjustTextareaHeight);
    commandInput.addEventListener('paste', () => {
        // Use setTimeout to allow paste content to be inserted
        setTimeout(adjustTextareaHeight, 0);
    });

    // Handle key events - Enter to submit, Shift+Enter for new line
    commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default new line behavior
            if (commandInput.value.trim()) {
                commandForm.dispatchEvent(new Event('submit'));
            }
        }
    });

    // Reset height when form submits - but keep consistent layout
    commandForm.addEventListener('submit', () => {
        setTimeout(() => {
            // Set height directly without changing the layout
            commandInput.value = '';
            commandInput.style.height = '52px'; // Match initial height plus padding
            commandInput.classList.remove('overflow');
        }, 0);
    });

    // Fetch app configuration (design types) at startup
    try {
        const response = await fetchWithTimeout('/api/config', {}, 10000);
        if (!response.ok) {
            throw new Error('Failed to fetch app configuration');
        }

        const config = await response.json();

        // Display welcome message if one is provided
        if (config.welcome_message) {
            addMessage(config.welcome_message, 'system');
        }

        // Initialize integrated viewer with configuration
        const modelViewer = document.getElementById('modelViewer');
        if (modelViewer && typeof initIntegratedViewer === 'function') {
            console.log('Initializing integrated viewer with config:', config);
            await initIntegratedViewer(modelViewer, config);
        }

        // Update model if one is provided in the initial configuration
        if (config.model) {
            console.log('Loading initial 3D model from config');
            updateModel(config.model);
        }

        // Dynamic creation of design type menu items
        if (config.design_types && config.design_types.length > 0) {
            // Clear existing items
            designDropdown.innerHTML = '';

            // Add each design type as a dropdown item
            config.design_types.forEach(designType => {
                const listItem = document.createElement('li');
                const link = document.createElement('a');
                link.className = 'dropdown-item';
                link.href = '#';
                link.textContent = designType.name;
                link.setAttribute('data-design-id', designType.id);
                link.setAttribute('title', designType.description);

                // Add click event listener
                link.addEventListener('click', function (e) {
                    e.preventDefault();
                    handleDesignSelection(designType.id);
                });

                listItem.appendChild(link);
                designDropdown.appendChild(listItem);
            });
        }
    } catch (error) {
        console.error('Error loading app configuration:', error);
        // Handle timeout errors specifically
        if (error.message.includes('timed out')) {
            console.log('Configuration request timed out - using fallback...');
        }
        // Fallback to default items if API fails
    }

    // Handler for selecting any design type
    async function handleDesignSelection(designType) {
        // Prevent selecting a design while waiting for a response
        if (isWaitingForResponse) {
            console.log('Waiting for previous response, ignoring new design selection');
            return;
        }

        try {
            console.log(`Starting new design of type: ${designType}`);

            // Set waiting state and disable input
            isWaitingForResponse = true;
            updateCommandInputState(true);

            // Reset message index
            messageIndex = 0;

            // Clear conversation
            conversationContainer.innerHTML = '';

            // Clear input
            commandInput.value = '';

            // Reset 3D viewer
            if (typeof resetViewer === 'function') {
                resetViewer();
            }

            // Show loading message without starting trajectory polling
            // We use a different loading message function for design selection
            // to avoid unnecessary trajectory polling
            const loadingMsg = addLoadingMessageWithoutPolling();

            // Call backend
            const response = await fetchWithTimeout('/new_design', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ type: designType })
            }, 15000);

            // Remove loading message
            if (loadingMsg) {
                loadingMsg.remove();
            }

            if (!response.ok) {
                throw new Error(`Failed to start ${designType} design`);
            }

            const data = await response.json();

            // Always display the message from the backend for new designs
            if (data.message) {
                addMessage(data.message, 'system', true);
            } else {
                // Fallback message if none is provided
                addMessage(`New ${designType.replace('_', ' ')} design started.`, 'system', true);
            }

            // Update model if one is provided
            if (data.model) {
                updateModel(data.model);
            }

        } catch (error) {
            console.error('Error:', error);
            // Handle timeout errors with user-friendly messages
            if (error.message.includes('timed out')) {
                addMessage(`Error: Request timed out while starting ${designType} design. Please try again.`, 'system error');
            } else {
                addMessage(`Error: Failed to start ${designType} design`, 'system error');
            }
        } finally {
            // Reset waiting state and enable input
            isWaitingForResponse = false;
            updateCommandInputState(false);
        }
    }

    // For backwards compatibility - attach click handlers to the static buttons too
    const emptyDesignBtn = document.getElementById('emptyDesign');
    if (emptyDesignBtn) {
        emptyDesignBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleDesignSelection('empty');
        });
    }

    const coffeeTableBtn = document.getElementById('coffeeTable');
    if (coffeeTableBtn) {
        coffeeTableBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleDesignSelection('coffee_table');
        });
    }

    // Utility function to clear/reset the 3D model viewer
    function clearModel() {
        if (typeof resetViewer === 'function') {
            resetViewer();
        } else if (typeof clearViewer === 'function') {
            clearViewer();
        } else {
            console.log('No clear/reset function available for 3D viewer');
        }
    }

    async function handleRollback(targetIndex, button) {
        // Prevent multiple submissions
        if (button.classList.contains('loading')) {
            return;
        }

        try {
            // Update button state to show loading
            button.classList.add('loading');
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rolling back...';

            const response = await fetchWithTimeout('/rollback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message_index: targetIndex })
            }, 15000);

            const data = await response.json();

            if (response.ok) {
                // Check if we need to update the 3D model
                if (data.model) {
                    console.log('Updating 3D model after rollback');
                    updateModel(data.model);
                } else if (data.reset_viewer) {
                    console.log('Resetting 3D viewer after rollback');
                    clearModel();
                }

                // Find the target system message and remove all messages after it
                const messages = Array.from(conversationContainer.getElementsByClassName('message'));
                let targetSystemMessage = null;

                // Find the target system message
                for (let message of messages) {
                    if (message.classList.contains('system-message')) {
                        const messageIndex = parseInt(message.dataset.messageIndex);
                        if (messageIndex === targetIndex) {
                            targetSystemMessage = message;
                            break;
                        }
                    }
                }

                if (targetSystemMessage) {
                    // Find the position of the target message
                    const targetPosition = messages.indexOf(targetSystemMessage);

                    // Remove all messages that come after the target (both user and system)
                    const messagesToRemove = messages.slice(targetPosition + 1);
                    messagesToRemove.forEach(message => message.remove());

                    console.log(`Removed ${messagesToRemove.length} messages after rollback point`);
                } else {
                    console.error(`Target system message with index ${targetIndex} not found`);
                }

                // Don't add any rollback completion message - just silently complete the rollback
                console.log(`Successfully rolled back to message ${targetIndex}`);

                // Reset button state after successful rollback
                button.classList.remove('loading');
                button.innerHTML = '<i class="fas fa-history"></i> Rollback here';
            } else {
                console.error('Rollback failed:', data.error);
                // Restore button state on error
                button.classList.remove('loading');
                button.innerHTML = '<i class="fas fa-history"></i> Rollback here';
            }
        } catch (error) {
            console.error('Error during rollback:', error);
            // Handle timeout errors with user feedback
            if (error.message.includes('timed out')) {
                addMessage('Error: Rollback request timed out. Please try again.', 'system error');
            }
            // Restore button state on error
            button.classList.remove('loading');
            button.innerHTML = '<i class="fas fa-history"></i> Rollback here';
        }
    }

    async function handleFeedback(messageIndex, feedbackType, button) {
        // Prevent multiple submissions
        if (button.classList.contains('active') || button.disabled) {
            return;
        }

        try {
            // Add a subtle click animation
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
            }, 100);

            // Disable all feedback buttons for this message temporarily
            const messageDiv = button.closest('.message');
            const allFeedbackButtons = messageDiv.querySelectorAll('.feedback-btn');
            allFeedbackButtons.forEach(btn => btn.disabled = true);

            const response = await fetchWithTimeout('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message_index: messageIndex,
                    feedback_type: feedbackType
                })
            }, 15000);

            const data = await response.json();

            if (response.ok) {
                // Mark the clicked button as active with animation
                button.classList.add('active');

                // Remove active state from the other feedback button
                const otherFeedbackType = feedbackType === 'thumbs_up' ? 'thumbs-down' : 'thumbs-up';
                const otherButton = messageDiv.querySelector(`.feedback-btn.${otherFeedbackType}`);
                if (otherButton) {
                    otherButton.classList.remove('active');
                }

                console.log(`Feedback submitted: ${feedbackType} for message ${messageIndex}`);

                // Enhanced success feedback
                const originalTitle = button.title;
                const originalIcon = button.innerHTML;

                // Show checkmark briefly
                button.innerHTML = '<i class="fas fa-check"></i>';
                button.title = 'Feedback submitted!';

                // Create a subtle success ripple effect
                const ripple = document.createElement('div');
                ripple.style.cssText = `
                    position: absolute;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.6);
                    transform: scale(0);
                    animation: ripple 0.6s linear;
                    pointer-events: none;
                    top: 50%;
                    left: 50%;
                    width: 10px;
                    height: 10px;
                    margin-left: -5px;
                    margin-top: -5px;
                `;

                // Add ripple keyframes if not already present
                if (!document.getElementById('ripple-style')) {
                    const style = document.createElement('style');
                    style.id = 'ripple-style';
                    style.textContent = `
                        @keyframes ripple {
                            to {
                                transform: scale(4);
                                opacity: 0;
                            }
                        }
                    `;
                    document.head.appendChild(style);
                }

                button.appendChild(ripple);

                setTimeout(() => {
                    ripple.remove();
                    button.innerHTML = originalIcon;
                    button.title = originalTitle;
                }, 1000);

            } else {
                console.error('Feedback submission failed:', data.message);

                // Show error feedback
                const originalIcon = button.innerHTML;
                button.innerHTML = '<i class="fas fa-times"></i>';
                button.style.borderColor = '#ef4444';

                setTimeout(() => {
                    button.innerHTML = originalIcon;
                    button.style.borderColor = '';
                }, 1500);
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);

            // Handle timeout errors specifically
            if (error.message.includes('timed out')) {
                console.warn('Feedback submission timed out');
                // Still show error visual feedback but don't add chat message for feedback timeouts
            }

            // Show error feedback
            const originalIcon = button.innerHTML;
            button.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            button.style.borderColor = '#ef4444';

            setTimeout(() => {
                button.innerHTML = originalIcon;
                button.style.borderColor = '';
            }, 1500);
        } finally {
            // Re-enable all feedback buttons for this message
            const messageDiv = button.closest('.message');
            const allFeedbackButtons = messageDiv.querySelectorAll('.feedback-btn');
            allFeedbackButtons.forEach(btn => btn.disabled = false);
        }
    }

    async function addMessage(text, type, isGeneratedResponse = false) {
        console.log('Adding message:', type, text);
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;

        // Store the current message index as a data attribute
        if (type === 'system') {
            messageDiv.dataset.messageIndex = messageIndex;
            // Mark if this is a generated response for feedback purposes
            if (isGeneratedResponse) {
                messageDiv.dataset.isGenerated = 'true';
            }
        }

        // Create icon container
        const iconDiv = document.createElement('div');
        iconDiv.className = 'message-icon';

        // Add appropriate icon based on message type
        if (type === 'user') {
            // Use the designer icon for user messages
            const designerImg = document.createElement('img');
            designerImg.src = '/static/images/designericon.png';
            designerImg.alt = 'Designer Icon';
            designerImg.className = 'designer-icon';
            iconDiv.appendChild(designerImg);
        } else {
            // System messages use the Morfis logo
            const logoImg = document.createElement('img');
            logoImg.src = '/static/images/logo.png';
            logoImg.alt = 'Morfis Logo';
            logoImg.className = 'morfis-logo';
            iconDiv.appendChild(logoImg);
        }

        // Create message content container
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';

        // Add rollback button for system messages that are not errors
        if (type === 'system') {
            const currentIndex = messageIndex++;
            const textContainer = document.createElement('div');
            textContainer.className = 'message-text';

            contentDiv.appendChild(textContainer);

            // Append elements to DOM before starting the typing animation
            messageDiv.appendChild(iconDiv);
            messageDiv.appendChild(contentDiv);
            conversationContainer.appendChild(messageDiv);

            console.log('Starting progressive typing for system message');
            await typeMessage(textContainer, text);
            console.log('Finished progressive typing');

            // After the message is typed, update rollback buttons for all system messages
            const messages = conversationContainer.getElementsByClassName('message');
            let lastSystemMessage = null;

            // Find the last system message
            for (let message of messages) {
                if (message.classList.contains('system-message')) {
                    lastSystemMessage = message;
                }
            }

            // Add or update rollback buttons for all system messages except the last one
            for (let message of messages) {
                if (message.classList.contains('system-message')) {
                    const messageContent = message.querySelector('.message-content');
                    let buttonContainer = messageContent.querySelector('.button-container');

                    // Save feedback state before removing container
                    let feedbackState = null;
                    if (buttonContainer) {
                        const thumbsUpBtn = buttonContainer.querySelector('.feedback-btn.thumbs-up');
                        const thumbsDownBtn = buttonContainer.querySelector('.feedback-btn.thumbs-down');
                        feedbackState = {
                            thumbsUp: thumbsUpBtn ? thumbsUpBtn.classList.contains('active') : false,
                            thumbsDown: thumbsDownBtn ? thumbsDownBtn.classList.contains('active') : false
                        };
                        buttonContainer.remove();
                    }

                    // Create button container for all system messages
                    buttonContainer = document.createElement('div');
                    buttonContainer.className = 'button-container';

                    // Add rollback button only if this is not the last system message and not the first message
                    const msgIndex = parseInt(message.dataset.messageIndex);
                    if (message !== lastSystemMessage && msgIndex > 0) {
                        const rollbackButton = document.createElement('button');
                        rollbackButton.className = 'rollback-btn';
                        rollbackButton.innerHTML = '<i class="fas fa-history"></i> Rollback here';
                        rollbackButton.onclick = () => handleRollback(msgIndex, rollbackButton);
                        buttonContainer.appendChild(rollbackButton);
                    }

                    // Add feedback buttons only for generated responses (not welcome messages)
                    if (message.dataset.isGenerated === 'true') {
                        const feedbackContainer = document.createElement('div');
                        feedbackContainer.className = 'feedback-container';

                        // Create thumbs up button
                        const thumbsUpBtn = document.createElement('button');
                        thumbsUpBtn.className = 'feedback-btn thumbs-up';
                        thumbsUpBtn.innerHTML = '<i class="fas fa-thumbs-up"></i>';
                        thumbsUpBtn.title = 'This response was helpful';
                        thumbsUpBtn.setAttribute('aria-label', 'Mark as helpful');
                        thumbsUpBtn.onclick = () => handleFeedback(parseInt(message.dataset.messageIndex), 'thumbs_up', thumbsUpBtn);

                        // Create thumbs down button
                        const thumbsDownBtn = document.createElement('button');
                        thumbsDownBtn.className = 'feedback-btn thumbs-down';
                        thumbsDownBtn.innerHTML = '<i class="fas fa-thumbs-down"></i>';
                        thumbsDownBtn.title = 'This response was not helpful';
                        thumbsDownBtn.setAttribute('aria-label', 'Mark as not helpful');
                        thumbsDownBtn.onclick = () => handleFeedback(parseInt(message.dataset.messageIndex), 'thumbs_down', thumbsDownBtn);

                        // Restore feedback state if it was previously set
                        if (feedbackState) {
                            if (feedbackState.thumbsUp) {
                                thumbsUpBtn.classList.add('active');
                            }
                            if (feedbackState.thumbsDown) {
                                thumbsDownBtn.classList.add('active');
                            }
                        }

                        feedbackContainer.appendChild(thumbsUpBtn);
                        feedbackContainer.appendChild(thumbsDownBtn);
                        buttonContainer.appendChild(feedbackContainer);
                    }

                    messageContent.appendChild(buttonContainer);
                }
            }
        } else {
            // For non-system messages, just add the text
            contentDiv.textContent = text;
            messageDiv.appendChild(iconDiv);
            messageDiv.appendChild(contentDiv);
            conversationContainer.appendChild(messageDiv);
        }

        // Scroll to bottom
        conversationContainer.scrollTop = conversationContainer.scrollHeight;
    }

    function showLoadingMessage() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';

        // Create icon container
        const iconDiv = document.createElement('div');
        iconDiv.className = 'message-icon';
        // Use Morfis logo for loading message as well
        const logoImg = document.createElement('img');
        logoImg.src = '/static/images/logo.png';
        logoImg.alt = 'Morfis Logo';
        logoImg.className = 'morfis-logo';
        iconDiv.appendChild(logoImg);

        // Create loading animation
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-message';
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.className = 'loading-dot';
            loadingDiv.appendChild(dot);
        }

        messageDiv.appendChild(iconDiv);
        messageDiv.appendChild(loadingDiv);
        conversationContainer.appendChild(messageDiv);

        // Start trajectory polling when loading begins
        if (!window.trajectoryPollingInterval) {
            console.log("Starting trajectory polling during model generation");
            window.trajectoryPollingInterval = setInterval(function () {
                // Call loadTrajectoryContent if it exists
                if (typeof window.loadTrajectoryContent === 'function') {
                    window.loadTrajectoryContent();
                }
            }, 5000); // Updated polling interval from 3 to 5 seconds
        }

        conversationContainer.scrollTop = conversationContainer.scrollHeight;
        return messageDiv;
    }

    async function typeMessage(element, text) {
        console.log('Starting typeMessage with text:', text);
        const delay = 30; // Delay between each character (ms)
        element.textContent = ''; // Clear the element first
        for (let i = 0; i < text.length; i++) {
            element.textContent += text[i];
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        console.log('Finished typeMessage');
    }

    commandForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        // Prevent submitting multiple commands while waiting for a response
        if (isWaitingForResponse) {
            console.log('Waiting for previous response, ignoring new submission');
            return;
        }

        const command = commandInput.value.trim();
        if (!command) return;

        // Set waiting state and disable input
        isWaitingForResponse = true;
        updateCommandInputState(true);

        // Add user message to conversation
        addMessage(command, 'user');
        commandInput.value = '';

        // Show loading message
        loadingMessage = showLoadingMessage();

        try {
            const response = await fetchWithTimeout('/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ command: command })
            }, 180000); // 3 minutes timeout for generation

            const data = await response.json();

            // Remove loading message
            if (loadingMessage) {
                loadingMessage.remove();
                loadingMessage = null;

                // Stop trajectory polling when generation is complete
                if (window.trajectoryPollingInterval) {
                    console.log("Stopping trajectory polling after model generation");
                    clearInterval(window.trajectoryPollingInterval);
                    window.trajectoryPollingInterval = null;
                }
            }

            if (response.ok) {
                // Add system response to conversation
                addMessage(data.message, 'system', true);

                // Update or reset 3D model
                if (data.model) {
                    updateModel(data.model);
                } else if (data.reset_viewer) {
                    // If reset_viewer flag is set, reset the 3D viewer
                    if (typeof resetViewer === 'function') {
                        resetViewer();
                    }
                }
            } else {
                addMessage('Error: ' + data.error, 'system error');
            }
        } catch (error) {
            // Remove loading message on error
            if (loadingMessage) {
                loadingMessage.remove();
                loadingMessage = null;

                // Also stop trajectory polling on error
                if (window.trajectoryPollingInterval) {
                    console.log("Stopping trajectory polling after error");
                    clearInterval(window.trajectoryPollingInterval);
                    window.trajectoryPollingInterval = null;
                }
            }
            console.error('Error:', error);

            // Handle timeout errors with user-friendly messages
            if (error.message.includes('timed out')) {
                addMessage('Error: Request timed out. The server may be busy - please try again.', 'system error');
            } else {
                addMessage('Error: Failed to process command', 'system error');
            }
        } finally {
            // Reset waiting state and enable input
            isWaitingForResponse = false;
            updateCommandInputState(false);
        }
    });

    // Function to update the command input state (disabled/enabled)
    function updateCommandInputState(disabled) {
        commandInput.disabled = disabled;
        const submitButton = commandForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = disabled;
        }

        // Add visual indication that the input is disabled
        if (disabled) {
            commandInput.classList.add('waiting');
            if (submitButton) {
                submitButton.classList.add('waiting');
            }
        } else {
            commandInput.classList.remove('waiting');
            if (submitButton) {
                submitButton.classList.remove('waiting');
            }
        }
    }

    // Function to show loading message without starting trajectory polling
    // Used for non-generative operations like new design and rollback
    function addLoadingMessageWithoutPolling() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';

        // Create icon container
        const iconDiv = document.createElement('div');
        iconDiv.className = 'message-icon';
        // Use Morfis logo for loading message
        const logoImg = document.createElement('img');
        logoImg.src = '/static/images/logo.png';
        logoImg.alt = 'Morfis Logo';
        logoImg.className = 'morfis-logo';
        iconDiv.appendChild(logoImg);

        // Create loading animation without starting polling
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'message-content loading-dots';

        // Create three dots in a row with proper styling
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('span');
            loadingDiv.appendChild(dot);
        }

        messageDiv.appendChild(iconDiv);
        messageDiv.appendChild(loadingDiv);
        conversationContainer.appendChild(messageDiv);

        // Unlike showLoadingMessage, we do NOT start trajectory polling here

        conversationContainer.scrollTop = conversationContainer.scrollHeight;
        return messageDiv;
    }
}

// Check authentication status and initialize app accordingly
document.addEventListener('DOMContentLoaded', function () {
    // Check if login overlay exists (indicates user is not authenticated)
    const loginOverlay = document.getElementById('loginOverlay');

    if (!loginOverlay) {
        // User is authenticated, initialize the app
        initializeMorfisApp();
    } else {
        // User not authenticated, wait for login
        console.log('Morfis: Authentication required, app initialization blocked');

        // Listen for successful login
        const observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (mutation) {
                if (mutation.type === 'childList') {
                    // Check if login overlay was removed
                    if (!document.getElementById('loginOverlay')) {
                        console.log('Morfis: Authentication successful, initializing app');
                        initializeMorfisApp();
                        observer.disconnect();
                    }
                }
            });
        });

        // Watch for removal of login overlay
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
});