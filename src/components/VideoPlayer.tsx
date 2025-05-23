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
    <div className="flex-1 aspect-video rounded-lg overflow-hidden bg-white/10">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
      />
      <div>{label}</div>
    </div>
  );
};

export default VideoPlayer;
