import type { RefObject } from "react";

export type ContextMenuPosition = {
  x: number;
  y: number;
};

export type TitlebarPointerDown = {
  startedOnTitlePill: boolean;
  x: number;
  y: number;
};

export type TitlebarPointerDownRef = RefObject<TitlebarPointerDown | null>;
