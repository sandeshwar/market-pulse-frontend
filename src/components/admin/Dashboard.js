import { fetchAnalyticsData, createCharts } from '../../services/analyticsService.js';
import { createElement } from '../../utils/dom.js';

/**
 * Analytics Dashboard Component
 * Displays API usage analytics in a visual dashboard
 */
export default class Dashboard {
  constructor(container) {
    this.container = container;
    this.analyticsData = null;
    this.charts = {};
    this.refreshInterval = null;
    this.refreshRate = 30000; // 30 seconds refresh rate
  }

  /**
   * Initialize the dashboard
   */
  async init() {
    this.render();
    await this.loadData();
    this.startAutoRefresh();

    // Add event listeners
    const refreshBtn = document.getElementById('refresh-analytics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.loadData());
    }

    // Add refresh rate controls
    const refreshRateSelect = document.getElementById('refresh-rate');
    if (refreshRateSelect) {
      refreshRateSelect.addEventListener('change', (e) => {
        this.refreshRate = parseInt(e.target.value, 10);
        this.startAutoRefresh();
      });
    }
  }

  /**
   * Render the dashboard structure
   */
  render() {
    this.container.innerHTML = '';
    
    // Create dashboard header
    const header = createElement('div', { className: 'dashboard-header' }, [
      createElement('h1', { textContent: 'API Analytics Dashboard' }),
      createElement('div', { className: 'dashboard-controls' }, [
        createElement('select', { id: 'refresh-rate', className: 'refresh-rate-select' }, [
          createElement('option', { value: '5000', textContent: 'Refresh: 5s' }),
          createElement('option', { value: '30000', textContent: 'Refresh: 30s', selected: true }),
          createElement('option', { value: '60000', textContent: 'Refresh: 1m' }),
          createElement('option', { value: '300000', textContent: 'Refresh: 5m' }),
        ]),
        createElement('button', { id: 'refresh-analytics', className: 'refresh-btn', textContent: 'Refresh Now' }),
      ])
    ]);
    
    // Create dashboard grid
    const grid = createElement('div', { className: 'dashboard-grid' }, [
      // Summary cards
      createElement('div', { className: 'dashboard-card summary-card', id: 'total-requests' }, [
        createElement('h3', { textContent: 'Total Requests' }),
        createElement('div', { className: 'card-value', id: 'total-requests-value', textContent: 'Loading...' }),
      ]),
      
      createElement('div', { className: 'dashboard-card summary-card', id: 'avg-response-time' }, [
        createElement('h3', { textContent: 'Avg Response Time' }),
        createElement('div', { className: 'card-value', id: 'avg-response-time-value', textContent: 'Loading...' }),
      ]),
      
      createElement('div', { className: 'dashboard-card summary-card', id: 'error-rate' }, [
        createElement('h3', { textContent: 'Error Rate' }),
        createElement('div', { className: 'card-value', id: 'error-rate-value', textContent: 'Loading...' }),
      ]),
      
      createElement('div', { className: 'dashboard-card summary-card', id: 'last-request' }, [
        createElement('h3', { textContent: 'Last Request' }),
        createElement('div', { className: 'card-value', id: 'last-request-value', textContent: 'Loading...' }),
      ]),
      
      // Charts
      createElement('div', { className: 'dashboard-card chart-card', id: 'endpoints-chart-container' }, [
        createElement('h3', { textContent: 'Requests by Endpoint' }),
        createElement('canvas', { id: 'endpoints-chart' }),
      ]),
      
      createElement('div', { className: 'dashboard-card chart-card', id: 'response-times-chart-container' }, [
        createElement('h3', { textContent: 'Response Times (ms)' }),
        createElement('canvas', { id: 'response-times-chart' }),
      ]),
      
      // Tables
      createElement('div', { className: 'dashboard-card table-card', id: 'endpoints-table-container' }, [
        createElement('h3', { textContent: 'Endpoint Details' }),
        createElement('div', { className: 'table-responsive' }, [
          createElement('table', { className: 'endpoints-table', id: 'endpoints-table' }, [
            createElement('thead', {}, [
              createElement('tr', {}, [
                createElement('th', { textContent: 'Endpoint' }),
                createElement('th', { textContent: 'Requests' }),
                createElement('th', { textContent: 'Avg Time (ms)' }),
                createElement('th', { textContent: 'Errors' }),
              ])
            ]),
            createElement('tbody', { id: 'endpoints-table-body' }, [
              createElement('tr', {}, [
                createElement('td', { colSpan: 4, textContent: 'Loading data...' })
              ])
            ])
          ])
        ])
      ])
    ]);
    
    this.container.appendChild(header);
    this.container.appendChild(grid);
  }

  /**
   * Load analytics data from the API
   */
  async loadData() {
    try {
      this.analyticsData = await fetchAnalyticsData();
      this.updateDashboard();
    } catch (error) {
      console.error('Failed to load analytics data:', error);
      // Show error message on the dashboard
      const cards = document.querySelectorAll('.card-value');
      cards.forEach(card => {
        card.textContent = 'Error loading data';
        card.classList.add('error');
      });
    }
  }

  /**
   * Update the dashboard with the latest data
   */
  updateDashboard() {
    if (!this.analyticsData) return;

    // Update summary cards
    document.getElementById('total-requests-value').textContent = this.analyticsData.total_requests.toLocaleString();
    
    // Calculate average response time across all endpoints
    const avgTimes = Object.values(this.analyticsData.average_response_times_ms);
    const overallAvg = avgTimes.length > 0 
      ? (avgTimes.reduce((sum, time) => sum + time, 0) / avgTimes.length).toFixed(2) 
      : 0;
    document.getElementById('avg-response-time-value').textContent = `${overallAvg} ms`;
    
    // Calculate error rate
    const totalErrors = Object.values(this.analyticsData.error_counts)
      .reduce((sum, count) => sum + count, 0);
    const errorRate = this.analyticsData.total_requests > 0 
      ? ((totalErrors / this.analyticsData.total_requests) * 100).toFixed(2) 
      : 0;
    document.getElementById('error-rate-value').textContent = `${errorRate}%`;
    
    // Format last request time
    const lastRequestTime = new Date(this.analyticsData.last_request);
    const timeAgo = this.getTimeAgo(lastRequestTime);
    document.getElementById('last-request-value').textContent = timeAgo;
    
    // Update charts
    this.updateCharts();
    
    // Update endpoints table
    this.updateEndpointsTable();
  }

  /**
   * Update the charts with the latest data
   */
  updateCharts() {
    // Create or update charts using the analyticsData
    this.charts = createCharts(this.analyticsData, this.charts);
  }

  /**
   * Update the endpoints table with the latest data
   */
  updateEndpointsTable() {
    const tableBody = document.getElementById('endpoints-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Get all unique endpoints
    const endpoints = Object.keys(this.analyticsData.endpoint_counts);
    
    // Sort endpoints by request count (descending)
    endpoints.sort((a, b) => {
      return this.analyticsData.endpoint_counts[b] - this.analyticsData.endpoint_counts[a];
    });
    
    // Create table rows
    endpoints.forEach(endpoint => {
      const count = this.analyticsData.endpoint_counts[endpoint] || 0;
      const avgTime = this.analyticsData.average_response_times_ms[endpoint]?.toFixed(2) || 0;
      const errors = this.analyticsData.error_counts[endpoint] || 0;
      
      const row = createElement('tr', {}, [
        createElement('td', { textContent: endpoint }),
        createElement('td', { textContent: count.toLocaleString() }),
        createElement('td', { textContent: `${avgTime} ms` }),
        createElement('td', { textContent: errors.toLocaleString() }),
      ]);
      
      // Highlight rows with errors
      if (errors > 0) {
        row.classList.add('has-errors');
      }
      
      tableBody.appendChild(row);
    });
    
    // If no endpoints, show a message
    if (endpoints.length === 0) {
      const row = createElement('tr', {}, [
        createElement('td', { colSpan: 4, textContent: 'No data available' })
      ]);
      tableBody.appendChild(row);
    }
  }

  /**
   * Start auto-refreshing the dashboard
   */
  startAutoRefresh() {
    // Clear existing interval if any
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Set new interval
    this.refreshInterval = setInterval(() => this.loadData(), this.refreshRate);
  }

  /**
   * Clean up when the dashboard is removed
   */
  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Clean up chart instances
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
  }

  /**
   * Get a human-readable time ago string
   */
  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec} seconds ago`;
    
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} minutes ago`;
    
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hours ago`;
    
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 30) return `${diffDay} days ago`;
    
    // For older dates, just return the formatted date
    return date.toLocaleString();
  }
}