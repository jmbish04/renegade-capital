/**
 * @fileoverview Audio Tool UI Component
 *
 * Renders an audio player with artwork for AI-generated podcast content.
 */

import * as React from 'react';
import { Card } from '../ui/card';

export type AudioProps = {
  src: string;
  title?: string;
  description?: string;
  artwork?: string;
};

export function Audio({ src, title, description, artwork }: AudioProps) {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const audioRef = React.useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    const handlePause = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('play', handlePlay);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('play', handlePlay);
    };
  }, []);

  return (
    <Card className="p-6 bg-muted/30 border-border">
      <div className="flex gap-4">
        {/* Artwork */}
        {artwork && (
          <div className="shrink-0">
            <img
              src={artwork}
              alt={title || 'Podcast artwork'}
              className="w-24 h-24 rounded-lg object-cover border border-border"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-base font-semibold text-foreground mb-1">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {description}
            </p>
          )}

          {/* Audio player */}
          <div className="space-y-2">
            <audio
              ref={audioRef}
              src={src}
              preload="metadata"
              className="hidden"
            />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-5 w-5"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              <div className="flex-1 text-xs text-muted-foreground">
                {isPlaying ? 'Playing...' : 'Click to play'}
              </div>
            </div>

            {/* Native controls for advanced features */}
            <audio
              controls
              src={src}
              className="w-full h-8"
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
