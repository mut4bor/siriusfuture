import { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useMediasoupStore } from '@/stores/prodiver';
import VideoPlayer from './VideoPlayer';
import { useNavigate } from 'react-router';
import Button from './Button';

export const VideoRoom = observer(
  ({ roomId }: { roomId: string | undefined }) => {
    const store = useMediasoupStore();
    const navigate = useNavigate();
    const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
    const localStream = store.state.localStream;
    const remoteStreams = store.state.remoteStreams;

    useEffect(() => {
      if (roomId) {
        store.joinRoom(roomId);
      }
    }, [roomId]);

    useEffect(() => {
      remoteStreams.forEach((stream, peerId) => {
        const videoElement = remoteVideosRef.current.get(peerId);
        if (videoElement) {
          videoElement.srcObject = stream;
        }
      });
    }, [remoteStreams]);

    const handleLeaveRoom = () => {
      store.leaveRoom();
      navigate('/');
    };

    return (
      <div className="">
        <Button onClick={handleLeaveRoom}>Leave Room</Button>

        <p>User: {store.state.peerId}</p>
        <p>Room: {store.state.roomId}</p>

        {store.state.error && (
          <div className="text-[red]">{store.state.error}</div>
        )}

        <div
          className={`w-full h-fit grid ${remoteStreams.size < 1 ? 'grid-cols-1' : remoteStreams.size < 2 ? 'grid-cols-2' : 'grid-cols-3'} gap-1`}
        >
          {localStream && (
            <>
              <VideoPlayer stream={localStream} label="You" isLocal />
              {/* <VideoPlayer stream={localStream} label="You" isLocal />
              <VideoPlayer stream={localStream} label="You" isLocal />
              <VideoPlayer stream={localStream} label="You" isLocal />
              <VideoPlayer stream={localStream} label="You" isLocal /> */}
            </>
          )}

          {Array.from(remoteStreams.entries()).map(
            ([peerId, stream], index) => {
              if (!stream) {
                return null;
              }
              return (
                <VideoPlayer
                  key={`${peerId}${index}`}
                  stream={stream}
                  label={peerId}
                  isLocal={false}
                />
              );
            }
          )}
        </div>
      </div>
    );
  }
);
