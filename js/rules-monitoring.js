// Rules Monitoring Implementation

class RulesMonitoring {
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

        // Add Header Controls (Toggle + Total)
        const header = this.container.querySelector('.panel-header');
        if (header && !header.querySelector('.header-controls')) {
            const controls = document.createElement('div');
            controls.className = 'header-controls';
            controls.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                margin-left: auto;
            `;

            // Toggle Button
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'toggle-all-btn';
            toggleBtn.textContent = 'Expand All';
            toggleBtn.style.cssText = `
                background: none;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                cursor: pointer;
                color: #666;
                transition: all 0.2s;
            `;

            toggleBtn.onclick = () => {
                const allRows = this.content.querySelectorAll('.rule-row');
                const isExpanded = toggleBtn.textContent === 'Collapse All';

                allRows.forEach(row => {
                    if (isExpanded) {
                        row.classList.remove('expanded');
                    } else {
                        row.classList.add('expanded');
                    }
                });

                toggleBtn.textContent = isExpanded ? 'Expand All' : 'Collapse All';
            };

            // Total Penalty Counter
            const totalCounter = document.createElement('div');
            totalCounter.className = 'total-penalty-counter';
            totalCounter.style.cssText = `
                font-weight: 600;
                font-size: 13px;
                color: #d32f2f;
                background: #ffebee;
                padding: 4px 8px;
                border-radius: 4px;
            `;

            controls.appendChild(toggleBtn);
            controls.appendChild(totalCounter);
            header.appendChild(controls);
        }

        this.rules = [
            { id: 'effort', name: 'Effort threshold not met', penalty: 5000, variant: 1 },
            { id: 'two_days', name: 'Two working days a week', penalty: 2000, variant: 2 },
            { id: 'two_days_sun', name: 'Two working days a week (Sunday)', penalty: 3000, variant: 3 },
            { id: 'no_teaching', name: 'No teaching task assigned', penalty: 1500, variant: 4 },
            { id: 'single_task', name: 'Single-task day', penalty: 1000, variant: 5 },
            { id: 'repeat', name: 'Repeat task', penalty: 500, variant: 6 }
        ];

        // Load saved penalties
        try {
            const savedPenalties = localStorage.getItem('rule_penalties');
            if (savedPenalties) {
                const parsed = JSON.parse(savedPenalties);
                this.rules.forEach(rule => {
                    if (parsed[rule.id]) {
                        rule.penalty = parsed[rule.id];
                    }
                });
            }
        } catch (e) {
            console.error('Error loading rule penalties', e);
        }

        // Generate dummy data
        this.generateDummyData();

        // Render
        this.render();
    }

    savePenalties() {
        const penalties = {};
        this.rules.forEach(r => penalties[r.id] = r.penalty);
        localStorage.setItem('rule_penalties', JSON.stringify(penalties));
    }

    generateDummyData() {
        const candidates = typeof CANDIDATES !== 'undefined' ? CANDIDATES : [
            { name: 'Maria' }, { name: 'Juan' }, { name: 'Sofia' }
        ];

        const tasks = ['Group Lesson', 'Private Lesson', 'DJ Set', 'Bar Shift'];

        this.rules.forEach(rule => {
            // Random number of violations (0-5)
            const count = Math.floor(Math.random() * 6);
            rule.violations = [];

            for (let i = 0; i < count; i++) {
                const candidate = candidates[Math.floor(Math.random() * candidates.length)];
                const task = tasks[Math.floor(Math.random() * tasks.length)];
                const day = Math.floor(Math.random() * 28) + 1;

                rule.violations.push({
                    name: candidate.name,
                    task: task,
                    date: `Dec ${day}`
                });
            }
        });
    }

    render() {
        this.content.innerHTML = '';

        // Sort by total score (descending)
        const sortedRules = [...this.rules].sort((a, b) => {
            const totalA = a.violations.length * a.penalty;
            const totalB = b.violations.length * b.penalty;
            return totalB - totalA;
        });

        sortedRules.forEach(rule => {
            const count = rule.violations.length;
            const total = count * rule.penalty;

            const row = document.createElement('div');
            row.className = `rule-row variant-${rule.variant}`;
            row.dataset.id = rule.id; // Store ID for FLIP

            // Header
            const header = document.createElement('div');
            header.className = 'rule-header';
            header.innerHTML = `
                <div class="rule-name">${rule.name}</div>
                <div class="rule-equation">
                    <span>${count}</span>
                    <span>×</span>
                    <input type="text" class="rule-input" value="${rule.penalty}" data-id="${rule.id}">
                    <span>=</span>
                    <span class="rule-total">${total.toLocaleString()}</span>
                </div>
                <div class="rule-info-btn" title="Click for details">i</div>
            `;

            // Details (Violations)
            const details = document.createElement('div');
            details.className = 'rule-details';

            const inner = document.createElement('div');
            inner.className = 'rule-details-inner';
            details.appendChild(inner);

            if (count > 0) {
                rule.violations.forEach(v => {
                    const item = document.createElement('div');
                    item.className = 'violation-item';
                    item.innerHTML = `
                        <span class="violation-name">${v.name}</span>
                        <span class="violation-task">${v.task} - ${v.date}</span>
                    `;
                    inner.appendChild(item);
                });
            } else {
                const empty = document.createElement('div');
                empty.className = 'violation-item';
                empty.style.fontStyle = 'italic';
                empty.textContent = 'No violations found';
                inner.appendChild(empty);
            }

            row.appendChild(header);
            row.appendChild(details);
            this.content.appendChild(row);

            // Event Listeners

            // Expand/Collapse
            header.addEventListener('click', (e) => {
                // Don't expand if clicking input
                if (e.target.classList.contains('rule-input')) return;

                row.classList.toggle('expanded');
            });

            // Edit Penalty
            const input = header.querySelector('.rule-input');
            input.addEventListener('click', (e) => e.stopPropagation()); // Prevent collapse

            let debounceTimer;
            input.addEventListener('input', (e) => {
                // Allow numbers only
                let val = e.target.value.replace(/[^0-9]/g, '');
                e.target.value = val;

                const newPenalty = parseInt(val) || 0;
                rule.penalty = newPenalty;

                // Update Total
                const newTotal = count * newPenalty;
                header.querySelector('.rule-total').textContent = newTotal.toLocaleString();

                // Update Global Total
                this.updateTotalPenalty();

                // Save
                this.savePenalties();

                // Trigger Sort with FLIP
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    this.updateSorting();
                }, 600); // Wait for user to stop typing
            });
        });

        this.updateTotalPenalty();
    }

    updateTotalPenalty() {
        const total = this.rules.reduce((sum, rule) => {
            return sum + (rule.violations.length * rule.penalty);
        }, 0);

        const counter = this.container.querySelector('.total-penalty-counter');
        if (counter) {
            counter.textContent = `Total Penalty: ${total.toLocaleString()}`;
        }
    }

    updateSorting() {
        // FLIP Animation
        const rows = Array.from(this.content.querySelectorAll('.rule-row'));

        // 1. First: Record positions
        const firstPositions = new Map();
        rows.forEach(row => {
            firstPositions.set(row.dataset.id, row.getBoundingClientRect().top);
        });

        // 2. Last: Re-order DOM
        const sortedRows = rows.sort((a, b) => {
            const ruleA = this.rules.find(r => r.id === a.dataset.id);
            const ruleB = this.rules.find(r => r.id === b.dataset.id);

            const totalA = ruleA.violations.length * ruleA.penalty;
            const totalB = ruleB.violations.length * ruleB.penalty;
            return totalB - totalA;
        });

        sortedRows.forEach(row => this.content.appendChild(row));

        // 3. Invert: Calculate delta and apply transform
        sortedRows.forEach(row => {
            const first = firstPositions.get(row.dataset.id);
            const last = row.getBoundingClientRect().top;
            const delta = first - last;

            if (delta !== 0) {
                row.style.transform = `translateY(${delta}px)`;
                row.style.transition = 'none';
            }
        });

        // Force reflow
        this.content.offsetHeight;

        // 4. Play: Remove transform and animate
        sortedRows.forEach(row => {
            row.style.transform = '';
            row.style.transition = 'transform 0.5s ease';
        });

        // Clean up transition property after animation
        setTimeout(() => {
            sortedRows.forEach(row => {
                row.style.transition = '';
            });
        }, 500);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Wait for layout
    setTimeout(() => {
        new RulesMonitoring('rules-panel');
    }, 200);
});
