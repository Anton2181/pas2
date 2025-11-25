// Schedule hover highlighting functionality
(function () {
    let hoverTimeout = null;

    function highlightScheduleTask(taskName, isGroup) {
        console.log('Highlighting:', taskName, 'isGroup:', isGroup);
        const allSquares = document.querySelectorAll('.schedule-task-square');
        console.log('Found squares:', allSquares.length);

        let matchCount = 0;
        allSquares.forEach(square => {
            const squareName = square.dataset.taskName;
            const squareIsGroup = square.dataset.isGroup === 'true';

            if (matchCount < 3) console.log('  Square:', squareName, 'isGroup:', squareIsGroup);

            let isMatch = false;
            if (isGroup) {
                // For groups, match if the square is also a group AND has the same name
                // OR if the square is NOT a group but its name is one of the tasks in the group (this part is tricky without the list of tasks)
                // SIMPLIFICATION: Just match by name for now. If the group title matches the square's task name (which for groups is the title), it's a match.
                // ALSO: We need to handle the case where the square is a "constituent" task of the group.
                // But wait, the schedule squares for groups are now AGGREGATED squares.
                // So they should have isGroup=true and taskName=Group Title.

                isMatch = squareName === taskName;
            } else {
                // For individual tasks, match exact name and ensure square is NOT a group
                isMatch = !squareIsGroup && squareName === taskName;
            }

            if (isMatch) {
                square.classList.add('highlighted');
                square.classList.remove('dimmed');
                matchCount++;
                console.log('    MATCH!', squareName);
            } else {
                square.classList.add('dimmed');
                square.classList.remove('highlighted');
            }
        });

        console.log('Total matches:', matchCount);
    }

    function clearHighlights() {
        document.querySelectorAll('.schedule-task-square').forEach(square => {
            square.classList.remove('dimmed', 'highlighted');
        });
    }

    function attachHoverListeners() {
        const taskCards = document.querySelectorAll('#available-tasks-grid .task-card');
        console.log('Attaching listeners to', taskCards.length, 'cards');

        taskCards.forEach(card => {
            card.addEventListener('mouseenter', function () {
                const isGroup = card.dataset.isGroup === 'true';
                const taskName = card.dataset.taskName;

                console.log('Hover on:', taskName, 'isGroup:', isGroup);
                if (!taskName) return;

                if (hoverTimeout) clearTimeout(hoverTimeout);
                hoverTimeout = setTimeout(() => highlightScheduleTask(taskName, isGroup), 500);
            });

            card.addEventListener('mouseleave', function () {
                if (hoverTimeout) {
                    clearTimeout(hoverTimeout);
                    hoverTimeout = null;
                }
                clearHighlights();
            });
        });
    }

    // Expose globally so it can be called after rendering
    window.attachScheduleHoverListeners = attachHoverListeners;

    // Also try to attach on load just in case (for initial load)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(attachHoverListeners, 500);
        });
    } else {
        setTimeout(attachHoverListeners, 500);
    }

    console.log('Schedule hover script loaded, attachScheduleHoverListeners exposed');
})();
