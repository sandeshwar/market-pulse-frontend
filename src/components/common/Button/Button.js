export function createButton({ 
  id,
  icon,
  text,
  onClick,
  title,
  variant = 'icon',
  fullWidth = false,
  ...customAttributes
}) {
  const classes = [
    'btn',
    `btn--${variant}`,
    fullWidth ? 'btn--full-width' : ''
  ].filter(Boolean).join(' ');

  // Ensure action attribute is correctly set
  const dataAction = onClick?.replace(/[()]/g, '');

  // Combine custom attributes with standard ones
  const attributes = {
    class: classes,
    title: title || '',
    ...customAttributes,
    ...(dataAction ? { 'data-action': dataAction } : {})
  };

  // Generate attribute string
  const attributeString = Object.entries(attributes)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

  return `
    <button ${attributeString}>
      ${icon ? `<i data-feather="${icon}"></i>` : ''}
      ${text || ''}
    </button>
  `;
}