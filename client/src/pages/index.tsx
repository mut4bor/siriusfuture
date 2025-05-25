import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import MainPage from '@/pages/main';
import RoomIdPage from '@/pages/roomId';
import { MediasoupStoreProvider } from '@/store/helpers/StoreProdiver';

const routesArray = [
  { path: `/`, Component: MainPage },

  { path: `/:roomId`, Component: RoomIdPage },
];

export const Routing = () => {
  const router = createBrowserRouter(
    routesArray.map(({ path, Component }) => ({
      path,
      Component,
    }))
  );

  return (
    <div className="p-2 w-full min-h-svh bg-gray-900 text-white">
      <MediasoupStoreProvider>
        <RouterProvider router={router} />
      </MediasoupStoreProvider>
    </div>
  );
};
