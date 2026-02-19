/**
 * Stats/Charts JavaScript
 * Charts are created once and updated in-place using chart.data + chart.update().
 * The <canvas> elements live in the stable page shell (summary.html), not in the
 * HTMX-swapped partial, so they are never torn down between filter changes.
 */

let categoryChartInstance = null;
let monthlyChartInstance = null;

const CATEGORY_COLORS = [
    '#d63031', '#0984e3', '#d63384', '#e17055',
    '#00b894', '#6c5ce7', '#636e72', '#fdcb6e',
    '#ff7675', '#74b9ff'
];

/**
 * Called by the inline <script> in stats.html after each HTMX swap.
 * categoryBreakdown: array of [name, expenses, income] tuples from the server.
 * monthly: array of [month_str, expenses, income] tuples from the server.
 * selectedCategory: string, may be empty.
 */
function updateCharts(categoryBreakdown, monthly, selectedCategory) {
    const chartsContainer = document.getElementById('charts-container');
    const categoryTitleEl = document.getElementById('category-chart-title');
    const monthlyTitleEl = document.getElementById('monthly-chart-title');

    const prefix = selectedCategory ? selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1) + ' — ' : '';

    if (categoryTitleEl) categoryTitleEl.textContent = prefix + 'Category Distribution';
    if (monthlyTitleEl) monthlyTitleEl.textContent = prefix + 'Monthly Trend';

    const categoryData = {
        labels: categoryBreakdown.map(c => c[0].charAt(0).toUpperCase() + c[0].slice(1)),
        expenses: categoryBreakdown.map(c => c[1])
    };

    const monthlyData = {
        labels: monthly.map(m => m[0]),
        income: monthly.map(m => m[2]),
        expenses: monthly.map(m => m[1])
    };

    const hasData = monthly.length > 0;

    if (chartsContainer) {
        chartsContainer.style.display = hasData ? '' : 'none';
    }

    if (!hasData) return;

    updateCategoryChart(categoryData);
    updateMonthlyChart(monthlyData);
}

/**
 * Creates the category doughnut chart on first call; updates data on subsequent calls.
 */
function updateCategoryChart(data) {
    const ctx = document.getElementById('categoryChart');
    if (!ctx) return;

    if (categoryChartInstance) {
        categoryChartInstance.data.labels = data.labels;
        categoryChartInstance.data.datasets[0].data = data.expenses;
        categoryChartInstance.update();
        return;
    }

    categoryChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                label: 'Expenses',
                data: data.expenses,
                backgroundColor: CATEGORY_COLORS,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': $' + context.parsed.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Creates the monthly line chart on first call; updates data on subsequent calls.
 */
function updateMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx) return;

    if (monthlyChartInstance) {
        monthlyChartInstance.data.labels = data.labels;
        monthlyChartInstance.data.datasets[0].data = data.income;
        monthlyChartInstance.data.datasets[1].data = data.expenses;
        monthlyChartInstance.update();
        return;
    }

    monthlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                {
                    label: 'Income',
                    data: data.income,
                    borderColor: '#00b894',
                    backgroundColor: 'rgba(0, 184, 148, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#00b894',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                },
                {
                    label: 'Expenses',
                    data: data.expenses,
                    borderColor: '#d63031',
                    backgroundColor: 'rgba(214, 48, 49, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointBackgroundColor: '#d63031',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': $' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return '$' + value.toFixed(0);
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Fetches fresh chart data for the given query string and updates charts in-place.
 * Called by filter_component.js when filters change on a page that has charts.
 */
function refreshCharts(queryString) {
    const url = '/api/chart-data' + (queryString ? '?' + queryString : '');

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const categoryBreakdown = data.categories.labels.map((label, i) => [
                label,
                data.categories.expenses[i],
                data.categories.income[i]
            ]);
            const monthly = data.monthly.labels.map((label, i) => [
                label,
                data.monthly.expenses[i],
                data.monthly.income[i]
            ]);
            updateCharts(categoryBreakdown, monthly, '');
        })
        .catch(error => {
            console.error('Error refreshing chart data:', error);
        });
}

/**
 * Fetches the stats partial and renders it into #stats-container.
 * Also refreshes charts since innerHTML does not execute <script> tags.
 * Called on page load and whenever transactions change.
 */
async function loadStats() {
    const container = document.getElementById('stats-container');
    if (!container) return;

    try {
        const response = await fetch('/api/stats' + window.location.search);
        const html = await response.text();
        container.innerHTML = html;

        // innerHTML does not execute <script> tags, so drive the chart
        // update directly rather than relying on the inline script in stats.html
        const params = window.location.search.slice(1);
        refreshCharts(params);
    } catch (error) {
        console.error('Error loading stats:', error);
        container.innerHTML = '<p style="color: #d63031;">Error loading statistics.</p>';
    }
}

window.updateCharts = updateCharts;
window.refreshCharts = refreshCharts;
window.loadStats = loadStats;
