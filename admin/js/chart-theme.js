/**
 * Chart Theme Utility
 * Provides theme-aware chart configurations
 */

class ChartThemeUtil {
  /**
   * Get theme-aware chart configuration
   * @param {string} chartType - Type of chart ('line', 'bar', etc.)
   * @param {Object} data - Chart data
   * @param {Object} options - Additional chart options
   * @returns {Object} Chart configuration
   */
  static getConfig(chartType, data, options = {}) {
    const isDarkTheme = document.documentElement.classList.contains('theme-dark');
    
    // Set theme-specific colors
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDarkTheme ? '#a9adc1' : '#666';
    
    // Default options with theme awareness
    const themeOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: textColor
          }
        },
        tooltip: {
          backgroundColor: isDarkTheme ? '#323a52' : 'rgba(255, 255, 255, 0.9)',
          titleColor: isDarkTheme ? '#e4e6f0' : '#333',
          bodyColor: isDarkTheme ? '#a9adc1' : '#666',
          borderColor: isDarkTheme ? '#3a4055' : '#ddd',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        },
        y: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor
          }
        }
      }
    };
    
    // Merge with provided options
    const mergedOptions = this.mergeDeep(themeOptions, options);
    
    return {
      type: chartType,
      data: data,
      options: mergedOptions
    };
  }
  
  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  static mergeDeep(target, source) {
    const output = Object.assign({}, target);
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }
  
  /**
   * Check if value is an object
   * @param {*} item - Value to check
   * @returns {boolean} True if object
   */
  static isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }
  
  /**
   * Update all charts when theme changes
   * @param {Array} charts - Array of Chart.js instances
   */
  static updateCharts(charts) {
    if (!charts || !charts.length) return;
    
    charts.forEach(chart => {
      if (!chart) return;
      
      const isDarkTheme = document.documentElement.classList.contains('theme-dark');
      const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
      const textColor = isDarkTheme ? '#a9adc1' : '#666';
      
      // Update grid colors
      if (chart.options.scales?.x?.grid) {
        chart.options.scales.x.grid.color = gridColor;
      }
      
      if (chart.options.scales?.y?.grid) {
        chart.options.scales.y.grid.color = gridColor;
      }
      
      // Update tick colors
      if (chart.options.scales?.x?.ticks) {
        chart.options.scales.x.ticks.color = textColor;
      }
      
      if (chart.options.scales?.y?.ticks) {
        chart.options.scales.y.ticks.color = textColor;
      }
      
      // Update legend colors
      if (chart.options.plugins?.legend?.labels) {
        chart.options.plugins.legend.labels.color = textColor;
      }
      
      // Update tooltip styles
      if (chart.options.plugins?.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = isDarkTheme ? '#323a52' : 'rgba(255, 255, 255, 0.9)';
        chart.options.plugins.tooltip.titleColor = isDarkTheme ? '#e4e6f0' : '#333';
        chart.options.plugins.tooltip.bodyColor = isDarkTheme ? '#a9adc1' : '#666';
        chart.options.plugins.tooltip.borderColor = isDarkTheme ? '#3a4055' : '#ddd';
      }
      
      // Update the chart
      chart.update();
    });
  }
}

// Listen for theme changes to update charts
document.addEventListener('DOMContentLoaded', () => {
  // Make utility available globally
  window.ChartThemeUtil = ChartThemeUtil;
  
  // Set up observer for theme changes
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.attributeName === 'class' && 
          mutation.target === document.documentElement) {
        // If charts are stored globally, update them
        if (window.adminPageInstance?.charts) {
          ChartThemeUtil.updateCharts(window.adminPageInstance.charts);
        }
      }
    });
  });
  
  // Start observing theme changes
  observer.observe(document.documentElement, { attributes: true });
});