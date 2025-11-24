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
                isMatch = squareIsGroup && squareName === taskName;
            } else {
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
