const MIN_PLAYBACK_SPEED = 0.01;

export function normalizePlaybackSpeed(speed: number): number {
  return Math.max(MIN_PLAYBACK_SPEED, Number(speed.toFixed(3)));
}
