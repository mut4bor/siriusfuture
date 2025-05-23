import React from 'react';
import ReactDOM from 'react-dom/client';
import { VideoRoom } from './components/VideoRoom';
import './styles/VideoConference.css';
import { MediasoupStoreProvider } from './stores';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <MediasoupStoreProvider>
      <VideoRoom />
    </MediasoupStoreProvider>
  </React.StrictMode>
);
