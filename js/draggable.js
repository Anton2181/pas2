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
    const canvasRect = elements.canvas.getBoundingClientRect();

    // Fix: Divide by zoomLevel for position because the container is scaled.
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

    // If dropped on a group, move it there immediately
    if (targetGroup) {
        const el = document.getElementById(`task-${instanceId}`);
        if (el) {
            const content = targetGroup.querySelector('.group-content');
            if (content) {
                content.appendChild(el);
                el.style.position = 'static';
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
}

function makeDraggable(el, instance, isGroup = false) {
    let isDragging = false;
    let startX, startY;
    let initialLeft, initialTop;

    el.addEventListener('mousedown', (e) => {
        if (e.target.closest('.task-delete-btn') ||
            e.target.closest('.candidates-toggle') ||
            e.target.closest('.group-delete-btn') ||
            e.target.closest('.group-candidates-toggle') ||
            e.target.closest('.resize-handle') ||
            e.target.closest('.icon-btn') || // Skip/Restore buttons
            (e.target.tagName === 'INPUT')) return;

        if (isGroup && e.target.closest('.task-card')) return;

        isDragging = true;
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
        }

        initialLeft = parseFloat(el.style.left);
        initialTop = parseFloat(el.style.top);
        el.style.zIndex = 1000;

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
                let droppedOnGroup = false;
                const groups = document.querySelectorAll('.component-group');

                const elRect = el.getBoundingClientRect();
                const centerX = elRect.left + elRect.width / 2;
                const centerY = elRect.top + elRect.height / 2;

                for (const groupEl of groups) {
                    const groupRect = groupEl.getBoundingClientRect();
                    if (centerX >= groupRect.left && centerX <= groupRect.right &&
                        centerY >= groupRect.top && centerY <= groupRect.bottom) {

                        const content = groupEl.querySelector('.group-content');
                        content.appendChild(el);
                        el.style.position = 'static';
                        el.style.left = '';
                        el.style.top = '';
                        droppedOnGroup = true;

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
                }
            }
        }
    });
}
