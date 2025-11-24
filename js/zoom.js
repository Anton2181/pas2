// Zoom and Pan Controls

let resetConfirmationTimeout = null;

function setupZoom() {
    console.log('setupZoom called');
    if (elements.zoomIn) {
        elements.zoomIn.addEventListener('click', () => {
            updateZoom(0.1);
        });
    }

    if (elements.zoomOut) {
        elements.zoomOut.addEventListener('click', () => {
            updateZoom(-0.1);
        });
    }

    if (elements.fitBtn) {
        elements.fitBtn.addEventListener('click', fitToContent);
    }

    if (elements.resetBtn) {
        console.log('Reset button found, attaching listener');
        elements.resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();

            // If Shift is held, force reset immediately
            if (e.shiftKey) {
                resetWorkspace(true);
                return;
            }

            // Check if already in confirming state
            if (elements.resetBtn.classList.contains('confirming')) {
                // Confirmed!
                clearTimeout(resetConfirmationTimeout);
                elements.resetBtn.classList.remove('confirming');
                elements.resetBtn.innerHTML = '⟲'; // Reset icon
                resetWorkspace(true); // Force reset as we already confirmed
            } else {
                // First click - enter confirming state
                elements.resetBtn.classList.add('confirming');
                elements.resetBtn.innerHTML = '??'; // Change text to question marks

                // Auto-revert after 3 seconds
                resetConfirmationTimeout = setTimeout(() => {
                    elements.resetBtn.classList.remove('confirming');
                    elements.resetBtn.innerHTML = '⟲';
                }, 3000);
            }
        });
    } else {
        console.error('Reset button NOT found in elements');
    }

    // Ctrl+Scroll to zoom
    elements.canvasContainer.addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();

            // Zoom delta (negative deltaY = zoom in)
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            updateZoom(delta);
        }
    }, { passive: false });

    setupPanning();
}

function resetWorkspace(force = false) {
    console.log('resetWorkspace called');
    const confirmed = force || confirm('Are you sure you want to clear the canvas?');
    console.log('Confirmation result:', confirmed);

    if (confirmed) {
        // Reset State
        state.canvasTasks = [];
        state.groups = [];
        state.connections = [];
        state.nextInstanceId = 1;
        state.nextGroupId = 1;

        // Clear DOM
        const canvas = elements.canvas;
        const connectionsLayer = document.getElementById('connections-layer');

        // Remove all task cards and groups
        const tasks = canvas.querySelectorAll('.task-card');
        const groups = canvas.querySelectorAll('.component-group');
        console.log(`Removing ${tasks.length} tasks and ${groups.length} groups`);

        tasks.forEach(el => el.remove());
        groups.forEach(el => el.remove());

        // Clear connections
        while (connectionsLayer.firstChild) {
            connectionsLayer.removeChild(connectionsLayer.firstChild);
        }

        // Return used tasks to available
        state.usedTasks.forEach(task => {
            if (!state.availableTasks.find(t => t.id === task.id)) {
                state.availableTasks.push(task);
            }
        });
        state.usedTasks = [];
        state.skippedTasks = [];

        if (typeof renderSidebarLists === 'function') {
            renderSidebarLists();
        } else {
            console.error('renderSidebarLists is not defined');
        }

        // Reset Zoom and Pan
        state.zoomLevel = 1;
        applyZoom();

        // Move view to top-left
        const container = elements.canvasContainer;
        container.scrollLeft = 0;
        container.scrollTop = 0;

        if (typeof pushState === 'function') pushState();
        console.log('Workspace reset complete');
    }
}

function updateZoom(change) {
    const container = elements.canvasContainer;
    const oldZoom = state.zoomLevel;

    // 1. Get center point relative to content (unscaled)
    const viewCenterX = container.scrollLeft + container.clientWidth / 2;
    const viewCenterY = container.scrollTop + container.clientHeight / 2;

    const contentCenterX = viewCenterX / oldZoom;
    const contentCenterY = viewCenterY / oldZoom;

    // 2. Update Zoom
    const newLevel = Math.max(0.2, Math.min(3, state.zoomLevel + change));
    state.zoomLevel = newLevel;
    applyZoom();

    // 3. Calculate new scroll positions to keep content center at view center
    const newViewCenterX = contentCenterX * newLevel;
    const newViewCenterY = contentCenterY * newLevel;

    container.scrollLeft = newViewCenterX - container.clientWidth / 2;
    container.scrollTop = newViewCenterY - container.clientHeight / 2;
}

function applyZoom() {
    // Scale the content wrapper
    elements.canvas.style.transform = `scale(${state.zoomLevel})`;

    // Update the sizer dimensions to match the scaled content
    if (elements.canvasSizer) {
        elements.canvasSizer.style.width = `${6000 * state.zoomLevel}px`;
        elements.canvasSizer.style.height = `${4000 * state.zoomLevel}px`;
    }
}

function setupPanning() {
    let isPanning = false;
    let startX, startY;
    let scrollLeft, scrollTop;

    elements.canvasContainer.addEventListener('mousedown', (e) => {
        // Only pan if clicking on the background (canvas-content or canvasContainer)
        // and NOT on a task or group
        if (e.target.closest('.task-card') ||
            e.target.closest('.component-group') ||
            e.target.closest('.zoom-controls')) return;

        isPanning = true;
        elements.canvasContainer.classList.add('panning');
        startX = e.pageX - elements.canvasContainer.offsetLeft;
        startY = e.pageY - elements.canvasContainer.offsetTop;
        scrollLeft = elements.canvasContainer.scrollLeft;
        scrollTop = elements.canvasContainer.scrollTop;
    });

    elements.canvasContainer.addEventListener('mouseleave', () => {
        isPanning = false;
        elements.canvasContainer.classList.remove('panning');
    });

    elements.canvasContainer.addEventListener('mouseup', () => {
        isPanning = false;
        elements.canvasContainer.classList.remove('panning');
    });

    elements.canvasContainer.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        e.preventDefault();
        const x = e.pageX - elements.canvasContainer.offsetLeft;
        const y = e.pageY - elements.canvasContainer.offsetTop;
        const walkX = (x - startX);
        const walkY = (y - startY);
        elements.canvasContainer.scrollLeft = scrollLeft - walkX;
        elements.canvasContainer.scrollTop = scrollTop - walkY;
    });
}

function fitToContent() {
    const items = [
        ...state.canvasTasks,
        ...state.groups
    ];

    if (items.length === 0) {
        state.zoomLevel = 1;
        applyZoom();
        // Center the view in the large canvas
        const containerW = elements.canvasContainer.clientWidth;
        const containerH = elements.canvasContainer.clientHeight;
        // We want to scroll to 0,0 effectively? Or center of the 300% area?
        // Let's just scroll to top-left for empty
        elements.canvasContainer.scrollLeft = 0;
        elements.canvasContainer.scrollTop = 0;
        return;
    }

    // Calculate bounding box (unscaled coordinates)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    items.forEach(item => {
        const width = item.width || 200;
        const height = item.height || 100;

        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + width);
        maxY = Math.max(maxY, item.y + height);
    });

    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const totalWidth = maxX - minX;
    const totalHeight = maxY - minY;

    const containerW = elements.canvasContainer.clientWidth;
    const containerH = elements.canvasContainer.clientHeight;

    // Calculate scale to fit
    const scaleX = containerW / totalWidth;
    const scaleY = containerH / totalHeight;
    let newZoom = Math.min(scaleX, scaleY);

    // Clamp zoom
    newZoom = Math.max(0.2, Math.min(1.5, newZoom));

    state.zoomLevel = newZoom;
    applyZoom();

    // Center the view
    // Center of bounding box in unscaled coordinates
    const centerX = minX + totalWidth / 2;
    const centerY = minY + totalHeight / 2;

    // We need to scroll so that (centerX * zoom, centerY * zoom) is at (containerW/2, containerH/2)
    const scaledCenterX = centerX * state.zoomLevel;
    const scaledCenterY = centerY * state.zoomLevel;

    elements.canvasContainer.scrollLeft = scaledCenterX - (containerW / 2);
    elements.canvasContainer.scrollTop = scaledCenterY - (containerH / 2);
}
