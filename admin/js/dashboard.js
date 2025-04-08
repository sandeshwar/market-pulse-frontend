import { fetchAnalyticsData, createCharts } from './analyticsService.js';
import adminSettings from './adminSettings.js';

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
    
    // Get refresh rate from settings or use default
    const settings = adminSettings.getSettings();
    this.refreshRate = settings.refreshRate || 30000; // Default to 30 seconds if not set
    
    // Listen for settings changes
    adminSettings.addListener(settings => {
      if (settings.refreshRate !== this.refreshRate) {
        this.refreshRate = settings.refreshRate;
        this.restartAutoRefresh();
      }
    });
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
        const newRate = parseInt(e.target.value, 10);
        this.refreshRate = newRate;
        this.startAutoRefresh();
        
        // Update admin settings to keep in sync
        adminSettings.updateSetting('refreshRate', newRate);
      });
    }
  }

  /**
   * Render the dashboard structure
   */
  render() {
    this.container.innerHTML = '';
    
    // Create dashboard header
    const header = document.createElement('div');
    header.className = 'dashboard-header';
    header.innerHTML = `
      <h1>API Analytics Dashboard</h1>
      <div class="dashboard-controls">
        <select id="refresh-rate" class="refresh-rate-select">
          <option value="5000" ${this.refreshRate === 5000 ? 'selected' : ''}>Refresh: 5s</option>
          <option value="30000" ${this.refreshRate === 30000 ? 'selected' : ''}>Refresh: 30s</option>
          <option value="60000" ${this.refreshRate === 60000 ? 'selected' : ''}>Refresh: 1m</option>
          <option value="300000" ${this.refreshRate === 300000 ? 'selected' : ''}>Refresh: 5m</option>
        </select>
        <span id="current-refresh-rate" class="current-refresh-rate">${this.refreshRate / 1000} seconds</span>
        <button id="refresh-analytics" class="refresh-btn">Refresh Now</button>
      </div>
    `;
    
    // Create dashboard grid
    const grid = document.createElement('div');
    grid.className = 'dashboard-grid';
    grid.innerHTML = `
      <!-- Summary cards -->
      <div class="dashboard-card summary-card" id="total-requests">
        <h3>Total Requests</h3>
        <div class="card-value" id="total-requests-value">Loading...</div>
      </div>
      
      <div class="dashboard-card summary-card" id="avg-response-time">
        <h3>Avg Response Time</h3>
        <div class="card-value" id="avg-response-time-value">Loading...</div>
      </div>
      
      <div class="dashboard-card summary-card" id="error-rate">
        <h3>Error Rate</h3>
        <div class="card-value" id="error-rate-value">Loading...</div>
      </div>
      
      <div class="dashboard-card summary-card" id="last-request">
        <h3>Last Request</h3>
        <div class="card-value" id="last-request-value">Loading...</div>
      </div>
      
      <!-- Charts -->
      <div class="dashboard-card chart-card" id="endpoints-chart-container">
        <h3>Requests by Endpoint</h3>
        <canvas id="endpoints-chart"></canvas>
      </div>
      
      <div class="dashboard-card chart-card" id="response-times-chart-container">
        <h3>Response Times (ms)</h3>
        <canvas id="response-times-chart"></canvas>
      </div>
      
      <!-- Tables -->
      <div class="dashboard-card table-card" id="endpoints-table-container">
        <h3>Endpoint Details</h3>
        <div class="table-responsive">
          <table class="endpoints-table" id="endpoints-table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Requests</th>
                <th>Avg Time (ms)</th>
                <th>Errors</th>
              </tr>
            </thead>
            <tbody id="endpoints-table-body">
              <tr>
                <td colspan="4">Loading data...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    
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
      
      const row = document.createElement('tr');
      if (errors > 0) {
        row.classList.add('has-errors');
      }
      
      row.innerHTML = `
        <td>${endpoint}</td>
        <td>${count.toLocaleString()}</td>
        <td>${avgTime} ms</td>
        <td>${errors.toLocaleString()}</td>
      `;
      
      tableBody.appendChild(row);
    });
    
    // If no endpoints, show a message
    if (endpoints.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="4">No data available</td>';
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
    
    // Update the refresh rate display if it exists
    const refreshRateSelect = document.getElementById('refresh-rate');
    if (refreshRateSelect) {
      refreshRateSelect.value = this.refreshRate.toString();
    }
    
    // Update the refresh rate display text
    const refreshRateText = document.getElementById('current-refresh-rate');
    if (refreshRateText) {
      const seconds = this.refreshRate / 1000;
      refreshRateText.textContent = `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
    }
  }
  
  /**
   * Restart auto-refresh with new settings
   */
  restartAutoRefresh() {
    // Only restart if already running
    if (this.refreshInterval) {
      this.startAutoRefresh();
    }
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