// Assignment Panel Implementation

class AssignmentPanel {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;

        // Find or create content div
        this.content = this.container.querySelector('.panel-content');
        if (!this.content) {
            this.content = document.createElement('div');
            this.content.className = 'panel-content';
            this.container.appendChild(this.content);
        }

        // Initialize Assignments from LocalStorage
        this.assignments = {};
        this.debugBlockedCandidates = new Set(); // For debugging

        // Load Workspace Data for Exclusions
        this.connections = [];
        this.taskLookup = {}; // Map: "groupId_taskName" or "solo_taskName" -> instanceId
        this.groupLookup = {}; // Map: groupId -> group object

        try {
            const stored = localStorage.getItem('task_assignments');
            if (stored) {
                this.assignments = JSON.parse(stored);
            }

            const workspaceStr = localStorage.getItem('workspace_autosave');
            if (workspaceStr) {
                const workspace = JSON.parse(workspaceStr);
                this.connections = workspace.state?.connections || [];
                const canvasTasks = workspace.state?.canvasTasks || [];
                const groups = workspace.state?.groups || [];

                // Build Group Lookup
                groups.forEach(g => this.groupLookup[g.id] = g);

                // Build Task Lookup
                canvasTasks.forEach(t => {
                    if (t.groupId) {
                        // Task in Group
                        this.taskLookup[`${t.groupId}_${t.name}`] = t.instanceId;
                    } else {
                        // Solo Task
                        this.taskLookup[`solo_${t.name}`] = t.instanceId;
                    }
                });
                console.log('[AssignmentPanel] Loaded workspace data:', {
                    connections: this.connections.length,
                    tasks: Object.keys(this.taskLookup).length
                });
            }
        } catch (e) {
            console.error('Failed to load assignments or workspace', e);
        }

        this.render();
    }

    saveAssignment(taskId, assigneeName, week, day, groupId = null) {
        console.log(`[SAVE] Task: ${taskId}, Assignee: ${assigneeName}, Week: ${week}, Day: ${day}, Group: ${groupId}`);
        const key = `${taskId}_${week}_${day}`;
        const existing = this.assignments[key];

        // Only update if changed
        if (existing && (typeof existing === 'object' ? existing.name : existing) === assigneeName) {
            return; // No change, keep existing timestamp
        }

        if (assigneeName) {
            this.assignments[key] = {
                name: assigneeName,
                timestamp: Date.now(),
                groupId: groupId
            };
        } else {
            delete this.assignments[key];
        }
        localStorage.setItem('task_assignments', JSON.stringify(this.assignments));
    }

    render() {
        if (typeof SCHEDULE_DATA === 'undefined' || !SCHEDULE_DATA) {
            this.content.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No schedule data available</div>';
            return;
        }

        const table = document.createElement('table');
        table.className = 'assignment-table';

        // Header
        const thead = document.createElement('thead');

        // Store reference to this instance for onclick
        const panelInstance = this;
        window._masterCheckHandler = function () {
            panelInstance.copyAllOptimalToAssignee();
        };
        window._clearAllHandler = function () {
            panelInstance.clearAllAssignments();
        };
        window._autoAssignSingleHandler = function () {
            panelInstance.autoAssignSingleCandidates();
        };


        thead.innerHTML = `
            <tr>
                <th class="col-group">Task Group</th>
                <th class="col-task">Task Name</th>
                <th class="col-candidates">Candidates</th>
                <th class="col-optimal">
                    Optimal
                    <button type="button" class="master-check-btn" onclick="window._masterCheckHandler(); return false;" title="Copy ALL Optimal Candidates to Assignee">✓</button>
                    <button type="button" class="master-check-btn" style="margin-left: 5px;" onclick="window._autoAssignSingleHandler(); return false;" title="Auto-assign tasks with single candidate">👤</button>
                </th>
                <th class="col-assignee">
                    Assignee
                    <button type="button" class="clear-all-btn" onclick="event.preventDefault(); event.stopPropagation(); window._clearAllHandler();" title="Clear ALL Assignees">×</button>
                </th>
            </tr>
        `;

        table.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');

        SCHEDULE_DATA.forEach((weekData, weekIndex) => {
            // Week Header Row
            const weekHeaderRow = document.createElement('tr');
            weekHeaderRow.className = 'week-header-row';
            weekHeaderRow.innerHTML = `<td colspan="5">${weekData.week}</td>`;
            tbody.appendChild(weekHeaderRow);

            // Separate 0th Day tasks from regular days
            const zeroDay = weekData.days.find(d => d.name === '0th Day');
            const regularDays = weekData.days.filter(d => d.name !== '0th Day');

            // Render 0th Day Tasks (directly under Week Header)
            if (zeroDay && zeroDay.tasks.length > 0) {
                this.renderDayTasks(zeroDay, weekData.week, tbody);
            }

            // Render Regular Days
            regularDays.forEach(day => {
                // Day Header Row
                const dayHeaderRow = document.createElement('tr');
                dayHeaderRow.className = 'day-header-row';
                const dateStr = day.date ? ` <span class="day-date">[${day.date}]</span>` : '';
                dayHeaderRow.innerHTML = `<td colspan="5">${day.name}${dateStr}</td>`;
                tbody.appendChild(dayHeaderRow);

                this.renderDayTasks(day, weekData.week, tbody);
            });
        });

        table.appendChild(tbody);
        this.content.innerHTML = '';
        this.content.appendChild(table);
    }

    renderDayTasks(day, week, tbody) {
        day.tasks.forEach(task => {
            // Apply saved assignment if exists (and not already set in data)
            const key = `${task.id}_${week}_${day.name}`;
            if (this.assignments[key]) {
                // Handle object or string (legacy)
                const val = this.assignments[key];
                task.assignee = (typeof val === 'object') ? val.name : val;
            }

            if (task.isGroup) {
                const commonCandidates = this.getCommonCandidates(task.subTasks, week, day.name, task);
                const optimalCandidate = this.getOptimalCandidate(commonCandidates);
                // ... (existing group logic) ...
                task.subTasks.forEach((subTask, subIndex) => {
                    // Apply saved assignment to subtasks too
                    const key = `${subTask.id}_${week}_${day.name}`;
                    if (this.assignments[key]) {
                        const val = this.assignments[key];
                        subTask.assignee = (typeof val === 'object') ? val.name : val;
                    }
                    // ... (existing subtask render logic) ...
                    const row = document.createElement('tr');

                    // Group Column (Merged)
                    if (subIndex === 0) {
                        const cell = document.createElement('td');
                        cell.className = 'group-cell';

                        if (task.variant) {
                            cell.classList.add(`variant-${task.variant}`);
                            // Allow CSS gradient to take precedence
                        } else {
                            cell.style.backgroundColor = task.color || '#f0f0f0';
                        }

                        cell.rowSpan = task.subTasks.length;
                        cell.innerHTML = `
                            <div>${task.name}</div>
                            <div class="task-meta">${task.time} | ${task.effort}</div>
                        `;
                        // Fix: Add ID tooltip
                        cell.title = `ID: ${task.id}`;
                        row.appendChild(cell);
                    }

                    // Task Name (Subtask)
                    const taskCell = document.createElement('td');
                    taskCell.style.backgroundColor = '#ffffff'; // Force white
                    taskCell.title = `ID: ${subTask.id}`; // Add ID tooltip
                    taskCell.innerHTML = `
                        <div>${subTask.name}</div>
                        <div class="task-meta">${subTask.time} | ${subTask.effort}</div>
                    `;
                    row.appendChild(taskCell);

                    // Candidates (Merged)
                    if (subIndex === 0) {
                        const cell = document.createElement('td');
                        cell.className = 'candidates-cell';
                        cell.rowSpan = task.subTasks.length;
                        cell.innerHTML = this.formatCandidates(commonCandidates, task, week, day.name);
                        row.appendChild(cell);
                    }

                    // Optimal (Merged)
                    if (subIndex === 0) {
                        const cell = document.createElement('td');
                        cell.className = 'optimal-cell';
                        cell.rowSpan = task.subTasks.length;

                        if (optimalCandidate) {
                            const container = document.createElement('div');
                            container.className = 'optimal-candidate-container'; // Add class for styling
                            container.style.display = 'flex';
                            container.style.alignItems = 'center';
                            container.style.justifyContent = 'center'; // Center it

                            const nameSpan = document.createElement('span');
                            nameSpan.textContent = optimalCandidate.name;
                            nameSpan.className = 'optimal-candidate-name'; // Add class for styling
                            nameSpan.title = 'Click to Assign';

                            const isAssigned = task.assignee === optimalCandidate.name;

                            if (isAssigned) {
                                nameSpan.classList.add('assigned');
                                nameSpan.style.cursor = 'default';
                                nameSpan.style.opacity = '0.7';
                            } else {
                                nameSpan.style.cursor = 'pointer';
                                nameSpan.style.textDecoration = 'underline';
                                nameSpan.onclick = () => this.copyOptimalToAssignee(task, optimalCandidate.name, week, day.name);
                            }

                            container.appendChild(nameSpan);
                            cell.appendChild(container);
                        } else {
                            cell.textContent = '-';
                        }
                        row.appendChild(cell);
                    }
                    // Assignee
                    const assigneeCell = document.createElement('td');
                    assigneeCell.appendChild(this.createAssigneeInput(subTask, week, day.name, task.id));
                    row.appendChild(assigneeCell);

                    tbody.appendChild(row);
                });
            } else {
                // Render Single Task
                const row = document.createElement('tr');

                // Group Column (Empty) - RESTORED
                const groupCell = document.createElement('td');
                groupCell.className = 'group-cell empty';
                groupCell.textContent = '-';
                row.appendChild(groupCell);

                // Use filtered candidates for Single Tasks too!
                const candidates = this.getCandidatesForTask(task, week, day.name);
                const optimalCandidate = this.getOptimalCandidate(candidates);

                // Task Name
                const cell = document.createElement('td');
                if (task.variant) {
                    cell.classList.add(`variant-${task.variant}`);
                } else {
                    // console.log(`[RENDER] Single Task: ${task.name}, Color: ${task.color}`);
                    cell.style.backgroundColor = '#ffffff'; // Force white
                }
                cell.innerHTML = `
                <div>${task.name}</div>
                <div class="task-meta">${task.time} | ${task.effort}</div>
            `;
                cell.title = `ID: ${task.id}`;
                row.appendChild(cell);

                // Candidates
                const candidatesCell = document.createElement('td');
                candidatesCell.className = 'candidates-cell';
                candidatesCell.innerHTML = this.formatCandidates(candidates, task, week, day.name);
                row.appendChild(candidatesCell);

                // Optimal
                const optimalCell = document.createElement('td');
                optimalCell.className = 'optimal-cell';
                if (optimalCandidate) {
                    const container = document.createElement('div');
                    container.className = 'optimal-candidate-container';
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.justifyContent = 'center';

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = optimalCandidate.name;
                    nameSpan.className = 'optimal-candidate-name';
                    nameSpan.title = 'Click to Assign';

                    const isAssigned = task.assignee === optimalCandidate.name;

                    if (isAssigned) {
                        nameSpan.classList.add('assigned');
                        nameSpan.style.cursor = 'default';
                        nameSpan.style.opacity = '0.7';
                    } else {
                        nameSpan.style.cursor = 'pointer';
                        nameSpan.style.textDecoration = 'underline';
                        nameSpan.onclick = () => this.copyOptimalToAssignee(task, optimalCandidate.name, week, day.name);
                    }

                    container.appendChild(nameSpan);
                    optimalCell.appendChild(container);
                } else {
                    optimalCell.textContent = '-';
                }
                row.appendChild(optimalCell);

                // Assignee
                const assigneeCell = document.createElement('td');
                assigneeCell.appendChild(this.createAssigneeInput(task, week, day.name));
                row.appendChild(assigneeCell);

                tbody.appendChild(row);
            }
        });
    }

    // ... (rest of methods) ...


    copyOptimalToAssignee(task, candidateName, week, day) {
        console.log(`[COPY OPTIMAL] Task: ${task.name}, Candidate: ${candidateName}, Group: ${task.isGroup}`);
        if (task.isGroup) {
            task.subTasks.forEach(sub => {
                console.log(`[COPY OPTIMAL] Subtask: ${sub.name} (ID: ${sub.id})`);
                sub.assignee = candidateName;
                this.saveAssignment(sub.id, candidateName, week, day, task.id); // Pass Group ID
            });
        } else {
            task.assignee = candidateName;
            this.saveAssignment(task.id, candidateName, week, day, null); // Save
        }

        // Visual Feedback: Find the button and update it
        // We don't have direct reference here easily, but we can re-render.
        // Or we can find it by task ID?
        // Actually, re-rendering handles the inputs.
        // But the optimal button is in the "Candidates" column.
        // Let's just re-render, but maybe we can make the button look "active" if assigned?
        // The render logic creates the button.
        // If task.assignee matches optimal, maybe we show "✓" in green or disabled?

        this.render();
        // Update Graph
        if (window.renderEffortGraph) window.renderEffortGraph();
    }

    copyAllOptimalToAssignee() {
        // Guard against re-entry
        if (this._isProcessing) return;
        this._isProcessing = true;

        const confirmed = confirm('Are you sure you want to copy ALL optimal candidates to Assignee fields? This will overwrite existing assignments.');

        if (!confirmed) {
            this._isProcessing = false;
            return;
        }

        SCHEDULE_DATA.forEach(weekData => {
            weekData.days.forEach(day => {
                day.tasks.forEach(task => {
                    if (task.isGroup) {
                        const common = this.getCommonCandidates(task.subTasks, weekData.week, day.name, task);
                        const optimal = this.getOptimalCandidate(common);
                        if (optimal) {
                            task.subTasks.forEach(sub => {
                                sub.assignee = optimal.name;
                                this.saveAssignment(sub.id, optimal.name, weekData.week, day.name, task.id);
                            });
                        }
                    } else {
                        const candidates = this.getCandidatesForTask(task, weekData.week, day.name);
                        const optimal = this.getOptimalCandidate(candidates);
                        if (optimal) {
                            task.assignee = optimal.name;
                            this.saveAssignment(task.id, optimal.name, weekData.week, day.name, null);
                        }
                    }
                });
            });
        });

        // Delay render to ensure event has completed
        setTimeout(() => {
            this.render();
            if (window.renderEffortGraph) window.renderEffortGraph();
            this._isProcessing = false;
        }, 100);
    }

    clearAllAssignments() {
        if (this._isProcessing) return;
        this._isProcessing = true;

        const confirmed = confirm('Are you sure you want to CLEAR ALL Assignees? This cannot be undone.');

        if (!confirmed) {
            this._isProcessing = false;
            return;
        }

        // Clear local storage and memory
        this.assignments = {};
        localStorage.removeItem('task_assignments');

        // Clear data model
        if (typeof SCHEDULE_DATA !== 'undefined') {
            SCHEDULE_DATA.forEach(weekData => {
                weekData.days.forEach(day => {
                    day.tasks.forEach(task => {
                        if (task.isGroup) {
                            task.subTasks.forEach(sub => sub.assignee = null);
                        } else {
                            task.assignee = null;
                        }
                    });
                });
            });
        }

        setTimeout(() => {
            this.render();
            if (window.renderEffortGraph) window.renderEffortGraph();
            this._isProcessing = false;
        }, 100);
    }

    getCommonCandidates(subTasks, week, day, groupTask) {
        // Use pre-calculated candidates if available (Source of Truth)
        const hasPrecalc = groupTask && groupTask.candidates && groupTask.candidates.length > 0;
        if (hasPrecalc) {
            return groupTask.candidates;
        }

        let candidates = typeof CANDIDATES !== 'undefined' ? CANDIDATES : [];

        return candidates.filter(c => {
            // Must be available for ALL subtasks
            return subTasks.every(sub => {
                // Check Role
                if (!this.hasRole(c, sub.name)) return false;

                // Check Availability
                if (typeof isCandidateAvailable === 'function') {
                    if (!isCandidateAvailable(c, sub.name, sub.time, week, day)) return false;
                }

                return true;
            });
        });
    }



    getCandidatesForTask(task, week, day) {
        // Use pre-calculated candidates if available (Source of Truth)
        const hasPrecalc = task && task.candidates && task.candidates.length > 0;
        if (hasPrecalc) {
            return task.candidates;
        }

        let candidates = typeof CANDIDATES !== 'undefined' ? CANDIDATES : [];

        return candidates.filter(c => {
            // Check Role
            if (!this.hasRole(c, task.name)) return false;

            // Check Availability
            if (typeof isCandidateAvailable === 'function') {
                if (!isCandidateAvailable(c, task.name, task.time, week, day)) return false;
            }

            return true;
        });
    }

    hasRole(candidate, roleName, excludeBoth = false) {
        console.log(`[ROLE-CHECK] Checking ${candidate ? candidate.name : 'null'} for ${roleName}`);
        if (!candidate || !roleName) return false;

        // 1. Check for Exact Match in Roles
        if (candidate.roles && candidate.roles.includes(roleName)) {
            return true;
        }

        // Check for localStorage override for Leader/Follower
        const taskName = roleName.toLowerCase();
        let mappedRole = null;

        if (taskName.includes('lead') || taskName.includes('conduct') || taskName.includes('teacher')) {
            mappedRole = 'leader';
        } else if (taskName.includes('follow') || taskName.includes('assist')) {
            mappedRole = 'follower';
        } else if (taskName.includes('preparation')) {
            // Preparation tasks without explicit 'teacher' or 'assistant' can be done by either
            // BUT only if we didn't find an exact match above.
            // Actually, if we are here, we didn't find an exact match.
            // So we should check if the candidate has ANY relevant role?
            // No, the issue is that the code below returns result based on 'Leader'/'Follower' strings which might not be in the roles array.
            // The roles array contains full task names.

            // If the candidate has the specific preparation task in their roles, we returned true above.
            // If not, maybe they are allowed via some other mechanism?
            // The original code was:
            // const result = candidate.roles && (candidate.roles.includes('Leader') || candidate.roles.includes('Follower') || candidate.roles.includes('Both'));

            // This assumes 'Leader', 'Follower', 'Both' are in the roles array.
            // But the JSON shows full task names.

            // If we want to allow based on "Leader" capability, we need to check teamRoles (from localStorage/JSON).
            // But here we only have candidate object.

            // Let's rely on the exact match above. If it failed, and it's a preparation task,
            // maybe we should be stricter? Or maybe the original code was intended for a different data structure.

            // For now, let's just return false if exact match failed, UNLESS we want to support the generic roles.
            // But wait, the log said: "Roles=..., Result=false".
            // The roles list had "Preparation for the Lesson / Assistant - Wednesday".
            // So the exact match SHOULD have worked.

            // Ah, the original code didn't have the exact match check at the top!
            // It went straight to the if/else block.
            // And since "preparation" matches, it went into this block and returned false because 'Leader'/'Follower' were not in the list.

            // So adding the exact match check at the top fixes it.
            return false;
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
        if (!candidate.roles) return false;
        return candidate.roles.includes(roleName);
    }

    getOptimalCandidate(candidates) {
        if (!candidates || candidates.length === 0) return null;
        // Placeholder logic: Pick the first one, or one with least load?
        // For now, just return the first one.
        return candidates[0];
    }

    getAllAssignments() {
        // Combine saved assignments with default ones from data
        const allAssignments = [];

        if (typeof SCHEDULE_DATA === 'undefined') return allAssignments;

        SCHEDULE_DATA.forEach(weekData => {
            weekData.days.forEach(day => {
                day.tasks.forEach(task => {
                    const processTask = (t) => {
                        const key = `${t.id}_${weekData.week}_${day.name}`;
                        const saved = this.assignments[key];
                        const assignee = saved ? (typeof saved === 'object' ? saved.name : saved) : t.assignee;
                        const timestamp = saved ? (typeof saved === 'object' ? saved.timestamp : 0) : 0;
                        const groupId = saved ? (typeof saved === 'object' ? saved.groupId : null) : null;


                        if (assignee) {
                            allAssignments.push({
                                taskId: t.id,
                                name: t.name,
                                assignee: assignee,
                                time: t.time,
                                day: day.name,
                                week: weekData.week,
                                groupId: groupId || (task.isGroup ? task.id : null), // Use saved groupId if present, else infer
                                timestamp: timestamp // Store timestamp for ordering
                            });
                        }
                    };

                    if (task.isGroup) {
                        task.subTasks.forEach(processTask);
                    } else {
                        processTask(task);
                    }
                });
            });
        });
        return allAssignments;
    }

    checkTimeOverlap(time1, time2) {
        if (!time1 || !time2) return false;

        const t1Str = String(time1).toLowerCase();
        const t2Str = String(time2).toLowerCase();

        // Handle "All"
        if (t1Str === 'all' || t2Str === 'all') return true;

        // Helper to parse a single range "20-21" or "10:00-11:30"
        const parseRange = (rangeStr) => {
            const parts = rangeStr.trim().split('-');
            if (parts.length !== 2) return null;
            const toMin = (s) => {
                const [h, m] = s.split(':').map(Number);
                return h * 60 + (m || 0);
            };
            let start = toMin(parts[0]);
            let end = toMin(parts[1]);
            // Handle midnight crossing (e.g. 23-00) or full day 0-0)
            // Assuming 00 as end means 24:00 (1440 min)
            if (end === 0 && start > 0) end = 24 * 60;
            return { start, end };
        };

        // Helper to parse complex time string "10-12, 14-16"
        const parseComplex = (t) => {
            return t.split(',').map(parseRange).filter(r => r !== null);
        };

        const ranges1 = parseComplex(t1Str);
        const ranges2 = parseComplex(t2Str);

        if (ranges1.length === 0 || ranges2.length === 0) return false;

        // Check if ANY range in t1 overlaps with ANY range in t2
        return ranges1.some(r1 => {
            return ranges2.some(r2 => {
                return r1.start < r2.end && r1.end > r2.start;
            });
        });
    }

    isCandidateBlocked(candidateName, currentTask, currentWeek, currentDay, precalculatedAssignments = null) {
        // Exception: Tasks on "0th Day" (Available Tasks) do not block each other
        if (currentDay === '0th Day') {
            return { blocked: false, reason: null };
        }

        const assignments = precalculatedAssignments || this.getAllAssignments();
        let blockReason = null;

        // Check Debug Blocks
        if (this.debugBlockedCandidates.has(candidateName)) {
            return { blocked: true, reason: 'Manually blocked for debugging' };
        }

        const isBlocked = assignments.some(a => {
            // Skip self
            if (a.taskId === currentTask.id) return false;

            // Check name match
            if (a.assignee !== candidateName) return false;

            // Check Day/Week match
            // Use loose equality for week to handle string/number mismatch
            if (a.week != currentWeek || a.day !== currentDay) return false;

            // Check Group ID (Ignore conflicts within the same group)
            // If currentTask has a groupId (meaning it's a subtask of a group)
            // AND the assignment 'a' also has a groupId
            // AND those groupIds are the same, then they are part of the same group.
            // In this case, they don't block each other.
            if (currentTask.groupId && a.groupId) {
                console.log(`[DEBUG] Checking Group Conflict: Task=${currentTask.id} (${currentTask.groupId}) vs Assgn=${a.taskId} (${a.groupId})`);
                if (String(currentTask.groupId) === String(a.groupId)) {
                    console.log(`[DEBUG] Same Group - IGNORING CONFLICT`);
                    return false;
                }
            }

            // Check Time Overlap
            const overlap = this.checkTimeOverlap(currentTask.time, a.time);

            if (overlap) {
                blockReason = `Blocked by: ${a.name} (${a.time})`;
                // Debug Log (Optional, can be removed if too spammy)
                // console.log(`[BLOCK] ${candidateName}: ${blockReason}`);
                return true; // Stop iteration, found block
            }

            // --- EXCLUSION CONNECTION CHECK ---
            // Only check if we have connection data loaded
            if (this.connections && this.connections.length > 0) {
                // Resolve IDs
                const myInstanceId = this.resolveInstanceId(currentTask);
                const otherInstanceId = this.resolveInstanceId(a);

                if (myInstanceId && otherInstanceId) {
                    // Check Task <-> Task Exclusion
                    const taskExclusion = this.connections.find(c =>
                        c.type === 'exclusion' &&
                        ((c.fromId === `task-${myInstanceId}` && c.toId === `task-${otherInstanceId}`) ||
                            (c.fromId === `task-${otherInstanceId}` && c.toId === `task-${myInstanceId}`))
                    );

                    if (taskExclusion) {
                        blockReason = `Excluded by Connection: ${a.name}`;
                        return true;
                    }
                }

                // Check Group Exclusions
                // My Group vs Other Task
                if (currentTask.groupId && otherInstanceId) {
                    const groupExclusion = this.connections.find(c =>
                        c.type === 'exclusion' &&
                        ((c.fromId === `group-${currentTask.groupId}` && c.toId === `task-${otherInstanceId}`) ||
                            (c.fromId === `task-${otherInstanceId}` && c.toId === `group-${currentTask.groupId}`))
                    );
                    if (groupExclusion) {
                        blockReason = `Group Excluded by: ${a.name}`;
                        return true;
                    }
                }

                // My Task vs Other Group
                if (myInstanceId && a.groupId) {
                    const groupExclusion = this.connections.find(c =>
                        c.type === 'exclusion' &&
                        ((c.fromId === `task-${myInstanceId}` && c.toId === `group-${a.groupId}`) ||
                            (c.fromId === `group-${a.groupId}` && c.toId === `group-${myInstanceId}`))
                    );
                    if (groupExclusion) {
                        blockReason = `Excluded by Group: ${a.groupId}`; // Ideally show group title
                        return true;
                    }
                }

                // My Group vs Other Group
                if (currentTask.groupId && a.groupId) {
                    const groupExclusion = this.connections.find(c =>
                        c.type === 'exclusion' &&
                        ((c.fromId === `group-${currentTask.groupId}` && c.toId === `group-${a.groupId}`) ||
                            (c.fromId === `group-${a.groupId}` && c.toId === `group-${currentTask.groupId}`))
                    );
                    if (groupExclusion) {
                        blockReason = `Group Exclusion`;
                        return true;
                    }
                }
            }

            return false;
        });

        // We need to find the blocking assignment to return it
        const blockingAssignment = isBlocked ? assignments.find(a => {
            if (a.taskId === currentTask.id) return false;
            if (a.assignee !== candidateName) return false;
            if (a.week != currentWeek || a.day !== currentDay) return false;
            if (currentTask.groupId && a.groupId && String(currentTask.groupId) === String(a.groupId)) return false;

            // Check Time Overlap
            if (this.checkTimeOverlap(currentTask.time, a.time)) return true;

            // Check Exclusions (Re-run logic to find specific blocker)
            if (this.connections && this.connections.length > 0) {
                const myInstanceId = this.resolveInstanceId(currentTask);
                const otherInstanceId = this.resolveInstanceId(a);

                if (myInstanceId && otherInstanceId) {
                    if (this.connections.some(c => c.type === 'exclusion' && ((c.fromId === `task-${myInstanceId}` && c.toId === `task-${otherInstanceId}`) || (c.fromId === `task-${otherInstanceId}` && c.toId === `task-${myInstanceId}`)))) return true;
                }
                if (currentTask.groupId && otherInstanceId) {
                    if (this.connections.some(c => c.type === 'exclusion' && ((c.fromId === `group-${currentTask.groupId}` && c.toId === `task-${otherInstanceId}`) || (c.fromId === `task-${otherInstanceId}` && c.toId === `group-${currentTask.groupId}`)))) return true;
                }
                if (myInstanceId && a.groupId) {
                    if (this.connections.some(c => c.type === 'exclusion' && ((c.fromId === `task-${myInstanceId}` && c.toId === `group-${a.groupId}`) || (c.fromId === `group-${a.groupId}` && c.toId === `group-${myInstanceId}`)))) return true;
                }
                if (currentTask.groupId && a.groupId) {
                    if (this.connections.some(c => c.type === 'exclusion' && ((c.fromId === `group-${currentTask.groupId}` && c.toId === `group-${a.groupId}`) || (c.fromId === `group-${a.groupId}` && c.toId === `group-${currentTask.groupId}`)))) return true;
                }
            }
            return false;
        }) : null;

        return { blocked: isBlocked, reason: blockReason, blockingAssignment };
    }

    resolveInstanceId(task) {
        if (!this.taskLookup) return null;
        if (task.groupId) {
            return this.taskLookup[`${task.groupId}_${task.name}`];
        } else {
            return this.taskLookup[`solo_${task.name}`];
        }
    }

    formatCandidates(candidates, task, week, day) {
        if (!candidates || candidates.length === 0) return '<span class="no-candidates">None</span>';

        // Ensure task has groupId if it is a group
        if (task.isGroup && !task.groupId) task.groupId = task.id;

        return candidates.map(c => {
            const result = this.isCandidateBlocked(c.name, task, week, day);
            const isBlocked = result.blocked;
            const className = isBlocked ? 'candidate-link blocked' : 'candidate-link';
            const onClick = isBlocked ? '' : `onclick="window.assignCandidate('${task.id}', '${c.name.replace(/'/g, "\\'")}', '${week}', '${day}')"`;
            const title = isBlocked ? `title="${result.reason || 'Already assigned to a competing task'}"` : '';

            return `<span class="${className}" ${onClick} ${title}
                data-task-id="${task.id}"
                data-week="${week}"
                data-day="${day}"
                data-time="${task.time}"
                data-group-id="${task.isGroup ? task.id : (task.groupId || '')}"
                data-candidate-name="${c.name.replace(/"/g, '&quot;')}"
            >${c.name}</span>`;
        }).join(', ');
    }

    updateCandidateVisuals(specificCandidate = null) {
        const links = document.querySelectorAll('.candidate-link');

        // Pre-calculate assignments ONCE
        const allAssignments = this.getAllAssignments();

        links.forEach(link => {
            const candidateName = link.dataset.candidateName;

            // Optimization: If specificCandidate is provided, ONLY update links for that candidate.
            if (specificCandidate && candidateName !== specificCandidate) return;

            const taskId = link.dataset.taskId;
            const week = link.dataset.week; // Keep as string (e.g. "Week 11")
            const day = link.dataset.day;
            const time = link.dataset.time;

            if (!taskId || !candidateName || !time) return;

            // Mock task object for checking
            // We need to pass groupId if available. 
            const linkGroupId = link.dataset.groupId;
            const mockTask = { id: taskId, time: time, groupId: linkGroupId };

            // If linkGroupId is missing (e.g. single task), it's null.
            // If currentTask is a group, we need to ensure we don't block against its own subtasks.
            // But wait, assignments are on subtasks.
            // If I am checking "Leading" Group, and "Maria" is assigned to "Leading" Subtask.
            // currentTask.groupId = "group-1".
            // a.groupId = "group-1".
            // They match -> return false (Don't block). Correct.

            // If I am checking "Assisting" Group.
            // currentTask.groupId = "group-2".
            // a.groupId = "group-1".
            // Match -> false. Proceed to time check.
            // Time overlap -> True. Block. Correct.

            // Pass precalculated assignments
            const result = this.isCandidateBlocked(candidateName, mockTask, week, day, allAssignments);
            const isBlocked = result.blocked;

            if (isBlocked) {
                link.classList.add('blocked');
                link.title = result.reason || 'Already assigned to a competing task';
                // We are no longer removing the onclick attribute.
                // Instead, we rely on CSS to disable clicks for blocked links.
                // .candidate-link.blocked { pointer-events: none; opacity: 0.5; }
            } else {
                link.classList.remove('blocked');
                link.removeAttribute('title');
                // Restore onclick (re-bind)
                // We can't easily restore the original onclick function if it was removed.
                // But wait, we are removing the attribute 'onclick'.
                // If the event was attached via addEventListener, it persists.
                // If it was inline 'onclick', it's gone.
                // The render method sets inline onclick: onclick="panelInstance.copyOptimalToAssignee(...)"
                // So we need to restore it.

                // Actually, instead of removing onclick, let's just use CSS pointer-events: none for blocked?
                // Or just check blocked status in the click handler?
                // The current implementation removes onclick.

                // Let's restore it.
                // We have the data needed: task, candidate, week, day.
                // But 'task' object is not fully available here, only ID.
                // copyOptimalToAssignee needs the full task object (for subtasks).

                // Alternative: Don't remove onclick. Just let it fail or warn?
                // Or use CSS to disable clicks.
                // .candidate-link.blocked { pointer-events: none; opacity: 0.5; }

                // If we rely on CSS, we don't need to touch onclick.
                // Let's check if CSS handles .blocked
            }
        });
    }

    createAssigneeInput(task, week, day, groupId = null) {
        const container = document.createElement('div');
        container.className = 'assignee-input-container';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'assignee-input';
        input.placeholder = 'Select Assignee...';
        input.autocomplete = 'off'; // Disable browser autocomplete
        input.dataset.taskId = task.id; // Store Task ID for lookup
        input.dataset.week = week;
        input.dataset.day = day;
        if (groupId) input.dataset.groupId = groupId;

        // Clear Button
        const clearBtn = document.createElement('button');
        clearBtn.className = 'input-clear-btn';
        clearBtn.innerHTML = '&times;';
        clearBtn.tabIndex = -1;
        clearBtn.title = 'Clear Assignment';

        const updateClearBtn = () => {
            clearBtn.style.display = input.value ? 'block' : 'none';
        };

        clearBtn.onclick = (e) => {
            e.preventDefault(); // Prevent focus loss issues
            input.value = '';
            // Trigger validation/save with empty value
            if (input.validate) input.validate('');
            input.focus();
        };

        if (task.assignee) {
            input.value = task.assignee;
            // Defer validation slightly to ensure element is ready, or just call it
            setTimeout(() => {
                if (input.validate) input.validate(task.assignee);
                updateClearBtn();
            }, 0);
        } else {
            updateClearBtn();
        }

        const dropdown = document.createElement('div');
        dropdown.className = 'assignee-dropdown-list';

        // Populate Dropdown
        const populateDropdown = (filterText = '') => {
            dropdown.innerHTML = '';
            if (typeof CANDIDATES === 'undefined') return;

            const filtered = CANDIDATES.filter(c =>
                c.name.toLowerCase().includes(filterText.toLowerCase())
            );

            if (filtered.length === 0) {
                const noResult = document.createElement('div');
                noResult.className = 'assignee-dropdown-item';
                noResult.style.color = '#999';
                noResult.style.cursor = 'default';
                noResult.textContent = 'No matches found';
                dropdown.appendChild(noResult);
                return;
            }

            filtered.forEach(c => {
                const item = document.createElement('div');
                item.className = 'assignee-dropdown-item';
                item.textContent = c.name;

                // Selection Handler
                item.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Prevent blur
                    input.value = c.name;
                    // task.assignee = c.name; // REMOVED: Let validateInput handle data update to preserve previous state
                    validateInput(c.name);
                    hideDropdown();
                    if (window.renderEffortGraph) window.renderEffortGraph();
                });

                dropdown.appendChild(item);
            });
        };

        const showDropdown = () => {
            populateDropdown(input.value);
            dropdown.classList.add('show');
        };

        const hideDropdown = () => {
            dropdown.classList.remove('show');
        };

        const validateInput = (val) => {
            updateClearBtn();

            // Capture previous assignee BEFORE updating data
            const previousAssignee = task.assignee;

            if (!val || !val.trim()) {
                input.classList.remove('valid', 'input-warning', 'input-error');
                task.assignee = null; // Clear assignment
                this.saveAssignment(task.id, null, week, day, groupId); // Save with groupId
                if (window.renderEffortGraph) window.renderEffortGraph();

                // Update visuals for previous assignee (to unblock them)
                if (previousAssignee) this.updateCandidateVisuals(previousAssignee);

                return;
            }

            // 1. Check if it's a known team member (CANDIDATES)
            const candidateObj = typeof CANDIDATES !== 'undefined' ? CANDIDATES.find(c => c.name.toLowerCase() === val.toLowerCase()) : null;

            if (!candidateObj) {
                // Not a team member -> RED
                input.classList.add('input-error');
                input.classList.remove('valid', 'input-warning');
                task.assignee = val;
                this.saveAssignment(task.id, val, week, day, groupId);

                // Update visuals for previous assignee
                if (previousAssignee && previousAssignee !== val) this.updateCandidateVisuals(previousAssignee);

                return;
            }

            // It IS a team member. Now check if allowed/blocked.
            // Ensure we pass groupId if it exists
            if (groupId) task.groupId = groupId;

            const result = this.isCandidateBlocked(candidateObj.name, task, week, day);
            const isBlocked = result.blocked;

            // Tooltip for Blocked Reason
            if (isBlocked && result.reason) {
                input.title = result.reason;
                // console.log(`[TOOLTIP] Set title for ${candidateObj.name} on ${task.name}: ${result.reason}`);
            } else {
                input.removeAttribute('title');
            }

            // Check if allowed for this task (Role)
            const hasRole = this.hasRole(candidateObj, task.name);

            // If Blocked OR No Role -> YELLOW
            // BUT: If blocked by a LATER assignment, we are valid (we win).
            // We need to check if the blocking assignment is older or newer.
            // We need to check if the blocking assignment is older or newer.
            // isCandidateBlocked returns { blocked: true, reason: ... }
            // It doesn't currently return the blocking assignment's timestamp.
            // Let's modify isCandidateBlocked or check it here.

            // Actually, isCandidateBlocked checks ALL assignments.
            // If we are validating *this* input, we are about to save/update it.
            // If we just typed it, it's NEW (now). So it will be later than existing ones.
            // So if there is a conflict, WE are the late one. So WE are invalid.
            // This is correct for manual entry.

            // But for "load page", we want to respect stored timestamps.
            // When loading, we call validateInput? No, we render.
            // But validateInput is called on input event.
            // Wait, validateInput is also called by `assignCandidateToTask`.

            // If we want "appropriate tasks light up", we need to check timestamps.
            // If `isBlocked` is true, it means there is a conflict.
            // We should check if the conflict is "valid" (older) or "invalid" (newer).
            // If the conflict is newer, then IT is the one that should be blocked, not us.

            // Let's get the blocking assignment details.
            // We need isCandidateBlocked to return the conflicting assignment.

            // For now, let's assume if blocked, it's yellow.
            // The user wants "order maintained".
            // If I mass assign: Task A (t=1), Task B (t=2).
            // Task A: Conflict with B? B is t=2. A is t=1. A wins. A is Green.
            // Task B: Conflict with A? A is t=1. B is t=2. B > A. B loses. B is Yellow.

            // So we need to pass our timestamp to isCandidateBlocked?
            // Or just get the conflicting assignment and compare.

            // Let's modify isCandidateBlocked to return the blocking assignment.

            if (isBlocked || !hasRole) {
                // Check timestamp priority if blocked
                let isReallyBlocked = isBlocked;
                if (isBlocked && result.blockingAssignment) {
                    const myKey = `${task.id}_${week}_${day}`;
                    const mySaved = this.assignments[myKey];
                    const myTime = mySaved ? (typeof mySaved === 'object' ? mySaved.timestamp : 0) : Date.now();
                    const otherTime = result.blockingAssignment.timestamp || 0;

                    console.log(`[VALIDATE] Conflict: Me(${myTime}) vs Other(${otherTime})`);

                    // If I am older (smaller timestamp), I win.
                    if (myTime < otherTime) {
                        isReallyBlocked = false;
                    }
                }

                if (isReallyBlocked || !hasRole) {
                    input.classList.add('input-warning');
                    input.classList.remove('valid', 'input-error');
                    // Still save
                    task.assignee = candidateObj.name;
                    this.saveAssignment(task.id, candidateObj.name, week, day, groupId);
                } else {
                    // Valid (because we won priority)
                    input.classList.add('valid');
                    input.classList.remove('input-warning', 'input-error');
                    task.assignee = candidateObj.name;
                    this.saveAssignment(task.id, candidateObj.name, week, day, groupId);
                }
            } else {
                // Valid -> GREEN
                input.classList.add('valid');
                input.classList.remove('input-warning', 'input-error');
                task.assignee = candidateObj.name;
                this.saveAssignment(task.id, candidateObj.name, week, day, groupId);
            }

            // Correct casing in input
            input.value = candidateObj.name;
            if (window.renderEffortGraph) window.renderEffortGraph();

            // Update visuals for new candidate
            this.updateCandidateVisuals(candidateObj.name);

            // Update visuals for previous assignee if different
            if (previousAssignee && previousAssignee !== candidateObj.name) {
                this.updateCandidateVisuals(previousAssignee);
            }
        };

        // Attach validate to input for external calls
        input.validate = validateInput;

        // Debounce Helper
        const debounce = (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        };

        // Event Listeners
        input.addEventListener('focus', showDropdown);
        input.addEventListener('blur', () => setTimeout(hideDropdown, 200));

        // Debounced Input Handler
        const handleInput = debounce((e) => {
            populateDropdown(e.target.value);
            dropdown.classList.add('show');
            validateInput(e.target.value);
            updateClearBtn();
        }, 300);

        input.addEventListener('input', handleInput);

        // Close on click outside (handled by blur mostly, but good for safety)

        container.appendChild(input);
        container.appendChild(clearBtn);
        container.appendChild(dropdown);
        return container;
    }

    assignCandidateToTask(taskId, candidateName, week, day) {
        // Construct a more specific selector if week and day are provided
        let selector = `.assignee-input[data-task-id="${taskId}"]`;
        if (week !== undefined && day !== undefined) {
            selector += `[data-week="${week}"][data-day="${day}"]`;
        }

        const input = document.querySelector(selector);
        if (input && input.validate) {
            input.validate(candidateName);
        } else if (input) {
            input.value = candidateName;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // Helper: Get base name (remove " - Tuesday", etc.)
    getTaskBaseName(name) {
        return name.split(' - ')[0].trim();
    }

    autoAssignSiblingTasks() {
        if (!SCHEDULE_DATA) return;
        let assignedCount = 0;

        console.log('[AUTO-SIBLING] Starting sibling task assignment...');

        SCHEDULE_DATA.forEach(weekData => {
            // 1. Group tasks by Base Name
            const tasksByBaseName = {};

            weekData.days.forEach(day => {
                day.tasks.forEach(task => {
                    // Skip if already assigned or is a group
                    const key = `${task.id}_${weekData.week}_${day.name}`;
                    if (this.assignments[key]) return;
                    if (task.isGroup) return; // Skip groups for now, focus on individual tasks

                    const baseName = this.getTaskBaseName(task.name);
                    if (!tasksByBaseName[baseName]) {
                        tasksByBaseName[baseName] = [];
                    }
                    tasksByBaseName[baseName].push({ task, day });
                });
            });

            // 2. Process groups with > 1 task
            Object.entries(tasksByBaseName).forEach(([baseName, items]) => {
                if (items.length < 2) return; // Not siblings

                // 3. Get candidates for each task
                // We need to check if the POOL of candidates matches the number of tasks.
                // But each task might have slightly different availability (time).

                // Let's collect ALL valid candidates for EACH task.
                const taskCandidates = items.map(item => {
                    const candidates = this.getCandidatesForTask(item.task, weekData.week, item.day.name);
                    // Filter blocked
                    const available = candidates.filter(c => {
                        const result = this.isCandidateBlocked(c.name, item.task, weekData.week, item.day.name);
                        return !result.blocked;
                    });
                    return { ...item, candidates: available };
                });

                // 4. Check Unique Candidates Count
                const uniqueCandidates = new Set();
                taskCandidates.forEach(tc => {
                    tc.candidates.forEach(c => uniqueCandidates.add(c.name));
                });

                if (uniqueCandidates.size === items.length) {
                    console.log(`[AUTO-SIBLING] Found match for "${baseName}" (Week ${weekData.week}): ${items.length} tasks, ${uniqueCandidates.size} candidates.`);

                    // 5. Find Valid Assignment (Backtracking/Permutation)
                    const candidatesList = Array.from(uniqueCandidates);
                    const solution = this.solveAssignment(taskCandidates, candidatesList);

                    if (solution) {
                        console.log(`[AUTO-SIBLING] Applying solution for "${baseName}"`);
                        solution.forEach(sol => {
                            this.saveAssignment(sol.taskId, sol.candidateName, weekData.week, sol.dayName, null);
                            assignedCount++;
                        });
                    } else {
                        console.log(`[AUTO-SIBLING] No valid non-conflicting assignment found for "${baseName}"`);
                    }
                }
            });
        });

        if (assignedCount > 0) {
            console.log(`[AUTO-SIBLING] Assigned ${assignedCount} sibling tasks.`);
            this.render();
            if (window.renderEffortGraph) window.renderEffortGraph();
        }
    }

    // Simple backtracking solver to find 1-to-1 assignment
    solveAssignment(tasksWithCandidates, allCandidates) {
        // tasksWithCandidates: [{ task, day, candidates: [] }]
        // allCandidates: [name1, name2, ...]

        const assignments = []; // [{ taskId, dayName, candidateName }]
        const usedCandidates = new Set();

        const backtrack = (taskIndex) => {
            if (taskIndex === tasksWithCandidates.length) {
                return true; // Solved
            }

            const current = tasksWithCandidates[taskIndex];

            // Try each valid candidate for this task
            for (const candidate of current.candidates) {
                if (!usedCandidates.has(candidate.name)) {
                    // Try assigning
                    usedCandidates.add(candidate.name);
                    assignments.push({
                        taskId: current.task.id,
                        dayName: current.day.name,
                        candidateName: candidate.name
                    });

                    if (backtrack(taskIndex + 1)) {
                        return true;
                    }

                    // Backtrack
                    assignments.pop();
                    usedCandidates.delete(candidate.name);
                }
            }
            return false;
        };

        if (backtrack(0)) {
            return assignments;
        }
        return null;
    }

    autoAssignSingleCandidates() {
        if (!SCHEDULE_DATA) return;

        let assignedCount = 0;
        // ... (Existing Single Logic) ...
        // Iterate through all tasks
        console.log(`[AUTO-SINGLE] Processing ${SCHEDULE_DATA.length} weeks...`);
        SCHEDULE_DATA.forEach(weekData => {
            weekData.days.forEach(day => {
                day.tasks.forEach(task => {
                    if (task.isGroup) {
                        // For groups, we must check if the GROUP has a single candidate.
                        // If so, assign that candidate to ALL subtasks.

                        // For groups, use standard getter which now includes Priority Logic
                        const candidates = this.getCommonCandidates(task.subTasks, weekData.week, day.name, task);

                        // Filter by Exclusion (Blocked) - Check block for the GROUP (representative task?)
                        // Actually we should check if candidate is blocked for ANY subtask.
                        // But getCommonCandidates checks availability. isCandidateBlocked checks other assignments.

                        const availableCandidates = candidates.filter(c => {
                            // Check if blocked for the first subtask (proxy for group time?)
                            // Or check overlap with group time if we had it.
                            // Groups usually share time.
                            // Let's iterate subtasks to be safe?
                            // For now, check first subtask.
                            const t = task.subTasks[0];
                            // We need to pass groupID to ignore self-blocks within group?
                            // Actually isCandidateBlocked handles "Skip self".
                            // But for a group, we are assigning to multiple tasks.

                            // Let's just check if blocked for the "Group Task" entity if it existed, 
                            // or just check the first subtask.
                            const result = this.isCandidateBlocked(c.name, t, weekData.week, day.name);
                            return !result.blocked;
                        });

                        if (availableCandidates.length === 1) {
                            const candidate = availableCandidates[0];
                            console.log(`[AUTO-SINGLE] Assigning ${candidate.name} to Group ${task.id}`);

                            // Assign to ALL subtasks
                            task.subTasks.forEach(sub => {
                                this.saveAssignment(sub.id, candidate.name, weekData.week, day.name, task.id);
                            });
                            assignedCount++;
                        }

                    } else {
                        // Single Task Logic
                        const processTask = (t, roleNameOverride = null, groupId = null) => {
                            // Skip if already assigned
                            const key = `${t.id}_${weekData.week}_${day.name}`;
                            if (this.assignments[key]) return;

                            // Use standard getter which now includes Priority Logic
                            const candidates = this.getCandidatesForTask(t, weekData.week, day.name);

                            // Filter by Exclusion (Blocked)
                            const availableCandidates = candidates.filter(c => {
                                if (groupId) t.groupId = groupId;
                                const result = this.isCandidateBlocked(c.name, t, weekData.week, day.name);
                                return !result.blocked;
                            });

                            if (availableCandidates.length === 1) {
                                const candidate = availableCandidates[0];
                                console.log(`[AUTO-SINGLE] Assigning ${candidate.name} to ${t.name} (${weekData.week}, ${day.name})`);
                                this.saveAssignment(t.id, candidate.name, weekData.week, day.name, groupId);
                                assignedCount++;
                            }
                        };
                        processTask(task);
                    }
                });
            });
        });

        if (assignedCount > 0) {
            console.log(`[AUTO-SINGLE] Assigned ${assignedCount} tasks/groups.`);
            this.render();
            if (window.renderEffortGraph) window.renderEffortGraph();
        } else {
            console.log('[AUTO-SINGLE] No single-candidate tasks found.');
        }

        // Run Sibling Logic
        this.autoAssignSiblingTasks();
    }
}

// Global Handler
window.assignCandidate = function (id, candidateName, week, day) {
    console.log(`[ASSIGN CLICK] ID: ${id}, Name: ${candidateName}, Week: ${week}, Day: ${day}`);

    // Try specific task ID first
    let selector = `.assignee-input[data-task-id="${id}"]`;
    if (week !== undefined && day !== undefined) {
        selector += `[data-week="${week}"][data-day="${day}"]`;
    }

    let inputs = document.querySelectorAll(selector);

    // If not found, try Group ID
    if (inputs.length === 0) {
        let groupSelector = `.assignee-input[data-group-id="${id}"]`;
        if (week !== undefined && day !== undefined) {
            groupSelector += `[data-week="${week}"][data-day="${day}"]`;
        }
        inputs = document.querySelectorAll(groupSelector);
    }

    if (inputs.length > 0) {
        inputs.forEach(input => {
            console.log(`[ASSIGN CLICK] Updating input for task: ${input.dataset.taskId}`);
            if (input.validate) {
                input.validate(candidateName);
            } else {
                input.value = candidateName;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    } else {
        console.warn(`[ASSIGN CLICK] No inputs found for ID: ${id} (Week: ${week}, Day: ${day})`);
    }
};

// Expose global render function
window.renderAssignmentPanel = () => {
    new AssignmentPanel('assignment-panel');
};

