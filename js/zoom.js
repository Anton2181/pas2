// Zoom Functionality

function setupZoom() {
    if (elements.zoomIn && elements.zoomOut) {
        elements.zoomIn.addEventListener('click', () => updateZoom(0.1));
        elements.zoomOut.addEventListener('click', () => updateZoom(-0.1));
    }
}

function updateZoom(delta) {
    state.zoomLevel = Math.max(0.5, Math.min(2, state.zoomLevel + delta));
    applyZoom();
}

function applyZoom() {
    document.documentElement.style.setProperty('--zoom-scale', state.zoomLevel);
    const badgeScale = (1 + 0.5 * (state.zoomLevel - 1)) / state.zoomLevel;
    document.documentElement.style.setProperty('--badge-scale', badgeScale);
}
