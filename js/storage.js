// Storage Management (Save/Load/Autosave)

const AUTOSAVE_INTERVAL = 30000; // 30 seconds

function initStorage() {
    if (elements.saveFileBtn) {
        elements.saveFileBtn.addEventListener('click', exportToFile);
    }
    if (elements.loadFileBtn) {
        elements.loadFileBtn.addEventListener('click', () => {
            document.getElementById('file-input').click();
        });
    }
    if (document.getElementById('file-input')) {
        document.getElementById('file-input').addEventListener('change', importFromFile);
    }

    // Autosave is now triggered by pushState

    // Load autosave on startup if available
    // We do this in main.js or here? 
    // Let's provide a function to check and load.
}

function saveWorkspace(silent = false) {
    const data = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        state: {
            availableTasks: state.availableTasks,
            usedTasks: state.usedTasks,
            skippedTasks: state.skippedTasks,
            canvasTasks: state.canvasTasks,
            groups: state.groups,
            connections: state.connections,
            nextInstanceId: state.nextInstanceId,
            nextGroupId: state.nextGroupId
        }
    };

    localStorage.setItem('workspace_autosave', JSON.stringify(data));
    console.log('Workspace autosaved');

    if (!silent) {
        showToast('Workspace saved');
    }
}

function loadWorkspace() {
    const stored = localStorage.getItem('workspace_autosave');
    if (stored) {
        try {
            const data = JSON.parse(stored);
            restoreState(data.state); // Use history.js restore function
            console.log('Workspace loaded from autosave');
            pushState(); // Add to history
            return true;
        } catch (e) {
            console.error('Failed to load workspace', e);
        }
    }
    return false;
}

function exportToFile() {
    const data = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        state: {
            availableTasks: state.availableTasks,
            usedTasks: state.usedTasks,
            skippedTasks: state.skippedTasks,
            canvasTasks: state.canvasTasks,
            groups: state.groups,
            connections: state.connections,
            nextInstanceId: state.nextInstanceId,
            nextGroupId: state.nextGroupId
        }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tangoplan_workspace_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importFromFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (data.state) {
                restoreState(data.state);
                pushState();
                showToast('Workspace loaded from file');
            } else {
                alert('Invalid file format');
            }
        } catch (err) {
            console.error('Error parsing file', err);
            alert('Error parsing file');
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #333;
        color: white;
        padding: 10px 20px;
        border-radius: 4px;
        z-index: 2000;
        opacity: 0;
        transition: opacity 0.3s;
    `;
    document.body.appendChild(toast);

    // Trigger reflow
    toast.offsetHeight;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
