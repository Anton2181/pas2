// Google Sheets Configuration
const SPREADSHEET_CONFIG = {
    id: '1s1hdDGjMQTjT1P5zO3xMX__hM1V-5Y9rEGt8uUg5_B0',
    gid: '342418684',
    get csvUrl() {
        const googleUrl = `https://docs.google.com/spreadsheets/d/${this.id}/export?format=csv&gid=${this.gid}`;
        return `https://corsproxy.io/?${encodeURIComponent(googleUrl)}`;
    }
};

// Data Models
let TASKS = [
    { id: 't1', name: 'Group Lesson', duration: 60, type: 'teaching' },
    { id: 't2', name: 'Private Lesson', duration: 45, type: 'teaching' },
    { id: 't3', name: 'Practica Supervision', duration: 120, type: 'supervision' },
    { id: 't4', name: 'Milonga DJ', duration: 240, type: 'music' },
    { id: 't5', name: 'Bar Shift', duration: 180, type: 'service' },
    { id: 't6', name: 'Cleaning', duration: 60, type: 'maintenance' }
];

let CANDIDATES = [
    { id: 'c1', name: 'Maria', roles: ['teaching', 'supervision'] },
    { id: 'c2', name: 'Juan', roles: ['teaching', 'music'] },
    { id: 'c3', name: 'Sofia', roles: ['service', 'maintenance'] },
    { id: 'c4', name: 'Carlos', roles: ['teaching', 'service'] },
    { id: 'c5', name: 'Elena', roles: ['supervision', 'music'] }
];

// Google Sheets Data Import
async function fetchSheetData() {
    try {
        const response = await fetch(SPREADSHEET_CONFIG.csvUrl);
        if (!response.ok) throw new Error('Failed to fetch spreadsheet data');
        const csv = await response.text();
        return parseCSV(csv);
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        return null;
    }
}

function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) return null;

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const taskNames = headers.slice(2);

    const candidates = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
        if (cells.length < 3) continue;

        const name = cells[0];
        const role = cells[1].toLowerCase();
        const availabilities = cells.slice(2);

        const roles = [];
        availabilities.forEach((avail, idx) => {
            if (avail.toLowerCase() === 'yes' && taskNames[idx]) {
                if (!roles.includes(taskNames[idx])) {
                    roles.push(taskNames[idx]);
                }
            }
        });

        if (name) {
            candidates.push({
                id: `c${i}`,
                name: name,
                role: role,
                roles: roles
            });
        }
    }

    const tasks = taskNames.map((taskName, idx) => ({
        id: `t${idx + 1}`,
        name: taskName,
        duration: 60,
        type: taskName.toLowerCase()
    }));

    return { tasks, candidates };
}

async function loadData(forceRefresh = false) {
    const stored = localStorage.getItem('spreadsheetData');
    const lastRefresh = localStorage.getItem('lastDataRefresh');

    if (!forceRefresh && stored) {
        try {
            const data = JSON.parse(stored);
            TASKS.length = 0;
            TASKS.push(...data.tasks);
            CANDIDATES.length = 0;
            CANDIDATES.push(...data.candidates);
            console.log('Loaded data from localStorage');
            return { success: true, timestamp: lastRefresh };
        } catch (e) {
            console.error('Error parsing stored data:', e);
        }
    }

    console.log('Fetching data from Google Sheets...');
    const data = await fetchSheetData();

    if (data) {
        TASKS.length = 0;
        TASKS.push(...data.tasks);
        CANDIDATES.length = 0;
        CANDIDATES.push(...data.candidates);

        const timestamp = new Date().toISOString();
        localStorage.setItem('spreadsheetData', JSON.stringify(data));
        localStorage.setItem('lastDataRefresh', timestamp);
        console.log('Data loaded from Google Sheets');
        return { success: true, timestamp: timestamp };
    }

    console.log('Using default data');
    return { success: false, timestamp: null };
}

function getLastRefreshDisplay() {
    const timestamp = localStorage.getItem('lastDataRefresh');
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '(just now)';
    if (diffMins < 60) return `(${diffMins}m ago)`;
    if (diffHours < 24) return `(${diffHours}h ago)`;
    return `(${diffDays}d ago)`;
}
