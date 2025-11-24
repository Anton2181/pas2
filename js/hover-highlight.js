// Hover Highlight for Connections

let hoverTimeout = null;
let currentHoveredElement = null;
const HOVER_DELAY = 800; // milliseconds to wait before highlighting

function initHoverHighlight() {
    // We'll attach listeners dynamically as elements are created
    // This function can be called from main.js
}

function attachHoverListeners(element) {
    if (!element) return;

    element.addEventListener('mouseenter', (e) => {
        // Find the actual target - if hovering over a task inside a group, use the group
        let target = e.currentTarget;

        // If this is a task card, check if it's inside a group
        if (target.classList.contains('task-card')) {
            const groupParent = target.closest('.component-group');
            if (groupParent) {
                // Use the group instead of the task
                target = groupParent;
            }
        }

        // Clear any existing timeout
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
        }

        // Set a new timeout
        hoverTimeout = setTimeout(() => {
            highlightConnections(target);
            currentHoveredElement = target;
        }, HOVER_DELAY);
    });

    element.addEventListener('mouseleave', (e) => {
        // Only clear if we're actually leaving the element (not just moving to a child)
        const relatedTarget = e.relatedTarget;

        // Check if we're moving to a child element
        if (relatedTarget && e.currentTarget.contains(relatedTarget)) {
            return; // Don't clear, we're still inside
        }

        // Clear timeout if mouse leaves before delay
        if (hoverTimeout) {
            clearTimeout(hoverTimeout);
            hoverTimeout = null;
        }

        // Clear highlight
        clearHighlight();
        currentHoveredElement = null;
    });
}

function highlightConnections(element) {
    const elementId = element.id;

    // Find all connections involving this element
    const connectedIds = getConnectedElementIds(elementId);

    // Add the hovered element itself to the connected set
    connectedIds.add(elementId);

    // Dim all task cards and groups that are NOT connected
    dimUnconnectedElements(connectedIds);

    // Highlight the connections
    highlightConnectedPaths(elementId);
}

function getConnectedElementIds(elementId) {
    const connected = new Set();

    // Resolve the element ID (in case it's a task inside a group)
    const resolvedId = resolveEndpoint(elementId);

    // Find all connections involving this element
    state.connections.forEach(conn => {
        const fromId = resolveEndpoint(conn.fromId);
        const toId = resolveEndpoint(conn.toId);

        if (fromId === resolvedId) {
            connected.add(toId);
            // Also add the original IDs if they're different (tasks in groups)
            connected.add(conn.toId);
        }
        if (toId === resolvedId) {
            connected.add(fromId);
            connected.add(conn.fromId);
        }
    });

    return connected;
}

function dimUnconnectedElements(connectedIds) {
    // Get all tasks that are children of connected groups
    const tasksInConnectedGroups = new Set();

    connectedIds.forEach(id => {
        if (id.startsWith('group-')) {
            const groupEl = document.getElementById(id);
            if (groupEl) {
                const taskCards = groupEl.querySelectorAll('.task-card');
                taskCards.forEach(task => {
                    tasksInConnectedGroups.add(task.id);
                });
            }
        }
    });

    // Dim all task cards that are NOT connected and NOT children of connected groups
    document.querySelectorAll('.task-card').forEach(el => {
        if (!connectedIds.has(el.id) && !tasksInConnectedGroups.has(el.id)) {
            el.style.opacity = '0.2';
            el.style.transition = 'opacity 0.3s ease';
        }
    });

    // Dim all groups that are NOT connected
    document.querySelectorAll('.component-group').forEach(el => {
        if (!connectedIds.has(el.id)) {
            el.style.opacity = '0.2';
            el.style.transition = 'opacity 0.3s ease';
        }
    });
}

function highlightConnectedPaths(elementId) {
    const resolvedId = resolveEndpoint(elementId);
    const layer = elements.connectionsLayer;

    // We need to re-render connections with special styling
    // Store the current connections that should be highlighted
    const highlightedConnections = state.connections.filter(conn => {
        const fromId = resolveEndpoint(conn.fromId);
        const toId = resolveEndpoint(conn.toId);
        return fromId === resolvedId || toId === resolvedId;
    });

    // Clear and re-render all connections
    Array.from(layer.children).forEach(child => {
        if (child !== tempLine) child.remove();
    });

    state.connections.forEach(conn => {
        const fromId = resolveEndpoint(conn.fromId);
        const toId = resolveEndpoint(conn.toId);
        const isHighlighted = fromId === resolvedId || toId === resolvedId;

        drawConnectionWithHighlight(conn, isHighlighted, resolvedId);
    });
}

function drawConnectionWithHighlight(conn, isHighlighted, hoveredId) {
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
    path.setAttribute('fill', 'none');

    if (isHighlighted) {
        // Highlighted connection: dashed with animation
        path.setAttribute('stroke', getColorForType(conn.type));
        path.setAttribute('stroke-width', '3');
        path.setAttribute('stroke-dasharray', '12 8'); // Increased gaps from 8,4 to 12,8

        // Determine direction of animation (away from hovered element)
        const isFromHovered = fromId === hoveredId;
        const pathLength = path.getTotalLength();

        // Create flowing animation (slower - 6s for subtle effect)
        const style = document.createElement('style');
        const animationName = `flow-${conn.id}`;
        const keyframes = `
            @keyframes ${animationName} {
                to {
                    stroke-dashoffset: ${isFromHovered ? -pathLength : pathLength};
                }
            }
        `;
        style.textContent = keyframes;
        document.head.appendChild(style);

        path.style.strokeDashoffset = '0';
        path.style.animation = `${animationName} 6s linear infinite`;
        path.classList.add('highlighted-connection');
    } else {
        // Non-highlighted connection: dimmed
        path.setAttribute('stroke', getColorForType(conn.type));
        path.setAttribute('stroke-width', '2');
        path.setAttribute('opacity', '0.15');
    }

    elements.connectionsLayer.appendChild(path);

    // Hit area (invisible, wide) - only for non-highlighted or always?
    const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    hitPath.setAttribute('d', d);
    hitPath.setAttribute('stroke', 'transparent');
    hitPath.setAttribute('stroke-width', '20');
    hitPath.setAttribute('fill', 'none');
    hitPath.style.cursor = 'pointer';
    hitPath.style.pointerEvents = 'stroke';
    hitPath.onclick = (e) => showDeleteButton(e, conn);
    elements.connectionsLayer.appendChild(hitPath);
}

function clearHighlight() {
    // Remove opacity from all elements
    document.querySelectorAll('.task-card, .component-group').forEach(el => {
        el.style.opacity = '';
    });

    // Remove animation styles
    document.querySelectorAll('.highlighted-connection').forEach(el => {
        el.remove();
    });

    // Remove dynamically created keyframe styles
    document.querySelectorAll('style').forEach(style => {
        if (style.textContent.includes('@keyframes flow-')) {
            style.remove();
        }
    });

    // Re-render connections normally
    renderConnections();
}
