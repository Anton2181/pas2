/**
 * Schedule Aggregation - Automatically aggregates tasks into groups
 * Runs on page load to combine tasks that belong to defined groups
 * Groups can match multiple times until tasks run out
 */

function aggregateScheduleIntoGroups(scheduleData) {
    let groups = [];
    let skippedTaskNames = new Set();
    let splitTasks = new Set();

    try {
        const workspaceStr = localStorage.getItem('workspace_autosave');
        if (workspaceStr) {
            const workspace = JSON.parse(workspaceStr);
            groups = workspace.state?.groups || [];
            const canvasTasks = workspace.state?.canvasTasks || [];

            // Get skipped tasks
            const skippedTasks = workspace.state?.skippedTasks || [];
            skippedTasks.forEach(task => {
                skippedTaskNames.add(task.name);
            });

            // Get split tasks (solo tasks marked as split)
            splitTasks = new Set(workspace.state?.splitTasks || []);

            console.log('Loaded groups for aggregation:', groups.length);
            console.log('Skipped tasks:', skippedTaskNames.size);
            console.log('Split tasks:', splitTasks.size);

            groups.forEach(group => {
                group.taskNames = canvasTasks
                    .filter(t => String(t.groupId) === String(group.id))
                    .map(t => t.name);

                const uniqueNames = new Set(group.taskNames);
                group.hasRepeats = uniqueNames.size !== group.taskNames.length;
                console.log(`Group "${group.title}" tasks:`, group.taskNames);
            });
        }
    } catch (e) {
        console.error('Error loading groups:', e);
        return scheduleData;
    }

    // Helper to check dynamic role state (Scoped to aggregation function)
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

    if (groups.length === 0) return scheduleData;

    groups.sort((a, b) => {
        // 0. Starred Groups come first!
        const aStarred = window.isTaskStarred && window.isTaskStarred(a.id, true);
        const bStarred = window.isTaskStarred && window.isTaskStarred(b.id, true);
        if (aStarred !== bStarred) return aStarred ? -1 : 1;

        // 1. Creation Order (ID) - Ascending
        // User rule: "higher order gets to aggregate first" -> First placed (Lower ID) is "Order 1".
        // So we sort Ascending.
        if (a.id !== b.id) {
            // Handle string/number IDs
            if (typeof a.id === 'string' && typeof b.id === 'string') {
                return a.id.localeCompare(b.id, undefined, { numeric: true });
            }
            return a.id - b.id;
        }

        return 0;
    });

    // Log final order
    console.log('Final Group Aggregation Order:', groups.map(g => `${g.title} (ID: ${g.id})`));

    // Initialize global aggregation counts
    window.AGGREGATION_COUNTS = {
        groups: {}, // { groupId: { current: 0, max: 0 } }
        tasks: {}   // { taskName: { current: 0, max: 0 } }
    };

    // Load limits from workspace state
    let limits = {};
    try {
        const workspaceStr = localStorage.getItem('workspace_autosave');
        if (workspaceStr) {
            const workspace = JSON.parse(workspaceStr);
            limits = workspace.state?.limits || {};
        }
    } catch (e) { }

    const aggregated = scheduleData.map(weekData => {
        // Track counts for the current week
        const weeklyCounts = {
            groups: {}, // { groupId: { potential: 0, actual: 0 } }
            tasks: {}   // { taskId: { potential: 0, actual: 0 } }
        };

        const processedDays = weekData.days.map(dayData => {
            const processedTasks = [];
            const usedIndices = new Set();

            // For each group, keep matching until no more matches
            groups.forEach(group => {
                if (!group.taskNames || group.taskNames.length === 0) return;

                // Initialize count for this group in this week if not exists
                if (!weeklyCounts.groups[group.id]) {
                    weeklyCounts.groups[group.id] = { potential: 0, actual: 0 };
                }
                const groupWeekCounts = weeklyCounts.groups[group.id];

                // Initialize global count if not exists
                if (!window.AGGREGATION_COUNTS.groups[group.id]) {
                    window.AGGREGATION_COUNTS.groups[group.id] = { current: 0, max: 0 };
                }

                let instanceCount = 0; // Instance count for the DAY (used for split logic)

                while (true) {
                    const groupTaskCounts = {};
                    group.taskNames.forEach(name => {
                        groupTaskCounts[name] = (groupTaskCounts[name] || 0) + 1;
                    });

                    const dayTaskCounts = {};
                    dayData.tasks.forEach((task, idx) => {
                        if (!usedIndices.has(idx) && !skippedTaskNames.has(task.name)) {
                            dayTaskCounts[task.name] = (dayTaskCounts[task.name] || 0) + 1;
                        }
                    });

                    let canMatch = true;
                    for (const [name, count] of Object.entries(groupTaskCounts)) {
                        if ((dayTaskCounts[name] || 0) < count) {
                            canMatch = false;
                            break;
                        }
                    }

                    if (!canMatch) break;

                    // Find indices for this potential group instance
                    const currentIndices = [];
                    const foundTasks = [];

                    // Try to find a match for each required task in the group
                    const groupTaskNames = [...group.taskNames];
                    let matchFailed = false;

                    for (const requiredName of groupTaskNames) {
                        const idx = dayData.tasks.findIndex((t, i) =>
                            t.name === requiredName &&
                            !usedIndices.has(i) &&
                            !currentIndices.includes(i) &&
                            (!group.skippedByLimitIndices || !group.skippedByLimitIndices.has(i))
                        );

                        if (idx !== -1) {
                            currentIndices.push(idx);
                            foundTasks.push(dayData.tasks[idx]);
                        } else {
                            matchFailed = true;
                            break;
                        }
                    }

                    if (!matchFailed) {
                        // Found a complete group match!

                        // Increment WEEKLY POTENTIAL count
                        groupWeekCounts.potential++;

                        // Check WEEKLY LIMIT
                        const limit = limits[group.id];
                        const limitReached = limit !== undefined && groupWeekCounts.actual >= limit;

                        if (limitReached) {
                            // Over limit: Skip this instance
                            if (!group.skippedByLimitIndices) group.skippedByLimitIndices = new Set();
                            currentIndices.forEach(i => group.skippedByLimitIndices.add(i));
                        } else {
                            // Under limit: Process this instance
                            groupWeekCounts.actual++;
                            instanceCount++; // Increment day instance count

                            // Mark as used globally
                            currentIndices.forEach(i => usedIndices.add(i));

                            // Calculate aggregated metrics
                            let totalEffort = 0, timeSlots = [], hasAll = false;
                            foundTasks.forEach(task => {
                                totalEffort += task.effort || 0;
                                if (task.time) {
                                    if (task.time.toLowerCase() === 'all') hasAll = true;
                                    else timeSlots.push(task.time);
                                }
                            });

                            let displayTime = '';
                            if (hasAll) {
                                displayTime = 'All';
                            } else if (timeSlots.length > 0) {
                                const parsed = timeSlots.map(slot => {
                                    const parts = slot.split('-');
                                    if (parts.length === 2) {
                                        let start = parseInt(parts[0]), end = parseInt(parts[1]);
                                        if (end === 0) end = 24;
                                        if (start === 0) start = 24;
                                        return { start, end };
                                    }
                                    return null;
                                }).filter(s => s);

                                if (parsed.length > 0) {
                                    const earliest = Math.min(...parsed.map(s => s.start));
                                    let latest = Math.max(...parsed.map(s => s.end));
                                    if (earliest === 20 && latest === 24) { // Special case for 8pm-12am
                                        displayTime = 'All';
                                    } else {
                                        displayTime = `${earliest === 24 ? '00' : earliest}-${latest === 24 ? '00' : latest}`;
                                    }
                                } else {
                                    displayTime = timeSlots.join(', ');
                                }
                            }

                            const taskNamesInGroup = foundTasks.map(task => task.name);
                            let candidateCount = 0;
                            let eligibleCandidates = [];

                            // ... (Existing Candidate Logic) ...
                            if (typeof CANDIDATES !== 'undefined' && CANDIDATES) {
                                // Iterate through instances (e.g. Leader, Follower)
                                // Note: instanceCount is 1-based here, so we use (instanceCount - 1) for 0-based index
                                const currentInstanceIndex = instanceCount - 1;

                                let currentEligibleCandidates = CANDIDATES.filter(c => {
                                    // Basic Availability Check
                                    return taskNamesInGroup.every(name => c.roles.includes(name)) &&
                                        foundTasks.every(t => isCandidateAvailable(c, t.name, t.time, weekData.week, dayData.name));
                                });

                                // Split Role Filtering (Strictly based on Split Badge)
                                if (group.isSplitRole && instanceCount <= 2) {
                                    const roleType = currentInstanceIndex === 0 ? 'leader' : 'follower';

                                    // 1. Identify Candidate Pools
                                    // Pure Specific: Has Role AND NOT Both
                                    const pureSpecificCandidates = currentEligibleCandidates.filter(c => hasDynamicRole(c, roleType) && !hasDynamicRole(c, 'both'));
                                    const starredPureSpecific = pureSpecificCandidates.filter(c => window.isCandidateStarred(group.id, c.id));

                                    // Both: Has Both Role
                                    const allBothCandidates = currentEligibleCandidates.filter(c => hasDynamicRole(c, 'both'));
                                    const starredBoth = allBothCandidates.filter(c => window.isCandidateStarred(group.id, c.id));

                                    // 2. Calculate Total Available Starred for the Group (for Viability Check)
                                    // We need to know if there are enough starred people GLOBALLY for this group to support "Both" usage.
                                    const allGroupStarred = CANDIDATES.filter(c => window.isCandidateStarred(group.id, c.id));
                                    const availableGroupStarred = allGroupStarred.filter(c =>
                                        foundTasks.every(t => isCandidateAvailable(c, t.name, t.time, weekData.week, dayData.name))
                                    );
                                    const totalAvailableStarredCount = availableGroupStarred.length;

                                    // 3. Selection Logic
                                    let candidatesToUse = [];

                                    // Hierarchy: Pure Specific > Both (Conditional)
                                    if (starredPureSpecific.length > 0) {
                                        // If we have Pure Specific Priority (e.g. Jan), use ONLY them.
                                        // This prevents "Both" candidates (e.g. Yulia) from appearing in the Leader slot
                                        // when a dedicated Leader is already assigned.
                                        candidatesToUse = starredPureSpecific;
                                    } else if (starredBoth.length > 0) {
                                        // If no Pure Specific, check Both.
                                        // Only use Both if the group has enough coverage (>= 2).
                                        if (totalAvailableStarredCount >= 2) {
                                            candidatesToUse = starredBoth;
                                        }
                                    }

                                    // 4. Final Decision
                                    if (candidatesToUse.length > 0) {
                                        currentEligibleCandidates = candidatesToUse;
                                    } else {
                                        // Fallback: Combine Unstarred Pure Specific + All Both
                                        currentEligibleCandidates = [...pureSpecificCandidates, ...allBothCandidates];
                                    }
                                }

                                // Priority Filtering (Starring) - General Case
                                // This applies if the group is starred, and it's NOT a split role.
                                // (For split roles, we handled it above).
                                if (group.id && window.isTaskStarred && window.isTaskStarred(group.id, true) && !group.isSplitRole) {
                                    const starredCandidates = currentEligibleCandidates.filter(c => window.isCandidateStarred(group.id, c.id));
                                    if (starredCandidates.length > 0) {
                                        currentEligibleCandidates = starredCandidates;
                                    }
                                }
                                eligibleCandidates = currentEligibleCandidates;
                                candidateCount = eligibleCandidates.length;
                            }

                            // Create group task
                            const groupTask = {
                                id: `grp-${group.id}-${dayData.name}-${instanceCount}`,
                                name: group.title,
                                color: getGroupColor(group.variant),
                                variant: group.variant, // Pass variant for styling
                                time: displayTime,
                                effort: totalEffort,
                                isGroup: true,
                                isSplitRole: group.isSplitRole, // Pass flag to task
                                splitRoleType: group.isSplitRole ? (instanceCount === 1 ? 'leader' : (instanceCount === 2 ? 'follower' : null)) : null,
                                candidateCount,
                                candidates: eligibleCandidates, // Store the list!
                                taskNames: taskNamesInGroup, // Store original task names for filtering
                                subTasks: foundTasks // Store full sub-task objects for availability checking
                            };

                            processedTasks.push(groupTask);
                        }

                    } else {
                        break; // No more matches for this group
                    }
                }
                if (group.skippedByLimitIndices) group.skippedByLimitIndices.clear();
            });

            // Create a set of all task names that belong to ANY group
            const allGroupTaskNames = new Set();
            groups.forEach(g => {
                g.taskNames.forEach(name => allGroupTaskNames.add(name));
            });

            // Pre-calculate counts for remaining tasks
            const remainingTaskCounts = {};
            dayData.tasks.forEach((task, idx) => {
                if (!usedIndices.has(idx) && !skippedTaskNames.has(task.name) && !allGroupTaskNames.has(task.name)) {
                    remainingTaskCounts[task.name] = (remainingTaskCounts[task.name] || 0) + 1;
                }
            });

            const processedSoloTaskCounts = {};

            // Add remaining ungrouped tasks (excluding skipped AND excluding leftovers from groups)
            dayData.tasks.forEach((task, idx) => {
                if (!usedIndices.has(idx) && !skippedTaskNames.has(task.name)) {
                    // If this task is part of a group definition but wasn't aggregated, it's a "leftover" -> SKIP IT
                    if (allGroupTaskNames.has(task.name)) {
                        return;
                    }

                    // Calculate Candidates & Priority for Individual Task
                    if (typeof CANDIDATES !== 'undefined') {
                        // Find Real ID
                        let realId = null;
                        if (typeof TASKS !== 'undefined') {
                            const originalTask = TASKS.find(t => t.name === task.name);
                            if (originalTask) realId = originalTask.id;
                        }

                        // Initialize task counts
                        if (realId) {
                            if (!weeklyCounts.tasks[realId]) {
                                weeklyCounts.tasks[realId] = { potential: 0, actual: 0 };
                            }
                            if (!window.AGGREGATION_COUNTS.tasks[realId]) {
                                window.AGGREGATION_COUNTS.tasks[realId] = { current: 0, max: 0 };
                            }

                            // Increment WEEKLY POTENTIAL
                            weeklyCounts.tasks[realId].potential++;

                            // Check WEEKLY LIMIT
                            const limit = limits[realId];
                            const taskWeekCounts = weeklyCounts.tasks[realId];
                            if (limit !== undefined && taskWeekCounts.actual >= limit) {
                                return; // Skip this task due to limit
                            }
                            taskWeekCounts.actual++;
                        }

                        // Check if Split Task
                        if (realId && splitTasks.has(realId)) {
                            const total = remainingTaskCounts[task.name] || 1;
                            const currentIdx = processedSoloTaskCounts[task.name] || 0;
                            processedSoloTaskCounts[task.name] = currentIdx + 1;

                            if (total >= 2) {
                                // Multiple instances: Assign roles sequentially (Leader, then Follower)
                                if (currentIdx === 0 || currentIdx === 1) {
                                    const role = currentIdx === 0 ? 'leader' : 'follower';
                                    const splitTask = { ...task, isSplitRole: true, role: role, id: realId };

                                    // Filter Candidates for this role
                                    let eligible = CANDIDATES.filter(c =>
                                        c.roles.includes(task.name) &&
                                        isCandidateAvailable(c, task.name, task.time, weekData.week, dayData.name)
                                    );

                                    // Apply Role Filter
                                    eligible = eligible.filter(c => {
                                        const match = hasDynamicRole(c, role);
                                        if (match) return true;
                                        if (hasDynamicRole(c, 'both')) return true;
                                        return false;
                                    });

                                    // Priority Filtering
                                    if (window.isTaskStarred && window.isTaskStarred(realId)) {
                                        const starred = eligible.filter(c => window.isCandidateStarred(realId, c.id));
                                        if (starred.length > 0) {
                                            eligible = starred;
                                        }
                                    }

                                    splitTask.candidates = eligible;
                                    processedTasks.push(splitTask);
                                }
                                // If > 2 instances, skip the rest (limit to 2 for split roles)
                                return;
                            } else {
                                // Single instance: Split into Leader and Follower
                                ['leader', 'follower'].forEach(role => {
                                    const splitTask = { ...task, isSplitRole: true, role: role, id: realId };

                                    // Filter Candidates for this role
                                    let eligible = CANDIDATES.filter(c =>
                                        c.roles.includes(task.name) &&
                                        isCandidateAvailable(c, task.name, task.time, weekData.week, dayData.name)
                                    );

                                    // Apply Role Filter
                                    eligible = eligible.filter(c => {
                                        const match = hasDynamicRole(c, role);
                                        if (match) return true;
                                        if (hasDynamicRole(c, 'both')) return true;
                                        return false;
                                    });

                                    // Priority Filtering
                                    if (window.isTaskStarred && window.isTaskStarred(realId)) {
                                        const starred = eligible.filter(c => window.isCandidateStarred(realId, c.id));
                                        if (starred.length > 0) {
                                            eligible = starred;
                                        }
                                    }

                                    splitTask.candidates = eligible;
                                    processedTasks.push(splitTask);
                                });
                                return; // Skip adding the original task
                            }
                        }

                        // 1. Availability & Role
                        let eligible = CANDIDATES.filter(c =>
                            c.roles.includes(task.name) &&
                            isCandidateAvailable(c, task.name, task.time, weekData.week, dayData.name)
                        );

                        // 2. Priority
                        if (realId && window.isTaskStarred && window.isTaskStarred(realId)) {
                            const starred = eligible.filter(c => window.isCandidateStarred(realId, c.id));
                            if (starred.length > 0) {
                                eligible = starred;
                            }
                        }

                        task.candidates = eligible;
                    }

                    processedTasks.push(task);
                }
            });

            // Sort tasks: All Day first, then by Start Time, then End Time, then Name
            processedTasks.sort((a, b) => {
                // 1. Time Sorting
                const timeA = a.time ? a.time.toLowerCase() : '';
                const timeB = b.time ? b.time.toLowerCase() : '';

                if (timeA !== timeB) {
                    // "All" comes first
                    if (timeA === 'all') return -1;
                    if (timeB === 'all') return 1;

                    // Parse start times
                    const getStart = (t) => {
                        if (!t) return 999;
                        const parts = t.split('-');
                        return parseInt(parts[0]) || 999;
                    };

                    const startA = getStart(timeA);
                    const startB = getStart(timeB);

                    if (startA !== startB) return startA - startB;

                    // Parse end times (if starts are equal)
                    const getEnd = (t) => {
                        if (!t) return 999;
                        const parts = t.split('-');
                        return parseInt(parts[1]) || 999;
                    };

                    const endA = getEnd(timeA);
                    const endB = getEnd(timeB);

                    if (endA !== endB) return endA - endB;
                }

                // 2. Name Sorting (Alphabetical)
                return a.name.localeCompare(b.name);
            });

            return { name: dayData.name, type: dayData.type, tasks: processedTasks };
        });

        // Update Global Aggregation Counts with Max Weekly Values
        Object.keys(weeklyCounts.groups).forEach(groupId => {
            const counts = weeklyCounts.groups[groupId];
            const globalCounts = window.AGGREGATION_COUNTS.groups[groupId];
            globalCounts.max = Math.max(globalCounts.max, counts.potential);
            globalCounts.current = Math.max(globalCounts.current, counts.actual);
        });

        Object.keys(weeklyCounts.tasks).forEach(taskId => {
            const counts = weeklyCounts.tasks[taskId];
            const globalCounts = window.AGGREGATION_COUNTS.tasks[taskId];
            globalCounts.max = Math.max(globalCounts.max, counts.potential);
            globalCounts.current = Math.max(globalCounts.current, counts.actual);
        });

        return {
            week: weekData.week,
            days: processedDays
        };
    });

    return aggregated;
}

function getGroupColor(variant) {
    const colors = { 1: '#E2B49A', 2: '#A8C6A3', 3: '#DBCB96', 4: '#9ABDE2', 5: '#E29AA8' };
    return colors[variant] || '#e0e0e0';
}

if (typeof SCHEDULE_DATA !== 'undefined') {
    const runAgg = () => {
        console.log('Running aggregation, CANDIDATES:', CANDIDATES?.length || 0);

        // Reload original data if available (to reset before re-aggregating)
        if (window.ORIGINAL_SCHEDULE_DATA) {
            SCHEDULE_DATA.length = 0;
            SCHEDULE_DATA.push(...window.ORIGINAL_SCHEDULE_DATA);
        } else {
            window.ORIGINAL_SCHEDULE_DATA = [...SCHEDULE_DATA];
        }

        const agg = aggregateScheduleIntoGroups(SCHEDULE_DATA);
        SCHEDULE_DATA.length = 0;
        SCHEDULE_DATA.push(...agg);
        console.log('Aggregation complete');

        if (typeof renderSchedulePreview === 'function' && document.getElementById('schedule-preview-container')) {
            renderSchedulePreview();
        }

        if (typeof renderEffortGraph === 'function') {
            renderEffortGraph();
        }

        if (typeof renderAvailableTasks === 'function') {
            renderAvailableTasks();
        }

        // Update Last Updated Label
        const label = document.getElementById('groups-last-updated');
        if (label) {
            const now = new Date();
            const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            label.textContent = `Last updated: ${timeString}`;
        }
    };

    // Function to re-download data from source and then refresh
    const reloadAndRefresh = async () => {
        if (typeof fetchSheetData === 'function') {
            const btn = document.getElementById('global-redownload-btn');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '⏳';
                btn.disabled = true;

                try {
                    await fetchSheetData();
                    // Update original data reference after fetch
                    window.ORIGINAL_SCHEDULE_DATA = [...SCHEDULE_DATA];
                    runAgg();
                    btn.innerHTML = '✅';
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }, 1000);
                } catch (e) {
                    console.error('Failed to reload data:', e);
                    btn.innerHTML = '❌';
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.disabled = false;
                    }, 2000);
                }
            } else {
                await fetchSheetData();
                window.ORIGINAL_SCHEDULE_DATA = [...SCHEDULE_DATA];
                runAgg();
            }
        } else {
            console.error('fetchSheetData not found');
        }
    };

    // Expose globally
    window.refreshScheduleAggregation = runAgg;
    window.reloadAndRefreshData = reloadAndRefresh;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAgg);
    } else {
        runAgg();
    }
}
