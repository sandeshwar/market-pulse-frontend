import { createListManagementSettings } from './ListManagementSettings.js';

export async function createSettingsPage() {
  // Get the list management settings element
  const listManagementElement = createListManagementSettings();
  
  // Create a wrapper element
  const settingsPage = document.createElement('div');
  settingsPage.className = 'settings-page';
  settingsPage.appendChild(listManagementElement);
  
  return settingsPage;
}