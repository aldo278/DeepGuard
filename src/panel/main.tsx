// TrustShield Side Panel Main Entry Point

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Chrome extension types
declare const chrome: any;

// Initialize the React app
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Set up communication with background script
chrome.runtime.sendMessage({ type: 'PANEL_OPENED' }, (response: any) => {
  if (response && response.error) {
    console.error('Failed to initialize panel:', response.error);
  }
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message: any) => {
  // Handle messages from background script
  console.log('Panel received message:', message);
});

export default {};
