// Color Selector Functionality
document.addEventListener('DOMContentLoaded', () => {
    // Get all color options
    const colorOptions = document.querySelectorAll('.color-option');

    // Define color names for better readability
    const colorNames = {
        '#9146FF': 'Purple',
        '#FF4136': 'Red',
        '#2ECC40': 'Green',
        '#0074D9': 'Blue',
        '#FF851B': 'Orange'
    };

    // Check if there's a saved color preference in localStorage
    const savedColor = localStorage.getItem('morfis_model_color');
    if (savedColor) {
        // Set the saved color as active
        colorOptions.forEach(option => {
            if (option.dataset.color === savedColor) {
                setActiveColor(option);
            }
        });
    }

    // Add click event listeners to all color options
    colorOptions.forEach(colorOption => {
        colorOption.addEventListener('click', () => {
            // Set this color as active
            setActiveColor(colorOption);

            // Get the color value
            const color = colorOption.dataset.color;

            // Save to localStorage
            localStorage.setItem('morfis_model_color', color);
            localStorage.setItem('selectedColor', color);

            // Update the model color immediately
            if (window.updateModelColor) {
                window.updateModelColor(color);
            }
        });
    });

    // Function to set active color
    function setActiveColor(option) {
        // Remove active class from all options
        colorOptions.forEach(opt => opt.classList.remove('active'));

        // Add active class to selected option
        option.classList.add('active');
    }
});