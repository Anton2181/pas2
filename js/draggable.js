// Drag and Drop Logic

// Z-index management
let maxZIndex = 1;

function bringToFront(el) {
    maxZIndex++;
    el.style.zIndex = maxZIndex;
}

function setupDragAndDrop() {
    elements.canvasContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    elements.canvasContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        const dataString = e.dataTransfer.getData('application/json');
        if (!dataString) return;

        // Check if dropped on a group
        const targetGroup = e.target.closest('.component-group');

        try {
            const data = JSON.parse(dataString);
            if (data.type === 'new-task') {
                handleNewTaskDrop(data, e.clientX, e.clientY, targetGroup);
            }
        } catch (err) {
            console.error('Drop error:', err);
        }
    });
}

function handleNewTaskDrop(data, x, y, targetGroup = null) {
    const task = TASKS.find(t => t.id === data.taskId);
    if (!task) return;

    if (data.source === 'available') {
        state.availableTasks = state.availableTasks.filter(t => t.id !== task.id);
        state.usedTasks.push(task);
        renderSidebarLists();
    } else if (data.source === 'skipped') {
        state.skippedTasks = state.skippedTasks.filter(t => t.id !== task.id);
        state.usedTasks.push(task);
        renderSidebarLists();
    }

    const instanceId = state.nextInstanceId++;
    // const canvasRect = elements.canvas.getBoundingClientRect(); // Removed: unreliable with scaling/scrolling

    // Fix: Use container rect and scroll position for robust coordinate calculation
    const containerRect = elements.canvasContainer.getBoundingClientRect();
    const scrollLeft = elements.canvasContainer.scrollLeft;
    const scrollTop = elements.canvasContainer.scrollTop;

    // Calculate position relative to the UN-SCROLLED, UN-SCALED canvas origin
    // x - containerRect.left gives mouse position relative to container viewport
    // + scrollLeft adds the scrolled amount
    // / zoomLevel scales it down to internal coordinates
    const posX = (x - containerRect.left + scrollLeft) / state.zoomLevel;
    const posY = (y - containerRect.top + scrollTop) / state.zoomLevel;

    console.log('Drop:', { x, y, containerLeft: containerRect.left, scrollLeft, zoom: state.zoomLevel, posX, posY });

    // Calculate priority for this task instance
    const existingInstances = state.canvasTasks.filter(t => t.id === task.id);
    const priority = existingInstances.length + 1;

    const taskInstance = {
        ...task,
        instanceId: instanceId,
        x: posX,
        y: posY,
        priority: priority
    };

    if (targetGroup) {
        taskInstance.groupId = targetGroup.id.replace('group-', '');
    }

    state.canvasTasks.push(taskInstance);
    renderTaskOnCanvas(taskInstance);
    updatePriorities(task.id);

    // If dropped on a group, move it there immediately
    if (targetGroup) {
        const el = document.getElementById(`task-${instanceId}`);
        if (el) {
            const content = targetGroup.querySelector('.group-content');
            if (content) {
                content.appendChild(el);
                el.style.position = 'relative';
                el.style.left = '';
                el.style.top = '';

                // Hide candidates toggle when added to group
                if (el._candidatesToggle) {
                    el._candidatesToggle.style.display = 'none';
                }
                if (el._candidatesList) {
                    el._candidatesList.style.display = 'none';
                }

                if (targetGroup._updateGroupCandidates) {
                    setTimeout(() => targetGroup._updateGroupCandidates(), 0);
                }
            }
        }
    }

    if (typeof pushState === 'function') pushState();
}

function makeDraggable(el, instance, isGroup = false) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;
    let hasMoved = false;

    el.addEventListener('mousedown', (e) => {
        if (e.target.closest('.task-delete-btn') ||
            e.target.closest('.candidates-toggle') ||
            e.target.closest('.group-delete-btn') ||
            e.target.closest('.group-candidates-toggle') ||
            e.target.closest('.resize-handle') ||
            e.target.closest('.icon-btn') || // Skip/Restore buttons
            (e.target.tagName === 'INPUT')) return;

        // Check for Shift key for connections
        if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            startConnectionDrag(e, el, instance, isGroup);
            return;
        }

        if (isGroup && e.target.closest('.task-card')) return;

        // Bring to front on click
        bringToFront(el);

        isDragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;

        if (!isGroup && el.parentElement.classList.contains('group-content')) {
            const canvasRect = elements.canvas.getBoundingClientRect();
            const oldGroup = el.parentElement.parentElement;

            elements.canvas.appendChild(el);
            el.style.position = 'absolute';

            const width = el.offsetWidth;
            const height = el.offsetHeight;

            // Fix: Calculate position to center under mouse, accounting for container scale
            // (e.clientX - canvasRect.left) is scaled pixels.
            // We need unscaled pixels for style.left.
            el.style.left = `${(e.clientX - canvasRect.left) / state.zoomLevel - (width / 2)}px`;
            el.style.top = `${(e.clientY - canvasRect.top) / state.zoomLevel - (height / 2)}px`;

            // Show candidates toggle when removed from group
            if (el._candidatesToggle) {
                el._candidatesToggle.style.display = 'block';
            }

            if (oldGroup && oldGroup._updateGroupCandidates) {
                setTimeout(() => oldGroup._updateGroupCandidates(), 0);
            }
            if (oldGroup && oldGroup._updateGroupMetrics) {
                setTimeout(() => oldGroup._updateGroupMetrics(), 0);
            }

            hasMoved = true; // Removing from group counts as a move
        }

        initialLeft = parseFloat(el.style.left);
        initialTop = parseFloat(el.style.top);

        if (isGroup) {
            document.querySelectorAll('.component-group').forEach(g => g.classList.remove('selected'));
            el.classList.add('selected');
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        // Fix: Divide delta by zoomLevel to match mouse movement in scaled container
        const dx = (e.clientX - startX) / state.zoomLevel;
        const dy = (e.clientY - startY) / state.zoomLevel;

        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            hasMoved = true;
        }

        el.style.left = `${initialLeft + dx}px`;
        el.style.top = `${initialTop + dy}px`;

        if (isGroup) {
            instance.x = initialLeft + dx;
            instance.y = initialTop + dy;
        }

        // Update connections
        if (typeof renderConnections === 'function') {
            renderConnections();
        }
    });

    window.addEventListener('mouseup', (e) => {
        if (isDragging) {
            isDragging = false;
            // Don't reset z-index - keep element at front

            if (!isGroup) {
                let droppedOnGroup = false;
                const groups = document.querySelectorAll('.component-group');

                const elRect = el.getBoundingClientRect();
                const centerX = elRect.left + elRect.width / 2;
                const centerY = elRect.top + elRect.height / 2;

                for (const groupEl of groups) {
                    const groupRect = groupEl.getBoundingClientRect();
                    if (centerX >= groupRect.left && centerX <= groupRect.right &&
                        centerY >= groupRect.top && centerY <= groupRect.bottom) {

                        // Check Exclusion Constraint
                        const taskInstanceId = el.id.replace('task-', '');
                        const targetGroupId = groupEl.id.replace('group-', '');

                        if (typeof checkExclusionConstraint === 'function' &&
                            checkExclusionConstraint(taskInstanceId, targetGroupId)) {
                            // Constraint violated
                            // Ideally show a toast or shake
                            console.log('Exclusion constraint violated');
                            continue; // Try other groups or fail
                        }

                        const content = groupEl.querySelector('.group-content');
                        content.appendChild(el);
                        el.style.position = 'relative';
                        el.style.left = '';
                        el.style.top = '';

                        // Update State
                        instance.groupId = groupEl.id.replace('group-', '');

                        droppedOnGroup = true;
                        hasMoved = true;

                        // Update connections immediately
                        if (typeof renderConnections === 'function') {
                            renderConnections();
                        }

                        // Hide candidates toggle when added to group
                        if (el._candidatesToggle) {
                            el._candidatesToggle.style.display = 'none';
                        }
                        // Also hide the list if it's open
                        if (el._candidatesList) {
                            el._candidatesList.style.display = 'none';
                        }

                        if (groupEl._updateGroupCandidates) {
                            setTimeout(() => groupEl._updateGroupCandidates(), 0);
                        }

                        break;
                    }
                }

                if (!droppedOnGroup) {
                    if (el.parentElement !== elements.canvas) {
                        elements.canvas.appendChild(el);
                        el.style.position = 'absolute';
                    }
                    instance.x = parseFloat(el.style.left);
                    instance.y = parseFloat(el.style.top);

                    // Clear Group ID
                    delete instance.groupId;
                }
            }

            if (hasMoved && typeof pushState === 'function') {
                pushState();
            }
        }
    });
}
