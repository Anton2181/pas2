// Canvas Search Functionality

function initCanvasSearch() {
    const searchBtn = document.getElementById('canvas-search-btn');
    const searchContainer = document.getElementById('canvas-search-container');
    const searchInput = document.getElementById('canvas-search-input');
    const searchResults = document.getElementById('canvas-search-results');

    if (!searchBtn || !searchContainer || !searchInput || !searchResults) return;

    // Toggle search container
    searchBtn.addEventListener('click', () => {
        const isActive = searchContainer.classList.contains('active');

        if (isActive) {
            // Close search
            searchContainer.classList.remove('active');
            searchResults.classList.remove('active');
            searchInput.value = '';
        } else {
            // Open search
            searchContainer.classList.add('active');
            setTimeout(() => searchInput.focus(), 300);
        }
    });

    // Handle search input
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();

        if (query === '') {
            searchResults.classList.remove('active');
            searchResults.innerHTML = '';
            return;
        }

        performCanvasSearch(query);
    });

    // Close search when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target) && !searchBtn.contains(e.target)) {
            searchContainer.classList.remove('active');
            searchResults.classList.remove('active');
            searchInput.value = '';
        }
    });

    // Handle escape key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchContainer.classList.remove('active');
            searchResults.classList.remove('active');
            searchInput.value = '';
        }
    });
}

function performCanvasSearch(query) {
    const searchResults = document.getElementById('canvas-search-results');
    const results = [];

    // Search through canvas tasks
    state.canvasTasks.forEach(task => {
        if (task.name.toLowerCase().includes(query)) {
            results.push({
                type: 'task',
                name: task.name,
                instanceId: task.instanceId,
                priority: task.priority,
                elementId: `task-${task.instanceId}`
            });
        }
    });

    // Search through groups
    state.groups.forEach(group => {
        if (group.title.toLowerCase().includes(query)) {
            results.push({
                type: 'group',
                name: group.title,
                id: group.id,
                elementId: `group-${group.id}`
            });
        }
    });

    // Display results
    displaySearchResults(results);
}

function displaySearchResults(results) {
    const searchResults = document.getElementById('canvas-search-results');

    if (results.length === 0) {
        searchResults.innerHTML = '<div style="padding: 12px; color: var(--text-secondary); text-align: center;">No results found</div>';
        searchResults.classList.add('active');
        return;
    }

    // Group tasks by name to show priority badges
    const tasksByName = {};
    const groupResults = [];

    results.forEach(result => {
        if (result.type === 'task') {
            if (!tasksByName[result.name]) {
                tasksByName[result.name] = [];
            }
            tasksByName[result.name].push(result);
        } else {
            groupResults.push(result);
        }
    });

    // Sort tasks within each name by priority
    Object.values(tasksByName).forEach(tasks => {
        tasks.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    });

    searchResults.innerHTML = '';

    // Render task results
    Object.entries(tasksByName).forEach(([name, tasks]) => {
        tasks.forEach((task, index) => {
            const item = document.createElement('div');
            item.className = 'canvas-search-result-item';

            const leftSide = document.createElement('div');
            leftSide.style.display = 'flex';
            leftSide.style.alignItems = 'center';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'canvas-search-result-name';
            nameSpan.textContent = task.name;
            leftSide.appendChild(nameSpan);

            // Show badge if there are multiple instances
            if (tasks.length > 1) {
                const badge = document.createElement('span');
                badge.className = 'canvas-search-result-badge';
                badge.textContent = task.priority || (index + 1);
                leftSide.appendChild(badge);
            }

            const typeSpan = document.createElement('span');
            typeSpan.className = 'canvas-search-result-type';
            typeSpan.textContent = 'Task';

            item.appendChild(leftSide);
            item.appendChild(typeSpan);

            item.addEventListener('click', () => {
                navigateToElement(task.elementId);
                closeSearch();
            });

            searchResults.appendChild(item);
        });
    });

    // Render group results
    groupResults.forEach(group => {
        const item = document.createElement('div');
        item.className = 'canvas-search-result-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'canvas-search-result-name';
        nameSpan.textContent = group.name;

        const typeSpan = document.createElement('span');
        typeSpan.className = 'canvas-search-result-type';
        typeSpan.textContent = 'Group';

        item.appendChild(nameSpan);
        item.appendChild(typeSpan);

        item.addEventListener('click', () => {
            navigateToElement(group.elementId);
            closeSearch();
        });

        searchResults.appendChild(item);
    });

    searchResults.classList.add('active');
}

function navigateToElement(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const container = elements.canvasContainer;
    // Get the element's absolute position from its style (since they are absolute positioned)
    const elementLeft = parseFloat(element.style.left);
    const elementTop = parseFloat(element.style.top);
    const elementWidth = element.offsetWidth;
    const elementHeight = element.offsetHeight;

    // Calculate the center of the element in canvas coordinates
    const centerX = elementLeft + (elementWidth / 2);
    const centerY = elementTop + (elementHeight / 2);

    // Calculate the target scroll position to center the element in the viewport
    // Target Scroll = (Center * Zoom) - (Viewport / 2)
    const targetScrollLeft = (centerX * state.zoomLevel) - (container.clientWidth / 2);
    const targetScrollTop = (centerY * state.zoomLevel) - (container.clientHeight / 2);

    // Smooth scroll to the element
    container.scrollTo({
        left: targetScrollLeft,
        top: targetScrollTop,
        behavior: 'smooth'
    });

    // Highlight the element briefly
    highlightElement(element);
}

function highlightElement(element) {
    // Add a temporary highlight effect
    const originalBoxShadow = element.style.boxShadow;
    const originalTransition = element.style.transition;

    element.style.transition = 'box-shadow 0.3s ease';
    element.style.boxShadow = '0 0 0 4px var(--accent-primary), 0 0 20px rgba(0, 0, 0, 0.3)';

    setTimeout(() => {
        element.style.boxShadow = originalBoxShadow;
        setTimeout(() => {
            element.style.transition = originalTransition;
        }, 300);
    }, 1500);
}

function closeSearch() {
    const searchContainer = document.getElementById('canvas-search-container');
    const searchResults = document.getElementById('canvas-search-results');
    const searchInput = document.getElementById('canvas-search-input');

    if (searchContainer) searchContainer.classList.remove('active');
    if (searchResults) searchResults.classList.remove('active');
    if (searchInput) searchInput.value = '';
}
