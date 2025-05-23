import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useMediasoupStore } from '../stores';
import VideoPlayer from './VideoPlayer';

export const VideoRoom = observer(() => {
  const store = useMediasoupStore();
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const localStream = store.state.localStream;
  const [joinCodeState, setJoinCodeState] = useState('');

  useEffect(() => {
    store.state.remoteStreams.forEach((stream, peerId) => {
      const videoElement = remoteVideosRef.current.get(peerId);
      if (videoElement) {
        videoElement.srcObject = stream;
      }
    });
  }, [store.state.remoteStreams]);

  const handleCreateRoom = async () => {
    const roomId = await store.createRoom();
    if (roomId) {
      await store.joinRoom(roomId);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    await store.joinRoom(roomId);
  };

  const handleLeaveRoom = () => {
    store.leaveRoom();
  };

  console.log('remoteStreams', store.state.remoteStreams);
  return (
    <div>
      <div>
        <button onClick={handleCreateRoom}>Create Room</button>

        <button onClick={handleLeaveRoom}>Leave Room</button>

        <input
          type="text"
          value={joinCodeState}
          onChange={event => setJoinCodeState(event.target.value)}
        />

        <button onClick={() => handleJoinRoom(joinCodeState)}>join Room</button>
      </div>

      <div>
        <h3>Local Video (user {store.state.peerId})</h3>

        <h3>room {store.state.roomId}</h3>
        {localStream && (
          <VideoPlayer stream={localStream} label="You" isLocal />
        )}
      </div>

      <div>
        {Array.from(store.state.remoteStreams.entries()).map(
          ([peerId, stream]) => {
            console.log('stream', stream);
            if (!stream) {
              return null;
            }
            return (
              <VideoPlayer stream={stream} label={peerId} isLocal={false} />
            );
          }
        )}
      </div>

      {store.state.error && (
        <div style={{ color: 'red' }}>{store.state.error}</div>
      )}
    </div>
  );
});
