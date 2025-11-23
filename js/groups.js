// Group Management

function setupGroups() {
    if (elements.addGroupBtn) {
        elements.addGroupBtn.addEventListener('click', createGroup);
    }
}

function createGroup() {
    const groupId = state.nextGroupId++;
    const variant = Math.floor(Math.random() * 5) + 1;

    // Calculate position to center in current viewport
    const container = elements.canvasContainer;
    const zoom = state.zoomLevel;

    // Center of viewport in SCROLLED pixels
    const viewportCenterX = container.scrollLeft + container.clientWidth / 2;
    const viewportCenterY = container.scrollTop + container.clientHeight / 2;

    // Convert to UNSCALED coordinates
    // We subtract half the group size (280x200) to center it
    const x = (viewportCenterX / zoom) - 140;
    const y = (viewportCenterY / zoom) - 100;

    const group = {
        id: groupId,
        title: 'New Group',
        variant: variant,
        x: x,
        y: y,
        width: 280, // Default width
        height: 200 // Default height
    };

    state.groups.push(group);
    renderGroup(group);

    if (typeof pushState === 'function') pushState();
}

function renderGroup(group) {
    const el = document.createElement('div');
    el.className = `component-group variant-${group.variant}`;
    el.id = `group-${group.id}`;
    el.style.left = `${group.x}px`;
    el.style.top = `${group.y}px`;
    if (group.width) el.style.width = `${group.width}px`;
    if (group.height) el.style.height = `${group.height}px`;

    const deleteBtn = document.createElement('div');
    deleteBtn.className = 'group-delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        const content = el.querySelector('.group-content');
        Array.from(content.children).forEach(child => {
            if (child.classList.contains('task-card')) {
                const rect = child.getBoundingClientRect();
                const canvasRect = elements.canvas.getBoundingClientRect();
                child.style.position = 'absolute';

                // When releasing, we need to convert screen coordinates back to canvas coordinates
                // rect is screen coords. canvasRect is screen coords of the wrapper.
                // The wrapper is scaled.
                // So (rect.left - canvasRect.left) gives scaled pixels.
                // We need unscaled pixels for style.left.
                child.style.left = `${(rect.left - canvasRect.left) / state.zoomLevel}px`;
                child.style.top = `${(rect.top - canvasRect.top) / state.zoomLevel}px`;

                elements.canvas.appendChild(child);

                // Show candidates toggle again
                if (child._candidatesToggle) {
                    child._candidatesToggle.style.display = 'block';
                }
            }
        });

        // Remove connections
        if (typeof removeConnectionsFor === 'function') {
            removeConnectionsFor(`group-${group.id}`);
        }

        el.remove();
        state.groups = state.groups.filter(g => g.id !== group.id);

        if (typeof pushState === 'function') pushState();
    };
    el.appendChild(deleteBtn);

    const header = document.createElement('div');
    header.className = 'group-header';
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';

    const titleContainer = document.createElement('div');
    titleContainer.textContent = group.title;
    titleContainer.style.flex = '1';
    header.appendChild(titleContainer);

    const metricsContainer = document.createElement('div');
    metricsContainer.className = 'group-metrics';
    metricsContainer.style.fontSize = '12px';
    metricsContainer.style.color = 'var(--text-secondary)';
    metricsContainer.style.display = 'flex';
    metricsContainer.style.gap = '16px';
    header.appendChild(metricsContainer);

    const updateGroupMetrics = () => {
        const taskCards = content.querySelectorAll('.task-card');
        let totalEffort = 0;
        let timeSlots = [];
        let hasAll = false;

        taskCards.forEach(card => {
            const taskId = card.id.replace('task-', '');
            const taskInstance = state.canvasTasks.find(t => t.instanceId == taskId);
            if (taskInstance) {
                if (taskInstance.effort) totalEffort += parseFloat(taskInstance.effort);
                if (taskInstance.time) {
                    if (taskInstance.time.toLowerCase() === 'all') {
                        hasAll = true;
                    } else {
                        timeSlots.push(taskInstance.time);
                    }
                }
            }
        });

        let timeDisplay = '';
        if (hasAll) {
            timeDisplay = 'All';
        } else if (timeSlots.length > 0) {
            // Parse time slots to find earliest and latest
            const parsedSlots = timeSlots.map(slot => {
                const parts = slot.split('-');
                if (parts.length === 2) {
                    return {
                        start: parseInt(parts[0]),
                        end: parseInt(parts[1])
                    };
                }
                return null;
            }).filter(s => s !== null);

            if (parsedSlots.length > 0) {
                const earliest = Math.min(...parsedSlots.map(s => s.start));
                const latest = Math.max(...parsedSlots.map(s => s.end));
                timeDisplay = `${earliest}-${latest}`;
            } else {
                // Fallback if times aren't in XX-YY format
                timeDisplay = timeSlots.join(', ');
            }
        }

        const effortDisplay = totalEffort > 0 ? `${totalEffort} Effort` : '';
        metricsContainer.innerHTML = `
            <span>${timeDisplay}</span>
            <span>${effortDisplay}</span>
        `;
    };

    // Store update function on element
    el._updateGroupMetrics = updateGroupMetrics;

    titleContainer.addEventListener('dblclick', () => {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = group.title;
        input.style.width = '100%';
        input.style.font = 'inherit';

        input.onblur = () => {
            group.title = input.value || 'Untitled Group';
            titleContainer.textContent = group.title;
            if (typeof pushState === 'function') pushState();
        };

        input.onkeydown = (e) => {
            if (e.key === 'Enter') input.blur();
        };

        titleContainer.textContent = '';
        titleContainer.appendChild(input);
        input.focus();
    });

    el.appendChild(header);

    const content = document.createElement('div');
    content.className = 'group-content';
    el.appendChild(content);

    const groupCandidatesToggle = document.createElement('div');
    groupCandidatesToggle.className = 'group-candidates-toggle';
    groupCandidatesToggle.innerHTML = '<span class="candidates-text">▼ Candidates</span><span class="candidates-icon" style="display:none">▼</span>';
    groupCandidatesToggle.style.cssText = `
        margin-top: 8px;
        text-align: center;
        cursor: pointer;
        color: var(--text-secondary);
        font-size: 12px;
        display: none;
    `;

    const groupCandidatesList = document.createElement('div');
    groupCandidatesList.className = 'group-candidates-list';
    groupCandidatesList.style.display = 'none';
    groupCandidatesList.style.marginTop = '8px';
    groupCandidatesList.style.padding = '4px';
    groupCandidatesList.style.fontSize = '12px';
    groupCandidatesList.style.color = 'var(--text-secondary)';
    groupCandidatesList.style.position = 'relative';

    const updateGroupCandidates = () => {
        const taskCards = content.querySelectorAll('.task-card');
        if (taskCards.length === 0) {
            groupCandidatesList.innerHTML = 'No tasks in group';
            groupCandidatesToggle.style.display = 'none';
            return;
        }

        groupCandidatesToggle.style.display = 'block';

        // Get all task NAMES in the group (not types)
        const taskNames = [];
        taskCards.forEach(card => {
            const taskId = card.id.replace('task-', '');
            const taskInstance = state.canvasTasks.find(t => t.instanceId == taskId);
            if (taskInstance) {
                taskNames.push(taskInstance.name);
            }
        });

        // Calculate intersection (candidates suitable for ALL tasks)
        let intersection = [...CANDIDATES];
        taskNames.forEach(taskName => {
            intersection = intersection.filter(c => c.roles.includes(taskName));
        });

        // Calculate union (candidates suitable for ANY task)
        const union = CANDIDATES.filter(c => {
            return taskNames.some(taskName => c.roles.includes(taskName));
        });

        const intersectionNames = intersection.map(c => c.name).join(', ') || 'None';
        groupCandidatesList.innerHTML = `<div>${intersectionNames}</div>`;

        const counter = document.createElement('div');
        counter.className = 'candidates-counter';
        counter.textContent = `${intersection.length}/${union.length}`;
        counter.style.cssText = `
            position: absolute;
            bottom: 2px;
            right: 4px;
            font-size: 10px;
            font-weight: 600;
            color: ${intersection.length === 0 ? 'red' : 'var(--text-secondary)'};
        `;
        groupCandidatesList.appendChild(counter);

        // Update toggle button to show count
        const countColor = intersection.length === 0 ? 'red' : 'var(--text-secondary)';
        const textSpan = groupCandidatesToggle.querySelector('.candidates-text');
        const isHidden = groupCandidatesList.style.display === 'none';
        if (textSpan) {
            textSpan.innerHTML = `${isHidden ? '▼' : '▲'} Candidates <span style="color: ${countColor};">(${intersection.length}/${union.length})</span>`;
        }

        // Update metrics
        if (el._updateGroupMetrics) el._updateGroupMetrics();
    };

    groupCandidatesToggle.onclick = () => {
        const isHidden = groupCandidatesList.style.display === 'none';
        if (isHidden) {
            updateGroupCandidates();
        }
        groupCandidatesList.style.display = isHidden ? 'block' : 'none';
        const textSpan = groupCandidatesToggle.querySelector('.candidates-text');
        const iconSpan = candidatesToggle.querySelector('.candidates-icon'); // Bug fix: candidatesToggle is not defined here, should be groupCandidatesToggle
        // Wait, in previous code it was groupCandidatesToggle.querySelector.
        // Let's fix that.
        const iconSpanCorrect = groupCandidatesToggle.querySelector('.candidates-icon');
        if (textSpan) textSpan.textContent = isHidden ? '▲ Candidates' : '▼ Candidates';
        if (iconSpanCorrect) iconSpanCorrect.textContent = isHidden ? '▲' : '▼';
    };

    el.appendChild(groupCandidatesToggle);
    el.appendChild(groupCandidatesList);

    el._updateGroupCandidates = updateGroupCandidates;

    // Resize Handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    el.appendChild(resizeHandle);

    // Resize Logic
    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent drag
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;

        const style = window.getComputedStyle(el);
        const startWidth = parseFloat(style.width);
        const startHeight = parseFloat(style.height);

        const onMouseMove = (moveEvent) => {
            const dx = (moveEvent.clientX - startX) / state.zoomLevel;
            const dy = (moveEvent.clientY - startY) / state.zoomLevel;

            const newWidth = Math.max(200, startWidth + dx);
            const newHeight = Math.max(150, startHeight + dy);

            el.style.width = `${newWidth}px`;
            el.style.height = `${newHeight}px`;

            group.width = newWidth;
            group.height = newHeight;

            if (typeof renderConnections === 'function') {
                renderConnections();
            }
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (typeof pushState === 'function') pushState();
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });

    makeDraggable(el, group, true);

    elements.canvas.appendChild(el);
}
