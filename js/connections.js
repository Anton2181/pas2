// Connection Management

let isConnecting = false;
let connectionStart = null; // { id, x, y, type }
let tempLine = null;

function initConnections() {
    // Initialize SVG layer if needed
    if (!elements.connectionsLayer) {
        elements.connectionsLayer = document.getElementById('connections-layer');
    }

    // Add listeners for mode switches to re-render connections
    document.querySelectorAll('input[name="conn-mode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            renderConnections();
        });
    });
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
    document.body.classList.add('is-connecting'); // Add class for hover check

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
    document.body.classList.remove('is-connecting'); // Remove class

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

    // Check if EXACT same connection exists (same nodes AND same type)
    // We allow different types between same nodes now (e.g. Exclusion + Equivalence)
    const exactExists = state.connections.some(c =>
        c.type === mode &&
        ((c.fromId === sourceId && c.toId === targetId) ||
            (c.fromId === targetId && c.toId === sourceId))
    );

    if (exactExists) return;

    // Special check: Don't allow Exclusion if Obligatory exists (logic conflict?) 
    // User asked for "both an equivalence and an exclusion", didn't mention obligatory.
    // Usually Obligatory means they are in the same group, which precludes exclusion.
    // But here we are just handling the connection creation.

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
    // 1. Calculate center position
    const task1 = document.getElementById(task1Id);
    const task2 = document.getElementById(task2Id);

    let groupX, groupY;

    if (task1 && task2) {
        // Use current style positions (unscaled canvas coords)
        const x1 = parseFloat(task1.style.left) || 0;
        const y1 = parseFloat(task1.style.top) || 0;
        const x2 = parseFloat(task2.style.left) || 0;
        const y2 = parseFloat(task2.style.top) || 0;

        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;

        // Center the group (width 280, height 200)
        groupX = centerX - 140 + (task1.offsetWidth / 2); // Add half task width to center better
        groupY = centerY - 100;
    }

    // 2. Create Group
    createGroup(groupX, groupY);
    const group = state.groups[state.groups.length - 1];
    const groupEl = document.getElementById(`group-${group.id}`);

    // 2. Move tasks
    // task1 and task2 are already defined above

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
    taskEl.style.zIndex = ''; // Reset z-index

    content.appendChild(taskEl);

    // Update the task instance's groupId in state
    const taskInstanceId = taskEl.id.replace('task-', '');
    const taskInstance = state.canvasTasks.find(t => t.instanceId == taskInstanceId);
    if (taskInstance) {
        const groupId = groupEl.id.replace('group-', '');
        taskInstance.groupId = groupId;
    }

    // Hide candidates toggle when added to group
    const toggle = taskEl.querySelector('.candidates-toggle') || taskEl._candidatesToggle;
    if (toggle) {
        toggle.style.display = 'none';
    }

    // Also hide the list if it's open
    const list = taskEl.querySelector('.candidates-list') || taskEl._candidatesList;
    if (list) {
        list.style.display = 'none';
    }

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

    const mode = document.querySelector('input[name="conn-mode"]:checked').value;

    state.connections.forEach(conn => {
        // Filter visibility based on mode
        if (mode === 'exclusion') {
            if (conn.type !== 'exclusion') return;
        } else if (mode === 'equivalent') {
            if (conn.type !== 'equivalent') return;
        }
        // If mode is 'obligatory' (or default), show all connections
        // User said: "with obligatory, show me all lines"

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

    let offset = 0;
    // Apply offset for equivalent connections to distinguish them from others
    if (conn.type === 'equivalent') {
        offset = 20; // 20px offset for the curve
    }

    const d = getBezierPath(points.p1, points.p2, offset);

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
    hitPath.onclick = (e) => showConnectionControls(e, conn);
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

function getBezierPath(p1, p2, offset = 0) {
    const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const controlDist = Math.min(dist * 0.5, 150);

    const getControlPoint = (p, dist, offset) => {
        let cp = { x: p.x, y: p.y };

        // Apply main direction
        switch (p.side) {
            case 'top': cp.y -= dist; break;
            case 'bottom': cp.y += dist; break;
            case 'left': cp.x -= dist; break;
            case 'right': cp.x += dist; break;
        }

        // Apply offset to control point perpendicular to connection side
        if (offset !== 0) {
            if (p.side === 'top' || p.side === 'bottom') {
                cp.x += offset;
            } else {
                cp.y += offset;
            }
        }

        return cp;
    };

    const cp1 = getControlPoint(p1, controlDist, offset);
    const cp2 = getControlPoint(p2, controlDist, offset);

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

function showConnectionControls(e, conn) {
    // Remove existing controls
    const existing = document.querySelector('.connection-controls');
    if (existing) existing.remove();

    const container = document.createElement('div');
    container.className = 'connection-controls';

    // Resolve elements to determine orientation
    let fromId = resolveEndpoint(conn.fromId);
    let toId = resolveEndpoint(conn.toId);
    const fromEl = document.getElementById(fromId);
    const toEl = document.getElementById(toId);

    if (!fromEl || !toEl) return;

    const fromRect = getScaledRect(fromEl);
    const toRect = getScaledRect(toEl);

    // Calculate centers
    const fromCenter = { x: fromRect.left + fromRect.width / 2, y: fromRect.top + fromRect.height / 2 };
    const toCenter = { x: toRect.left + toRect.width / 2, y: toRect.top + toRect.height / 2 };

    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;

    // Determine orientation (more vertical than horizontal)
    const isVertical = Math.abs(dy) > Math.abs(dx);

    if (isVertical) {
        container.classList.add('vertical');
    }

    // Determine which element is first (Left/Top) and second (Right/Bottom)
    let firstEl, secondEl;
    if (isVertical) {
        // Sort by Y (Top first)
        if (fromRect.top < toRect.top) {
            firstEl = fromEl;
            secondEl = toEl;
        } else {
            firstEl = toEl;
            secondEl = fromEl;
        }
    } else {
        // Sort by X (Left first)
        if (fromRect.left < toRect.left) {
            firstEl = fromEl;
            secondEl = toEl;
        } else {
            firstEl = toEl;
            secondEl = fromEl;
        }
    }

    // Get names for tooltips
    const getName = (el) => {
        let name = null;
        if (el.classList.contains('component-group')) {
            // Try state first
            const group = state.groups.find(g => `group-${g.id}` === el.id);
            if (group) name = group.title;
            // Fallback to DOM
            if (!name) {
                const header = el.querySelector('.group-header');
                if (header && header.firstElementChild) {
                    name = header.firstElementChild.textContent.trim();
                }
            }
            return name || 'Group';
        } else {
            // Try state first
            const instanceId = el.id.replace('task-', '');
            const task = state.canvasTasks.find(t => t.instanceId === instanceId);
            if (task) name = task.name;
            // Fallback to DOM
            if (!name) {
                const header = el.querySelector('.task-header');
                if (header) name = header.textContent.trim();
            }
            return name || 'Task';
        }
    };
    const firstName = getName(firstEl);
    const secondName = getName(secondEl);

    // First Arrow (Left or Up)
    const firstBtn = document.createElement('button');
    firstBtn.className = 'connection-control-btn left-btn';
    firstBtn.innerHTML = isVertical ? '↑' : '←';
    firstBtn.setAttribute('data-tooltip', `Go to ${firstName}`);
    firstBtn.onclick = (ev) => {
        ev.stopPropagation();
        navigateToElement(firstEl.id);
        container.remove();
    };
    container.appendChild(firstBtn);

    // Delete Button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'connection-control-btn delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.setAttribute('data-tooltip', 'Delete connection');
    deleteBtn.onclick = (ev) => {
        ev.stopPropagation();
        state.connections = state.connections.filter(c => c.id !== conn.id);
        renderConnections();
        container.remove();
        if (typeof pushState === 'function') pushState();
    };
    container.appendChild(deleteBtn);

    // Second Arrow (Right or Down)
    const secondBtn = document.createElement('button');
    secondBtn.className = 'connection-control-btn right-btn';
    secondBtn.innerHTML = isVertical ? '↓' : '→';
    secondBtn.setAttribute('data-tooltip', `Go to ${secondName}`);
    secondBtn.onclick = (ev) => {
        ev.stopPropagation();
        navigateToElement(secondEl.id);
        container.remove();
    };
    container.appendChild(secondBtn);

    // Position at click
    const canvasRect = elements.canvas.getBoundingClientRect();
    const x = (e.clientX - canvasRect.left) / state.zoomLevel;
    const y = (e.clientY - canvasRect.top) / state.zoomLevel;

    container.style.left = `${x}px`;
    container.style.top = `${y}px`;

    elements.canvas.appendChild(container);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (container.parentElement) container.remove();
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
