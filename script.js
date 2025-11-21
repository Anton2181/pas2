
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
    groups: [], // Group instances
    nextInstanceId: 1,
    nextGroupId: 1,
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
    zoomOut: document.getElementById('zoom-out'),
    addGroupBtn: document.getElementById('add-group-btn')
};

// Initialization
function init() {
    setupSidebar();
    renderSidebarLists();
    setupDragAndDrop();
    setupZoom();
    setupGroups();
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

function setupGroups() {
    if (elements.addGroupBtn) {
        elements.addGroupBtn.addEventListener('click', createGroup);
    }
}

function createGroup() {
    const groupId = state.nextGroupId++;
    const variant = Math.floor(Math.random() * 5) + 1;

    // Center on canvas (approximate)
    const canvasRect = elements.canvas.getBoundingClientRect();
    const x = (canvasRect.width / 2 - 150) / state.zoomLevel;
    const y = (canvasRect.height / 2 - 100) / state.zoomLevel;

    const group = {
        id: groupId,
        title: 'New Group',
        variant: variant,
        x: x,
        y: y
    };

    state.groups.push(group);
    renderGroup(group);
}

function renderGroup(group) {
    const el = document.createElement('div');
    el.className = `component-group variant-${group.variant}`;
    el.id = `group-${group.id}`;
    el.style.left = `${group.x}px`;
    el.style.top = `${group.y}px`;

    // Delete Button
    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'group-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        // Release tasks
        const content = el.querySelector('.group-content');
        Array.from(content.children).forEach(child => {
            if (child.classList.contains('task-card')) {
                // Move back to canvas at current absolute position
                const rect = child.getBoundingClientRect();
                const canvasRect = elements.canvas.getBoundingClientRect();
                child.style.position = 'absolute';
                child.style.left = `${(rect.left - canvasRect.left) / state.zoomLevel}px`;
                child.style.top = `${(rect.top - canvasRect.top) / state.zoomLevel}px`;
                elements.canvas.appendChild(child);
            }
        });
        el.remove();
        state.groups = state.groups.filter(g => g.id !== group.id);
    };
    el.appendChild(deleteBtn);

    // Header
    const header = document.createElement('div');
    header.className = 'group-header';
    header.textContent = group.title;

    // Editable Title
    header.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = group.title;
        input.style.width = '100%';
        input.style.font = 'inherit';

        input.onblur = () => {
            group.title = input.value || 'Untitled Group';
            header.textContent = group.title;
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') input.blur();
        };

        header.textContent = '';
        header.appendChild(input);
        input.focus();
    });

    el.appendChild(header);

    // Content Area
    const content = document.createElement('div');
    content.className = 'group-content';
    el.appendChild(content);

    // Make Group Draggable
    makeDraggable(el, group, true);

    elements.canvas.appendChild(el);
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
    candidatesToggle.innerHTML = '<span class="candidates-text">▼ Candidates</span><span class="candidates-icon" style="display:none">▼</span>';

    const candidatesList = document.createElement('div');
    candidatesList.className = 'candidates-list';
    candidatesList.style.display = 'none';
    candidatesList.style.marginTop = '8px';
    candidatesList.style.padding = '4px';
    candidatesList.style.fontSize = '12px';
    candidatesList.style.color = 'var(--text-secondary)';

    // Populate candidates as comma-separated text
    const suitableCandidates = CANDIDATES.filter(c => c.roles.includes(instance.type));
    candidatesList.textContent = suitableCandidates.map(c => c.name).join(', ');

    candidatesToggle.onclick = () => {
        const isHidden = candidatesList.style.display === 'none';
        candidatesList.style.display = isHidden ? 'block' : 'none';
        const textSpan = candidatesToggle.querySelector('.candidates-text');
        const iconSpan = candidatesToggle.querySelector('.candidates-icon');
        if (textSpan) textSpan.textContent = isHidden ? '▲ Candidates' : '▼ Candidates';
        if (iconSpan) iconSpan.textContent = isHidden ? '▲' : '▼';
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

function makeDraggable(el, instance, isGroup = false) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;

    el.addEventListener('mousedown', (e) => {
        if (e.target.closest('.task-delete-btn') ||
            e.target.closest('.candidates-toggle') ||
            e.target.closest('.group-delete-btn') ||
            (e.target.tagName === 'INPUT')) return;

        // Prevent group drag if clicking on a task inside it
        if (isGroup && e.target.closest('.task-card')) return;

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        // If element is in a group (static position), we need to detach it to drag
        if (!isGroup && el.parentElement.classList.contains('group-content')) {
            const canvasRect = elements.canvas.getBoundingClientRect();

            // Reparent to canvas
            elements.canvas.appendChild(el);
            el.style.position = 'absolute';

            // Center on mouse
            // We need to wait for layout to update to get correct dimensions, but usually synchronous append works
            const width = el.offsetWidth;
            const height = el.offsetHeight;

            el.style.left = `${(e.clientX - canvasRect.left) / state.zoomLevel - width / 2}px`;
            el.style.top = `${(e.clientY - canvasRect.top) / state.zoomLevel - height / 2}px`;

            // Update start coordinates to match the new position relative to mouse
            // Since we centered it, startX/Y match the center, so dx/dy logic in mousemove needs to be consistent
            // Actually, if we just set the position here, we need to update initialLeft/Top to this new position
            // and keep startX/Y as the current mouse position.
        }

        initialLeft = parseFloat(el.style.left);
        initialTop = parseFloat(el.style.top);
        el.style.zIndex = 1000;

        // Add selected class
        if (isGroup) {
            document.querySelectorAll('.component-group').forEach(g => g.classList.remove('selected'));
            el.classList.add('selected');
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        // Adjust delta by zoom level to keep tracking 1:1 with mouse
        const dx = (e.clientX - startX);
        const dy = (e.clientY - startY);

        el.style.left = `${initialLeft + dx}px`;
        el.style.top = `${initialTop + dy}px`;

        if (isGroup) {
            instance.x = initialLeft + dx;
            instance.y = initialTop + dy;
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (isDragging) {
            isDragging = false;
            el.style.zIndex = '';

            if (!isGroup) {
                // Check for drop on group
                let droppedOnGroup = false;
                const groups = document.querySelectorAll('.component-group');

                // We need to check collision with the actual mouse position or element center
                const elRect = el.getBoundingClientRect();
                const centerX = elRect.left + elRect.width / 2;
                const centerY = elRect.top + elRect.height / 2;

                for (const groupEl of groups) {
                    const groupRect = groupEl.getBoundingClientRect();
                    if (centerX >= groupRect.left && centerX <= groupRect.right &&
                        centerY >= groupRect.top && centerY <= groupRect.bottom) {

                        const content = groupEl.querySelector('.group-content');
                        content.appendChild(el);
                        el.style.position = 'static'; // Let flexbox handle layout
                        el.style.left = '';
                        el.style.top = '';
                        droppedOnGroup = true;
                        break;
                    }
                }

                if (!droppedOnGroup) {
                    // Ensure it's on canvas and update coordinates
                    if (el.parentElement !== elements.canvas) {
                        elements.canvas.appendChild(el);
                        el.style.position = 'absolute';
                    }
                    instance.x = parseFloat(el.style.left);
                    instance.y = parseFloat(el.style.top);
                }
            }
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
