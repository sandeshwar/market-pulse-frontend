import { createCard } from '../../common/Card/Card.js';
import { ICONS } from '../../../utils/icons.js';

function createNewsItem({ title, url, image, time }) {
  return `
    <div 
      class="news-item" 
      onclick="window.open('${url}', '_blank')"
      style="display: flex"
    >
      <div class="news-content">
        <div class="news-title">${title}</div>
        <div class="news-time">${time}</div>
      </div>
      <div class="news-image-container">
        <img src="${image}" alt="" class="news-image">
      </div>
    </div>
  `;
}

export function createBreakingNewsCard() {
  const news = [
    {
      title: 'Samsung reveals schedule who gets update of One UI 4 with Android 12',
      url: '#',
      image: 'https://images.unsplash.com/photo-1610945264803-c22b62d2a7b3?auto=format&fit=crop&w=64&h=64&q=80',
      time: '2h'
    },
    {
      title: 'Does life replay before our eyes when we die? Find out what happens in the brain when a person dies',
      url: '#',
      image: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?auto=format&fit=crop&w=64&h=64&q=80',
      time: '1d'
    },
    {
      title: 'RRR finds a fan in Klaus Mikaelson aka Joseph Morgan: \'Absolute masterpiece\'',
      url: '#',
      image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=64&h=64&q=80',
      time: '2d'
    }
  ];

  const content = `
    <div class="breaking-news">
      <div class="news-list">
        ${news.map(item => createNewsItem(item)).join('')}
      </div>
    </div>
  `;

  return createCard({
    title: 'Breaking News',
    icon: ICONS.globe,
    content
  });
}
