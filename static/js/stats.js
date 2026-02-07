/**
 * Stats/Charts JavaScript
 * Handles chart rendering with proper instance management
 */

// Store chart instances globally to destroy them when updating
let categoryChartInstance = null;
let monthlyChartInstance = null;

/**
 * Initialize charts with data from the page
 * This function is called after stats.html is loaded into the page
 */
function initializeCharts(categoryFilter, timeRange, startDate, endDate) {
    let url = '/api/chart-data';
    const params = [];
    
    if (categoryFilter) params.push(`category=${categoryFilter}`);
    if (timeRange) params.push(`range=${timeRange}`);
    if (startDate) params.push(`start_date=${startDate}`);
    if (endDate) params.push(`end_date=${endDate}`);
    
    if (params.length > 0) {
        url += '?' + params.join('&');
    }
    
    fetch(url)
        .then(response => response.json())
        .then(data => {
            renderCategoryChart(data.categories);
            renderMonthlyChart(data.monthly);
        })
        .catch(error => {
            console.error('Error loading chart data:', error);
        });
}

/**
 * Render category doughnut chart
 */
function renderCategoryChart(data) {
    const categoryCtx = document.getElementById('categoryChart');
    if (!categoryCtx || !data.labels || data.labels.length === 0) return;
    
    // Destroy existing chart if it exists
    if (categoryChartInstance) {
        categoryChartInstance.destroy();
    }
    
    categoryChartInstance = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: data.labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
            datasets: [{
                label: 'Expenses',
                data: data.expenses,
                backgroundColor: [
                    '#d63031', '#0984e3', '#d63384', '#e17055',
                    '#00b894', '#6c5ce7', '#636e72', '#fdcb6e',
                    '#ff7675', '#74b9ff'
                ],
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
 * Render monthly line chart
 */
function renderMonthlyChart(data) {
    const monthlyCtx = document.getElementById('monthlyChart');
    if (!monthlyCtx || !data.labels || data.labels.length === 0) return;
    
    // Destroy existing chart if it exists
    if (monthlyChartInstance) {
        monthlyChartInstance.destroy();
    }
    
    monthlyChartInstance = new Chart(monthlyCtx, {
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
                intersect: false,
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

// Make function globally available
window.initializeCharts = initializeCharts;
