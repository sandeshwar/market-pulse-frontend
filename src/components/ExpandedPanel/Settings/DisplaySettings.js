import { createSelect } from '../../common/Select/Select.js';

export function createDisplaySettings() {
  return `
    <div class="settings-content">
      <div class="settings-group">
        <label class="settings-label">Theme</label>
        ${createSelect({
          id: 'theme-select',
          options: [
            { value: 'system', label: 'System Default' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' }
          ]
        })}
      </div>

      <div class="settings-group">
        <label class="settings-label">Price Display</label>
        ${createSelect({
          id: 'price-format',
          options: [
            { value: 'decimal', label: 'Decimal (1,234.56)' },
            { value: 'compact', label: 'Compact (1.23K)' }
          ]
        })}
      </div>

      <div class="settings-group">
        <label class="settings-label">Time Zone</label>
        ${createSelect({
          id: 'timezone',
          options: [
            { value: 'local', label: 'Local Time' },
            { value: 'et', label: 'Eastern Time (ET)' },
            { value: 'utc', label: 'UTC' }
          ]
        })}
      </div>
    </div>
  `;
}