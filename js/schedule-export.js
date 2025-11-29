/**
 * Schedule Export - Generates a hierarchical JSON source of truth
 * Structure: Week > Day > (Role-Restricted Pair) > Group > Task > Candidate
 */

function generateScheduleExport() {
    if (typeof SCHEDULE_DATA === 'undefined') {
        console.error('SCHEDULE_DATA not found');
        return null;
    }

    const exportData = {
        generatedAt: new Date().toISOString(),
        version: '1.0',
        schedule: []
    };

    // Helper to get real ID for star/connection checks
    const getRealId = (task) => {
        if (task.isGroup) {
            const parts = task.id.split('-');
            if (parts.length >= 2) return parts[1]; // "grp-{id}-..." -> "{id}"
        } else {
            const originalTask = typeof TASKS !== 'undefined' ? TASKS.find(t => t.name === task.name) : null;
            if (originalTask) return originalTask.id;
        }
        return null;
    };

    // Helper to get connections for a specific item
    const getConnections = (realId, isGroup) => {
        // Use workspaceState if available (team.html), otherwise try state (script.js)
        const appState = (typeof workspaceState !== 'undefined') ? workspaceState : (typeof state !== 'undefined' ? state : null);

        if (!appState || !appState.connections) return [];

        const idToCheck = isGroup ? `group-${realId}` : `task-${realId}`;
        // Wait, connections.js uses "task-{instanceId}" or "group-{id}". 
        // But here in schedule preview, we don't have instance IDs for tasks, only generic task definitions.
        // However, groups DO have specific IDs.
        // For generic tasks, we might not have specific connections unless they are tied to the task definition?
        // Actually, connections are on the CANVAS instances. 
        // The schedule is an aggregation of those instances.
        // So we should look up connections based on the GROUP ID (which is stable).
        // For individual tasks that are NOT in a group... they are aggregated by name.
        // If there are multiple instances of "Private Lesson" on canvas, they are aggregated into one "Private Lesson" entry in schedule if they are not grouped.
        // But wait, the aggregation logic (schedule-aggregation.js) creates "instances" in the schedule based on available slots.
        // It doesn't directly map 1:1 to canvas instances unless they are grouped.

        // Let's focus on Group connections first, as those are the most critical for "Role-Restricted Pairs".
        if (!isGroup) return [];

        return appState.connections.filter(c => {
            return c.fromId === idToCheck || c.toId === idToCheck;
        }).map(c => ({
            type: c.type,
            targetId: c.fromId === idToCheck ? c.toId : c.fromId
        }));
    };

    // Helper to enrich candidate data
    const enrichCandidates = (candidates, task, realId, isGroup) => {
        return candidates.map(c => {
            const isStarred = window.isCandidateStarred ? window.isCandidateStarred(realId, c.id) : false;

            // Check for dynamic role override
            let role = null;
            let hasBoth = false;

            const key = `team_role_${c.id}`;
            const stored = localStorage.getItem(key);
            if (stored) {
                try {
                    const state = JSON.parse(stored);
                    hasBoth = !!state.both;

                    // Determine active role
                    if (state.both) role = 'both';
                    else if (state.leader) role = 'leader';
                    else if (state.follower) role = 'follower';
                } catch (e) { }
            }

            return {
                id: c.id,
                name: c.name,
                role: role,
                hasBoth: hasBoth,
                isPriority: isStarred
            };
        });
    };

    SCHEDULE_DATA.forEach(weekData => {
        const weekExport = {
            week: weekData.week,
            days: []
        };

        weekData.days.forEach(dayData => {
            const dayExport = {
                name: dayData.name,
                items: []
            };

            // Process tasks and identify split-role pairs
            // In schedule-aggregation.js, split role groups are created as separate tasks:
            // "Group Name" (Leader) and "Group Name" (Follower)
            // They share the same name and variant, but have different `splitRoleType`.
            // They also have `id` like `grp-{id}-{day}-{instance}`.

            const processedIndices = new Set();

            dayData.tasks.forEach((task, index) => {
                if (processedIndices.has(index)) return;

                const realId = getRealId(task);
                const isGroup = task.isGroup;

                // Check if this is part of a Split Role Pair
                if (isGroup && task.isSplitRole) {
                    // Find its partner (the other part of the split role)
                    // Usually they are adjacent or close.
                    // We look for another task with same name, same isGroup, same isSplitRole, but different splitRoleType?
                    // Actually, aggregation creates them sequentially.

                    // Let's try to find all parts of this split group in this day
                    const parts = [];
                    dayData.tasks.forEach((t, i) => {
                        if (processedIndices.has(i)) return;
                        if (t.isGroup && t.isSplitRole && t.name === task.name && getRealId(t) === realId) {
                            parts.push({ task: t, index: i });
                        }
                    });

                    if (parts.length > 0) {
                        // Mark as processed
                        parts.forEach(p => processedIndices.add(p.index));

                        // Create a "Pair" item
                        const pairItem = {
                            type: 'pair',
                            name: task.name,
                            groupId: realId,
                            connections: getConnections(realId, true),
                            subItems: parts.map(p => {
                                const t = p.task;
                                return {
                                    type: 'group_instance',
                                    roleType: t.splitRoleType, // 'leader' or 'follower'
                                    time: t.time,
                                    effort: t.effort,
                                    candidates: enrichCandidates(t.candidates || [], t, realId, true)
                                };
                            })
                        };
                        dayExport.items.push(pairItem);
                        return;
                    }
                }

                // Normal Group or Single Task
                processedIndices.add(index);

                const item = {
                    type: isGroup ? 'group' : 'task',
                    name: task.name,
                    id: realId, // Group ID or Task ID
                    time: task.time,
                    effort: task.effort,
                    connections: getConnections(realId, isGroup),
                    candidates: []
                };

                // Get candidates
                let candidates = [];
                if (task.candidates) {
                    candidates = task.candidates;
                } else if (typeof getCandidatesForTask === 'function') {
                    // Fallback if not pre-calculated (e.g. single tasks)
                    // We need to access AssignmentPanel logic or similar?
                    // Or just use global CANDIDATES filtered by role
                    if (typeof CANDIDATES !== 'undefined') {
                        candidates = CANDIDATES.filter(c => c.roles.includes(task.name));
                    }
                }

                item.candidates = enrichCandidates(candidates, task, realId, isGroup);
                dayExport.items.push(item);
            });

            weekExport.days.push(dayExport);
        });

        exportData.schedule.push(weekExport);
    });

    return exportData;
}

function downloadScheduleJson(data) {
    if (!data) return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `schedule_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Expose globally
window.generateScheduleExport = generateScheduleExport;
window.downloadScheduleJson = downloadScheduleJson;
