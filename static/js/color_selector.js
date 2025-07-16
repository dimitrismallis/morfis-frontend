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
    // Give priority to 'selectedColor' over the older 'morfis_model_color'
    const savedColor = localStorage.getItem('selectedColor') || localStorage.getItem('morfis_model_color');
    if (savedColor) {
        console.log(`🎨 Color selector loading saved color: ${savedColor}`);
        // Set the saved color as active
        colorOptions.forEach(option => {
            if (option.dataset.color === savedColor) {
                setActiveColor(option);
            }
        });
    } else {
        console.log('🎨 No saved color found, using default');
    }

    // Add click event listeners to all color options
    colorOptions.forEach(colorOption => {
        colorOption.addEventListener('click', () => {
            console.log(`🎨 Color option clicked: ${colorOption.dataset.color}`);

            // Set this color as active
            setActiveColor(colorOption);

            // Get the color value
            const color = colorOption.dataset.color;

            // Save to localStorage
            localStorage.setItem('morfis_model_color', color);
            localStorage.setItem('selectedColor', color);
            console.log(`💾 Saved color to localStorage: ${color}`);

            // Update the model color immediately
            if (window.updateModelColor) {
                console.log(`🔄 Calling window.updateModelColor(${color})`);
                window.updateModelColor(color);
            } else {
                console.log('❌ window.updateModelColor not available');
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