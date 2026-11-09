import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import logs from 'virtual:vehicle-logs';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App logs={logs} />
  </StrictMode>,
);
