import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/general.css';
import { Routing } from './pages';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Routing />
  </React.StrictMode>
);
