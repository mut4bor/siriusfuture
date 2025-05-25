import { Router } from 'express';
import { roomManager } from '../models/Room';

const router = Router();

// Get active rooms
router.get('/rooms', (req, res) => {
  const rooms = Array.from(roomManager.getAllRooms().entries()).map(
    ([id, room]) => ({
      id,
      participants: Array.from(room.peers.keys()),
    })
  );

  res.json({ rooms });
});

// Get room info
router.get('/rooms/:roomId', (req, res) => {
  const room = roomManager.getRoom(req.params.roomId);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  res.json({
    id: room.id,
    participants: Array.from(room.peers.keys()),
    numparticipants: room.peers.size,
  });
});

export default router;
