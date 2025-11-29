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
// Expose globally
window.setScheduleMemberFilter = setScheduleMemberFilter;
window.renderSchedulePreview = renderSchedulePreview;

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

    // Track candidate counts for animation detection
    const newCandidateCounts = new Map();
    const previousCandidateCounts = window.lastCandidateCounts || new Map();

    // Track Filter Change
    const previousMemberFilterId = window.lastMemberFilterId;
    const filterChanged = previousMemberFilterId !== currentMemberFilterId;

    // Track Style Change (Circle vs Square)
    // container is already defined above
    const isCircleStyle = container ? container.classList.contains('group-style-circle') : false;
    const previousStyle = window.lastGroupStyle;
    const styleChanged = previousStyle !== undefined && previousStyle !== isCircleStyle;
    window.lastGroupStyle = isCircleStyle;

    // Get current hover state to apply immediately (prevents flicker)
    const hoveredTaskName = window.getCurrentHoveredTaskName ? window.getCurrentHoveredTaskName() : null;
    const hoveredIsGroup = window.getCurrentHoveredIsGroup ? window.getCurrentHoveredIsGroup() : false;

    // ... (max candidates calculation) ...

    // Animation Logic
    // ...

    // Inside the loop where we process tasks:
    // We need to update the shouldAnimate logic.
    // Since I can't easily inject into the loop from here without replacing the whole function,
    // I will replace the block where `shouldAnimate` is calculated.
    // Wait, I am replacing lines 38-40. I need to make sure I don't break the rest.
    // I will just add the style tracking here.

    // ...

    // Actually, I need to replace the `shouldAnimate` logic block later in the file.
    // Let's do this in two steps or one big replacement if possible.
    // The `shouldAnimate` logic is around line 177.
    // The setup is around line 38.

    // I'll update the setup first.

    // 1. Calculate Max Candidates for Normalization
    let maxCandidates = 0;
    SCHEDULE_DATA.forEach(weekData => {
        weekData.days.forEach(dayData => {
            if (dayData.tasks) {
                dayData.tasks.forEach(task => {
                    const count = getCandidateCount(task.name, task, weekData.week, dayData.name);
                    if (count > maxCandidates) maxCandidates = count;
                });
            }
        });
    });

    // Ensure a minimum max to avoid division by zero or overly sensitive gradients for low counts
    if (maxCandidates < 5) maxCandidates = 5;

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
                const candidateCount = getCandidateCount(task.name, task, weekData.week, dayData.name);
                taskSquare.style.backgroundColor = getHeatmapColor(candidateCount, maxCandidates);

                // Store count for next comparison
                newCandidateCounts.set(task.id, candidateCount);

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
                                hasRole(filterCandidate, subTask.name) && // Use hasRole
                                isCandidateAvailable(filterCandidate, subTask.name, subTask.time, weekData.week, dayData.name)
                            );

                            // Extra check for Split Role Groups:
                            // If this is a split role group, we must also check if the candidate has the SPECIFIC role for this instance (Leader vs Follower)
                            if (isEligible && task.isSplitRole && task.splitRoleType) {
                                if (!hasRole(filterCandidate, task.splitRoleType)) {
                                    isEligible = false;
                                }
                            }
                        } else {
                            // For individual tasks
                            isEligible = hasRole(filterCandidate, task.name) && // Use hasRole
                                isCandidateAvailable(filterCandidate, task.name, task.time, weekData.week, dayData.name);
                        }
                    }

                    if (!isEligible) {
                        taskSquare.classList.add('task-ineligible');
                        // Force gray background for ineligible tasks
                        taskSquare.style.backgroundColor = '#eeeeee';
                    }
                }

                // Animation Logic
                let shouldAnimate = false;

                // Animate if:
                // 1. Filter changed (implicit reset of view)
                // 2. Style changed (Circle <-> Square)
                // 3. New Task
                // 4. Count Changed

                if (filterChanged) {
                    shouldAnimate = true;
                } else if (styleChanged && task.isGroup) {
                    shouldAnimate = true;
                } else {
                    // For groups, we ONLY animate on style/filter change.
                    // We suppress "New" and "Count Changed" animations for groups to ensure stability.
                    if (!task.isGroup) {
                        // 1. New Task?
                        if (!previousRenderedIds.has(task.id)) {
                            shouldAnimate = true;
                        }
                        // 2. Count Changed?
                        else if (previousCandidateCounts.has(task.id) && previousCandidateCounts.get(task.id) !== candidateCount) {
                            shouldAnimate = true;
                        }
                    }
                }

                // SUPPRESS ANIMATION IF INELIGIBLE (Grayed out)
                // If we are filtering by a candidate, and this task is ineligible for them, don't pop it even if count changed.
                // It's distracting to see gray squares popping.
                if (filterCandidate) {
                    // Re-calculate eligibility or check class?
                    // We already checked eligibility above.
                    // Let's use the class check as a proxy since we just applied it.
                    if (taskSquare.classList.contains('task-ineligible')) {
                        shouldAnimate = false;
                    }
                }

                if (shouldAnimate) {
                    // DEBUG: Log why we are animating
                    // console.log(`Animating ${task.name} (${task.id}). Group: ${task.isGroup}. Reason: ${filterChanged ? 'Filter' : styleChanged ? 'Style' : !previousRenderedIds.has(task.id) ? 'New' : 'Count'}`);

                    requestAnimationFrame(() => {
                        // Use pop animation for groups OR count updates
                        if (task.isGroup || previousRenderedIds.has(task.id)) {
                            taskSquare.classList.add('is-group-task'); // Ensure shape style if needed
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
    window.lastCandidateCounts = newCandidateCounts;
    window.lastMemberFilterId = currentMemberFilterId;

    // Re-apply hover if needed
    if (window.reapplyScheduleHover) {
        // Use requestAnimationFrame to ensure DOM is ready and reduce flicker
        requestAnimationFrame(window.reapplyScheduleHover);
    }
}

// Global click listener to close detail view when clicking outside
document.addEventListener('click', handleGlobalClick);

// Helper to check role with localStorage override
function hasRole(candidate, role, excludeBoth = false) {
    if (!candidate || !role) return false;

    // Check for localStorage override for Leader/Follower
    // We need to map the task name (role) to "leader" or "follower"
    const taskName = role.toLowerCase();
    let mappedRole = null;

    if (taskName.includes('lead') || taskName.includes('conduct') || taskName.includes('teacher')) {
        mappedRole = 'leader';
    } else if (taskName.includes('follow') || taskName.includes('assist')) {
        mappedRole = 'follower';
    }

    if (mappedRole) {
        const key = `team_role_${candidate.id}`;
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                const state = JSON.parse(stored);
                if (mappedRole === 'leader') {
                    if (excludeBoth) return state.leader; // Only check specific role
                    return state.leader || state.both; // Include both
                }
                if (mappedRole === 'follower') {
                    if (excludeBoth) return state.follower; // Only check specific role
                    return state.follower || state.both; // Include both
                }
            } catch (e) {
                console.error('Error parsing team role override:', e);
            }
        }
    }

    // Fallback to static roles
    return candidate.roles.includes(role);
}

function getCandidateCount(taskName, task, week, day) {
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

    // Optimization: Use pre-calculated candidates for groups if available
    // This ensures we use the correct logic from schedule-aggregation.js
    let pool = (task && task.candidates) ? task.candidates : CANDIDATES;



    // If we used pre-calculated candidates, we are done!
    if (task && task.candidates) {
        return pool.length;
    }

    // 3. Calculate Count (for individual tasks or if no pre-calc)
    if (isGroup && task && task.subTasks) {
        // ... (Legacy logic, should rarely be hit for groups now) ...
        // For role-based groups, try specific roles first, then fall back to Both
        if (task.isSplitRole) {
            // ... (Keep existing logic as fallback) ...
            // Actually, we can just return 0 or re-calculate if needed.
            // But let's keep the logic I added earlier just in case.

            const specificRoleCandidates = pool.filter(c => {
                return task.subTasks.every(subTask =>
                    hasRole(c, subTask.name, true) && // excludeBoth = true
                    isCandidateAvailable(c, subTask.name, subTask.time, week, day)
                );
            });

            if (specificRoleCandidates.length > 0) {
                return specificRoleCandidates.length;
            }

            const bothCandidates = pool.filter(c => {
                const key = `team_role_${c.id}`;
                const stored = localStorage.getItem(key);
                let hasBoth = false;
                if (stored) {
                    try {
                        const state = JSON.parse(stored);
                        hasBoth = state.both === true;
                    } catch (e) { }
                }
                return hasBoth && task.subTasks.every(subTask =>
                    isCandidateAvailable(c, subTask.name, subTask.time, week, day)
                );
            });

            return bothCandidates.length;
        } else {
            // Non-role-based group: just check availability
            return pool.filter(c => {
                return task.subTasks.every(subTask =>
                    isCandidateAvailable(c, subTask.name, subTask.time, week, day)
                );
            }).length;
        }
    } else {
        // Individual Task
        return pool.filter(c =>
            hasRole(c, taskName) && // Use hasRole helper (includes Both)
            isCandidateAvailable(c, taskName, task.time, week, day)
        ).length;
    }
}

function getHeatmapColor(count, max) {
    if (count === 0) return '#c66276ff'; // Pastel pink/red - no candidates

    // Gradient Stops (The "Old Thresholds" colors)
    const stops = [
        { val: 0.0, color: '#c66276ff' }, // Pink (0%)
        { val: 0.2, color: '#F5A896' }, // Coral (20%)
        { val: 0.4, color: '#F5D896' }, // Yellow (40%)
        { val: 0.7, color: '#C6D89E' }, // Lime (70%)
        { val: 1.0, color: '#A8C6A3' }  // Green (100%)
    ];

    // Normalize count (0 to 1)
    // We map 1..max to 0..1
    // If max is small (e.g. 5), we still want to use the full range
    const normalized = Math.min(1, Math.max(0, (count - 1) / (max - 1)));

    // Find the two stops we are between
    let lower = stops[0];
    let upper = stops[stops.length - 1];

    for (let i = 0; i < stops.length - 1; i++) {
        if (normalized >= stops[i].val && normalized <= stops[i + 1].val) {
            lower = stops[i];
            upper = stops[i + 1];
            break;
        }
    }

    // Interpolate
    const range = upper.val - lower.val;
    const factor = (normalized - lower.val) / range;

    return interpolateColor(lower.color, upper.color, factor);
}

function interpolateColor(color1, color2, factor) {
    // Parse Hex
    const r1 = parseInt(color1.substring(1, 3), 16);
    const g1 = parseInt(color1.substring(3, 5), 16);
    const b1 = parseInt(color1.substring(5, 7), 16);

    const r2 = parseInt(color2.substring(1, 3), 16);
    const g2 = parseInt(color2.substring(3, 5), 16);
    const b2 = parseInt(color2.substring(5, 7), 16);

    // Interpolate
    const r = Math.round(r1 + (r2 - r1) * factor);
    const g = Math.round(g1 + (g2 - g1) * factor);
    const b = Math.round(b1 + (b2 - b1) * factor);

    // To Hex
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
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
    const card = renderDetailTaskCard(task, weekIndex, dayIndex, dayRow);

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
 * @param {number} weekIndex
 * @param {number} dayIndex
 * @param {HTMLElement} dayRow
 */
function renderDetailTaskCard(task, weekIndex, dayIndex, dayRow) {
    const el = document.createElement('div');
    el.className = 'task-card';
    el.classList.add('schedule-detail-card');

    const content = document.createElement('div');
    content.innerHTML = `<div class="task-header">
        ${task.name}
        <span class="task-id-badge" style="font-size: 10px; color: #999; margin-left: 8px; font-weight: normal; font-family: monospace;">${task.id}</span>
    </div>`;

    // Show subtask IDs for groups
    if (task.isGroup && task.subTasks) {
        const subtasksDiv = document.createElement('div');
        subtasksDiv.style.fontSize = '10px';
        subtasksDiv.style.color = '#aaa';
        subtasksDiv.style.marginTop = '2px';
        subtasksDiv.style.fontFamily = 'monospace';
        // Limit to first few if too many? No, user asked for "exact tasks", implying full list.
        // But let's wrap it nicely.
        subtasksDiv.textContent = 'Includes: ' + task.subTasks.map(t => t.id).join(', ');
        content.appendChild(subtasksDiv);
    }

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
    // Use stored candidates (Source of Truth) or calculate on fly (Fallback)
    let suitableCandidates = task.candidates;

    if (!suitableCandidates) {
        suitableCandidates = (typeof CANDIDATES !== 'undefined')
            ? CANDIDATES.filter(c => hasRole(c, task.name))
            : [];
    }

    // Only apply filtering if we didn't have pre-calculated candidates
    if (!task.candidates) {

        // Filter by Availability
        const weekData = SCHEDULE_DATA[weekIndex];
        const dayData = weekData.days[dayIndex];
        const week = weekData.week;
        const day = dayData.name;

        if (task.isGroup && task.subTasks) {
            if (task.isSplitRole && task.splitRoleType) {
                const requiredRole = task.splitRoleType;

                // Helper to check dynamic role state (inline)
                const hasDynamicRole = (c, type) => {
                    const key = `team_role_${c.id}`;
                    try {
                        const stored = localStorage.getItem(key);
                        if (stored) {
                            const state = JSON.parse(stored);
                            if (type === 'leader') return state.leader;
                            if (type === 'follower') return state.follower;
                            if (type === 'both') return state.both;
                        }
                    } catch (e) { }
                    return false;
                };

                // Filter by Capability (Static) + Availability first
                // We assume suitableCandidates is already a pool of potentially valid people
                let pool = suitableCandidates.filter(c =>
                    task.subTasks.every(subTask =>
                        c.roles.includes(subTask.name) && // Capability
                        isCandidateAvailable(c, subTask.name, subTask.time, week, day)
                    )
                );

                // Role-based filtering
                // Refined Priority Logic:
                // 1. Starred Leaders (Priority Specific)
                // 2. Starred Both (Priority Both - only if no Priority Specific)
                // 3. Unstarred Leaders (Specific - only if no Priority Both?)
                // But if we have Starred Leaders, they should win over Starred Both.

                const pureSpecificCandidates = pool.filter(c => hasDynamicRole(c, requiredRole));
                const starredSpecificCandidates = pureSpecificCandidates.filter(c => window.isCandidateStarred(realId, c.id));
                const starredBothCandidates = pool.filter(c => hasDynamicRole(c, 'both') && window.isCandidateStarred(realId, c.id));

                let selectedCandidates = [];

                if (starredSpecificCandidates.length > 0) {
                    // Hierarchy 1: Priority Leaders exist. Use ONLY them.
                    selectedCandidates = starredSpecificCandidates;
                } else {
                    // Hierarchy 2 & 3: No Priority Leaders.
                    // Combine Unstarred Leaders and ALL Both candidates (Starred or Unstarred).
                    const allBothCandidates = pool.filter(c => hasDynamicRole(c, 'both'));
                    selectedCandidates = [...pureSpecificCandidates, ...allBothCandidates];
                }

                if (selectedCandidates.length > 0) {
                    suitableCandidates = selectedCandidates;
                } else {
                    // Hierarchy 4: Fallback to all Both (Unstarred Both)
                    suitableCandidates = pool.filter(c => hasDynamicRole(c, 'both'));
                }
            } else {
                // Non-role-based group: just check availability & capability
                suitableCandidates = suitableCandidates.filter(c =>
                    task.subTasks.every(subTask =>
                        // c.roles.includes(subTask.name) && // Capability check? Aggregation does it.
                        // If we rely on aggregation, we might not need this. But for safety:
                        isCandidateAvailable(c, subTask.name, subTask.time, week, day)
                    )
                );
            }
        } else {
            suitableCandidates = suitableCandidates.filter(c =>
                isCandidateAvailable(c, task.name, task.time, week, day)
            );
        }

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

            // Edge Case: Single Priority Assignment with "Both" Role in a Split Role Group
            // If there is exactly ONE starred candidate, and that candidate has the "Both" role,
            // AND this is a split-role group (where we need 2 unique people),
            // we ignore the priority status and show the full list.
            let ignorePriority = false;

            if (task.isGroup && task.isSplitRole && starredCandidates.length === 1) {
                const candidate = starredCandidates[0];
                const key = `team_role_${candidate.id}`;
                const stored = localStorage.getItem(key);
                if (stored) {
                    try {
                        const state = JSON.parse(stored);
                        if (state.both) {
                            // Check if there are ANY OTHER starred candidates in this group?
                            // We iterate over ALL candidates to see how many are starred for this group ID.
                            let totalGroupStarredCount = 0;
                            if (typeof CANDIDATES !== 'undefined') {
                                totalGroupStarredCount = CANDIDATES.filter(c => window.isCandidateStarred(realId, c.id)).length;
                            }

                            // Only ignore priority if this candidate is the ONLY one starred in the entire group
                            if (totalGroupStarredCount === 1) {
                                ignorePriority = true;
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing team role override:', e);
                    }
                }
            }

            if (ignorePriority) {
                // Fallback to full list (re-calculate without star filter)
                // We already have suitableCandidates as the full list before filtering
                // But we need to make sure we didn't overwrite it.
                // Ah, we filtered suitableCandidates in place? No, we created starredCandidates.
                // But wait, if ignorePriority is true, we just DON'T set suitableCandidates = starredCandidates.
                // So suitableCandidates remains the full list.
            } else if (starredCandidates.length > 0) {
                suitableCandidates = starredCandidates;
            }
            // Else fallback to full list
        }
    } // End of (!task.candidates) block

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

        // Force re-render to trigger animations
        if (window.renderSchedulePreview) {
            window.renderSchedulePreview();
        }
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
