// 
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  
  if (appContainer) {
    const root = createRoot(appContainer);
    root.render(<App />);
  } else {
    console.error('App container not found');
  }
});