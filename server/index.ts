import express from 'express';
import http from 'http';
import mediasoup from 'mediasoup';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Хранилище для комнат и WebSocket клиентов
const rooms = new Map();
const clients = new Map();

// Настройки mediasoup
const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
];

let worker;

// Инициализация mediasoup worker
async function initializeWorker() {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });

  console.log('mediasoup worker created');
}

// WebSocket обработчик
wss.on('connection', ws => {
  console.log('New WebSocket connection');

  ws.on('message', async message => {
    const data = JSON.parse(message.toString());
    console.log('WebSocket message received:', data);

    switch (data.type) {
      case 'join':
        clients.set(data.peerId, ws);
        const room = rooms.get(data.roomId);
        if (room) {
          // Отправляем информацию о существующих продюсерах
          room.peers.forEach((peer, existingPeerId) => {
            if (existingPeerId !== data.peerId) {
              // Проходим по всем продюсерам этого пира
              peer.producers.forEach((producer, kind) => {
                console.log(
                  `Sending existing producer info to new peer: ${producer.id} (${kind}) from ${existingPeerId}`
                );
                ws.send(
                  JSON.stringify({
                    type: 'newProducer',
                    producerId: producer.id,
                    peerId: existingPeerId,
                    kind: kind,
                  })
                );
              });
            }
          });
        }
        break;

      case 'newProducer':
        // Оповещаем всех участников комнаты о новом продюсере
        const targetRoom = rooms.get(data.roomId);
        if (targetRoom) {
          clients.forEach((client, peerId) => {
            if (peerId !== data.peerId && client.readyState === ws.OPEN) {
              client.send(
                JSON.stringify({
                  type: 'newProducer',
                  producerId: data.producerId,
                  peerId: data.peerId,
                  kind: data.kind,
                })
              );
            }
          });
        }
        break;
    }
  });

  ws.on('close', () => {
    // Находим и удаляем отключившегося клиента
    clients.forEach((client, peerId) => {
      if (client === ws) {
        clients.delete(peerId);
        // Оповещаем остальных участников
        clients.forEach(c => {
          if (c.readyState === ws.OPEN) {
            c.send(
              JSON.stringify({
                type: 'producerClosed',
                peerId,
              })
            );
          }
        });
      }
    });
  });
});

// Создание комнаты
app.post('/create-room', async (req, res) => {
  try {
    const roomId = uuidv4();
    const router = await worker.createRouter({ mediaCodecs });
    rooms.set(roomId, {
      router,
      peers: new Map(),
      producers: new Map(),
    });
    console.log('Room created:', roomId);
    res.json({ roomId });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Could not create room' });
  }
});

app.get('/rooms/:roomId/rtpCapabilities', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) return res.status(404).end();
  res.json(room.router.rtpCapabilities);
});

// Подключение к комнате
app.post('/join-room', async (req, res) => {
  const { roomId, peerId } = req.body;
  const room = rooms.get(roomId);

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  try {
    // Проверяем, существует ли уже пир
    let peer = room.peers.get(peerId);

    if (!peer) {
      const transport = await createWebRtcTransport(room.router);
      peer = {
        transport,
        isConnected: false,
        producers: new Map(),
        consumers: new Map(),
      };
      room.peers.set(peerId, peer);
    }

    console.log(`Peer ${peerId} joined room ${roomId}`);

    res.json({
      routerRtpCapabilities: room.router.rtpCapabilities,
      transportOptions: {
        id: peer.transport.id,
        iceParameters: peer.transport.iceParameters,
        iceCandidates: peer.transport.iceCandidates,
        dtlsParameters: peer.transport.dtlsParameters,
      },
    });
  } catch (error) {
    console.error('Error joining room:', error);
    res.status(500).json({ error: 'Could not join room' });
  }
});

// Создание WebRTC транспорта
async function createWebRtcTransport(router) {
  const transport = await router.createWebRtcTransport({
    listenIps: [{ ip: '0.0.0.0', announcedIp: '127.0.0.1' }],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
  });

  transport.on('dtlsstatechange', dtlsState => {
    console.log('dtlsstatechange', dtlsState);
    if (dtlsState === 'closed') {
      transport.close();
    }
  });

  transport.on('close', () => {
    console.log('Transport closed');
  });

  return transport;
}

// Подключение транспорта
app.post('/connect-transport', async (req, res) => {
  const { roomId, peerId, dtlsParameters } = req.body;
  const room = rooms.get(roomId);
  const peer = room.peers.get(peerId);

  if (!room || !peer) {
    return res.status(404).json({ error: 'Room or peer not found' });
  }

  try {
    // Проверяем, не подключен ли уже транспорт
    if (peer.isConnected) {
      return res.json({ success: true });
    }

    await peer.transport.connect({ dtlsParameters });
    peer.isConnected = true;

    console.log(`Transport connected for peer ${peerId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error connecting transport:', error);
    res.status(500).json({ error: 'Could not connect transport' });
  }
});

// Создание продюсера (отправка медиапотока)
app.post('/produce', async (req, res) => {
  const { roomId, peerId, kind, rtpParameters } = req.body;
  const room = rooms.get(roomId);
  const peer = room?.peers.get(peerId);

  if (!room || !peer) {
    return res.status(404).json({ error: 'Room or peer not found' });
  }

  try {
    console.log('Creating producer with parameters:', {
      kind,
      rtpParametersJSON: JSON.stringify(rtpParameters, null, 2),
    });
    const producer = await peer.transport.produce({ kind, rtpParameters });

    // Храним продюсер в Map с ключом по типу (audio/video)
    peer.producers.set(kind, producer);

    // Отправляем сообщение всем в комнате о новом продюсере
    clients.forEach((client, clientPeerId) => {
      if (clientPeerId !== peerId && client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'newProducer',
            producerId: producer.id,
            peerId: peerId,
            kind: kind,
          })
        );
      }
    });

    console.log('Producer created successfully:', {
      producerId: producer.id,
      peerId,
      kind,
    });
    res.json({ id: producer.id });
  } catch (error) {
    console.error('Error producing:', error);
    res.status(500).json({ error: 'Could not produce' });
  }
});

// Создание консьюмера (получение медиапотока)
app.post('/consume', async (req, res) => {
  const { roomId, peerId, producerId, rtpCapabilities } = req.body;

  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const peer = room.peers.get(peerId);
  if (!peer) {
    return res.status(404).json({ error: 'Peer not found' });
  }

  try {
    // Находим продюсера в комнате
    let foundProducer = null;
    let producerPeerId = null;

    room.peers.forEach((remotePeer, remotePeerId) => {
      remotePeer.producers.forEach(producer => {
        if (producer.id === producerId) {
          foundProducer = producer;
          producerPeerId = remotePeerId;
        }
      });
    });

    if (!foundProducer) {
      return res.status(404).json({ error: 'Producer not found' });
    }

    // Проверяем, можем ли мы потреблять этот продюсер
    if (
      !room.router.canConsume({
        producerId: foundProducer.id,
        rtpCapabilities,
      })
    ) {
      return res.status(400).json({ error: 'Cannot consume' });
    }

    // Создаем потребителя
    const consumer = await peer.transport.consume({
      producerId: foundProducer.id,
      rtpCapabilities,
      paused: true, // начинаем с паузы, возобновляем позже
    });

    // Сохраняем потребителя
    peer.consumers.set(consumer.id, consumer);

    res.json({
      consumerParameters: {
        id: consumer.id,
        producerId: foundProducer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        type: consumer.type,
        producerPaused: consumer.producerPaused,
      },
    });
  } catch (error) {
    console.error('Error consuming:', error);
    res.status(500).json({ error: 'Could not consume' });
  }
});

app.post('/resume-consumer', async (req, res) => {
  const { roomId, peerId, consumerId } = req.body;

  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const peer = room.peers.get(peerId);
  if (!peer) {
    return res.status(404).json({ error: 'Peer not found' });
  }

  const consumer = peer.consumers.get(consumerId);
  if (!consumer) {
    return res.status(404).json({ error: 'Consumer not found' });
  }

  try {
    await consumer.resume();
    res.json({ success: true });
  } catch (error) {
    console.error('Error resuming consumer:', error);
    res.status(500).json({ error: 'Could not resume consumer' });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3001;

async function start() {
  await initializeWorker();
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
