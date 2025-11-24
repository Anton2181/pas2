// UI Rendering Functions

function setupSidebar() {
    elements.toggleBtn.addEventListener('click', () => {
        elements.sidebar.classList.toggle('collapsed');
        const icon = elements.toggleBtn.querySelector('.icon');
        icon.textContent = elements.sidebar.classList.contains('collapsed') ? '←' : '→';
    });

    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', () => {
            renderSidebarLists();
        });
    }
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

        // rebuildTaskLists() in data.js now handles repopulating based on canvas state
        renderSidebarLists();

        refreshBtn.disabled = false;
        updateRefreshButtonText(refreshBtn);

        if (typeof pushState === 'function') pushState();
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
    const filter = elements.searchInput ? elements.searchInput.value.toLowerCase() : '';

    elements.availableList.innerHTML = '';
    state.availableTasks.forEach(task => {
        if (task.name.toLowerCase().includes(filter)) {
            const el = createTaskListItem(task, 'available');
            elements.availableList.appendChild(el);
        }
    });

    elements.usedList.innerHTML = '';
    state.usedTasks.forEach(task => {
        if (task.name.toLowerCase().includes(filter)) {
            const el = createTaskListItem(task, 'used');
            elements.usedList.appendChild(el);
        }
    });

    if (elements.skippedList) {
        elements.skippedList.innerHTML = '';
        state.skippedTasks.forEach(task => {
            if (task.name.toLowerCase().includes(filter)) {
                const el = createTaskListItem(task, 'skipped');
                elements.skippedList.appendChild(el);
            }
        });
    }
}

function createTaskListItem(task, source) {
    const div = document.createElement('div');
    div.className = 'task-list-item';
    div.draggable = true;
    div.dataset.taskId = task.id;
    div.dataset.source = source;

    const nameSpan = document.createElement('span');
    nameSpan.textContent = task.name;
    div.appendChild(nameSpan);

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.style.display = 'flex';
    meta.style.justifyContent = 'space-between';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = task.time || '';

    const effortSpan = document.createElement('span');
    effortSpan.textContent = task.effort ? `${task.effort}` : '';

    meta.appendChild(timeSpan);
    meta.appendChild(effortSpan);
    div.appendChild(meta);

    const controls = document.createElement('div');
    controls.className = 'task-controls';
    controls.style.display = 'flex';
    controls.style.gap = '4px';

    if (source === 'available') {
        const skipBtn = document.createElement('span');
        skipBtn.className = 'icon-btn';
        skipBtn.innerHTML = '↷';
        skipBtn.title = 'Skip Task';
        skipBtn.style.cursor = 'pointer';
        skipBtn.onclick = (e) => {
            e.stopPropagation();
            skipTask(task);
        };
        controls.appendChild(skipBtn);
    } else if (source === 'skipped') {
        const restoreBtn = document.createElement('span');
        restoreBtn.className = 'icon-btn';
        restoreBtn.innerHTML = '↶';
        restoreBtn.title = 'Restore Task';
        restoreBtn.style.cursor = 'pointer';
        restoreBtn.onclick = (e) => {
            e.stopPropagation();
            restoreTask(task);
        };
        controls.appendChild(restoreBtn);
    }

    const menuBtn = document.createElement('span');
    menuBtn.className = 'icon';
    menuBtn.textContent = '⋮';
    controls.appendChild(menuBtn);

    div.appendChild(controls);

    // Click to spawn task at viewport center
    div.addEventListener('click', (e) => {
        if (e.target.closest('.icon-btn') || e.target.closest('.icon')) {
            return;
        }

        const container = elements.canvasContainer;
        const containerRect = container.getBoundingClientRect();

        // User requested formula: "add an x offset by 1/2 the width of the sidebar * 0/1"
        const leftSidebarWidth = 260;
        const rightSidebarWidth = 300;
        const isSidebarOpen = !elements.sidebar.classList.contains('collapsed');

        // Base center: Center of the space between left sidebar and window edge
        const baseCenterX = leftSidebarWidth + ((window.innerWidth - leftSidebarWidth) / 2);

        // Offset: Shift left by half the right sidebar width if open
        const offset = isSidebarOpen ? -(rightSidebarWidth / 2) : 0;

        const centerX = baseCenterX + offset;

        // Use container's vertical center
        const centerY = containerRect.top + containerRect.height / 2;

        // Add random nudge (in screen pixels)
        const nudgeX = (Math.random() - 0.5) * 40;
        const nudgeY = (Math.random() - 0.5) * 40;

        // Task tile dimensions (approximate based on CSS)
        const taskWidth = 264;
        const taskHeight = 100; // Approximate height

        const x = centerX + nudgeX - (taskWidth / 2);
        const y = centerY + nudgeY - (taskHeight / 2);

        const data = {
            taskId: task.id,
            source: source,
            type: 'new-task'
        };
        handleNewTaskDrop(data, x, y);
    });

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

function skipTask(task) {
    state.availableTasks = state.availableTasks.filter(t => t.id !== task.id);
    state.skippedTasks.push(task);
    renderSidebarLists();
    if (typeof pushState === 'function') pushState();
}

function restoreTask(task) {
    state.skippedTasks = state.skippedTasks.filter(t => t.id !== task.id);
    state.availableTasks.push(task);
    renderSidebarLists();
    if (typeof pushState === 'function') pushState();
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
    content.innerHTML = `<div class="task-header">${instance.name}</div>`;

    // Lookup metrics by task name
    const metrics = METRICS_DATA.find(m => m.name === instance.name) || {};
    const time = metrics.time || instance.time || '';
    const effort = metrics.effort || instance.effort || '';

    // Store metrics on instance for group aggregation
    instance.time = time;
    instance.effort = effort;

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.style.display = 'flex';
    meta.style.justifyContent = 'space-between';
    meta.style.marginTop = '8px';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = time;

    const effortSpan = document.createElement('span');
    effortSpan.textContent = effort ? `${effort} Effort` : '';

    meta.appendChild(timeSpan);
    meta.appendChild(effortSpan);
    content.appendChild(meta);
    el.appendChild(content);

    const candidatesToggle = document.createElement('div');
    candidatesToggle.className = 'candidates-toggle';
    candidatesToggle.style.cssText = `
        margin-top: 8px;
        text-align: center;
        cursor: pointer;
        color: var(--text-secondary);
        font-size: 12px;
        display: ${instance.groupId ? 'none' : 'block'};
    `;

    const suitableCandidates = CANDIDATES.filter(c => c.roles.includes(instance.name));
    candidatesToggle.innerHTML = `<span class="candidates-text">▼ Candidates (${suitableCandidates.length})</span><span class="candidates-icon" style="display:none">▼</span>`;

    const candidatesList = document.createElement('div');
    candidatesList.className = 'candidates-list';
    candidatesList.style.display = 'none';
    candidatesList.style.marginTop = '8px';
    candidatesList.style.fontSize = '12px';
    candidatesList.style.color = 'var(--text-secondary)';
    candidatesList.style.position = 'relative';

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
        if (textSpan) textSpan.textContent = isHidden ? `▲ Candidates (${suitableCandidates.length})` : `▼ Candidates (${suitableCandidates.length})`;
        if (iconSpan) iconSpan.textContent = isHidden ? '▲' : '▼';
    };

    el.appendChild(candidatesToggle);
    el.appendChild(candidatesList);

    el._candidatesToggle = candidatesToggle;
    el._candidatesList = candidatesList;

    makeDraggable(el, instance);

    el.addEventListener('mousedown', (e) => {
        // Bring to front when clicking anywhere on the task
        if (typeof bringToFront === 'function') {
            bringToFront(el);
        }
        document.querySelectorAll('.task-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
    });

    let parent = elements.canvas;
    if (instance.groupId) {
        const groupEl = document.getElementById(`group-${instance.groupId}`);
        if (groupEl) {
            const content = groupEl.querySelector('.group-content');
            if (content) {
                parent = content;
                el.style.position = 'relative';
                el.style.left = '';
                el.style.top = '';

                // Hide candidates toggle when in group
                if (candidatesToggle) candidatesToggle.style.display = 'none';
                if (candidatesList) candidatesList.style.display = 'none';
            }
        }
    }

    parent.appendChild(el);

    // Update group candidates if needed
    if (instance.groupId) {
        const groupEl = document.getElementById(`group-${instance.groupId}`);
        if (groupEl && groupEl._updateGroupCandidates) {
            setTimeout(() => groupEl._updateGroupCandidates(), 0);
        }
    }
}

function updatePriorities(taskId) {
    const instances = state.canvasTasks.filter(t => t.id === taskId);

    // Sort by priority to maintain order
    instances.sort((a, b) => (a.priority || 0) - (b.priority || 0));

    // Renumber priorities to fill gaps (1, 2, 3... with no skips)
    instances.forEach((instance, index) => {
        const newPriority = index + 1;
        instance.priority = newPriority;

        const el = document.getElementById(`task-${instance.instanceId}`);
        if (!el) return;

        const badge = el.querySelector('.priority-badge');
        if (instances.length > 1) {
            badge.style.display = 'flex';
            badge.textContent = newPriority;
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

        if (typeof removeConnectionsFor === 'function') {
            removeConnectionsFor(`task-${instanceId}`);
        }

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

        const groupId = task.groupId;
        if (groupId) {
            const groupEl = document.getElementById(`group-${groupId}`);
            if (groupEl && groupEl._updateGroupCandidates) {
                // Use timeout to ensure DOM is updated (element removed)
                setTimeout(() => groupEl._updateGroupCandidates(), 0);
            }
        }

        updatePriorities(taskId);

        if (typeof pushState === 'function') pushState();
    }
}
