// Save Design Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get the save design button and modal elements
    const saveDesignBtn = document.getElementById('saveDesignBtn');
    const saveDesignModal = document.getElementById('saveDesignModal');
    const saveDesignForm = document.getElementById('saveDesignForm');
    const designNameInput = document.getElementById('designName');
    const confirmSaveBtn = document.getElementById('confirmSaveDesign');
    const saveDesignStatus = document.getElementById('saveDesignStatus');
    
    // Add click event listener to save design button
    if (saveDesignBtn) {
        saveDesignBtn.addEventListener('click', function() {
            openSaveDesignModal();
        });
    }
    
    // Function to open the save design modal
    function openSaveDesignModal() {
        // Reset the form and status message
        if (saveDesignForm) saveDesignForm.reset();
        if (saveDesignStatus) {
            saveDesignStatus.className = 'mt-3 d-none';
            saveDesignStatus.textContent = '';
        }
        
        // Initialize Bootstrap modal
        const modal = new bootstrap.Modal(saveDesignModal);
        modal.show();
        
        // Focus on the design name input after modal is shown
        saveDesignModal.addEventListener('shown.bs.modal', function() {
            designNameInput.focus();
        }, { once: true });
    }
    
    // Add submit handler for the save design form
    if (confirmSaveBtn) {
        confirmSaveBtn.addEventListener('click', async function() {
            // Validate form
            if (!designNameInput.value.trim()) {
                showSaveStatus('Please enter a design name', 'error');
                designNameInput.focus();
                return;
            }
            
            // Show loading state
            const originalBtnText = confirmSaveBtn.innerHTML;
            confirmSaveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
            confirmSaveBtn.disabled = true;
            
            try {
                // Call the backend to save the design
                const response = await fetch('/save_design', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: designNameInput.value.trim()
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.status === 'success') {
                    // Show success message
                    showSaveStatus(data.message, 'success');
                    
                    // Close modal after a short delay
                    setTimeout(() => {
                        bootstrap.Modal.getInstance(saveDesignModal).hide();
                    }, 2000);
                } else {
                    // Show error message
                    showSaveStatus(data.message || 'Failed to save design', 'error');
                }
            } catch (error) {
                console.error('Error saving design:', error);
                showSaveStatus('An error occurred while saving the design', 'error');
            } finally {
                // Reset button state
                confirmSaveBtn.innerHTML = originalBtnText;
                confirmSaveBtn.disabled = false;
            }
        });
    }
    
    // Allow pressing Enter in the input field to submit the form
    if (designNameInput) {
        designNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmSaveBtn.click();
            }
        });
    }
    
    // Function to show status messages
    function showSaveStatus(message, type) {
        if (!saveDesignStatus) return;
        
        saveDesignStatus.textContent = message;
        saveDesignStatus.className = `mt-3 ${type}`;
        saveDesignStatus.classList.remove('d-none');
    }
});