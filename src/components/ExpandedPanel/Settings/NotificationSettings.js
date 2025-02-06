import { createSelect } from '../../common/Select/Select.js';
import { createButton } from '../../common/Button/Button.js';

export function createNotificationSettings() {
  return `
    <div class="settings-content">
      <div class="settings-group">
        <label class="settings-label">Alert Sound</label>
        ${createSelect({
          id: 'alert-sound',
          options: [
            { value: 'none', label: 'None' },
            { value: 'bell', label: 'Bell' },
            { value: 'chime', label: 'Chime' }
          ]
        })}
      </div>
      
      <div class="settings-group">
        <label class="settings-label">Desktop Notifications</label>
        <div class="toggle-group">
          ${createButton({
            text: 'Enable Notifications',
            variant: 'primary',
            onClick: 'requestNotificationPermission()'
          })}
          <span class="settings-help">
            Get notified when price thresholds are reached
          </span>
        </div>
      </div>
    </div>
  `;
}