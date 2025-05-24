import { createContext, useContext } from 'react';
import { CallStore } from '../CallStore';

const MediasoupStoreContext = createContext<CallStore | null>(null);

export const MediasoupStoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const store = new CallStore();

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
