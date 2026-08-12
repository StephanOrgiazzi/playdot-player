import { Effect, Schedule, Schema } from "effect";
import { LatestValueWriter } from "@shared/lib/LatestValueWriter";
import { setVideoMarginRatio, type VideoMarginRatio } from "./libmpv-api";

const EMPTY_RATIO: Required<VideoMarginRatio> = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

const HIDDEN_RATIO: Required<VideoMarginRatio> = {
  left: 0,
  right: 0,
  top: 1,
  bottom: 0,
};

class VideoViewportError extends Schema.TaggedErrorClass<VideoViewportError>()(
  "VideoViewport.MarginUpdateError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Failed to update video viewport margins";
  }
}

const applyVideoMarginRatio = Effect.fn("VideoViewport.applyMarginRatio")(
  (ratio: VideoMarginRatio): Effect.Effect<void, VideoViewportError> =>
    Effect.tryPromise({
      try: () => setVideoMarginRatio(ratio),
      catch: (cause) => new VideoViewportError({ cause }),
    }).pipe(
      Effect.retry(Schedule.recurs(2)),
      Effect.catch((error) => Effect.logError("VideoViewport.margin_update_failed", error)),
    ),
);

let layoutRatio = EMPTY_RATIO;
let desiredRatio = EMPTY_RATIO;
let hidden = false;
const marginWriter = new LatestValueWriter<Required<VideoMarginRatio>>((ratio) =>
  Effect.runPromise(applyVideoMarginRatio(ratio)),
);

function ratiosAreEqual(
  left: Required<VideoMarginRatio>,
  right: Required<VideoMarginRatio>,
): boolean {
  return (
    left.left === right.left &&
    left.right === right.right &&
    left.top === right.top &&
    left.bottom === right.bottom
  );
}

function updateDesiredRatio(ratio: Required<VideoMarginRatio>): Promise<void> {
  if (ratiosAreEqual(desiredRatio, ratio)) {
    return marginWriter.whenIdle();
  }

  desiredRatio = ratio;
  return marginWriter.write(ratio);
}

export function setVideoViewportLayout(ratio: Required<VideoMarginRatio>): void {
  layoutRatio = ratio;
  if (!hidden) {
    updateDesiredRatio(layoutRatio).catch(() => undefined);
  }
}

export function setVideoViewportHidden(value: boolean): Promise<void> {
  hidden = value;
  return updateDesiredRatio(hidden ? HIDDEN_RATIO : layoutRatio);
}
