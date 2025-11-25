/**
 * Schedule Aggregation - Automatically aggregates tasks into groups
 * Runs on page load to combine tasks that belong to defined groups
 * Groups can match multiple times until tasks run out
 */

function aggregateScheduleIntoGroups(scheduleData) {
    let groups = [];
    let skippedTaskNames = new Set();

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

            console.log('Loaded groups for aggregation:', groups.length);
            console.log('Skipped tasks:', skippedTaskNames.size);

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

    if (groups.length === 0) return scheduleData;

    groups.sort((a, b) => {
        // 1. Sort by Variant (Priority) Ascending (1 matches before 2)
        // The user explicitly requested "1. priority" groups to be created before "2. priority" ones.
        if (a.variant !== b.variant) return a.variant - b.variant;

        // 2. Groups without repeats come first (Specific > Generic)
        if (a.hasRepeats !== b.hasRepeats) return a.hasRepeats ? 1 : -1;

        // 3. Groups with fewer tasks come first (More constrained > Less constrained)
        if (a.taskNames.length !== b.taskNames.length) return a.taskNames.length - b.taskNames.length;

        // 4. Tiebreaker: ID (older first)
        return a.id - b.id;
    });

    const aggregated = scheduleData.map(weekData => ({
        week: weekData.week,
        days: weekData.days.map(dayData => {
            const processedTasks = [];
            const usedIndices = new Set();

            // For each group, keep matching until no more matches
            groups.forEach(group => {
                if (!group.taskNames || group.taskNames.length === 0) return;

                let instanceCount = 0;
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
                            !currentIndices.includes(i)
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

                        if (typeof CANDIDATES !== 'undefined' && CANDIDATES) {
                            eligibleCandidates = CANDIDATES.filter(c =>
                                taskNamesInGroup.every(name => c.roles.includes(name))
                            );
                            candidateCount = eligibleCandidates.length;
                        }

                        // Create group task
                        const groupTask = {
                            id: `grp-${group.id}-${dayData.name}-${instanceCount}`,
                            name: group.title,
                            color: getGroupColor(group.variant),
                            time: displayTime,
                            effort: totalEffort,
                            isGroup: true,
                            candidateCount,
                            candidates: eligibleCandidates, // Store the list!
                            taskNames: taskNamesInGroup // Store original task names for filtering
                        };

                        processedTasks.push(groupTask);
                        instanceCount++;
                    } else {
                        break; // No more matches for this group
                    }
                }
            });

            // Create a set of all task names that belong to ANY group
            const allGroupTaskNames = new Set();
            groups.forEach(g => {
                g.taskNames.forEach(name => allGroupTaskNames.add(name));
            });

            // Add remaining ungrouped tasks (excluding skipped AND excluding leftovers from groups)
            dayData.tasks.forEach((task, idx) => {
                if (!usedIndices.has(idx) && !skippedTaskNames.has(task.name)) {
                    // If this task is part of a group definition but wasn't aggregated, it's a "leftover" -> SKIP IT
                    if (allGroupTaskNames.has(task.name)) {
                        // console.log('Skipping leftover group task:', task.name);
                        return;
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
        })
    }));

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

        if (typeof renderAvailableTasks === 'function') {
            renderAvailableTasks();
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
