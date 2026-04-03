type IconName =
  | "app-mark"
  | "file"
  | "play"
  | "pause"
  | "backward"
  | "forward"
  | "volume"
  | "volume-off"
  | "audio-track"
  | "subtitles"
  | "minimize"
  | "maximize"
  | "restore"
  | "close"
  | "check"
  | "fullscreen-enter"
  | "fullscreen-exit";

type PlayerIconProps = {
  name: IconName;
  className?: string;
};

export function PlayerIconSprite() {
  return (
    <svg className="icon-sprite" aria-hidden="true">
      <symbol id="icon-app-mark" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill="#000000" />
        <circle cx="12" cy="12" r="3" fill="#ffffff" />
      </symbol>
      <symbol id="icon-file" viewBox="0 0 24 24">
        <path
          d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 2v6h6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id="icon-play" viewBox="0 0 24 24">
        <path d="M7 5.5 18.5 12 7 18.5Z" fill="currentColor" />
      </symbol>
      <symbol id="icon-pause" viewBox="0 0 24 24">
        <rect x="6.5" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
        <rect x="13.5" y="4.5" width="4" height="15" rx="1" fill="currentColor" />
      </symbol>
      <symbol id="icon-backward" viewBox="0 0 24 24">
        <path d="M11 18.5 3 12l8-6.5zM21 18.5 13 12l8-6.5z" fill="currentColor" />
      </symbol>
      <symbol id="icon-forward" viewBox="0 0 24 24">
        <path d="M13 18.5 21 12l-8-6.5zM3 18.5 11 12 3 5.5z" fill="currentColor" />
      </symbol>
      <symbol id="icon-volume" viewBox="0 0 24 24">
        <path
          d="M11 5 6 9H3v6h3l5 4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15.5 8.5a5 5 0 0 1 0 7M18.6 5.2a9.5 9.5 0 0 1 0 13.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id="icon-volume-off" viewBox="0 0 24 24">
        <path
          d="M11 5 6 9H3v6h3l5 4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="m16 9 5 6M21 9l-5 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id="icon-audio-track" viewBox="0 0 24 24">
        <path d="M4 11v2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M8 7v10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M12 4v16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 6v12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M20 9v6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </symbol>
      <symbol id="icon-subtitles" viewBox="0 0 24 24">
        <rect
          x="3.5"
          y="5.5"
          width="17"
          height="13"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M7 10.5h4.5M13.5 10.5H17M7 14h7.5M16.5 14H17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </symbol>
      <symbol id="icon-minimize" viewBox="0 0 24 24">
        <line
          x1="5"
          y1="12"
          x2="19"
          y2="12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </symbol>
      <symbol id="icon-maximize" viewBox="0 0 24 24">
        <rect
          x="5"
          y="5"
          width="14"
          height="14"
          rx="2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </symbol>
      <symbol id="icon-restore" viewBox="0 0 24 24">
        <path
          d="M9 9h10v10H9z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M15 9V5H5v10h4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id="icon-close" viewBox="0 0 24 24">
        <path
          d="m7 7 10 10M17 7 7 17"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </symbol>
      <symbol id="icon-check" viewBox="0 0 24 24">
        <path
          d="m5.5 12.5 4 4 9-9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id="icon-fullscreen-enter" viewBox="0 0 24 24">
        <path
          d="M15 4h5v5M9 20H4v-5M20 15v5h-5M4 9V4h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
      <symbol id="icon-fullscreen-exit" viewBox="0 0 24 24">
        <path
          d="M4 8h4V4M16 4v4h4M20 16h-4v4M8 20v-4H4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </symbol>
    </svg>
  );
}

export function PlayerIcon({ name, className }: PlayerIconProps) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#icon-${name}`} />
    </svg>
  );
}
