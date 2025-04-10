import React from 'react';
import { createIndicesSettingsReact } from './IndicesSettingsReact.jsx';
import { createWatchlistSettingsReact } from './WatchlistSettingsReact.jsx';
import { replaceIcons } from '../../../utils/feather.js';

export async function createSettingsPage() {
  // Create a wrapper element
  const settingsPage = document.createElement('div');
  settingsPage.className = 'settings-page';

  // Add the indices settings page (React version) first to match home page order
  const indicesSettingsPage = await createIndicesSettingsReact();
  settingsPage.appendChild(indicesSettingsPage);

  // Add the watchlist settings page (React version)
  const watchlistSettingsPage = await createWatchlistSettingsReact();
  settingsPage.appendChild(watchlistSettingsPage);

  // We've removed the admin dashboard card from the Chrome extension

  // Replace icons after rendering
  setTimeout(async () => {
    await replaceIcons();
  }, 0);

  return settingsPage;
}

