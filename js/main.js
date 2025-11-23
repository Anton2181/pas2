// Main Initialization

async function init() {
    initElements();
    await loadData();

    state.availableTasks = [...TASKS];

    setupSidebar();
    renderSidebarLists();
    setupZoom();
    setupGroups();
    setupDataRefresh();
    setupDragAndDrop();
    initConnections();
    initHistory();
    initStorage();
    setupReset();

    // Try to load autosave
    if (loadWorkspace()) {
        showToast('Restored previous session');
    } else {
        // If no autosave, push initial state
        if (typeof pushState === 'function') pushState();
    }

    // Start at top-left
    if (elements.canvasContainer) {
        elements.canvasContainer.scrollLeft = 0;
        elements.canvasContainer.scrollTop = 0;
    }
}

function setupReset() {
    if (elements.resetBtn) {
        elements.resetBtn.onclick = () => {
            if (confirm('Are you sure you want to reset the workspace? This will clear all tasks and groups.')) {
                state.availableTasks = [...TASKS];
                state.usedTasks = [];
                state.skippedTasks = [];
                state.canvasTasks = [];
                state.groups = [];
                state.connections = [];
                state.nextInstanceId = 1;
                state.nextGroupId = 1;

                renderAll();
                if (typeof pushState === 'function') pushState();
                showToast('Workspace reset');
            }
        };
    }
}

function renderAll() {
    // Clear Canvas
    const canvasContent = elements.canvas;
    // Keep connections layer
    const connLayer = elements.connectionsLayer;

    // Remove all children except connections layer
    Array.from(canvasContent.children).forEach(child => {
        if (child.id !== 'connections-layer') {
            child.remove();
        }
    });

    // Clear connections layer
    connLayer.innerHTML = '';

    // Render Groups
    state.groups.forEach(group => {
        renderGroup(group);
    });

    // Render Canvas Tasks
    state.canvasTasks.forEach(task => {
        renderTaskOnCanvas(task);
    });

    // Update priorities for all task types
    const uniqueTaskIds = [...new Set(state.canvasTasks.map(t => t.id))];
    uniqueTaskIds.forEach(taskId => {
        updatePriorities(taskId);
    });

    // Render Connections
    renderConnections();

    // Render Sidebar
    renderSidebarLists();
}

// Start the application
init();
