import { createContext, useContext } from 'react';
import { MediasoupStore } from './MediasoupStore';

const MediasoupStoreContext = createContext<MediasoupStore | null>(null);

export const MediasoupStoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const store = new MediasoupStore();

  return (
    <MediasoupStoreContext.Provider value={store}>
      {children}
    </MediasoupStoreContext.Provider>
  );
};

export const useMediasoupStore = () => {
  const store = useContext(MediasoupStoreContext);
  if (!store) {
    throw new Error(
      'useMediasoupStore must be used within MediasoupStoreProvider'
    );
  }
  return store;
};
