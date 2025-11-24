// Main Application Logic

// Shared Date Logic
function setupDateEditable() {
    const dateEl = document.getElementById('project-date');
    if (!dateEl) return;

    const storedDate = localStorage.getItem('project_date');
    if (storedDate) {
        dateEl.textContent = storedDate;
    }

    dateEl.addEventListener('dblclick', () => {
        const currentText = dateEl.textContent;
        const input = document.createElement('input');
        input.value = currentText;

        input.onblur = () => {
            const newValue = input.value || 'December 2025';
            dateEl.textContent = newValue;
            localStorage.setItem('project_date', newValue);
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') input.blur();
        };

        dateEl.textContent = '';
        dateEl.appendChild(input);
        input.focus();
    });
}

async function init() {
    // Setup Date
    setupDateEditable();

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
    initCanvasSearch();
    initHistory();
    // setupReset(); // Removed to avoid conflict with zoom.js

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

// setupReset removed


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
