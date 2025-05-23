import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  stream: MediaStream;
  isLocal: boolean;
  label: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  stream,
  isLocal,
  label,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="video-player">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={isLocal ? 'local' : 'remote'}
      />
      <div className="label">{label}</div>
    </div>
  );
};

export default VideoPlayer;
