import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/base.css';
import './styles/brand.css';
import './styles/ui.css';
import './styles/shelf.css';
import './styles/reader.css';
import './styles/ai.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
