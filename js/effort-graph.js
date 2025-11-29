// Effort Graph Implementation

class EffortGraph {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            display: block;
            width: 100%;
            height: 100%;
            position: relative;
        `;
        this.container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.data = [];
        const storedThreshold = localStorage.getItem('effort_threshold');
        this.threshold = storedThreshold ? parseInt(storedThreshold, 10) : 8;
        this.isDragging = false;
        this.hoveringLine = false;

        this.margin = { top: 40, right: 20, bottom: 20, left: 50 }; // Reduced bottom margin since no labels
        this.barSpacing = 0; // No spacing

        // Create tooltip element
        this.tooltip = document.createElement('div');
        this.tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            display: none;
            z-index: 1000;
            font-family: 'Inter', sans-serif;
            white-space: nowrap;
        `;
        document.body.appendChild(this.tooltip);

        // Bind events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        window.addEventListener('resize', this.resize.bind(this));

        // Initial setup
        this.calculateRealData();
        this.resize();

        // Expose global render function
        window.renderEffortGraph = () => {
            this.calculateRealData();
            this.render();
        };
    }

    calculateRealData() {
        if (typeof CANDIDATES === 'undefined' || typeof SCHEDULE_DATA === 'undefined') {
            console.warn('CANDIDATES or SCHEDULE_DATA not found');
            return;
        }

        // Initialize map: Candidate ID -> { name, effort: 0, maxEffort: 0 }
        const candidateMap = new Map();
        CANDIDATES.forEach(c => {
            candidateMap.set(c.id, {
                name: c.name,
                effort: 0, // Assigned effort (currently 0 as no assignment logic exists)
                maxEffort: 0
            });
        });

        // Iterate through Schedule Data
        SCHEDULE_DATA.forEach(weekData => {
            const week = weekData.week;
            weekData.days.forEach(dayData => {
                const day = dayData.name;
                dayData.tasks.forEach(task => {
                    const processTask = (t) => {
                        const effort = parseFloat(t.effort) || 0;
                        if (effort === 0) return;

                        // 1. Calculate Assigned Effort
                        if (t.assignee) {
                            // Find candidate by name (case-insensitive)
                            const assigneeEntry = Array.from(candidateMap.values()).find(c => c.name.toLowerCase() === t.assignee.toLowerCase());
                            if (assigneeEntry) {
                                assigneeEntry.effort += effort;
                            }
                        }

                        // 2. Calculate Potential Max Effort (for background bars)
                        // Note: For groups, we might want to check candidates for the group or subtask.
                        // Assuming candidates are filtered per subtask or group.
                        let eligibleCandidates = [];

                        if (t.isGroup && t.candidates) {
                            eligibleCandidates = t.candidates;
                        } else {
                            // Use global check if available
                            eligibleCandidates = CANDIDATES.filter(c =>
                                (typeof hasRole === 'function' ? hasRole(c, t.name) : true) &&
                                (typeof isCandidateAvailable === 'function' ? isCandidateAvailable(c, t.name, t.time, week, day) : true)
                            );
                        }

                        eligibleCandidates.forEach(c => {
                            const entry = candidateMap.get(c.id);
                            if (entry) {
                                entry.maxEffort += effort;
                            }
                        });
                    };

                    if (task.isGroup) {
                        task.subTasks.forEach(processTask);
                    } else {
                        processTask(task);
                    }
                });
            });
        });

        // Convert map to array
        this.data = Array.from(candidateMap.values());

        // Sort by assigned effort ASCENDING (rising to the right)
        this.data.sort((a, b) => {
            // Primary: assigned effort (ascending)
            if (a.effort !== b.effort) return a.effort - b.effort;
            // Secondary: potential effort (ascending) for ties
            if (a.maxEffort !== b.maxEffort) return a.maxEffort - b.maxEffort;
            // Tertiary: name (ascending)
            return a.name.localeCompare(b.name);
        });
    }

    resize() {
        if (!this.container) return;
        const rect = this.container.getBoundingClientRect();

        // Handle high DPI
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;
        this.ctx.scale(dpr, dpr);

        this.width = rect.width;
        this.height = rect.height;

        this.render();
    }

    render() {
        if (!this.width || !this.height) return;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        if (this.data.length === 0) return;

        // Calculate scales
        // Scale based on ASSIGNED effort (plus buffer), let max potential go offscreen
        const maxAssigned = Math.max(...this.data.map(d => d.effort));
        // Ensure we have at least some height if no one is assigned
        const maxVal = Math.max(maxAssigned * 1.1, 16);

        // Y-Axis scale
        this.maxVal = maxVal; // Store for drag logic
        this.yScale = (this.height - this.margin.top - this.margin.bottom) / maxVal;
        const yScale = this.yScale;

        // X-Axis calculations - Dynamic Width
        const availableWidth = this.width - this.margin.left - this.margin.right;
        this.barWidth = availableWidth / this.data.length;

        const startX = this.margin.left;

        // Calculate Y-axis ticks (0, 2, 4, 6, 8, 10, ...)
        let tickInterval = 2;
        if (maxVal > 20) tickInterval = 5;
        if (maxVal > 50) tickInterval = 10;
        if (maxVal > 100) tickInterval = 20;

        const numTicks = Math.ceil(maxVal / tickInterval);

        // Draw Y-axis gridlines and labels
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;
        ctx.fillStyle = '#999';
        ctx.font = '11px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= numTicks; i++) {
            const value = i * tickInterval;
            const y = this.height - this.margin.bottom - (value * yScale);

            // Gridline
            ctx.beginPath();
            ctx.moveTo(this.margin.left, y);
            ctx.lineTo(this.width - this.margin.right, y);
            ctx.stroke();

            // Label
            ctx.fillText(value.toString(), this.margin.left - 5, y);
        }

        // Draw Bars
        this.data.forEach((d, i) => {
            const x = startX + i * this.barWidth;
            const yBase = this.height - this.margin.bottom;

            // Actual Effort Only (removed max effort background)
            const h = d.effort * yScale;
            // User wants to surpass threshold: Green if >= threshold, Red if < threshold
            ctx.fillStyle = d.effort >= this.threshold ? '#81c784' : '#e57373';
            ctx.fillRect(x, yBase - h, this.barWidth, h);

            // No Labels
        });

        // Draw Axes
        ctx.beginPath();
        ctx.strokeStyle = '#ddd';
        ctx.moveTo(this.margin.left, this.margin.top);
        ctx.lineTo(this.margin.left, this.height - this.margin.bottom);
        ctx.lineTo(this.width - this.margin.right, this.height - this.margin.bottom);
        ctx.stroke();

        // Draw Threshold Line
        const thresholdY = this.height - this.margin.bottom - (this.threshold * yScale);

        ctx.beginPath();
        ctx.strokeStyle = this.hoveringLine || this.isDragging ? '#4A90E2' : '#666';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(this.margin.left, thresholdY);
        ctx.lineTo(this.width - this.margin.right, thresholdY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Threshold Label
        ctx.fillStyle = this.hoveringLine || this.isDragging ? '#4A90E2' : '#666';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`Threshold = ${this.threshold}`, this.width - this.margin.right, thresholdY - 5);

        // Drag Handle (invisible but for logic)
        this.thresholdY = thresholdY;
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if hovering near threshold line
        if (Math.abs(y - this.thresholdY) < 10) {
            this.hoveringLine = true;
            this.canvas.style.cursor = 'ns-resize';
            this.tooltip.style.display = 'none'; // Hide tooltip when dragging/hovering line
        } else if (!this.isDragging) {
            this.hoveringLine = false;
            this.canvas.style.cursor = 'default';
        }

        if (this.isDragging) {
            // Calculate new threshold value from Y position
            // Use the same scale as render() to ensure 1:1 movement
            const yVal = this.height - this.margin.bottom - y;
            let newVal = Math.round(yVal / this.yScale);

            // Clamp
            // Limit to reasonable bounds (0 to maxVal)
            newVal = Math.max(0, Math.min(newVal, Math.ceil(this.maxVal)));

            if (newVal !== this.threshold) {
                this.threshold = newVal;
                localStorage.setItem('effort_threshold', this.threshold);
                this.render();
            }
        } else if (!this.hoveringLine) {
            // Tooltip Logic
            this.render(); // Re-render to clear hover effects if any (though we don't have bar hover effects yet)

            const startX = this.margin.left;
            const availableWidth = this.width - this.margin.left - this.margin.right;

            if (x >= startX && x <= startX + availableWidth) {
                const index = Math.floor((x - startX) / this.barWidth);
                if (index >= 0 && index < this.data.length) {
                    const d = this.data[index];

                    // Show Tooltip first to get dimensions
                    this.tooltip.style.display = 'block';
                    this.tooltip.innerHTML = `
                        <div style="font-weight: 600; margin-bottom: 4px;">${d.name}</div>
                        <div>Effort: ${d.effort}</div>
                    `;

                    // Calculate position
                    const tooltipRect = this.tooltip.getBoundingClientRect();
                    let left = e.pageX + 10;
                    let top = e.pageY + 10;

                    // Prevent going off right edge
                    if (left + tooltipRect.width > window.innerWidth) {
                        left = e.pageX - tooltipRect.width - 10;
                    }

                    // Prevent going off bottom edge
                    if (top + tooltipRect.height > window.innerHeight) {
                        top = e.pageY - tooltipRect.height - 10;
                    }

                    this.tooltip.style.left = `${left}px`;
                    this.tooltip.style.top = `${top}px`;

                    // Highlight bar?
                    // Optional: Draw a highlight overlay
                    const ctx = this.ctx;
                    const barX = startX + index * this.barWidth;
                    const yBase = this.height - this.margin.bottom;

                    const dataMax = Math.max(...this.data.map(d => d.maxEffort));
                    const maxVal = Math.max(dataMax * 1.1, 10);
                    const yScale = (this.height - this.margin.top - this.margin.bottom) / maxVal;
                    const maxH = d.maxEffort * yScale;

                    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.fillRect(barX, yBase - maxH, this.barWidth, maxH);
                } else {
                    this.tooltip.style.display = 'none';
                }
            } else {
                this.tooltip.style.display = 'none';
            }
        }
    }

    handleMouseLeave() {
        this.tooltip.style.display = 'none';
        this.hoveringLine = false;
        this.isDragging = false;
    }

    handleMouseDown(e) {
        if (this.hoveringLine) {
            this.isDragging = true;
        }
    }

    handleMouseUp() {
        this.isDragging = false;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Wait for layout to settle?
    setTimeout(() => {
        const graph = new EffortGraph('effort-panel-content');

        // Handle resize when splitter moves
        const observer = new ResizeObserver(() => {
            graph.resize();
        });
        observer.observe(document.getElementById('effort-panel'));
    }, 100);
});
