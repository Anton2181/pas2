// Connection Management

let isConnecting = false;
let connectionStart = null; // { id, x, y, type }
let tempLine = null;

function initConnections() {
    // Initialize SVG layer if needed
    if (!elements.connectionsLayer) {
        elements.connectionsLayer = document.getElementById('connections-layer');
    }
}

function startConnectionDrag(e, sourceEl, sourceInstance, isGroup = false) {
    // Check if source is a task inside a group
    if (!isGroup) {
        const groupId = getGroupIdForElement(sourceEl.id);
        if (groupId) {
            const groupEl = document.getElementById(`group-${groupId}`);
            const group = state.groups.find(g => g.id == groupId);
            if (groupEl && group) {
                sourceEl = groupEl;
                sourceInstance = group;
                isGroup = true;
            }
        }
    }

    isConnecting = true;

    const rect = sourceEl.getBoundingClientRect();
    const canvasRect = elements.canvas.getBoundingClientRect();

    // Calculate center in scaled canvas coordinates
    const startX = ((rect.left - canvasRect.left) + rect.width / 2) / state.zoomLevel;
    const startY = ((rect.top - canvasRect.top) + rect.height / 2) / state.zoomLevel;

    connectionStart = {
        id: isGroup ? `group-${sourceInstance.id}` : `task-${sourceInstance.instanceId}`,
        x: startX,
        y: startY,
        el: sourceEl
    };

    // Create temp line
    tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    tempLine.setAttribute('stroke', getConnectionColor());
    tempLine.setAttribute('stroke-width', '2');
    tempLine.setAttribute('fill', 'none');
    tempLine.setAttribute('stroke-dasharray', '5,5'); // Dashed for draft
    elements.connectionsLayer.appendChild(tempLine);

    // Add global listeners
    window.addEventListener('mousemove', onConnectionMove);
    window.addEventListener('mouseup', onConnectionUp);
}

function getConnectionColor() {
    const mode = document.querySelector('input[name="conn-mode"]:checked').value;
    switch (mode) {
        case 'obligatory': return 'var(--conn-obligatory)';
        case 'exclusion': return 'var(--conn-exclusion)';
        case 'equivalent': return '#90CDF4'; // Pastel Blue
        default: return '#999';
    }
}

function onConnectionMove(e) {
    if (!isConnecting || !tempLine) return;

    const canvasRect = elements.canvas.getBoundingClientRect();
    const currentX = (e.clientX - canvasRect.left) / state.zoomLevel;
    const currentY = (e.clientY - canvasRect.top) / state.zoomLevel;

    const d = `M ${connectionStart.x} ${connectionStart.y} L ${currentX} ${currentY}`;
    tempLine.setAttribute('d', d);
}

function onConnectionUp(e) {
    if (!isConnecting) return;

    isConnecting = false;
    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }

    window.removeEventListener('mousemove', onConnectionMove);
    window.removeEventListener('mouseup', onConnectionUp);

    // Check drop target
    let targetEl = e.target.closest('.task-card, .component-group');

    if (targetEl) {
        const groupId = getGroupIdForElement(targetEl.id);
        if (groupId) {
            targetEl = document.getElementById(`group-${groupId}`);
        }
    }

    if (targetEl && targetEl !== connectionStart.el) {
        const targetId = targetEl.id;
        handleConnection(connectionStart.id, targetId);
    }

    connectionStart = null;
}

function handleConnection(sourceId, targetId) {
    const mode = document.querySelector('input[name="conn-mode"]:checked').value;

    // Prevent duplicate connections
    const exists = state.connections.some(c =>
        (c.fromId === sourceId && c.toId === targetId) ||
        (c.fromId === targetId && c.toId === sourceId)
    );
    if (exists) return;

    if (mode === 'obligatory') {
        handleObligatoryConnection(sourceId, targetId);
    } else if (mode === 'exclusion') {
        handleExclusionConnection(sourceId, targetId);
    } else {
        // Equivalent
        createConnectionObject(sourceId, targetId, 'equivalent');
    }
}

function createConnectionObject(sourceId, targetId, type) {
    state.connections.push({
        id: Date.now().toString(),
        fromId: sourceId,
        toId: targetId,
        type: type
    });
    renderConnections();
    if (typeof pushState === 'function') pushState();
}

function handleObligatoryConnection(sourceId, targetId) {
    const sourceIsGroup = sourceId.startsWith('group-');
    const targetIsGroup = targetId.startsWith('group-');

    // Task <-> Task: Create New Group
    if (!sourceIsGroup && !targetIsGroup) {
        createGroupFromTasks(sourceId, targetId);
    }
    // Task <-> Group: Add Task to Group
    else if (!sourceIsGroup && targetIsGroup) {
        addTaskToGroup(sourceId, targetId);
    }
    else if (sourceIsGroup && !targetIsGroup) {
        addTaskToGroup(targetId, sourceId);
    }
    // Group <-> Group: Merge
    else {
        mergeGroups(sourceId, targetId);
    }
}

function handleExclusionConnection(sourceId, targetId) {
    // Check if they are already in the same group
    const sourceGroupId = getGroupIdForElement(sourceId);
    const targetGroupId = getGroupIdForElement(targetId);

    if (sourceGroupId && targetGroupId && sourceGroupId === targetGroupId) {
        alert('Cannot create exclusion between items in the same group.');
        return;
    }

    createConnectionObject(sourceId, targetId, 'exclusion');
}

function getGroupIdForElement(elementId) {
    if (elementId.startsWith('group-')) return elementId.replace('group-', '');

    const el = document.getElementById(elementId);
    if (el && el.parentElement && el.parentElement.classList.contains('group-content')) {
        const groupEl = el.closest('.component-group');
        return groupEl ? groupEl.id.replace('group-', '') : null;
    }
    return null;
}

function createGroupFromTasks(task1Id, task2Id) {
    // 1. Create Group
    createGroup();
    const group = state.groups[state.groups.length - 1];
    const groupEl = document.getElementById(`group-${group.id}`);

    // 2. Move tasks
    const task1 = document.getElementById(task1Id);
    const task2 = document.getElementById(task2Id);

    moveTaskToGroup(task1, groupEl);
    moveTaskToGroup(task2, groupEl);

    renderConnections();

    // pushState is called by createGroup, but we modified tasks after.
    // We should pushState again.
    if (typeof pushState === 'function') pushState();
}

function addTaskToGroup(taskId, groupId) {
    const task = document.getElementById(taskId);
    const group = document.getElementById(groupId);
    moveTaskToGroup(task, group);
    if (typeof pushState === 'function') pushState();
}

function mergeGroups(sourceId, targetId) {
    const id1 = sourceId.replace('group-', '');
    const id2 = targetId.replace('group-', '');

    const group1 = state.groups.find(g => g.id == id1);
    const group2 = state.groups.find(g => g.id == id2);

    if (!group1 || !group2) return;

    const el1 = document.getElementById(sourceId);
    const el2 = document.getElementById(targetId);

    const tasks1 = el1.querySelectorAll('.task-card').length;
    const tasks2 = el2.querySelectorAll('.task-card').length;

    let survivor, victim, survivorEl, victimEl;

    if (tasks1 > tasks2) {
        survivor = group1; victim = group2;
        survivorEl = el1; victimEl = el2;
    } else if (tasks2 > tasks1) {
        survivor = group2; victim = group1;
        survivorEl = el2; victimEl = el1;
    } else {
        // Tie: Older (lower ID) wins
        if (group1.id < group2.id) {
            survivor = group1; victim = group2;
            survivorEl = el1; victimEl = el2;
        } else {
            survivor = group2; victim = group1;
            survivorEl = el2; victimEl = el1;
        }
    }

    // Move tasks
    const victimContent = victimEl.querySelector('.group-content');
    const survivorContent = survivorEl.querySelector('.group-content');

    Array.from(victimContent.children).forEach(child => {
        if (child.classList.contains('task-card')) {
            survivorContent.appendChild(child);
        }
    });

    // Update connections pointing to victim group
    state.connections.forEach(c => {
        if (c.fromId === `group-${victim.id}`) c.fromId = `group-${survivor.id}`;
        if (c.toId === `group-${victim.id}`) c.toId = `group-${survivor.id}`;
    });

    // Remove victim group
    victimEl.remove();
    state.groups = state.groups.filter(g => g.id !== victim.id);

    // Update candidates
    if (survivorEl._updateGroupCandidates) {
        survivorEl._updateGroupCandidates();
    }

    renderConnections();
    if (typeof pushState === 'function') pushState();
}

function moveTaskToGroup(taskEl, groupEl) {
    const content = groupEl.querySelector('.group-content');
    taskEl.style.position = 'relative';
    taskEl.style.left = '';
    taskEl.style.top = '';
    taskEl.style.transform = '';

    content.appendChild(taskEl);

    // Trigger updates
    if (groupEl._updateGroupCandidates) {
        groupEl._updateGroupCandidates();
    }
}

function renderConnections() {
    const layer = elements.connectionsLayer;
    // Remove all paths except tempLine
    Array.from(layer.children).forEach(child => {
        if (child !== tempLine) child.remove();
    });

    state.connections.forEach(conn => {
        drawConnection(conn);
    });
}

function drawConnection(conn) {
    let fromId = resolveEndpoint(conn.fromId);
    let toId = resolveEndpoint(conn.toId);

    if (fromId === toId) return;

    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);

    if (!fromEl || !toEl) return;

    const fromRect = getScaledRect(fromEl);
    const toRect = getScaledRect(toEl);

    const points = getBestConnectionPoints(fromRect, toRect);

    const d = getBezierPath(points.p1, points.p2);

    // Visible path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('stroke', getColorForType(conn.type));
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    elements.connectionsLayer.appendChild(path);

    // Hit area (invisible, wide)
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', d);
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '20'); // Wide hit area
    hitPath.setAttribute('fill', 'none');
    hitPath.style.cursor = 'pointer';
    hitPath.style.pointerEvents = 'stroke'; // Enable clicks on the stroke
    hitPath.onclick = (e) => showDeleteButton(e, conn);
    elements.connectionsLayer.appendChild(hitPath);
}

function resolveEndpoint(id) {
    if (id.startsWith('task-')) {
        const groupId = getGroupIdForElement(id);
        if (groupId) return `group-${groupId}`;
    }
    return id;
}

function getScaledRect(el) {
    const rect = el.getBoundingClientRect();
    const canvasRect = elements.canvas.getBoundingClientRect();
    return {
        left: (rect.left - canvasRect.left) / state.zoomLevel,
        top: (rect.top - canvasRect.top) / state.zoomLevel,
        width: rect.width / state.zoomLevel,
        height: rect.height / state.zoomLevel,
        right: (rect.right - canvasRect.left) / state.zoomLevel,
        bottom: (rect.bottom - canvasRect.top) / state.zoomLevel,
        centerX: ((rect.left - canvasRect.left) + rect.width / 2) / state.zoomLevel,
        centerY: ((rect.top - canvasRect.top) + rect.height / 2) / state.zoomLevel
    };
}

function getBestConnectionPoints(r1, r2) {
    const edges1 = [
        { x: r1.centerX, y: r1.top, side: 'top' },
        { x: r1.centerX, y: r1.bottom, side: 'bottom' },
        { x: r1.left, y: r1.centerY, side: 'left' },
        { x: r1.right, y: r1.centerY, side: 'right' }
    ];

    const edges2 = [
        { x: r2.centerX, y: r2.top, side: 'top' },
        { x: r2.centerX, y: r2.bottom, side: 'bottom' },
        { x: r2.left, y: r2.centerY, side: 'left' },
        { x: r2.right, y: r2.centerY, side: 'right' }
    ];

    let minDist = Infinity;
    let bestP1 = edges1[0];
    let bestP2 = edges2[0];

    edges1.forEach(p1 => {
        edges2.forEach(p2 => {
            const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            if (dist < minDist) {
                minDist = dist;
                bestP1 = p1;
                bestP2 = p2;
            }
        });
    });

    return { p1: bestP1, p2: bestP2 };
}

function getBezierPath(p1, p2) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const controlDist = Math.min(dist * 0.5, 150);

    const getControlPoint = (p, dist) => {
        switch (p.side) {
            case 'top': return { x: p.x, y: p.y - dist };
            case 'bottom': return { x: p.x, y: p.y + dist };
            case 'left': return { x: p.x - dist, y: p.y };
            case 'right': return { x: p.x + dist, y: p.y };
            default: return { x: p.x, y: p.y };
        }
    };

    const cp1 = getControlPoint(p1, controlDist);
    const cp2 = getControlPoint(p2, controlDist);

    return `M ${p1.x} ${p1.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${p2.x} ${p2.y}`;
}

function getColorForType(type) {
    switch (type) {
        case 'obligatory': return 'var(--conn-obligatory)';
        case 'exclusion': return 'var(--conn-exclusion)';
        case 'equivalent': return '#90CDF4';
        default: return '#000';
    }
}

function showDeleteButton(e, conn) {
    // Remove existing delete buttons
    const existing = document.querySelector('.connection-delete-btn');
    if (existing) existing.remove();

    const btn = document.createElement('div');
    btn.className = 'connection-delete-btn';
    btn.innerHTML = '×';

    // Position at click
    const canvasRect = elements.canvas.getBoundingClientRect();
    const x = (e.clientX - canvasRect.left) / state.zoomLevel;
    const y = (e.clientY - canvasRect.top) / state.zoomLevel;

    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;

    // Style
    const color = getColorForType(conn.type);
    btn.style.backgroundColor = color;
    btn.style.color = 'white';
    btn.style.border = '2px solid white';
    btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

    btn.onclick = () => {
        state.connections = state.connections.filter(c => c.id !== conn.id);
        renderConnections();
        btn.remove();
        if (typeof pushState === 'function') pushState();
    };

    elements.canvas.appendChild(btn);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (btn.parentElement) btn.remove();
    }, 3000);
}

function removeConnectionsFor(elementId) {
    const initialCount = state.connections.length;
    state.connections = state.connections.filter(c =>
        c.fromId !== elementId && c.toId !== elementId
    );

    if (state.connections.length !== initialCount) {
        renderConnections();
    }
}

function checkExclusionConstraint(taskInstanceId, targetGroupId) {
    const groupEl = document.getElementById(`group-${targetGroupId}`);
    if (!groupEl) return false;

    const content = groupEl.querySelector('.group-content');
    const tasksInGroup = Array.from(content.querySelectorAll('.task-card')).map(el => {
        const id = el.id.replace('task-', '');
        return state.canvasTasks.find(t => t.instanceId == id);
    });

    const taskId = `task-${taskInstanceId}`;
    const groupId = `group-${targetGroupId}`;

    // 1. Check exclusion with Group
    const groupExclusion = state.connections.find(c =>
        c.type === 'exclusion' &&
        ((c.fromId === taskId && c.toId === groupId) ||
            (c.fromId === groupId && c.toId === taskId))
    );
    if (groupExclusion) return true;

    // 2. Check exclusion with Tasks in Group
    for (const t of tasksInGroup) {
        if (!t) continue;
        const otherTaskId = `task-${t.instanceId}`;
        const taskExclusion = state.connections.find(c =>
            c.type === 'exclusion' &&
            ((c.fromId === taskId && c.toId === otherTaskId) ||
                (c.fromId === otherTaskId && c.toId === taskId))
        );
        if (taskExclusion) return true;
    }

    return false;
}
