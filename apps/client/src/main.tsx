import React from 'react';
import ReactDOM from 'react-dom/client';
import { GameStatus } from "@pecking-order/shared-types";

// Verify Import
console.log(`Client Loaded. Status: ${GameStatus.OPEN}`);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <h1>Pecking Order Client</h1>
  </React.StrictMode>,
);
