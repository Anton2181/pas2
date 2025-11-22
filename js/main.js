// Main Initialization

async function init() {
    initElements();
    await loadData();

    state.availableTasks = [...TASKS];

    setupSidebar();
    renderSidebarLists();
    setupDragAndDrop();
    setupZoom();
    setupGroups();
    setupDataRefresh();
}

// Start the application
init();
