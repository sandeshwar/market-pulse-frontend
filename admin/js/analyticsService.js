/**
 * Analytics Service
 * Handles fetching analytics data from the API
 */

/**
 * Fetch analytics data from the API
 * @returns {Promise<Object>} The analytics data
 */
export async function fetchAnalyticsData() {
  try {
    // Get the API URL from config or environment
    const apiUrl = window.API_BASE_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/analytics`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch analytics data: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    throw error;
  }
}

/**
 * Update analytics configuration
 * @param {boolean} enableTracking - Whether to enable analytics tracking
 * @returns {Promise<Object>} Updated configuration
 */
export async function updateAnalyticsConfig(enableTracking) {
  try {
    // Get the API URL from config or environment
    const apiUrl = window.API_BASE_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/analytics/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enable_tracking: enableTracking })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update analytics config: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating analytics config:', error);
    throw error;
  }
}

/**
 * Create or update charts with analytics data
 * @param {Object} data - The analytics data
 * @param {Object} existingCharts - Existing chart instances
 * @returns {Object} Updated chart instances
 */
export function createCharts(data, existingCharts = {}) {
  // Make sure Chart.js is available
  if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded. Please include Chart.js in your project.');
    return existingCharts;
  }
  
  const charts = { ...existingCharts };
  
  // Create endpoints chart
  charts.endpointsChart = createOrUpdateEndpointsChart(data, charts.endpointsChart);
  
  // Create response times chart
  charts.responseTimesChart = createOrUpdateResponseTimesChart(data, charts.responseTimesChart);
  
  return charts;
}

/**
 * Create or update the endpoints chart
 * @param {Object} data - The analytics data
 * @param {Chart} existingChart - Existing chart instance
 * @returns {Chart} The chart instance
 */
function createOrUpdateEndpointsChart(data, existingChart) {
  const canvas = document.getElementById('endpoints-chart');
  if (!canvas) return existingChart;
  
  // Prepare data for the chart
  const endpoints = Object.keys(data.endpoint_counts);
  const counts = endpoints.map(endpoint => data.endpoint_counts[endpoint]);
  
  // Sort by count (descending)
  const sortedIndices = counts.map((_, i) => i)
    .sort((a, b) => counts[b] - counts[a]);
  
  // Take top 10 endpoints
  const top10Indices = sortedIndices.slice(0, 10);
  const top10Endpoints = top10Indices.map(i => formatEndpointName(endpoints[i]));
  const top10Counts = top10Indices.map(i => counts[i]);
  
  // Chart configuration
  const chartConfig = {
    type: 'bar',
    data: {
      labels: top10Endpoints,
      datasets: [{
        label: 'Request Count',
        data: top10Counts,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: function(tooltipItems) {
              // Show the full endpoint name in tooltip
              const index = tooltipItems[0].dataIndex;
              return endpoints[sortedIndices[index]];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Number of Requests'
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  };
  
  // Create or update chart
  if (existingChart) {
    existingChart.data.labels = chartConfig.data.labels;
    existingChart.data.datasets[0].data = chartConfig.data.datasets[0].data;
    existingChart.update();
    return existingChart;
  } else {
    return new Chart(canvas, chartConfig);
  }
}

/**
 * Create or update the response times chart
 * @param {Object} data - The analytics data
 * @param {Chart} existingChart - Existing chart instance
 * @returns {Chart} The chart instance
 */
function createOrUpdateResponseTimesChart(data, existingChart) {
  const canvas = document.getElementById('response-times-chart');
  if (!canvas) return existingChart;
  
  // Prepare data for the chart
  const endpoints = Object.keys(data.average_response_times_ms);
  const responseTimes = endpoints.map(endpoint => data.average_response_times_ms[endpoint]);
  
  // Sort by response time (descending)
  const sortedIndices = responseTimes.map((_, i) => i)
    .sort((a, b) => responseTimes[b] - responseTimes[a]);
  
  // Take top 10 endpoints with highest response times
  const top10Indices = sortedIndices.slice(0, 10);
  const top10Endpoints = top10Indices.map(i => formatEndpointName(endpoints[i]));
  const top10Times = top10Indices.map(i => responseTimes[i]);
  
  // Chart configuration
  const chartConfig = {
    type: 'bar',
    data: {
      labels: top10Endpoints,
      datasets: [{
        label: 'Average Response Time (ms)',
        data: top10Times,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgba(255, 99, 132, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            title: function(tooltipItems) {
              // Show the full endpoint name in tooltip
              const index = tooltipItems[0].dataIndex;
              return endpoints[sortedIndices[index]];
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Response Time (ms)'
          }
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45
          }
        }
      }
    }
  };
  
  // Create or update chart
  if (existingChart) {
    existingChart.data.labels = chartConfig.data.labels;
    existingChart.data.datasets[0].data = chartConfig.data.datasets[0].data;
    existingChart.update();
    return existingChart;
  } else {
    return new Chart(canvas, chartConfig);
  }
}

/**
 * Format endpoint name for display
 * @param {string} endpoint - The full endpoint path
 * @returns {string} Shortened endpoint name
 */
function formatEndpointName(endpoint) {
  // Extract the path part (remove HTTP method)
  const parts = endpoint.split(' ');
  if (parts.length < 2) return endpoint;
  
  const path = parts[1];
  
  // Handle normalized paths with placeholders
  if (path.includes('/:')) {
    // For normalized paths like "/api/market-data/news/ticker/:symbol"
    // Extract the meaningful part and keep the placeholder
    const segments = path.split('/');
    if (segments.length <= 3) return path;
    
    // Return the last 2 segments (including the placeholder)
    return '/' + segments.slice(-2).join('/');
  }
  
  // Shorten the path for display
  // For example: "/api/market-data/stocks" -> "/stocks"
  const segments = path.split('/');
  if (segments.length <= 3) return path;
  
  // Return the last 2 segments
  return '/' + segments.slice(-2).join('/');
}