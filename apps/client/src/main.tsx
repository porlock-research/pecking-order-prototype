import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register service worker for PWA + push notifications
// Uses vite-plugin-pwa's virtual module to handle dev/prod paths correctly
import { registerSW } from 'virtual:pwa-register';
registerSW();