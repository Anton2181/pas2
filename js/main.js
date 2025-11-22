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

    // Start at top-left
    if (elements.canvasContainer) {
        elements.canvasContainer.scrollLeft = 0;
        elements.canvasContainer.scrollTop = 0;
    }
}

// Start the application
init();
