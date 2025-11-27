// Schedule Layout Resizing Logic

document.addEventListener('DOMContentLoaded', () => {
    initSplitters();
});

function initSplitters() {
    const container = document.querySelector('.schedule-container');
    const leftPanel = document.getElementById('assignment-panel');
    const rightContainer = document.getElementById('right-container');
    const topPanel = document.getElementById('effort-panel');
    const bottomPanel = document.getElementById('rules-panel');

    const vSplitter = document.getElementById('v-splitter');
    const hSplitter = document.getElementById('h-splitter');

    if (!vSplitter || !hSplitter) return;

    // Vertical Splitter (Left vs Right)
    let isDraggingV = false;

    vSplitter.addEventListener('mousedown', (e) => {
        isDraggingV = true;
        vSplitter.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        e.preventDefault();
    });

    vSplitter.addEventListener('dblclick', () => {
        leftPanel.style.width = ''; // Reset to CSS default
    });

    // Horizontal Splitter (Top vs Bottom)
    let isDraggingH = false;

    hSplitter.addEventListener('mousedown', (e) => {
        isDraggingH = true;
        hSplitter.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
        e.preventDefault();
    });

    hSplitter.addEventListener('dblclick', () => {
        topPanel.style.height = ''; // Reset to CSS default
    });

    // Global Mouse Events
    document.addEventListener('mousemove', (e) => {
        if (isDraggingV) {
            const containerRect = container.getBoundingClientRect();
            const newLeftWidth = e.clientX - containerRect.left;

            // Constraints (min 200px, max container width - 200px)
            if (newLeftWidth > 200 && newLeftWidth < containerRect.width - 200) {
                const percentage = (newLeftWidth / containerRect.width) * 100;
                leftPanel.style.width = `${percentage}%`;
                // Right container takes remaining space via flex: 1
            }
        }

        if (isDraggingH) {
            const containerRect = rightContainer.getBoundingClientRect();
            const newTopHeight = e.clientY - containerRect.top;

            // Constraints (min 150px, max container height - 150px)
            if (newTopHeight > 150 && newTopHeight < containerRect.height - 150) {
                const percentage = (newTopHeight / containerRect.height) * 100;
                topPanel.style.height = `${percentage}%`;
                // Bottom panel takes remaining space via flex: 1
            }
        }
    });

    document.addEventListener('mouseup', () => {
        if (isDraggingV) {
            isDraggingV = false;
            vSplitter.classList.remove('dragging');
            document.body.style.cursor = '';
        }
        if (isDraggingH) {
            isDraggingH = false;
            hSplitter.classList.remove('dragging');
            document.body.style.cursor = '';
        }
    });
}
