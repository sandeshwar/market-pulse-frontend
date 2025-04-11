import { createButtonReact } from '../Button/Button.js';
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

  // Create the card element
  const cardElement = document.createElement('div');
  cardElement.className = 'card';
  
  // Create the card structure
  cardElement.innerHTML = `
    <div class="card__header">
      <div class="card__title">
        ${icon ? `<i data-feather="${icon}"></i>` : ''}
        ${title}
      </div>
      ${showActions ? '<div class="card__actions"></div>' : ''}
    </div>
    <div class="card__content">
      ${content}
    </div>
  `;
  
  // Add action buttons if needed
  if (showActions) {
    const actionsContainer = cardElement.querySelector('.card__actions');
    actions.forEach(action => {
      const buttonElement = createButtonReact({
        ...action,
        variant: 'icon'
      });
      actionsContainer.appendChild(buttonElement);
    });
  }
  
  return cardElement.outerHTML;
}