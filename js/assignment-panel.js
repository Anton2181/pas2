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
        try {
            const stored = localStorage.getItem('task_assignments');
            if (stored) {
                this.assignments = JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load assignments', e);
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
                    <button type="button" class="clear-all-btn" onclick="window._clearAllHandler(); return false;" title="Clear ALL Assignees">×</button>
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

    applyPriorityFilter(candidates, task) {
        if (!candidates || candidates.length === 0) return [];

        console.log(`[PRIO-TRACE] applyPriorityFilter called for ${task ? task.name : 'unknown'} (ID: ${task ? task.id : 'N/A'})`);

        // 1. Resolve Real ID for Star Checking
        let realId = null;
        let isGroup = false;

        if (task) {
            if (task.isGroup) {
                isGroup = true;
                // Extract group ID from "g-{id}-..."
                // console.log(`[PRIO-DEBUG] Checking Group ID: ${task.id}`);
                const parts = task.id.toString().split('-');
                if (parts.length >= 2) {
                    realId = parts[1];
                } else {
                    // Fallback: assume the ID itself is the real ID if no hyphen
                    realId = task.id;
                }
            } else {
                // Find task in TASKS by name to get its persistent ID (t1, t2...)
                // Note: task.name might have " - DayName" appended. We should try exact match first, then startsWith.
                let originalTask = typeof TASKS !== 'undefined' ? TASKS.find(t => t.name === task.name) : null;

                if (!originalTask && typeof TASKS !== 'undefined') {
                    // Try matching by base name (e.g. "Master of Cerimony" vs "Master of Cerimony - Tuesday")
                    // We assume the suffix starts with " - "
                    const baseName = task.name.split(' - ')[0];
                    originalTask = TASKS.find(t => t.name === baseName);
                }

                if (originalTask) realId = originalTask.id;
            }
        }

        // 2. Check Star Restriction
        if (realId) {
            // 2. Check for Starred Candidates
            // If the task itself is NOT starred, we check if any candidates are starred for this task.
            const starredCandidates = candidates.filter(c => {
                const isStarred = window.isCandidateStarred(realId, c.id);
                console.log(`[PRIO-CHECK] Task: ${task.name} (RealID: ${realId}), Candidate: ${c.name} (ID: ${c.id}), Starred: ${isStarred}`);
                return isStarred;
            });

            if (starredCandidates.length > 0) {
                console.log(`[PRIO-DEBUG] Found ${starredCandidates.length} starred candidates for ${task.name} (RealID: ${realId})`);

                // Special Case: "Both" Role in Split Groups
                // If we have a split group (Leader/Follower), and a candidate is "Both",
                // they might be starred for the GROUP, but we only want to prioritize them 
                // if they are the ONLY starred candidate, OR if they are explicitly needed.
                let ignorePriority = false;

                if (task && task.isGroup && task.isSplitRole && starredCandidates.length === 1) {
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

                                console.log(`[PRIO-DEBUG] "Both" Exception Check. Candidate: ${candidate.name}, Total Starred in Group: ${totalGroupStarredCount}`);

                                // Only ignore priority if this candidate is the ONLY one starred in the entire group
                                if (totalGroupStarredCount === 1) {
                                    ignorePriority = true;
                                    console.log(`[PRIO-DEBUG] Ignoring Priority (Single "Both" Candidate)`);
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing team role override:', e);
                        }
                    }
                }

                if (starredCandidates.length > 0 && !ignorePriority) {
                    return starredCandidates;
                }
            }
        }

        return candidates;
    }

    getCommonCandidates(subTasks, week, day, groupTask) {
        // Use pre-calculated candidates if available (Source of Truth)
        const hasPrecalc = groupTask && groupTask.candidates && groupTask.candidates.length > 0;
        let candidates = hasPrecalc ? groupTask.candidates : (typeof CANDIDATES !== 'undefined' ? CANDIDATES : []);

        // Apply Priority Filter (Starring)
        candidates = this.applyPriorityFilter(candidates, groupTask);

        // If we used pre-calculated candidates, trust them and return (matching schedule-preview.js)
        if (hasPrecalc) {
            // console.log(`[COMMON] Using precalc for ${groupTask.name}: ${candidates.length}`);
            return candidates;
        }

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
        let candidates = hasPrecalc ? task.candidates : (typeof CANDIDATES !== 'undefined' ? CANDIDATES : []);

        // Apply Priority Filter (Starring)
        candidates = this.applyPriorityFilter(candidates, task);

        // If we used pre-calculated candidates, trust them and return
        if (hasPrecalc) {
            return candidates;
        }

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

        // Check for localStorage override for Leader/Follower
        const taskName = roleName.toLowerCase();
        let mappedRole = null;

        if (taskName.includes('lead') || taskName.includes('conduct') || taskName.includes('teacher')) {
            mappedRole = 'leader';
        } else if (taskName.includes('follow') || taskName.includes('assist')) {
            mappedRole = 'follower';
        } else if (taskName.includes('preparation')) {
            // Preparation tasks without explicit 'teacher' or 'assistant' can be done by either
            const result = candidate.roles && (candidate.roles.includes('Leader') || candidate.roles.includes('Follower') || candidate.roles.includes('Both'));
            console.log(`[ROLE-CHECK] Prep check for ${candidate.name}: Roles=${candidate.roles}, Result=${result}`);
            return result;
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

    isCandidateBlocked(candidateName, currentTask, currentWeek, currentDay) {
        // Exception: Tasks on "0th Day" (Available Tasks) do not block each other
        if (currentDay === '0th Day') {
            return { blocked: false, reason: null };
        }

        const assignments = this.getAllAssignments();
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
            if (currentTask.groupId && a.groupId && currentTask.groupId === a.groupId) {
                // console.log(`[EXCLUSION] Ignoring conflict within group ${currentTask.groupId}`);
                return false;
            }

            // Check Time Overlap
            const overlap = this.checkTimeOverlap(currentTask.time, a.time);

            if (overlap) {
                blockReason = `Blocked by: ${a.name} (${a.time})`;
                // Debug Log (Optional, can be removed if too spammy)
                // console.log(`[BLOCK] ${candidateName}: ${blockReason}`);
                return true; // Stop iteration, found block
            }
            return false;
        });

        // We need to find the blocking assignment to return it
        const blockingAssignment = isBlocked ? assignments.find(a => {
            if (a.taskId === currentTask.id) return false;
            if (a.assignee !== candidateName) return false;
            if (a.week != currentWeek || a.day !== currentDay) return false;
            if (currentTask.groupId && a.groupId && currentTask.groupId === a.groupId) return false;
            return this.checkTimeOverlap(currentTask.time, a.time);
        }) : null;

        return { blocked: isBlocked, reason: blockReason, blockingAssignment };
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

    updateCandidateVisuals() {
        const links = document.querySelectorAll('.candidate-link');
        links.forEach(link => {
            const taskId = link.dataset.taskId;
            const week = link.dataset.week; // Keep as string (e.g. "Week 11")
            const day = link.dataset.day;
            const time = link.dataset.time;
            const candidateName = link.dataset.candidateName;

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

            const result = this.isCandidateBlocked(candidateName, mockTask, week, day);
            const isBlocked = result.blocked;

            if (isBlocked) {
                link.classList.add('blocked');
                link.title = result.reason || 'Already assigned to a competing task';
                link.removeAttribute('onclick');
            } else {
                link.classList.remove('blocked');
                link.removeAttribute('title');
                // Re-add onclick with week/day
                if (!link.hasAttribute('onclick')) {
                    link.setAttribute('onclick', `window.assignCandidate('${taskId}', '${candidateName.replace(/'/g, "\\'")}', '${week}', '${day}')`);
                }
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
                    task.assignee = c.name; // Update Data
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

            if (!val || !val.trim()) {
                input.classList.remove('valid', 'input-warning', 'input-error');
                task.assignee = null; // Clear assignment
                this.saveAssignment(task.id, null, week, day, groupId); // Save with groupId
                if (window.renderEffortGraph) window.renderEffortGraph();
                this.updateCandidateVisuals(); // Live Update
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
                this.updateCandidateVisuals(); // Live Update (even if invalid, might clear previous valid)
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
            this.updateCandidateVisuals(); // Live Update
        };

        // Attach validate to input for external calls
        input.validate = validateInput;

        // Event Listeners
        input.addEventListener('focus', showDropdown);
        input.addEventListener('blur', () => setTimeout(hideDropdown, 200));
        input.addEventListener('input', (e) => {
            populateDropdown(e.target.value);
            dropdown.classList.add('show');
            validateInput(e.target.value);
            updateClearBtn(); // Toggle clear button visibility
        });

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

    autoAssignSingleCandidates() {
        if (!SCHEDULE_DATA) return;

        let assignedCount = 0;

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

                        // Filter by Exclusion (Blocked)
                        // Note: getCommonCandidates already checks Availability and Capability
                        const availableCandidates = candidates.filter(c => {
                            const groupTaskObj = { ...task, groupId: task.id };
                            const result = this.isCandidateBlocked(c.name, groupTaskObj, weekData.week, day.name);
                            return !result.blocked;
                        });

                        if (availableCandidates.length === 1) {
                            const candidate = availableCandidates[0];
                            console.log(`[AUTO-SINGLE] Assigning ${candidate.name} to GROUP ${task.name}`);

                            // Assign to ALL subtasks
                            task.subTasks.forEach(sub => {
                                const key = `${sub.id}_${weekData.week}_${day.name}`;
                                if (this.assignments[key]) return;
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
    }
}

// Global Handler
// Global Handler
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

