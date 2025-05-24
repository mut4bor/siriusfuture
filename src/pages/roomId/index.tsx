import Button from '@/components/Button';
import Input from '@/components/Input';
import VideoPlayer from '@/components/VideoPlayer';
import { useMediasoupStore } from '@/store/helpers/StoreProdiver';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

const RoomIdPage = observer(() => {
  const { roomId } = useParams();
  const callStore = useMediasoupStore();
  const navigate = useNavigate();

  const [simulatedPeopleAmount, setSimulatedPeopleAmount] = useState(8);

  useEffect(() => {
    // Initialize the call store with your signaling server URL
    callStore.initialize({
      signalingUrl: 'ws://localhost:3001',
    });

    return () => {
      // Only leave the call if we're actually connected
      if (callStore.isConnected()) {
        callStore.leaveCall();
      }
    };
  }, []);

  const joinCall = () => {
    if (roomId) {
      const userId = `user-${Math.floor(Math.random() * 1000)}`;
      callStore.joinCall(roomId, userId);
    }
  };

  useEffect(() => {
    joinCall();
  }, [roomId]);

  const handleLeaveRoom = () => {
    callStore.leaveCall();
    navigate('/');
  };

  const getGridColumnsAmount = () =>
    `md:grid-cols-${Math.min(
      simulatedPeopleAmount > 0
        ? simulatedPeopleAmount === 1
          ? 2
          : simulatedPeopleAmount
        : 1,
      3
    )}`;

  console.log('localStream', callStore.localParticipant?.videoStream);
  console.log('localid', callStore.localParticipantId);

  return (
    <div className="flex flex-col gap-2 max-w-[1400px] m-auto">
      {/* <p>Room ID: {callStore}</p> */}
      <Input
        value={`${simulatedPeopleAmount}`}
        onChange={value =>
          setSimulatedPeopleAmount(value === '' ? 0 : Math.abs(parseInt(value)))
        }
        label="Симулировать количество участников в комнате"
        type="number"
      />
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
          <VideoPlayer
            stream={callStore.localParticipant?.videoStream ?? null}
            label={`Вы (${callStore.localParticipant?.userId})`}
            isMuted
          />
          {/* {Array.from({ length: simulatedPeopleAmount }).map((_, index) => (
            <VideoPlayer
              key={index}
              stream={null}
              label={`Пользователь ${index + 1}`}
            />
          ))} */}

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
