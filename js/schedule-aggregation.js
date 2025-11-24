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

    groups.sort((a, b) => (a.hasRepeats === b.hasRepeats ? 0 : (a.hasRepeats ? 1 : -1)));

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

                    const matchedIndices = [];
                    const namesCopy = [...group.taskNames];

                    for (let idx = 0; idx < dayData.tasks.length; idx++) {
                        if (usedIndices.has(idx)) continue;
                        if (skippedTaskNames.has(dayData.tasks[idx].name)) continue;
                        const nameIdx = namesCopy.indexOf(dayData.tasks[idx].name);
                        if (nameIdx !== -1) {
                            matchedIndices.push(idx);
                            namesCopy.splice(nameIdx, 1);
                        }
                    }

                    if (namesCopy.length !== 0) break;

                    matchedIndices.forEach(idx => usedIndices.add(idx));

                    let totalEffort = 0, timeSlots = [], hasAll = false;
                    matchedIndices.forEach(idx => {
                        const task = dayData.tasks[idx];
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
                            if (earliest === 20 && latest === 24) {
                                displayTime = 'All';
                            } else {
                                displayTime = `${earliest === 24 ? '00' : earliest}-${latest === 24 ? '00' : latest}`;
                            }
                        } else {
                            displayTime = timeSlots.join(', ');
                        }
                    }

                    const taskNamesInGroup = matchedIndices.map(idx => dayData.tasks[idx].name);
                    let candidateCount = 0;
                    if (typeof CANDIDATES !== 'undefined' && CANDIDATES) {
                        candidateCount = CANDIDATES.filter(c =>
                            taskNamesInGroup.every(name => c.roles.includes(name))
                        ).length;
                    }

                    processedTasks.push({
                        id: `grp-${group.id}-${dayData.name}-${instanceCount++}`,
                        name: group.title,
                        color: getGroupColor(group.variant),
                        time: displayTime,
                        effort: totalEffort,
                        isGroup: true,
                        candidateCount
                    });
                }
            });

            // Add remaining ungrouped tasks (excluding skipped)
            dayData.tasks.forEach((task, idx) => {
                if (!usedIndices.has(idx) && !skippedTaskNames.has(task.name)) {
                    processedTasks.push(task);
                }
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
        window.ORIGINAL_SCHEDULE_DATA = [...SCHEDULE_DATA];
        const agg = aggregateScheduleIntoGroups(SCHEDULE_DATA);
        SCHEDULE_DATA.length = 0;
        SCHEDULE_DATA.push(...agg);
        console.log('Aggregation complete');
        if (typeof renderSchedulePreview === 'function' && document.getElementById('schedule-preview-container')) {
            renderSchedulePreview();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runAgg);
    } else {
        runAgg();
    }
}
