import { useEffect, useRef, useState } from 'react';

interface Props {
  stream: MediaStream | null;
  isMuted?: boolean;
  label: string;
}

const VideoPlayer = ({ stream, isMuted, label }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [trackInfo, setTrackInfo] = useState('No tracks');

  useEffect(() => {
    if (!stream) {
      console.log('No stream provided to VideoPlayer');
      return;
    }

    // Log detailed stream information
    const tracks = stream.getTracks();
    const trackDetails = tracks
      .map(
        track =>
          `${track.kind} (${track.id}): enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`
      )
      .join('\n');

    console.log(`Stream ${stream.id} details:`, {
      active: stream.active,
      tracks: tracks.length,
      trackDetails,
    });

    setTrackInfo(`${tracks.length} tracks: ${trackDetails}`);

    // Attach stream to video element
    if (videoRef.current) {
      console.log(`Attaching stream ${stream.id} to video element`);
      videoRef.current.srcObject = stream;

      // Attempt to play (important for mobile browsers)
      videoRef.current.play().catch(err => {
        console.error('Error playing video:', err);
      });
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [stream]);

  const handlePlaying = () => {
    console.log('Video is now playing');
  };

  const handleWaiting = () => {
    console.log('Video is waiting for data');
  };

  const handleError = (e: any) => {
    console.error('Video error:', e);
  };

  return (
    <div className="relative flex-1 w-full aspect-video rounded-lg overflow-hidden bg-white/10">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className="w-full h-full object-cover"
        onPlaying={handlePlaying}
        onWaiting={handleWaiting}
        onError={handleError}
      />
      <div className="absolute bottom-2 left-2 text-white px-4 py-1 bg-black/30 rounded font-semibold">
        {label}
      </div>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          background: 'rgba(0,0,0,0.5)',
          color: 'white',
          padding: '4px',
          fontSize: '10px',
          whiteSpace: 'pre-line',
        }}
      >
        {stream ? `Stream: ${stream.id}\n${trackInfo}` : 'No stream'}
      </div>
    </div>
  );
};

export default VideoPlayer;
