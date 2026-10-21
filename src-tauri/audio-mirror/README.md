# Dolby Surround

The context-menu toggle uses a bundled, headless WASAPI worker. It is compiled
from these C# sources by `build.rs` using the .NET Framework compiler included
with Windows. No separately installed AudioBridge app is used.

Defaults reproduce the working AudioBridge setup:

- Source: the single active output whose name contains `D1Max` (EAZZE_D1Max).
- Copy: the single active Realtek `Speakers` / `Haut-parleurs` output.
- Full stereo, 100% copy gain, 200 ms additional delay.

The frontend switches Windows to Duplicate before starting the worker and
temporarily selects its exact WASAPI source in mpv. The worker waits up to ten
seconds for D1Max to appear. Disabling the option stops the worker, switches to
PC screen only and restores the previous mpv device. Failed audio activation
also returns to PC screen only. Windows default audio devices are unchanged.
The menu name does not imply Dolby decoding or discrete surround channels.
The worker exits when its stdin closes, and the backend
also terminates it on deactivation, main-window close, or application exit.
Runtime device failures are reported to the player and stop the copy.

The queue and WASAPI pipeline come from the already tested local AudioBridge
prototype. `--self-test` runs its offline DSP checks. NAudio 1.10.0 is distributed
with its MIT license alongside the generated worker.
