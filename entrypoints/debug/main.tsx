import React from 'react';
import { createRoot } from 'react-dom/client';
import DebugApp from './App';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DebugApp />
  </React.StrictMode>,
);

