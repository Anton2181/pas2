// History Management for Undo/Redo

const HISTORY_STACK_SIZE = 50;
const historyStack = [];
let historyIndex = -1;
let isRestoring = false;

function initHistory() {
    if (elements.undoBtn) {
        elements.undoBtn.addEventListener('click', undo);
    }
    // Initial state is now handled in main.js
}

function pushState() {
    if (isRestoring) return;

    // Remove future states if we are in the middle of the stack
    if (historyIndex < historyStack.length - 1) {
        historyStack.splice(historyIndex + 1);
    }

    // Create deep copy of state
    const snapshot = JSON.parse(JSON.stringify({
        availableTasks: state.availableTasks,
        usedTasks: state.usedTasks,
        skippedTasks: state.skippedTasks,
        canvasTasks: state.canvasTasks,
        groups: state.groups,
        connections: state.connections,
        nextInstanceId: state.nextInstanceId,
        nextGroupId: state.nextGroupId
    }));

    historyStack.push(snapshot);
    if (historyStack.length > HISTORY_STACK_SIZE) {
        historyStack.shift();
    } else {
        historyIndex++;
    }

    updateUndoButton();

    // Autosave
    if (typeof saveWorkspace === 'function') {
        saveWorkspace(true);
    }
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreState(historyStack[historyIndex]);
        updateUndoButton();
    }
}

function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        restoreState(historyStack[historyIndex]);
        updateUndoButton();
    }
}

function restoreState(snapshot) {
    isRestoring = true;

    // Restore state variables
    state.availableTasks = JSON.parse(JSON.stringify(snapshot.availableTasks));
    state.usedTasks = JSON.parse(JSON.stringify(snapshot.usedTasks));
    state.skippedTasks = JSON.parse(JSON.stringify(snapshot.skippedTasks));
    state.canvasTasks = JSON.parse(JSON.stringify(snapshot.canvasTasks));
    state.groups = JSON.parse(JSON.stringify(snapshot.groups));
    state.connections = JSON.parse(JSON.stringify(snapshot.connections));
    state.nextInstanceId = snapshot.nextInstanceId;
    state.nextGroupId = snapshot.nextGroupId;

    // Re-render everything
    renderAll();

    isRestoring = false;
}

function updateUndoButton() {
    if (elements.undoBtn) {
        elements.undoBtn.disabled = historyIndex <= 0;
        elements.undoBtn.style.opacity = historyIndex <= 0 ? '0.5' : '1';
    }
}
