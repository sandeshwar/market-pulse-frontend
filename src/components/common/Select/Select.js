export function createSelect({ 
  options = [],
  id = '',
  value = '',
  icon = 'chevron-down'
}) {
  return `
    <div class="select-wrapper">
      <select 
        class="select-field"
        ${id ? `id="${id}"` : ''}
        ${value ? `value="${value}"` : ''}
      >
        ${options.map(option => `
          <option value="${option.value}">${option.label}</option>
        `).join('')}
      </select>
      <i data-feather="${icon}" class="select-icon"></i>
    </div>
  `;
}