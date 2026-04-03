import type { MediaTrack } from "@features/player/model/playerState";
import type { MpvNodeValue } from "./libmpv-api";

function isMpvNodeObject(
  value: MpvNodeValue,
): value is { readonly [key: string]: MpvNodeValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMpvNodeArray(
  value: MpvNodeValue | undefined,
): value is readonly MpvNodeValue[] {
  return Array.isArray(value);
}

export function parseTracks(node: MpvNodeValue | undefined): MediaTrack[] {
  if (!isMpvNodeArray(node)) {
    return [];
  }

  return node
    .map((value) => {
      if (!isMpvNodeObject(value)) {
        return null;
      }

      const type = value.type === "audio" || value.type === "sub" ? value.type : null;
      const id = typeof value.id === "number" ? value.id : null;

      if (!type || id === null) {
        return null;
      }

      const title =
        typeof value.title === "string" && value.title.trim().length > 0
          ? value.title
          : `${type} ${id}`;

      const track: MediaTrack = {
        id,
        type,
        title,
        lang: typeof value.lang === "string" ? value.lang : undefined,
        selected: value.selected === true,
        external: value.external === true,
      };

      return track;
    })
    .filter((track): track is MediaTrack => track !== null);
}
