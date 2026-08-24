# Third-party notices

PLAY. is MIT-licensed, but its Windows playback stack includes third-party components under their own licenses.

## mpv / libmpv

- Component: mpv / libmpv
- Runtime revision: `94335ab87a`
- Binary build release: `zhongfly/mpv-winbuild` `2026-07-18-94335ab87a`
- Required build flavor for PLAY.: LGPL development build (`mpv-dev-lgpl-*`)
- License: GNU Lesser General Public License 2.1 or later for the LGPL-compatible build
- Source: https://github.com/mpv-player/mpv/tree/94335ab87a
- Build provenance: https://github.com/zhongfly/mpv-winbuild

## FFmpeg

FFmpeg libraries are included as part of the LGPL libmpv Windows runtime selected above.

- License: LGPL-compatible configuration of FFmpeg
- Upstream source: https://github.com/FFmpeg/FFmpeg
- Build provenance: https://github.com/zhongfly/mpv-winbuild

## libmpv-wrapper

- Component: `nini22P/libmpv-wrapper`
- Version: `v0.1.1`
- License: GNU Lesser General Public License 2.1
- Source: https://github.com/nini22P/libmpv-wrapper/tree/v0.1.1

## tauri-plugin-libmpv

- Component: `nini22P/tauri-plugin-libmpv`
- Version: `0.3.2`
- License: Mozilla Public License 2.0
- Crate: https://crates.io/crates/tauri-plugin-libmpv/0.3.2
- Upstream source: https://github.com/nini22P/tauri-plugin-libmpv

## Bundled license copies

`bun run setup-lib` writes the applicable license texts, mpv copyright notice, this notice, and source provenance into `src-tauri/lib/licenses/`. That directory is already included in Tauri's `lib/**/*` bundled resources, so the files ship with Windows packages.
