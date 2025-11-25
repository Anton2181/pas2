/**
 * Renders the Schedule Preview panel
 */
/**
 * Renders the Schedule Preview panel
 */
let currentMemberFilterId = null;

function setScheduleMemberFilter(memberId) {
    currentMemberFilterId = memberId;
    renderSchedulePreview();
}

// Expose globally
window.setScheduleMemberFilter = setScheduleMemberFilter;

function renderSchedulePreview() {
    const container = document.getElementById('schedule-preview-container');
    if (!container) return;

    container.innerHTML = ''; // Clear existing content

    // Get selected candidate for filtering
    let filterCandidate = null;
    if (currentMemberFilterId) {
        filterCandidate = CANDIDATES.find(c => c.id === currentMemberFilterId);
    }

    // Track IDs rendered in THIS pass
    const newRenderedIds = new Set();
    const previousRenderedIds = window.renderedTaskIds || new Set();

    // Get current hover state to apply immediately (prevents flicker)
    const hoveredTaskName = window.getCurrentHoveredTaskName ? window.getCurrentHoveredTaskName() : null;
    const hoveredIsGroup = window.getCurrentHoveredIsGroup ? window.getCurrentHoveredIsGroup() : false;

    SCHEDULE_DATA.forEach((weekData, weekIndex) => {
        const weekGroup = document.createElement('div');
        weekGroup.className = 'schedule-week-group';
        weekGroup.dataset.weekIndex = weekIndex;

        // Week Header
        const weekHeader = document.createElement('div');
        weekHeader.className = 'schedule-week-header';
        weekHeader.textContent = weekData.week;
        weekGroup.appendChild(weekHeader);

        // Days
        weekData.days.forEach((dayData, dayIndex) => {
            // Skip empty days
            if (!dayData.tasks || dayData.tasks.length === 0) {
                return;
            }

            const dayRow = document.createElement('div');
            dayRow.className = `schedule-day-row day-${dayData.type}`;
            dayRow.dataset.dayIndex = dayIndex;

            // Day Label (Hidden via CSS but kept for structure if needed later)
            const dayLabel = document.createElement('div');
            dayLabel.className = 'schedule-day-label';
            dayLabel.textContent = dayData.name;
            dayRow.appendChild(dayLabel);

            // Tasks Container
            const tasksContainer = document.createElement('div');
            tasksContainer.className = 'schedule-tasks-container';

            dayData.tasks.forEach(task => {
                const taskSquare = document.createElement('div');
                taskSquare.className = 'schedule-task-square';

                // Calculate color based on candidate count
                const candidateCount = getCandidateCount(task.name, task);
                taskSquare.style.backgroundColor = getHeatmapColor(candidateCount);

                taskSquare.dataset.taskId = task.id;
                taskSquare.dataset.taskName = task.name;
                taskSquare.dataset.isGroup = task.isGroup ? 'true' : 'false';

                // Immediate Hover Application (No Flicker)
                if (hoveredTaskName) {
                    let isMatch = false;
                    if (hoveredIsGroup) {
                        isMatch = task.name === hoveredTaskName;
                    } else {
                        isMatch = !task.isGroup && task.name === hoveredTaskName;
                    }

                    if (isMatch) {
                        taskSquare.classList.add('highlighted');
                    } else {
                        taskSquare.classList.add('dimmed');
                    }
                }

                // Animation Logic
                // If ID was NOT in the previous render, it's new -> Animate
                if (!previousRenderedIds.has(task.id)) {
                    // New task! Animate it.
                    requestAnimationFrame(() => {
                        if (task.isGroup) {
                            taskSquare.classList.add('is-group-task');
                            taskSquare.classList.add('animate-pop');
                        } else {
                            taskSquare.classList.add('animate-slide');
                        }
                    });
                } else {
                    // Already rendered previously, just add static class if needed
                    if (task.isGroup) {
                        taskSquare.classList.add('is-group-task');
                    }
                }

                // Add to current set
                newRenderedIds.add(task.id);

                // Filtering Logic
                if (filterCandidate) {
                    let isEligible = false;

                    // Resolve Real ID for Star Checking
                    let realId = null;
                    let isGroup = task.isGroup;

                    if (isGroup) {
                        const parts = task.id.split('-');
                        if (parts.length >= 2) realId = parts[1];
                    } else {
                        const originalTask = typeof TASKS !== 'undefined' ? TASKS.find(t => t.name === task.name) : null;
                        if (originalTask) realId = originalTask.id;
                    }

                    // 1. Check Star Restriction (Priority)
                    let starRestricted = false;
                    if (realId && window.isTaskStarred && window.isTaskStarred(realId, isGroup)) {
                        // Check if ANY candidates are starred for this task
                        const anyStarred = typeof CANDIDATES !== 'undefined' && CANDIDATES.some(c => window.isCandidateStarred(realId, c.id));

                        if (anyStarred) {
                            // Restriction is active. Is the current candidate starred?
                            if (!window.isCandidateStarred(realId, filterCandidate.id)) {
                                starRestricted = true; // Not starred, so ineligible
                            }
                        }
                    }

                    if (!starRestricted) {
                        if (task.isGroup && task.subTasks) {
                            // For groups, check if candidate can do ALL tasks in the group
                            // Check Roles AND Availability for each sub-task
                            isEligible = task.subTasks.every(subTask =>
                                filterCandidate.roles.includes(subTask.name) &&
                                isCandidateAvailable(filterCandidate, subTask.name, subTask.time, weekData.week, dayData.name)
                            );
                        } else {
                            // For individual tasks
                            isEligible = filterCandidate.roles.includes(task.name) &&
                                isCandidateAvailable(filterCandidate, task.name, task.time, weekData.week, dayData.name);
                        }
                    }

                    if (!isEligible) {
                        taskSquare.classList.add('task-ineligible');
                    }
                }

                // Click event
                taskSquare.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleTaskDetail(task, weekIndex, dayIndex, dayRow);
                });

                // Smart tooltip positioning on hover using GLOBAL tooltip
                taskSquare.addEventListener('mouseenter', (e) => {
                    const tooltip = getGlobalTooltip();
                    tooltip.textContent = task.name;

                    const rect = taskSquare.getBoundingClientRect();

                    // Position below the square by default
                    let top = rect.bottom + 8;
                    let left = rect.left + (rect.width / 2);

                    tooltip.style.top = `${top}px`;
                    tooltip.style.left = `${left}px`;
                    tooltip.style.transform = 'translateX(-50%)';
                    tooltip.style.opacity = '1';
                });

                taskSquare.addEventListener('mouseleave', () => {
                    const tooltip = getGlobalTooltip();
                    tooltip.style.opacity = '0';
                });

                tasksContainer.appendChild(taskSquare);
            });

            dayRow.appendChild(tasksContainer);
            weekGroup.appendChild(dayRow);
        });

        container.appendChild(weekGroup);
    });

    // Update global set for next time
    window.renderedTaskIds = newRenderedIds;

    // Re-apply hover if needed
    if (window.reapplyScheduleHover) {
        // Use requestAnimationFrame to ensure DOM is ready and reduce flicker
        requestAnimationFrame(window.reapplyScheduleHover);
    }
}

// Global click listener to close detail view when clicking outside
document.addEventListener('click', handleGlobalClick);

function getCandidateCount(taskName, task) {
    if (typeof CANDIDATES === 'undefined') return 0;

    // 1. Resolve Real ID for Star Checking
    let realId = null;
    let isGroup = false;

    if (task) {
        if (task.isGroup) {
            isGroup = true;
            // Extract group ID from "g-{id}-..."
            const parts = task.id.split('-');
            if (parts.length >= 2) realId = parts[1];
        } else {
            // Find task in TASKS by name to get its persistent ID (t1, t2...)
            const originalTask = typeof TASKS !== 'undefined' ? TASKS.find(t => t.name === task.name) : null;
            if (originalTask) realId = originalTask.id;
        }
    }

    let pool = CANDIDATES;

    // 2. Check Star Restriction
    // We need to use the resolved realId
    if (realId && window.isTaskStarred && window.isTaskStarred(realId, isGroup)) {
        const starredCandidates = pool.filter(c => window.isCandidateStarred(realId, c.id));
        if (starredCandidates.length > 0) {
            pool = starredCandidates;
        }
        // Else fallback to full pool
    }

    // 3. Calculate Count
    if (isGroup && task && task.subTasks) {
        // For groups, candidate must be eligible for ALL subtasks
        // We check if the candidate is in the pool AND has roles for all subtasks
        // (Availability check is expensive, maybe skip for heatmap? 
        //  The original logic just checked roles. Let's stick to roles for performance unless requested.)
        // Wait, the previous logic was just roles.

        return pool.filter(c => {
            return task.subTasks.every(subTask => c.roles.includes(subTask.name));
        }).length;
    } else {
        // Individual Task
        return pool.filter(c => c.roles.includes(taskName)).length;
    }
}

function getHeatmapColor(count) {
    // Pastel red-yellow-green heatmap
    if (count === 0) return '#E29AA8'; // Pastel pink/red - no candidates
    if (count <= 2) return '#F5A896'; // Pastel coral - very few
    if (count <= 5) return '#F5D896'; // Pastel yellow - some
    if (count <= 10) return '#C6D89E'; // Pastel lime - good amount
    return '#A8C6A3'; // Pastel green - many
}

function handleGlobalClick(e) {
    // If click is inside a task square or detail container, do nothing
    if (e.target.closest('.schedule-task-square') || e.target.closest('.schedule-detail-container')) {
        return;
    }

    // Close all open detail views
    document.querySelectorAll('.schedule-detail-container.open').forEach(el => {
        el.classList.remove('open');
        el.dataset.currentTaskId = '';
    });
}

/**
 * Toggles the detail view for a task, inserting it after the clicked task's row
 * @param {Object} task 
 * @param {number} weekIndex 
 * @param {number} dayIndex 
 * @param {HTMLElement} dayRow 
 */
function toggleTaskDetail(task, weekIndex, dayIndex, dayRow) {
    // Find the clicked task square
    const clickedSquare = event.target.closest('.schedule-task-square');
    const tasksContainer = dayRow.querySelector('.schedule-tasks-container');

    if (!clickedSquare || !tasksContainer) return;

    // Get all squares to find which ones are on the same row
    const allSquares = Array.from(tasksContainer.querySelectorAll('.schedule-task-square'));
    const clickedRect = clickedSquare.getBoundingClientRect();

    // Find all squares on the same visual row (same top position)
    const squaresOnSameRow = allSquares.filter(square => {
        const rect = square.getBoundingClientRect();
        return Math.abs(rect.top - clickedRect.top) < 5; // Allow 5px tolerance
    });

    // Find the last square in this row
    const lastSquareInRow = squaresOnSameRow[squaresOnSameRow.length - 1];

    // Find or create detail container
    let detailContainer = tasksContainer.querySelector('.schedule-detail-container');

    if (!detailContainer) {
        // Create new detail container
        detailContainer = document.createElement('div');
        detailContainer.className = 'schedule-detail-container';
        detailContainer.id = `detail-${weekIndex}-${dayIndex}`;
        detailContainer.style.flexBasis = '100%'; // Take full width

        // Create triangle marker
        const triangle = document.createElement('div');
        triangle.className = 'schedule-detail-triangle';
        detailContainer.appendChild(triangle);

        const detailContent = document.createElement('div');
        detailContent.className = 'schedule-detail-content';
        detailContainer.appendChild(detailContent);
    }

    const detailContent = detailContainer.querySelector('.schedule-detail-content');
    const triangle = detailContainer.querySelector('.schedule-detail-triangle');

    // Close ALL other open details globally
    document.querySelectorAll('.schedule-detail-container.open').forEach(el => {
        if (el !== detailContainer) {
            el.classList.remove('open');
            el.dataset.currentTaskId = '';
        }
    });

    const currentTaskId = detailContainer.dataset.currentTaskId;

    // If clicking the same task that is already open, close it
    if (detailContainer.classList.contains('open') && currentTaskId === task.id) {
        detailContainer.classList.remove('open');
        detailContainer.dataset.currentTaskId = '';
        return;
    }

    // Insert detail container after the last square in the clicked row
    if (lastSquareInRow.nextSibling !== detailContainer) {
        tasksContainer.insertBefore(detailContainer, lastSquareInRow.nextSibling);
    }

    // Update content
    detailContent.innerHTML = '';

    // Create detailed task card
    const card = renderDetailTaskCard(task);

    // Adjust card style for the detail view
    card.style.width = 'auto';
    card.style.maxWidth = '400px';
    card.style.margin = '0 auto';
    card.style.position = 'relative';
    card.style.left = 'auto';
    card.style.top = 'auto';

    detailContent.appendChild(card);

    // Open container
    detailContainer.classList.add('open');
    detailContainer.dataset.currentTaskId = task.id;

    // Position the triangle after container is open and laid out
    requestAnimationFrame(() => {
        if (clickedSquare && triangle) {
            const squareRect = clickedSquare.getBoundingClientRect();
            const containerRect = detailContainer.getBoundingClientRect();

            // Calculate position relative to container, centering on the square
            const relativeLeft = squareRect.left - containerRect.left + (squareRect.width / 2) - 12;
            triangle.style.left = `${Math.max(12, Math.min(relativeLeft, containerRect.width - 24))}px`;
        }
    });
}

/**
 * Renders a task card similar to the canvas view
 * @param {Object} task 
 */
function renderDetailTaskCard(task) {
    const el = document.createElement('div');
    el.className = 'task-card';
    el.classList.add('schedule-detail-card');

    const content = document.createElement('div');
    content.innerHTML = `<div class="task-header">${task.name}</div>`;

    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.style.display = 'flex';
    meta.style.justifyContent = 'space-between';
    meta.style.marginTop = '8px';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = task.time || '';

    const effortSpan = document.createElement('span');
    effortSpan.textContent = task.effort ? `${task.effort} Effort` : '';

    meta.appendChild(timeSpan);
    meta.appendChild(effortSpan);
    content.appendChild(meta);
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
        display: block;
    `;

    // Use stored candidates (for groups) or calculate on fly (for singles)
    let suitableCandidates = task.candidates || (
        (typeof CANDIDATES !== 'undefined')
            ? CANDIDATES.filter(c => c.roles.includes(task.name))
            : []
    );

    // Apply Star Restriction to the list
    // 1. Resolve Real ID
    let realId = null;
    let isGroup = false;

    if (task) {
        if (task.isGroup) {
            isGroup = true;
            const parts = task.id.split('-');
            if (parts.length >= 2) realId = parts[1];
        } else {
            const originalTask = typeof TASKS !== 'undefined' ? TASKS.find(t => t.name === task.name) : null;
            if (originalTask) realId = originalTask.id;
        }
    }

    // 2. Filter if Starred
    if (realId && window.isTaskStarred && window.isTaskStarred(realId, isGroup)) {
        const starredCandidates = suitableCandidates.filter(c => window.isCandidateStarred(realId, c.id));
        if (starredCandidates.length > 0) {
            suitableCandidates = starredCandidates;
        }
        // Else fallback to full list
    }

    const displayCount = suitableCandidates.length;

    candidatesToggle.innerHTML = `<span class="candidates-text">▼ Candidates (${displayCount})</span><span class="candidates-icon" style="display:none">▼</span>`;

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

    candidatesToggle.onclick = (e) => {
        e.stopPropagation();
        const isHidden = candidatesList.style.display === 'none';
        candidatesList.style.display = isHidden ? 'block' : 'none';
        const textSpan = candidatesToggle.querySelector('.candidates-text');
        if (textSpan) textSpan.textContent = isHidden ? `▲ Candidates (${displayCount})` : `▼ Candidates (${displayCount})`;
    };

    el.appendChild(candidatesToggle);
    el.appendChild(candidatesList);

    return el;
}

// Global tooltip helper to avoid z-index stacking context issues
function getGlobalTooltip() {
    let tooltip = document.getElementById('global-schedule-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'global-schedule-tooltip';
        tooltip.className = 'schedule-tooltip';
        document.body.appendChild(tooltip);
    }
    return tooltip;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    renderSchedulePreview();
});

// Group Style Toggle Logic
(function () {
    const STORAGE_KEY = 'schedule_group_style';

    function updateStyle(style) {
        const container = document.getElementById('schedule-preview-container');
        const toggle = document.getElementById('group-style-toggle');

        if (!container) return;

        if (style === 'circle') {
            container.classList.add('group-style-circle');
            if (toggle) toggle.checked = true;
        } else {
            container.classList.remove('group-style-circle');
            if (toggle) toggle.checked = false;
        }
        localStorage.setItem(STORAGE_KEY, style);
    }

    // Init
    const savedStyle = localStorage.getItem(STORAGE_KEY) || 'square';

    function initToggle() {
        const toggle = document.getElementById('group-style-toggle');
        if (toggle) {
            // Set initial state
            updateStyle(savedStyle);

            // Add listener
            toggle.addEventListener('change', (e) => {
                updateStyle(e.target.checked ? 'circle' : 'square');
            });
        } else {
            // Retry if not found (e.g. dynamic loading issues)
            setTimeout(initToggle, 500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initToggle);
    } else {
        initToggle();
    }
})();
