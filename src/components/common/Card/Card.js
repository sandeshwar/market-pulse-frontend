import { createButton } from '../Button/Button.js';
import { ICONS } from '../../../utils/icons.js';

export function createCard({ 
  title,
  icon,
  content,
  showActions = false
}) {
  const actions = [
    { 
      icon: ICONS.moreVertical, 
      title: 'More options',
      onClick: 'handleCardOptions' 
    }
  ];

  return `
    <div class="card">
      <div class="card__header">
        <div class="card__title">
          ${icon ? `<i data-feather="${icon}"></i>` : ''}
          ${title}
        </div>
        ${showActions ? `
          <div class="card__actions">
            ${actions.map(action => createButton({
              ...action,
              variant: 'icon',
              'data-action': action.onClick
            })).join('')}
          </div>
        ` : ''}
      </div>
      <div class="card__content">
        ${content}
      </div>
    </div>
  `;
}