import type { JSX } from "react";
import type { PlayerAction } from "@features/player/model/types";
import { PlayerIcon } from "@features/player/ui/PlayerIcons";
import { MenuActionItem } from "./MenuActionItem";

type EnhancementMenuItemsProps = {
  hasMedia: boolean;
  hasVideo: boolean;
  isFsrEnabled: boolean;
  isAudioNormalizerEnabled: boolean;
  isStereoDownmixEnabled: boolean;
  isSvpAvailable: boolean;
  isSvpEnabled: boolean;
  toggleFsr: PlayerAction;
  toggleAudioNormalizer: PlayerAction;
  toggleStereoDownmix: PlayerAction;
  toggleSvp: PlayerAction;
  runAction: (action: PlayerAction) => void;
};

export function EnhancementMenuItems({
  hasMedia,
  hasVideo,
  isFsrEnabled,
  isAudioNormalizerEnabled,
  isStereoDownmixEnabled,
  isSvpAvailable,
  isSvpEnabled,
  toggleFsr,
  toggleAudioNormalizer,
  toggleStereoDownmix,
  toggleSvp,
  runAction,
}: EnhancementMenuItemsProps): JSX.Element {
  return (
    <>
      {hasVideo ? (
        <MenuActionItem
          label="Upscale"
          shortcut="U"
          onClick={(): void => runAction(toggleFsr)}
          icon={isFsrEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null}
        />
      ) : null}
      {hasVideo ? (
        <MenuActionItem
          label="Audio Normalizer"
          shortcut="N"
          role="menuitemcheckbox"
          ariaChecked={isAudioNormalizerEnabled}
          onClick={(): void => runAction(toggleAudioNormalizer)}
          icon={
            isAudioNormalizerEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null
          }
        />
      ) : null}
      <MenuActionItem
        label="Stereo Downmix"
        shortcut="D"
        role="menuitemcheckbox"
        ariaChecked={isStereoDownmixEnabled}
        disabled={!hasMedia}
        onClick={(): void => runAction(toggleStereoDownmix)}
        icon={isStereoDownmixEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null}
      />
      {hasVideo && isSvpAvailable ? (
        <MenuActionItem
          label="Use Installed SVP"
          role="menuitemcheckbox"
          ariaChecked={isSvpEnabled}
          disabled={!hasMedia}
          onClick={(): void => runAction(toggleSvp)}
          icon={isSvpEnabled ? <PlayerIcon name="check" className="icon icon--xs" /> : null}
        />
      ) : null}
    </>
  );
}
