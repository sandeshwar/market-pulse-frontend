import { useEffect } from 'react';
import { IndicesSettings } from './IndicesSettings.jsx';
import { WatchlistSettings } from './WatchlistSettings.jsx';
import { replaceIcons } from '../../../utils/feather.js';

export const SettingsPage = () => {
  // Replace Feather icons after component renders
  useEffect(() => {
    replaceIcons();
  }, []);

  return (
    <div className="settings-page">
      <IndicesSettings />
      <WatchlistSettings />
    </div>
  );
};

