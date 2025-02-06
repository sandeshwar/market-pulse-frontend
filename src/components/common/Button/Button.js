export function createButton({ 
  id,
  icon,
  text,
  onClick,
  title,
  variant = 'icon',
  fullWidth = false
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    fullWidth ? 'btn--full-width' : ''
  ].filter(Boolean).join(' ');

  // Ensure onClick is treated as an action identifier
  const actionAttr = onClick ? `data-action="${onClick.replace(/[()]/g, '')}"` : '';

  return `
    <button 
      ${id ? `id="${id}"` : ''}
      class="${classes}"
      title="${title}"
      ${actionAttr}
    >
      ${icon ? `<i data-feather="${icon}"></i>` : ''}
      ${text || ''}
    </button>
  `;
}