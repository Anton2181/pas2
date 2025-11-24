// Global Storage Management - Shared across all pages

function exportGlobalData() {
    // Gather all localStorage data
    const allData = {
        timestamp: new Date().toISOString(),
        version: '1.0',
        workspace: null,
        stars: {},
        teamRoles: {},
        projectDate: null,
        spreadsheetData: null
    };

    // Get workspace state
    const workspaceStr = localStorage.getItem('workspace_autosave');
    if (workspaceStr) {
        try {
            allData.workspace = JSON.parse(workspaceStr);
        } catch (e) {
            console.error('Failed to parse workspace data', e);
        }
    }

    // Get all star assignments (candidate_star_* and task_star_*)
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('candidate_star_') || key.startsWith('task_star_')) {
            allData.stars[key] = localStorage.getItem(key);
        }
    }

    // Get all team role toggles
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('team_role_')) {
            const value = localStorage.getItem(key);
            try {
                allData.teamRoles[key] = JSON.parse(value);
            } catch (e) {
                allData.teamRoles[key] = value;
            }
        }
    }

    // Get project date
    allData.projectDate = localStorage.getItem('project_date');

    // Get spreadsheet data cache
    const spreadsheetStr = localStorage.getItem('spreadsheetData');
    if (spreadsheetStr) {
        try {
            allData.spreadsheetData = JSON.parse(spreadsheetStr);
        } catch (e) {
            console.error('Failed to parse spreadsheet data', e);
        }
    }

    // Create filename with readable format
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    // Format: Warsaw_Tango_Partyka_2025_11_24_15_30.JSON
    const filename = `Warsaw_Tango_Partyka_${year}_${month}_${day}_${hours}_${minutes}.JSON`;

    // Download file
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.setAttribute('download', filename); // Ensure download attribute is set
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('All data exported successfully');
}

function importGlobalData(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            // Restore workspace state
            if (data.workspace) {
                localStorage.setItem('workspace_autosave', JSON.stringify(data.workspace));
            }

            // Restore all star assignments
            if (data.stars) {
                for (const [key, value] of Object.entries(data.stars)) {
                    localStorage.setItem(key, value);
                }
            }

            // Restore team roles
            if (data.teamRoles) {
                for (const [key, value] of Object.entries(data.teamRoles)) {
                    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                }
            }

            // Restore project date
            if (data.projectDate) {
                localStorage.setItem('project_date', data.projectDate);
            }

            // Restore spreadsheet data cache
            if (data.spreadsheetData) {
                localStorage.setItem('spreadsheetData', JSON.stringify(data.spreadsheetData));
            }

            showToast('All data imported successfully - Refresh the page to see changes');

            // Reload the page after a short delay to apply changes
            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (err) {
            console.error('Error parsing file', err);
            alert('Error parsing file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function initGlobalStorage() {
    const saveBtn = document.getElementById('global-save-btn');
    const loadBtn = document.getElementById('global-load-btn');
    const fileInput = document.getElementById('global-file-input');

    if (saveBtn) {
        saveBtn.addEventListener('click', exportGlobalData);
    }

    if (loadBtn && fileInput) {
        loadBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importGlobalData(file);
            }
            e.target.value = ''; // Reset input
        });
    }
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
