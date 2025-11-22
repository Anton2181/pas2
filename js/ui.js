// UI Rendering Functions

function setupSidebar() {
    elements.toggleBtn.addEventListener('click', () => {
        elements.sidebar.classList.toggle('collapsed');
        const icon = elements.toggleBtn.querySelector('.icon');
        icon.textContent = elements.sidebar.classList.contains('collapsed') ? '←' : '→';
    });
}

function setupDataRefresh() {
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'tool-btn';
    updateRefreshButtonText(refreshBtn);
    refreshBtn.style.marginTop = '8px';

    refreshBtn.onclick = async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<span class="icon">↻</span> Loading...';

        const result = await loadData(true);

        state.availableTasks = [...TASKS];
        state.usedTasks = [];

        renderSidebarLists();

        refreshBtn.disabled = false;
        updateRefreshButtonText(refreshBtn);
    };

    const rightSidebar = document.querySelector('.right-sidebar .sidebar-content');
    if (rightSidebar) {
        rightSidebar.insertBefore(refreshBtn, rightSidebar.firstChild);
        elements.refreshDataBtn = refreshBtn;
    }
}

function updateRefreshButtonText(btn) {
    const timeDisplay = getLastRefreshDisplay();
    btn.innerHTML = `<span class="icon">↻</span> Refresh Data ${timeDisplay}`;
}

function renderSidebarLists() {
    elements.availableList.innerHTML = '';
    state.availableTasks.forEach(task => {
        const el = createTaskListItem(task, 'available');
        elements.availableList.appendChild(el);
    });

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

function renderTaskOnCanvas(instance) {
    const el = document.createElement('div');
    el.className = 'task-card';
    el.id = `task-${instance.instanceId}`;
    el.style.left = `${instance.x}px`;
    el.style.top = `${instance.y}px`;

    const priorityBadge = document.createElement('div');
    priorityBadge.className = 'priority-badge';
    priorityBadge.style.display = 'none';
    el.appendChild(priorityBadge);

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'task-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        removeTaskInstance(instance.instanceId);
    };
    el.appendChild(deleteBtn);

    const content = document.createElement('div');
    content.innerHTML = `
        <div class="task-header">${instance.name}</div>
        <div class="task-meta">${instance.duration} min</div>
    `;
    el.appendChild(content);

    // Candidates Toggle (only show on canvas, not in groups)
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
    candidatesList.style.fontSize = '12px';
    candidatesList.style.color = 'var(--text-secondary)';
    candidatesList.style.position = 'relative';

    const suitableCandidates = CANDIDATES.filter(c => c.roles.includes(instance.name));
    const candidatesText = document.createElement('div');
    candidatesText.textContent = suitableCandidates.map(c => c.name).join(', ');
    candidatesList.appendChild(candidatesText);

    const counter = document.createElement('div');
    counter.className = 'candidates-counter';
    counter.textContent = suitableCandidates.length.toString();
    counter.style.cssText = `
        position: absolute;
        bottom: 2px;
        right: 4px;
        font-size: 10px;
        font-weight: 600;
        color: var(--text-secondary);
    `;
    candidatesList.appendChild(counter);

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

    // Store reference for hiding/showing toggle
    el._candidatesToggle = candidatesToggle;
    el._candidatesList = candidatesList;

    makeDraggable(el, instance);

    el.addEventListener('mousedown', () => {
        document.querySelectorAll('.task-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
    });

    elements.canvas.appendChild(el);
}

function updatePriorities(taskId) {
    const instances = state.canvasTasks.filter(t => t.id === taskId);

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

function removeTaskInstance(instanceId) {
    const index = state.canvasTasks.findIndex(t => t.instanceId === instanceId);
    if (index > -1) {
        const task = state.canvasTasks[index];
        const taskId = task.id;

        const el = document.getElementById(`task-${instanceId}`);
        if (el) el.remove();

        state.canvasTasks.splice(index, 1);

        const remainingInstances = state.canvasTasks.filter(t => t.id === taskId);
        if (remainingInstances.length === 0) {
            state.usedTasks = state.usedTasks.filter(t => t.id !== taskId);
            const taskDef = TASKS.find(t => t.id === taskId);
            if (taskDef) {
                state.availableTasks.push(taskDef);
            }
            renderSidebarLists();
        }

        updatePriorities(taskId);
    }
}
