import Button from '@/components/Button';
import Input from '@/components/Input';
import { useMediasoupStore } from '@/store/helpers/StoreProdiver';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { useNavigate } from 'react-router';

const MainPage = observer(() => {
  const callStore = useMediasoupStore();
  const navigate = useNavigate();
  const [joinRoomCodeValue, setJoinRoomCodeValue] = useState('');
  const [warningText, setWarningText] = useState('');

  const handleCreateRoom = async () => {
    const roomId = '9f704e1d-0e19-4c83-839b-fdc399918ddc';
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
    <div className="min-h-screen max-w-lg m-auto flex flex-col gap-2 items-center justify-center">
      <div className="w-full bg-gray-800 rounded-xl shadow-lg p-8 flex flex-col gap-2 items-center">
        <h1 className="text-3xl font-bold mb-5">Sirius Future</h1>
        <Button
          onClick={handleCreateRoom}
          className="w-full bg-[#8769ef] hover:bg-[#62bafd] text-white py-3 rounded-lg transition"
        >
          Создать комнату
        </Button>

        <p className="text-lg">или</p>

        <div className="w-full flex flex-row gap-2">
          <div className="w-full">
            <Input
              placeholder="Введите код комнаты"
              value={joinRoomCodeValue}
              onChange={setJoinRoomCodeValue}
              className="px-4 py-3 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8769ef] transition"
            />
          </div>
          <Button
            onClick={() => {
              // if (isValidUUID(joinRoomCodeValue)) {
              handleJoinClick();
              setWarningText('');
              // } else {
              //   setWarningText('Wrong code, try again');
              //   setJoinRoomCodeValue('');
              // }
            }}
            disabled={!joinRoomCodeValue}
            className="w-full bg-[#cc5174] hover:bg-[#a95287] text-white py-3 rounded-lg transition"
          >
            Подключиться
          </Button>
        </div>
      </div>

      <p>{warningText}</p>
    </div>
  );
});

export default MainPage;
