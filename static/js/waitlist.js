// Waitlist join functionality

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

document.addEventListener('DOMContentLoaded', function () {
    const joinWaitlistBtn = document.getElementById('joinWaitlistBtn');

    if (joinWaitlistBtn) {
        joinWaitlistBtn.addEventListener('click', function () {
            // Create waitlist form modal
            const modalEl = document.createElement('div');
            modalEl.className = 'waitlist-modal';
            modalEl.innerHTML = `
                <div class="waitlist-form-container">
                    <h3>Join the Morfis waitlist and become an Alpha tester</h3>
                    <form id="waitlistForm">
                        <div class="form-group">
                            <label for="firstName">First Name*</label>
                            <input type="text" id="firstName" name="firstName" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="lastName">Last Name*</label>
                            <input type="text" id="lastName" name="lastName" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="email">Email*</label>
                            <input type="email" id="email" name="email" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label for="organization">Organization</label>
                            <input type="text" id="organization" name="organization" class="form-control">
                        </div>
                        <div class="form-group consent-group">
                            <input type="checkbox" id="consent" name="consent" required>
                            <label for="consent">By submitting this form, you give us permission to store and use your personal information solely to contact you about alpha testing.</label>
                        </div>
                        <div class="form-buttons">
                            <button type="button" class="cancel-btn">Cancel</button>
                            <button type="submit" class="submit-btn">Submit</button>
                        </div>
                    </form>
                </div>
            `;

            // Add modal to the body
            document.body.appendChild(modalEl);

            // After a short delay, add the 'show' class to animate in
            setTimeout(() => {
                modalEl.classList.add('show');
            }, 10);

            // Add cancel button functionality
            const cancelBtn = modalEl.querySelector('.cancel-btn');
            cancelBtn.addEventListener('click', function () {
                closeModal(modalEl);
            });

            // Add form submission handler
            const waitlistForm = modalEl.querySelector('#waitlistForm');
            waitlistForm.addEventListener('submit', function (e) {
                e.preventDefault();

                // Get form data
                const formData = {
                    firstName: waitlistForm.firstName.value.trim(),
                    lastName: waitlistForm.lastName.value.trim(),
                    email: waitlistForm.email.value.trim(),
                    organization: waitlistForm.organization.value.trim(),
                    consent: waitlistForm.consent.checked
                };

                // Show loading state
                const submitBtn = waitlistForm.querySelector('.submit-btn');
                const originalText = submitBtn.textContent;
                submitBtn.disabled = true;
                submitBtn.textContent = 'Submitting...';

                // Submit form data
                fetchWithTimeout('/api/waitlist', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                }, 15000) // 15 seconds timeout
                    .then(response => response.json())
                    .then(data => {
                        // Close the form modal
                        closeModal(modalEl);

                        // Show success message
                        showResultMessage(data.success, data.message);
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        // Handle timeout errors with specific message
                        if (error.message.includes('timed out')) {
                            showResultMessage(false, 'Request timed out. Please check your connection and try again.');
                        } else {
                            showResultMessage(false, 'An error occurred. Please try again.');
                        }
                    })
                    .finally(() => {
                        // Reset button state
                        submitBtn.disabled = false;
                        submitBtn.textContent = originalText;
                    });
            });
        });
    }

    // Helper function to close modal with animation
    function closeModal(modalEl) {
        modalEl.classList.remove('show');

        // Remove from DOM after animation completes
        setTimeout(() => {
            document.body.removeChild(modalEl);
        }, 300);
    }

    // Helper function to show result message
    function showResultMessage(success, message) {
        const alertEl = document.createElement('div');
        alertEl.className = 'waitlist-alert';
        alertEl.innerHTML = `
            <div class="alert-content ${success ? 'success' : 'error'}">
                <h3>${success ? 'Thank you!' : 'Oops!'}</h3>
                <p>${message}</p>
                <button class="alert-close-btn">Close</button>
            </div>
        `;

        // Add alert to the body
        document.body.appendChild(alertEl);

        // After a short delay, add the 'show' class to animate in
        setTimeout(() => {
            alertEl.classList.add('show');
        }, 10);

        // Add close button functionality
        const closeBtn = alertEl.querySelector('.alert-close-btn');
        closeBtn.addEventListener('click', function () {
            alertEl.classList.remove('show');

            // Remove from DOM after animation completes
            setTimeout(() => {
                document.body.removeChild(alertEl);
            }, 300);
        });
    }
});