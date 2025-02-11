import { createListManagementSettings } from './ListManagementSettings.js';

export function createSettingsPage() {
  return `
    <div class="settings-page">
      ${createListManagementSettings()}
    </div>
  `;
}