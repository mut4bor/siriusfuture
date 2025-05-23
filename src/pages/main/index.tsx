import Button from '@/components/Button';
import Input from '@/components/Input';
import { useMediasoupStore } from '@/stores/prodiver';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useNavigate } from 'react-router';

const MainPage = observer(() => {
  const store = useMediasoupStore();
  const navigate = useNavigate();
  const [joinRoomCodeValue, setJoinRoomCodeValue] = useState('');
  const [warningText, setWarningText] = useState('');

  const handleCreateRoom = async () => {
    const roomId = await store.createRoom();
    if (roomId) {
      navigate(`/${roomId}`);
    }
  };

  const handleJoinClick = () => {
    navigate(`/${joinRoomCodeValue}`);
  };

  const isValidUUID = (uuid: string): boolean => {
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  return (
    <div className="flex gap-3">
      <Button onClick={handleCreateRoom}>Create room</Button>

      <p>{warningText}</p>

      <Input
        placeholder="Введите код комнаты"
        value={joinRoomCodeValue}
        onChange={setJoinRoomCodeValue}
      />

      <Button
        onClick={() => {
          if (isValidUUID(joinRoomCodeValue)) {
            handleJoinClick();
            setWarningText('');
          } else {
            setWarningText('Wrong code, try again');
            setJoinRoomCodeValue('');
          }
        }}
        disabled={!joinRoomCodeValue}
      >
        Join room
      </Button>
    </div>
  );
});

export default MainPage;
