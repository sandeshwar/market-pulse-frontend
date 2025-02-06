import { createThresholdSettings } from './ThresholdSettings.js';
import { createDisplaySettings } from './DisplaySettings.js';
import { createListManagementSettings } from './ListManagementSettings.js';
import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';

export function createSettingsPage() {
  return `
    <div class="settings-page">
      ${createListManagementSettings()}
    </div>
  `;
}