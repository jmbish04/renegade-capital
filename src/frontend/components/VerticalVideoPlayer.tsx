"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  RotateCcw,
  Settings
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VerticalVideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
}

export const VerticalVideoPlayer: React.FC<VerticalVideoPlayerProps> = ({ 
  src, 
  poster, 
  className 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isHovering, setIsHovering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => setDuration(video.duration);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (value: number | readonly number[]) => {
    const newValue = Array.isArray(value) ? value[0] : value;
    if (videoRef.current) {
      videoRef.current.currentTime = newValue;
      setCurrentTime(newValue);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (value: number | readonly number[]) => {
    const newVolume = Array.isArray(value) ? value[0] : value;
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "group relative flex flex-col items-center justify-center bg-black rounded-xl overflow-hidden border border-border shadow-2xl",
        "aspect-[9/16] w-full max-w-[400px] mx-auto",
        className
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-cover cursor-pointer"
        onClick={togglePlay}
        playsInline
      />

      {/* Overlay: Play Button on Center (Visible when paused or hovering) */}
      {(!isPlaying || isHovering) && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/20 transition-opacity duration-300 pointer-events-none"
        >
          {!isPlaying && (
            <div className="size-20 flex items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-xl animate-in zoom-in-50 duration-200 pointer-events-auto cursor-pointer" onClick={togglePlay}>
              <Play className="size-10 fill-current ml-1" />
            </div>
          )}
        </div>
      )}

      {/* Controls Bar (Glassmorphism) */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 p-4 pt-8 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-transform duration-300 ease-in-out",
          isHovering || !isPlaying ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Progress Slider */}
        <div className="mb-4 group/slider">
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-white hover:bg-white/20"
              onClick={togglePlay}
            >
              {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
            </Button>

            <div className="flex items-center gap-2 group/volume">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-white hover:bg-white/20"
                onClick={toggleMute}
              >
                {isMuted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </Button>
              <div className="w-0 group-hover/volume:w-20 transition-all duration-300 overflow-hidden">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.01}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                />
              </div>
            </div>

            <span className="text-[10px] font-mono text-white/80 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1">
             <Button
              variant="ghost"
              size="icon"
              className="size-8 text-white hover:bg-white/20"
              onClick={() => { if(videoRef.current) videoRef.current.currentTime = 0 }}
            >
              <RotateCcw className="size-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-white hover:bg-white/20"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize className="size-5" /> : <Maximize className="size-5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
