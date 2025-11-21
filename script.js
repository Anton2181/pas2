
// Data Models
const TASKS = [
    { id: 't1', name: 'Group Lesson', duration: 60, type: 'teaching' },
    { id: 't2', name: 'Private Lesson', duration: 45, type: 'teaching' },
    { id: 't3', name: 'Practica Supervision', duration: 120, type: 'supervision' },
    { id: 't4', name: 'Milonga DJ', duration: 240, type: 'music' },
    { id: 't5', name: 'Bar Shift', duration: 180, type: 'service' },
    { id: 't6', name: 'Cleaning', duration: 60, type: 'maintenance' }
];

const CANDIDATES = [
    { id: 'c1', name: 'Maria', roles: ['teaching', 'supervision'] },
    { id: 'c2', name: 'Juan', roles: ['teaching', 'music'] },
    { id: 'c3', name: 'Sofia', roles: ['service', 'maintenance'] },
    { id: 'c4', name: 'Carlos', roles: ['teaching', 'service'] },
    { id: 'c5', name: 'Elena', roles: ['supervision', 'music'] }
];

// State
const state = {
    availableTasks: [...TASKS],
    usedTasks: [], // Tasks that have been instantiated at least once
    canvasTasks: [], // Instances of tasks on the canvas
    nextInstanceId: 1,
    zoomLevel: 1
};

// DOM Elements
const elements = {
    sidebar: document.getElementById('task-sidebar'),
    toggleBtn: document.getElementById('toggle-sidebar'),
    availableList: document.getElementById('available-tasks'),
    usedList: document.getElementById('used-tasks'),
    canvas: document.getElementById('canvas'),
    connectionsLayer: document.getElementById('connections-layer'),
    zoomIn: document.getElementById('zoom-in'),
    zoomOut: document.getElementById('zoom-out')
};

// Initialization
function init() {
    setupSidebar();
    renderSidebarLists();
    setupDragAndDrop();
    setupZoom();
}

function setupZoom() {
    if (elements.zoomIn && elements.zoomOut) {
        elements.zoomIn.addEventListener('click', () => updateZoom(0.1));
        elements.zoomOut.addEventListener('click', () => updateZoom(-0.1));
    }
}

function updateZoom(delta) {
    state.zoomLevel = Math.max(0.5, Math.min(2, state.zoomLevel + delta));
    applyZoom();
}

function applyZoom() {
    document.documentElement.style.setProperty('--zoom-scale', state.zoomLevel);
    // Calculate badge scale to grow at half the speed of the zoom
    // Effective scale = 1 + 0.5 * (zoom - 1)
    // Child scale = Effective scale / Parent scale (zoom)
    const badgeScale = (1 + 0.5 * (state.zoomLevel - 1)) / state.zoomLevel;
    document.documentElement.style.setProperty('--badge-scale', badgeScale);
}

// Sidebar Functionality
function setupSidebar() {
    elements.toggleBtn.addEventListener('click', () => {
        elements.sidebar.classList.toggle('collapsed');
        const icon = elements.toggleBtn.querySelector('.icon');
        icon.textContent = elements.sidebar.classList.contains('collapsed') ? '←' : '→';
    });
}

function renderSidebarLists() {
    // Render Available Tasks
    elements.availableList.innerHTML = '';
    state.availableTasks.forEach(task => {
        const el = createTaskListItem(task, 'available');
        elements.availableList.appendChild(el);
    });

    // Render Used Tasks
    elements.usedList.innerHTML = '';
    state.usedTasks.forEach(task => {
        const el = createTaskListItem(task, 'used');
        elements.usedList.appendChild(el);
    });
}

function createTaskListItem(task, source) {
    const div = document.createElement('div');
    div.className = 'task-list-item';
    div.draggable = true;
    div.dataset.taskId = task.id;
    div.dataset.source = source;

    div.innerHTML = `
        <span>${task.name}</span>
        <span class="icon">⋮</span>
    `;

    div.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/json', JSON.stringify({
            taskId: task.id,
            source: source,
            type: 'new-task'
        }));
        e.dataTransfer.effectAllowed = 'copy';
    });

    return div;
}

// Drag and Drop Logic
function setupDragAndDrop() {
    elements.canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    elements.canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const dataString = e.dataTransfer.getData('application/json');
        if (!dataString) return;

        try {
            const data = JSON.parse(dataString);
            if (data.type === 'new-task') {
                handleNewTaskDrop(data, e.clientX, e.clientY);
            }
        } catch (err) {
            console.error('Drop error:', err);
        }
    });
}

function handleNewTaskDrop(data, x, y) {
    const task = TASKS.find(t => t.id === data.taskId);
    if (!task) return;

    // Update State
    if (data.source === 'available') {
        state.availableTasks = state.availableTasks.filter(t => t.id !== task.id);
        state.usedTasks.push(task);
        renderSidebarLists();
    }

    // Create Task Instance
    const instanceId = state.nextInstanceId++;
    const canvasRect = elements.canvas.getBoundingClientRect();

    // Calculate position relative to canvas container
    // We need to account for zoom/pan later, but for now simple offset
    const posX = (x - canvasRect.left) / state.zoomLevel;
    const posY = (y - canvasRect.top) / state.zoomLevel;

    const taskInstance = {
        ...task,
        instanceId: instanceId,
        x: posX,
        y: posY
    };

    state.canvasTasks.push(taskInstance);
    renderTaskOnCanvas(taskInstance);
    updatePriorities(task.id);
}

function renderTaskOnCanvas(instance) {
    const el = document.createElement('div');
    el.className = 'task-card';
    el.id = `task-${instance.instanceId}`;
    el.style.left = `${instance.x}px`;
    el.style.top = `${instance.y}px`;
    // Apply zoom via CSS variable on the element or container
    // We will use a global CSS variable for simplicity as requested

    // Priority Badge (will be updated)
    const priorityBadge = document.createElement('div');
    priorityBadge.className = 'priority-badge';
    priorityBadge.style.display = 'none'; // Hidden by default
    el.appendChild(priorityBadge);

    // Delete Button
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'task-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        removeTaskInstance(instance.instanceId);
    };
    el.appendChild(deleteBtn);

    // Content
    const content = document.createElement('div');
    content.innerHTML = `
        <div class="task-header">${instance.name}</div>
        <div class="task-meta">${instance.duration} min</div>
    `;
    el.appendChild(content);

    // Candidates Toggle
    const candidatesToggle = document.createElement('div');
    candidatesToggle.className = 'candidates-toggle';
    candidatesToggle.style.cssText = `
        margin-top: 8px;
        text-align: center;
        cursor: pointer;
        color: var(--text-secondary);
        font-size: 12px;
    `;
    candidatesToggle.innerHTML = '▼ Candidates';

    const candidatesList = document.createElement('div');
    candidatesList.className = 'candidates-list';
    candidatesList.style.display = 'none';
    candidatesList.style.marginTop = '8px';

    // Populate candidates
    const suitableCandidates = CANDIDATES.filter(c => c.roles.includes(instance.type));
    candidatesList.innerHTML = suitableCandidates.map(c =>
        `<div style="padding: 4px; font-size: 12px;">${c.name}</div>`
    ).join('');

    candidatesToggle.onclick = () => {
        const isHidden = candidatesList.style.display === 'none';
        candidatesList.style.display = isHidden ? 'block' : 'none';
        candidatesToggle.innerHTML = isHidden ? '▲ Candidates' : '▼ Candidates';
    };

    el.appendChild(candidatesToggle);
    el.appendChild(candidatesList);

    // Make draggable on canvas
    makeDraggable(el, instance);

    // Selection logic
    el.addEventListener('mousedown', () => {
        document.querySelectorAll('.task-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
    });

    elements.canvas.appendChild(el);
}

function makeDraggable(el, instance) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;

    el.addEventListener('mousedown', (e) => {
        if (e.target.closest('.task-delete-btn') || e.target.closest('.candidates-toggle')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseFloat(el.style.left);
        initialTop = parseFloat(el.style.top);
        el.style.zIndex = 1000;
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        // Adjust delta by zoom level to keep tracking 1:1 with mouse
        const dx = (e.clientX - startX);
        const dy = (e.clientY - startY);

        el.style.left = `${initialLeft + dx}px`;
        el.style.top = `${initialTop + dy}px`;

        instance.x = initialLeft + dx;
        instance.y = initialTop + dy;
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            el.style.zIndex = '';
        }
    });
}

function removeTaskInstance(instanceId) {
    const index = state.canvasTasks.findIndex(t => t.instanceId === instanceId);
    if (index > -1) {
        const task = state.canvasTasks[index];
        const taskId = task.id;

        // Remove from DOM
        const el = document.getElementById(`task-${instanceId}`);
        if (el) el.remove();

        // Remove from state
        state.canvasTasks.splice(index, 1);

        // Check if any instances of this task type remain
        const remainingInstances = state.canvasTasks.filter(t => t.id === taskId);
        if (remainingInstances.length === 0) {
            // Move back to available
            state.usedTasks = state.usedTasks.filter(t => t.id !== taskId);
            const taskDef = TASKS.find(t => t.id === taskId);
            if (taskDef) {
                state.availableTasks.push(taskDef);
                // Sort available tasks to keep order? Optional.
            }
            renderSidebarLists();
        }

        updatePriorities(taskId);
    }
}

function updatePriorities(taskId) {
    const instances = state.canvasTasks.filter(t => t.id === taskId);

    // If multiple instances, show numbers
    // "from there, you can bring it back out again, which will cause numbers to appear in the top right of the task tiles representing the priority"
    // This implies if there is > 1 instance, or maybe even if it's just in "Used" list?
    // Let's assume if there are multiple instances, we number them.

    instances.forEach((instance, index) => {
        const el = document.getElementById(`task-${instance.instanceId}`);
        if (!el) return;

        const badge = el.querySelector('.priority-badge');
        if (instances.length > 1) {
            badge.style.display = 'flex';
            badge.textContent = index + 1;
        } else {
            badge.style.display = 'none';
        }
    });
}

// Start
init();
