import { VideoRoom } from '@/components/VideoRoom';
import { useParams } from 'react-router';

const RoomIdPage = () => {
  const { roomId } = useParams();

  return (
    <div>
      <VideoRoom roomId={roomId} />
    </div>
  );
};

export default RoomIdPage;
