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
let TASKS = [];
let METRICS_DATA = [];
let CANDIDATES = [];

// Proper CSV parsing function that handles quoted fields
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

async function fetchSheetData() {
    try {
        const tasksUrl = 'https://corsproxy.io/?' + encodeURIComponent(
            `https://docs.google.com/spreadsheets/d/${SPREADSHEET_CONFIG.id}/export?format=csv&gid=342418684`
        );

        const metricsUrl = 'https://corsproxy.io/?' + encodeURIComponent(
            `https://docs.google.com/spreadsheets/d/${SPREADSHEET_CONFIG.id}/export?format=csv&gid=592403055`
        );

        const availabilityUrl = 'https://corsproxy.io/?' + encodeURIComponent(
            `https://docs.google.com/spreadsheets/d/${SPREADSHEET_CONFIG.id}/export?format=csv&gid=2123241311`
        );

        const [tasksResponse, metricsResponse, availabilityResponse] = await Promise.all([
            fetch(tasksUrl),
            fetch(metricsUrl),
            fetch(availabilityUrl)
        ]);

        if (!tasksResponse.ok || !metricsResponse.ok || !availabilityResponse.ok) {
            throw new Error('Failed to fetch spreadsheet data');
        }

        const tasksCsv = await tasksResponse.text();
        const metricsCsv = await metricsResponse.text();
        const availabilityCsv = await availabilityResponse.text();

        const tasksData = parseTasksCSV(tasksCsv);
        const metricsData = parseMetricsCSV(metricsCsv);
        const availabilityData = parseAvailabilityCSV(availabilityCsv);

        if (!tasksData) {
            throw new Error('Failed to parse task data');
        }

        console.log('Tasks from Task Availability:', tasksData.tasks);
        console.log('Metrics from Template:', metricsData);
        console.log('Availability Data:', availabilityData);

        // Merge availability into candidates
        tasksData.candidates.forEach(candidate => {
            const avail = availabilityData.find(a => a.name === candidate.name);
            if (avail) {
                candidate.availability = avail.availability;
            } else {
                candidate.availability = {};
            }
        });

        // Get task names that have metrics in the Template
        const tasksWithMetrics = new Set(metricsData.map(m => m.name));

        // Filter to only include tasks that appear in both sheets (intersection)
        const intersectedTasks = tasksData.tasks.filter(task => tasksWithMetrics.has(task.name));

        console.log('Tasks in both sheets (intersection):', intersectedTasks);
        console.log(`Filtered from ${tasksData.tasks.length} to ${intersectedTasks.length} tasks`);

        // Update Globals
        TASKS.length = 0;
        TASKS.push(...intersectedTasks);

        CANDIDATES.length = 0;
        CANDIDATES.push(...tasksData.candidates);

        METRICS_DATA.length = 0;
        METRICS_DATA.push(...metricsData);

        // Save to LocalStorage
        localStorage.setItem('spreadsheetData', JSON.stringify({
            tasks: TASKS,
            candidates: CANDIDATES,
            metrics: METRICS_DATA
        }));

        // Update Globals
        TASKS.length = 0;
        TASKS.push(...intersectedTasks);

        CANDIDATES.length = 0;
        CANDIDATES.push(...tasksData.candidates);

        METRICS_DATA.length = 0;
        METRICS_DATA.push(...metricsData);

        // Save to LocalStorage
        localStorage.setItem('spreadsheetData', JSON.stringify({
            tasks: TASKS,
            candidates: CANDIDATES,
            metrics: METRICS_DATA
        }));

        return {
            tasks: intersectedTasks,
            candidates: tasksData.candidates,
            metrics: metricsData
        };
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        return null;
    }
}

function parseAvailabilityCSV(csv) {
    const rows = [];
    let currentRow = [];
    let inQuotes = false;
    let currentCell = '';

    // Simple CSV parser
    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (currentCell || currentRow.length > 0) currentRow.push(currentCell.trim());
            if (currentRow.length > 0) rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
    }

    // Structure Validation:
    // Row 3 (index 3): Weeks (Week 1, Week 2...)
    // Row 4 (index 4): Days (Tue, Wed...)
    // Row 5+ (index 5+): Candidates (Name in Column B / Index 1)

    if (rows.length < 6) {
        console.warn('Availability CSV too short:', rows.length);
        return [];
    }

    const weekRow = rows[3];
    const dayRow = rows[4];

    // Map columns to Week/Day
    const columnMap = {};
    let currentWeek = '';

    for (let i = 4; i < weekRow.length; i++) { // Starting from column E (index 4)
        if (weekRow[i] && weekRow[i].toLowerCase().includes('week')) {
            currentWeek = weekRow[i];
        }

        if (currentWeek && dayRow[i]) {
            // Normalize day name (Tue -> Tuesday)
            let dayName = dayRow[i];
            const dayMap = {
                'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday',
                'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday', 'Mon': 'Monday'
            };
            if (dayMap[dayName]) dayName = dayMap[dayName];

            columnMap[i] = { week: currentWeek, day: dayName };
        }
    }

    const candidates = [];
    for (let i = 5; i < rows.length; i++) {
        const row = rows[i];
        const name = row[1]; // Column B (Name)
        if (!name) continue;

        const availability = {};

        for (let j = 4; j < row.length; j++) {
            if (columnMap[j]) {
                const { week, day } = columnMap[j];
                const value = row[j];

                if (!availability[week]) availability[week] = {};
                availability[week][day] = value;
            }
        }

        candidates.push({ name, availability });
    }

    if (candidates.length === 0) {
        console.warn('No candidates parsed from Availability CSV');
    }

    return candidates;
}

// Helper to check availability (Global)
function isCandidateAvailable(candidate, taskName, taskTime, week, day) {
    // 1. Check Role (Implicitly done by caller usually, but good to be safe)
    // But for highlighting, we might need to check it here if the caller doesn't.
    // The aggregation logic checks roles separately.
    // Let's keep this focused on TIME availability, but maybe include role check if needed?
    // No, keep it focused on time/availability constraints. Role check is separate.

    // 2. Check Time Availability
    if (!candidate.availability) return true; // No availability data, assume available

    // Skip check for "0th Day" or tasks with "All" time
    if (day === '0th Day' || taskTime === 'All' || !taskTime) return true;

    // Normalize Week Name (e.g. "Week 10" matches "Week 10")
    const weekAvail = candidate.availability[week];
    if (!weekAvail) return true; // No data for this week

    const dayAvail = weekAvail[day];
    if (!dayAvail || dayAvail === 'None') return false; // Explicitly None or missing
    if (dayAvail === 'All') return true; // Available all day

    // 3. Check Time Range Intersection
    try {
        const parseTime = (tStr) => {
            const parts = tStr.split(/[-–]/); // Handle different dashes
            if (parts.length !== 2) return null;
            let start = parseInt(parts[0].trim());
            let end = parseInt(parts[1].trim());
            if (isNaN(start) || isNaN(end)) return null;
            return { start, end };
        };

        const taskRange = parseTime(taskTime);
        const candRange = parseTime(dayAvail);

        if (!taskRange || !candRange) return true; // Can't parse, assume available

        // Handle midnight (00) as 24
        if (taskRange.end === 0) taskRange.end = 24;
        if (candRange.end === 0) candRange.end = 24;

        // Strict Containment: Task must be fully within Candidate's availability
        return taskRange.start >= candRange.start && taskRange.end <= candRange.end;
    } catch (e) {
        console.warn('Error checking availability:', e);
        return true;
    }
}

function parseMetricsCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]);
    console.log('Metrics sheet headers:', headers);

    const todoIdx = headers.findIndex(h => h.toLowerCase().includes('todo'));
    const timeIdx = headers.findIndex(h => h.toLowerCase().includes('time'));
    const effortIdx = headers.findIndex(h => h.toLowerCase().includes('effort'));

    console.log('Column indices - TODO:', todoIdx, 'Time:', timeIdx, 'Effort:', effortIdx);

    const metrics = [];
    const seenTasks = new Set();

    for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i]);

        const taskName = todoIdx >= 0 ? cells[todoIdx] : '';
        if (!taskName || seenTasks.has(taskName)) continue;

        seenTasks.add(taskName);

        const time = timeIdx >= 0 && cells[timeIdx] ? cells[timeIdx] : '';
        // Check bounds before accessing effortIdx
        const effortStr = effortIdx >= 0 && effortIdx < cells.length && cells[effortIdx] ? cells[effortIdx] : '';
        // Handle European number format (comma instead of dot)
        const effort = effortStr ? parseFloat(effortStr.replace(',', '.')) : '';

        console.log(`Task: "${taskName}", Time: "${time}", Effort: "${effort}"`);

        metrics.push({
            name: taskName,
            time: time,
            effort: effort
        });
    }

    return metrics;
}

function parseTasksCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim());
    if (lines.length < 2) return null;

    const headers = parseCSVLine(lines[0]);
    const taskNames = headers.slice(2);

    const candidates = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i]);
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
            if (data.metrics) {
                METRICS_DATA.length = 0;
                METRICS_DATA.push(...data.metrics);
            }
            console.log('Loaded data from localStorage');
            highlightRemovedTasks();
            rebuildTaskLists();
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
        if (data.metrics) {
            METRICS_DATA.length = 0;
            METRICS_DATA.push(...data.metrics);
        }

        const timestamp = new Date().toISOString();
        localStorage.setItem('spreadsheetData', JSON.stringify(data));
        localStorage.setItem('lastDataRefresh', timestamp);
        console.log('Data loaded from Google Sheets');
        highlightRemovedTasks();
        rebuildTaskLists();
        return { success: true, timestamp: timestamp };
    }

    console.log('Using default data');
    return { success: false, timestamp: null };
}

function highlightRemovedTasks() {
    // Get current valid task IDs
    const validTaskIds = new Set(TASKS.map(t => t.id));

    // Check all canvas tasks
    state.canvasTasks.forEach(instance => {
        const el = document.getElementById(`task-${instance.instanceId}`);
        if (el) {
            if (!validTaskIds.has(instance.id)) {
                // Task no longer in the list - highlight in red
                el.style.border = '2px solid red';
                el.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                console.log(`Task "${instance.name}" (${instance.id}) is no longer in the task list`);
            } else {
                // Task is still valid - remove any red highlighting
                el.style.border = '';
                el.style.backgroundColor = '';
            }
        }
    });
}

function rebuildTaskLists() {
    // Get unique task IDs currently on the canvas
    const usedTaskIds = new Set(state.canvasTasks.map(t => t.id));

    // Rebuild used and available tasks
    state.usedTasks = [];
    state.availableTasks = [];

    TASKS.forEach(task => {
        if (usedTaskIds.has(task.id)) {
            state.usedTasks.push(task);
        } else {
            state.availableTasks.push(task);
        }
    });

    console.log(`Rebuilt task lists: ${state.usedTasks.length} used, ${state.availableTasks.length} available`);
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
