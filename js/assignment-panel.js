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

    saveAssignment(taskId, assigneeName) {
        if (assigneeName) {
            this.assignments[taskId] = assigneeName;
        } else {
            delete this.assignments[taskId];
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

        thead.innerHTML = `
            <tr>
                <th class="col-group">Task Group</th>
                <th class="col-task">Task Name</th>
                <th class="col-candidates">Candidates</th>
                <th class="col-optimal">
                    Optimal
                    <button type="button" class="master-check-btn" onclick="window._masterCheckHandler(); return false;" title="Copy ALL Optimal Candidates to Assignee">✓</button>
                </th>
                <th class="col-assignee">Assignee</th>
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
            if (this.assignments[task.id]) {
                task.assignee = this.assignments[task.id];
            }

            if (task.isGroup) {
                const commonCandidates = this.getCommonCandidates(task, week, day.name);
                const optimalCandidate = this.getOptimalCandidate(commonCandidates);
                // ... (existing group logic) ...
                task.subTasks.forEach((subTask, subIndex) => {
                    // Apply saved assignment to subtasks too
                    if (this.assignments[subTask.id]) {
                        subTask.assignee = this.assignments[subTask.id];
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

                    // Task Name
                    row.innerHTML += `
                        <td>
                            <div>${subTask.name}</div>
                            <div class="task-meta">${subTask.time} | ${subTask.effort}</div>
                        </td>`;

                    // Candidates (Merged)
                    if (subIndex === 0) {
                        const cell = document.createElement('td');
                        cell.className = 'candidates-cell';
                        cell.rowSpan = task.subTasks.length;
                        cell.innerHTML = this.formatCandidates(commonCandidates, task);
                        row.appendChild(cell);
                    }

                    // Optimal (Merged)
                    if (subIndex === 0) {
                        const cell = document.createElement('td');
                        cell.className = 'optimal-cell';
                        cell.rowSpan = task.subTasks.length;

                        if (optimalCandidate) {
                            const container = document.createElement('div');
                            container.style.display = 'flex';
                            container.style.alignItems = 'center';
                            container.style.gap = '8px';

                            const nameSpan = document.createElement('span');
                            nameSpan.textContent = optimalCandidate.name;
                            nameSpan.style.flex = '1';

                            const checkBtn = document.createElement('button');
                            checkBtn.className = 'optimal-check-btn';
                            checkBtn.textContent = '✓';
                            checkBtn.title = 'Copy to Assignee';
                            checkBtn.onclick = () => this.copyOptimalToAssignee(task, optimalCandidate.name);

                            container.appendChild(nameSpan);
                            container.appendChild(checkBtn);
                            cell.appendChild(container);
                        } else {
                            cell.textContent = '-';
                        }
                        row.appendChild(cell);
                    }

                    // Assignee
                    const assigneeCell = document.createElement('td');
                    assigneeCell.appendChild(this.createAssigneeInput(subTask));
                    row.appendChild(assigneeCell);

                    tbody.appendChild(row);
                });
            } else {
                // Render Single Task
                const row = document.createElement('tr');

                // Group Column (Empty)
                row.innerHTML += `<td class="group-cell empty">-</td>`;

                // Task Name
                row.innerHTML += `
                    <td>
                        <div>${task.name}</div>
                        <div class="task-meta">${task.time} | ${task.effort}</div>
                    </td>`;

                // Candidates
                const candidates = this.getCandidatesForTask(task, week, day.name);
                row.innerHTML += `<td class="candidates-cell">${this.formatCandidates(candidates, task)}</td>`;

                // Optimal
                const optimal = this.getOptimalCandidate(candidates);
                const optimalCell = document.createElement('td');
                optimalCell.className = 'optimal-cell';
                if (optimal) {
                    const container = document.createElement('div');
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.gap = '8px';

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = optimal.name;
                    nameSpan.style.flex = '1';

                    const checkBtn = document.createElement('button');
                    checkBtn.className = 'optimal-check-btn';
                    checkBtn.textContent = '✓';
                    checkBtn.title = 'Copy to Assignee';
                    checkBtn.onclick = () => this.copyOptimalToAssignee(task, optimal.name);

                    container.appendChild(nameSpan);
                    container.appendChild(checkBtn);
                    optimalCell.appendChild(container);
                } else {
                    optimalCell.textContent = '-';
                }
                row.appendChild(optimalCell);

                // Assignee
                const assigneeCell = document.createElement('td');
                assigneeCell.appendChild(this.createAssigneeInput(task));
                row.appendChild(assigneeCell);

                tbody.appendChild(row);
            }
        });
    }

    // ... (rest of methods) ...


    copyOptimalToAssignee(task, candidateName) {
        if (task.isGroup) {
            task.subTasks.forEach(sub => {
                sub.assignee = candidateName;
                this.saveAssignment(sub.id, candidateName); // Save
            });
        } else {
            task.assignee = candidateName;
            this.saveAssignment(task.id, candidateName); // Save
        }
        // Re-render to update inputs
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
                        const common = this.getCommonCandidates(task, weekData.week, day.name);
                        const optimal = this.getOptimalCandidate(common);
                        if (optimal) {
                            task.subTasks.forEach(sub => sub.assignee = optimal.name);
                        }
                    } else {
                        const candidates = this.getCandidatesForTask(task, weekData.week, day.name);
                        const optimal = this.getOptimalCandidate(candidates);
                        if (optimal) {
                            task.assignee = optimal.name;
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

    getCommonCandidates(groupTask, week, day) {
        if (!groupTask.subTasks || groupTask.subTasks.length === 0) return [];
        if (typeof CANDIDATES === 'undefined') return [];

        // Start with all candidates
        let candidates = CANDIDATES;

        // 1. Filter by Capability (Static) + Availability
        // We assume aggregation has already done this, but we re-verify or trust aggregation?
        // Aggregation stores candidates in groupTask.candidates!
        // Optimization: Use pre-calculated candidates if available
        if (groupTask.candidates) {
            // If aggregation already filtered correctly (which it does now), just use it!
            // But we might need to apply star filtering if needed? 
            // Assignment panel usually shows ALL eligible candidates.
            return groupTask.candidates;
        }

        // Fallback if no pre-calculated candidates (shouldn't happen for groups from aggregation)
        // Filter by availability for ALL subtasks
        const availableCandidates = candidates.filter(candidate => {
            return groupTask.subTasks.every(subTask => {
                const isAvailable = typeof isCandidateAvailable === 'function'
                    ? isCandidateAvailable(candidate, subTask.name, subTask.time, week, day)
                    : true;
                return isAvailable && candidate.roles.includes(subTask.name); // Capability check
            });
        });

        // If this is NOT a role-based group, return all available candidates
        if (!groupTask.isSplitRole) {
            return availableCandidates;
        }

        // Role-based group: Filter by Split Type (Leader/Follower)
        if (groupTask.splitRoleType) {
            const requiredRole = groupTask.splitRoleType;

            // Helper for dynamic role check (inline)
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

            // 1. Try specific roles (exclude Both)
            const specificCandidates = availableCandidates.filter(c => hasDynamicRole(c, requiredRole));

            if (specificCandidates.length > 0) {
                return specificCandidates;
            }

            // 2. Fallback to Both
            return availableCandidates.filter(c => hasDynamicRole(c, 'both'));
        }

        return availableCandidates;
    }

    getCandidatesForTask(task, week, day) {
        if (typeof CANDIDATES === 'undefined') return [];
        return CANDIDATES.filter(candidate => this.isCandidateValid(candidate, task, week, day));
    }

    isCandidateValid(candidate, task, week, day) {
        // Check Role
        const hasRoleResult = this.hasRole(candidate, task.name);
        if (!hasRoleResult) return false;

        // Check Availability
        if (typeof isCandidateAvailable === 'function') {
            const availResult = isCandidateAvailable(candidate, task.name, task.time, week, day);

            // Debug log for failed availability (one line to avoid hiding)
            if (!availResult) {
                console.log(`[AVAIL] ${candidate.name} unavailable for "${task.name}" | time:"${task.time}" week:"${week}" day:"${day}"`);
            }

            return availResult;
        }
        return true;
    }

    hasRole(candidate, roleName, excludeBoth = false) {
        if (!candidate || !roleName) return false;

        // Check for localStorage override for Leader/Follower
        const taskName = roleName.toLowerCase();
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
        if (!candidate.roles) return false;
        return candidate.roles.includes(roleName);
    }

    getOptimalCandidate(candidates) {
        if (!candidates || candidates.length === 0) return null;
        // Placeholder logic: Pick the first one, or one with least load?
        // For now, just return the first one.
        return candidates[0];
    }

    formatCandidates(candidates, task) {
        if (!candidates || candidates.length === 0) return '<span class="no-candidates">None</span>';
        return candidates.map(c =>
            `<span class="candidate-link" onclick="window.assignCandidate('${task.id}', '${c.name.replace(/'/g, "\\'")}')">${c.name}</span>`
        ).join(', ');
    }

    createAssigneeInput(task) {
        const container = document.createElement('div');
        container.className = 'assignee-input-container';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'assignee-input';
        input.placeholder = 'Select Assignee...';
        input.autocomplete = 'off'; // Disable browser autocomplete
        input.dataset.taskId = task.id; // Store Task ID for lookup
        if (task.assignee) {
            input.value = task.assignee;
            // Defer validation slightly to ensure element is ready, or just call it
            setTimeout(() => validateInput(task.assignee), 0);
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
            if (!val.trim()) {
                input.classList.remove('valid', 'warning');
                task.assignee = null; // Clear assignment
                this.saveAssignment(task.id, null); // Save
                if (window.renderEffortGraph) window.renderEffortGraph();
                return;
            }
            const isValid = typeof CANDIDATES !== 'undefined' && CANDIDATES.some(c => c.name.toLowerCase() === val.toLowerCase());
            if (isValid) {
                input.classList.add('valid');
                input.classList.remove('warning');
                // Correct casing
                const candidate = CANDIDATES.find(c => c.name.toLowerCase() === val.toLowerCase());
                if (candidate) {
                    input.value = candidate.name;
                    task.assignee = candidate.name; // Update Data
                    this.saveAssignment(task.id, candidate.name); // Save
                    if (window.renderEffortGraph) window.renderEffortGraph();
                }
            } else {
                input.classList.add('warning');
                input.classList.remove('valid');
                // Still save the text value even if invalid?
                // User said "color it yellow", implying it's allowed but warned.
                task.assignee = val;
                this.saveAssignment(task.id, val); // Save
            }
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
        });

        // Close on click outside (handled by blur mostly, but good for safety)

        container.appendChild(input);
        container.appendChild(dropdown);
        return container;
    }

    assignCandidateToTask(taskId, candidateName) {
        const input = document.querySelector(`.assignee-input[data-task-id="${taskId}"]`);
        if (input && input.validate) {
            input.validate(candidateName);
        } else if (input) {
            input.value = candidateName;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
}

// Global Handler
window.assignCandidate = function (taskId, candidateName) {
    // Find the panel instance? 
    // We can just find the input directly since we have the ID.
    const input = document.querySelector(`.assignee-input[data-task-id="${taskId}"]`);
    if (input) {
        // If the input has the validate method attached (which it should), use it.
        if (input.validate) {
            input.validate(candidateName);
        } else {
            input.value = candidateName;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
};

// Expose global render function
window.renderAssignmentPanel = () => {
    new AssignmentPanel('assignment-panel');
};
