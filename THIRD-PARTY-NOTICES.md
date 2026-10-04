# Third-party notices

PLAY. is MIT-licensed, but its Windows playback stack includes third-party components under their own licenses.

## mpv / libmpv

- Component: mpv / libmpv
- Runtime revision: `654e9382c0`
- Binary build release: `zhongfly/mpv-winbuild` `2026-08-24-654e9382c0`
- PLAY. durable mirror: `third-party-libmpv-2026-08-24-654e9382c0`
- Required build flavor for PLAY.: LGPL development build (`mpv-dev-lgpl-*`)
- License: GNU Lesser General Public License 2.1 or later for the LGPL-compatible build
- Source: https://github.com/mpv-player/mpv/tree/654e9382c0
- Build provenance: https://github.com/zhongfly/mpv-winbuild/releases/tag/2026-08-24-654e9382c0
- Binary mirror: https://github.com/StephanOrgiazzi/playdot-player/releases/tag/third-party-libmpv-2026-08-24-654e9382c0

## FFmpeg

FFmpeg libraries are included in the selected `mpv-dev-lgpl-*` Windows runtime. The build provider documents this flavor as statically linking FFmpeg under LGPLv3.

- License: GNU Lesser General Public License 3.0
- Exact source revision: derived from the pinned build release's `sha256.txt` by `scripts/setup-third-party-notices.mjs`
- Upstream source: https://github.com/FFmpeg/FFmpeg
- Build provenance: https://github.com/zhongfly/mpv-winbuild/releases/tag/2026-08-24-654e9382c0

## libmpv-wrapper

- Component: `nini22P/libmpv-wrapper`
- Version: `v0.1.1`
- License: GNU Lesser General Public License 2.1
- Source: https://github.com/nini22P/libmpv-wrapper/tree/v0.1.1

## tauri-plugin-libmpv

- Component: `nini22P/tauri-plugin-libmpv`
- Version: `0.3.2`
- Source revision: `5da4e044c276245dcfd8a279310e5106394a0679`
- License: Mozilla Public License 2.0
- Crate: https://crates.io/crates/tauri-plugin-libmpv/0.3.2
- Upstream source: https://github.com/nini22P/tauri-plugin-libmpv/tree/5da4e044c276245dcfd8a279310e5106394a0679

## Adaptive-sharpen

- Component: bacondither Adaptive-sharpen, DX11 version `2021-09-10`, mpv two-pass HQ port by flowreen
- Bundled file: `shaders/adaptive-luma-ultra.glsl` (existing resource filename retained)
- Port revision: `f9e1a1ee3ef6ed3047f20457ed5886daff85dcb5`
- Source: https://github.com/flowreen/Miscellaneous-shaders/blob/f9e1a1ee3ef6ed3047f20457ed5886daff85dcb5/Adaptive-sharpen%20-%20mpv/Adaptive-sharpen-mpv.glsl
- Upstream pull request: https://github.com/bacondither/Miscellaneous-shaders/pull/1
- License: BSD-2-Clause; reproduced below and retained in the shader source

```text
Copyright (c) 2015-2021, bacondither
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:
1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer
   in this position and unchanged.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE AUTHORS ``AS IS'' AND ANY EXPRESS OR
IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT, INDIRECT,
INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## Bundled license copies

`bun run setup-lib` writes the applicable license texts, mpv copyright notice, this notice, and source provenance into `src-tauri/lib/licenses/`. Remote license files are fetched from pinned revisions, and the FFmpeg revision is derived from the pinned Windows build metadata. For the FFmpeg LGPLv3 component, both the LGPLv3 and GPLv3 license texts are bundled. That directory is already included in Tauri's `lib/**/*` bundled resources, so the files ship with Windows packages.
