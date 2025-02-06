import { createInput } from '../../common/Input/Input.js';
import { createButton } from '../../common/Button/Button.js';
import { createSelect } from '../../common/Select/Select.js';
import { THRESHOLD_TYPES, getThresholds, saveThreshold, removeThreshold } from '../../../utils/thresholds.js';
import { ICONS } from '../../../utils/icons.js';

function createThresholdItem({ symbol, price, type }) {
  return `
    <div class="threshold-item">
      <div class="threshold-info">
        <span class="threshold-symbol">${symbol}</span>
        <span class="threshold-details">
          ${type} ${price}
        </span>
      </div>
      <button 
        class="btn btn--icon" 
        onclick="removeThreshold('${symbol}', ${price}, '${type}')"
        title="Remove threshold"
      >
        <i data-feather="${ICONS.trash}"></i>
      </button>
    </div>
  `;
}

export function createThresholdSettings() {
  const thresholds = getThresholds();
  const thresholdsList = Object.entries(thresholds)
    .flatMap(([symbol, values]) => 
      values.map(v => createThresholdItem({ symbol, ...v }))
    )
    .join('');

  return `
    <div class="settings-content">
      <div class="settings-group">
        <label class="settings-label">Add New Threshold</label>
        <div class="settings-inputs">
          ${createInput({
            id: 'threshold-symbol',
            placeholder: 'Enter symbol...',
            type: 'text'
          })}
          
          ${createInput({
            id: 'threshold-price',
            placeholder: 'Enter price...',
            type: 'number',
            step: '0.01'
          })}
          
          ${createSelect({
            id: 'threshold-type',
            options: [
              { value: THRESHOLD_TYPES.ABOVE, label: 'Above' },
              { value: THRESHOLD_TYPES.BELOW, label: 'Below' }
            ]
          })}
          
          ${createButton({
            text: 'Add',
            variant: 'primary',
            onClick: 'addThreshold()'
          })}
        </div>
        <span class="settings-help">
          Set price levels to receive alerts when symbols cross these thresholds
        </span>
      </div>

      <div class="settings-group">
        <label class="settings-label">Active Thresholds</label>
        <div class="thresholds-list">
          ${thresholdsList || '<div class="empty-state">No thresholds set</div>'}
        </div>
      </div>
    </div>
  `;
}