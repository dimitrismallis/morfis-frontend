// STEP Preview functionality - Opens 3D viewer in new window
document.addEventListener('DOMContentLoaded', function () {
    const stepViewerBtn = document.getElementById('stepViewerBtn');

    if (stepViewerBtn) {
        stepViewerBtn.addEventListener('click', function () {
            openStepViewer();
        });
    }
});

function openStepViewer() {
    // Open the STEP viewer in a new window
    const viewerUrl = '/step-viewer';
    const windowFeatures = 'width=1200,height=800,scrollbars=yes,resizable=yes,menubar=no,toolbar=no,location=no,status=no';

    const viewerWindow = window.open(viewerUrl, 'stepViewer', windowFeatures);

    // Focus the new window if it was successfully opened
    if (viewerWindow) {
        viewerWindow.focus();
    } else {
        // Fallback if popup was blocked
        alert('Please allow popups for this site to open the 3D viewer, or manually navigate to: ' + window.location.origin + viewerUrl);
    }
} 