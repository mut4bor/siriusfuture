import Button from '@/components/Button';
import VideoPlayer from '@/components/VideoPlayer';
import { WS_URL } from '@/config';
import { useMediasoupStore } from '@/store/helpers/StoreProdiver';
import { isValidUUID } from '@/utils/isValidUUID';
import { observer } from 'mobx-react-lite';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';

const RoomIdPage = observer(() => {
  const { roomId } = useParams();

  const callStore = useMediasoupStore();
  const navigate = useNavigate();

  const localStream = callStore.localParticipant?.videoStream;
  const remoteParticipantsAmount = callStore.remoteParticipants.length;

  useEffect(() => {
    callStore.initialize({
      signalingUrl: WS_URL,
    });

    return () => {
      callStore.leaveCall();
    };
  }, []);

  const joinCall = () => {
    if (roomId) {
      const userId = `user-${Math.floor(Math.random() * 1000)}`;
      callStore.joinCall(roomId, userId);
    }
  };

  useEffect(() => {
    if (!isValidUUID(roomId)) {
      navigate('/');
    }

    joinCall();
  }, [roomId]);

  const handleLeaveRoom = () => {
    callStore.leaveCall();
    navigate('/');
  };

  const getGridColumnsAmount = () =>
    `md:grid-cols-${Math.min(
      remoteParticipantsAmount > 0
        ? remoteParticipantsAmount === 1
          ? 2
          : remoteParticipantsAmount
        : 1,
      3
    )}`;

  return (
    <div className="flex flex-col gap-2 max-w-[1400px] m-auto">
      {callStore.connectionState === 'error' && (
        <div className="error">
          <p>Error: {callStore.error?.message}</p>
          <button onClick={joinCall}>Try Again</button>
        </div>
      )}
      <div className="flex flex-col items-center justify-center gap-2">
        <div
          className={`grid gap-2 justify-center w-full h-full grid-cols-1 sm:grid-cols-2 ${getGridColumnsAmount()} auto-rows-fr`}
        >
          {localStream && (
            <VideoPlayer
              key={localStream.id}
              stream={localStream}
              label={`Вы (${callStore.localParticipant?.userId})`}
              isMuted
            />
          )}

          {callStore.remoteParticipants.map(participant => (
            <VideoPlayer
              key={participant.userId}
              stream={participant.videoStream ?? null}
              label={`Пользователь ${participant.userId}`}
            />
          ))}
        </div>

        <Button onClick={handleLeaveRoom} className="bg-red-800 w-fit">
          Выйти на главную
        </Button>
      </div>
    </div>
  );
});

export default RoomIdPage;
