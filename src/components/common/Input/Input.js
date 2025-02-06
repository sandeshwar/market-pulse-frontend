export function createInput({ 
  type = 'text',
  placeholder = '',
  icon = null,
  id = '',
  value = ''
}) {
  return `
    <div class="input-wrapper">
      <input
        type="${type}"
        class="input-field"
        placeholder="${placeholder}"
        ${id ? `id="${id}"` : ''}
        ${value ? `value="${value}"` : ''}
      />
      ${icon ? `<i data-feather="${icon}" class="input-icon"></i>` : ''}
    </div>
  `;
}