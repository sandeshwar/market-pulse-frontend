let badgeCount = 0;
const badgeElement = document.createElement('div');
badgeElement.className = 'extension-badge';

export function updateBadge(count) {
  badgeCount = count;
  badgeElement.textContent = count > 0 ? count.toString() : '';
  badgeElement.style.display = count > 0 ? 'flex' : 'none';
}

export function getBadgeElement() {
  return badgeElement;
}

export function clearBadge() {
  updateBadge(0);
}