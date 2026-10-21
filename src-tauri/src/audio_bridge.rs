use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Read};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use tauri::Manager;

struct RunningBridge {
    child: Child,
    source_device: String,
}

impl Drop for RunningBridge {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Clone, Default)]
pub struct AudioBridgeState(Arc<Mutex<Option<RunningBridge>>>);

impl AudioBridgeState {
    pub fn stop(&self) {
        if let Ok(mut state) = self.0.lock() {
            state.take();
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioBridgeStatus {
    enabled: bool,
    error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DisplayMode {
    Duplicate,
    PcOnly,
}

#[tauri::command]
pub async fn audio_bridge_set_display_mode(mode: DisplayMode) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            use windows::Win32::Devices::Display::{
                SetDisplayConfig, SDC_APPLY, SDC_TOPOLOGY_CLONE, SDC_TOPOLOGY_INTERNAL,
            };
            let topology = match mode {
                DisplayMode::Duplicate => SDC_TOPOLOGY_CLONE,
                DisplayMode::PcOnly => SDC_TOPOLOGY_INTERNAL,
            };
            // With a topology flag Windows selects its last saved configuration.
            // No path or mode arrays are supplied for these documented presets.
            // https://learn.microsoft.com/windows/win32/api/winuser/nf-winuser-setdisplayconfig
            let result = unsafe { SetDisplayConfig(None, None, SDC_APPLY | topology) };
            if result != 0 {
                return Err(format!(
                    "Could not switch Windows display mode: {}",
                    std::io::Error::from_raw_os_error(result)
                ));
            }
            Ok(())
        }
        #[cfg(not(windows))]
        {
            let _ = mode;
            Err("Dolby Surround is available on Windows only.".into())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

fn worker_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let relative = "lib/audio-mirror/PlaydotAudioMirror.exe";
    let packaged = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join(relative);
    if packaged.is_file() {
        return Ok(packaged);
    }
    #[cfg(debug_assertions)]
    {
        let local = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(relative);
        if local.is_file() {
            return Ok(local);
        }
    }
    Err("The bundled audio mirror is missing. Rebuild PLAY. on Windows.".into())
}

fn start_worker(app: tauri::AppHandle, state: AudioBridgeState) -> Result<String, String> {
    if !cfg!(windows) {
        return Err("Dolby Surround is available on Windows only.".into());
    }
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if let Some(running) = guard.as_mut() {
        if running
            .child
            .try_wait()
            .map_err(|e| e.to_string())?
            .is_none()
        {
            return Ok(running.source_device.clone());
        }
    }
    guard.take();
    let mut command = Command::new(worker_path(&app)?);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    let child = command
        .spawn()
        .map_err(|e| format!("Could not start the audio mirror: {e}"))?;
    // Own the child before any fallible startup operation, so every error kills it.
    let mut running = RunningBridge {
        child,
        source_device: String::new(),
    };
    let stdout = running
        .child
        .stdout
        .take()
        .ok_or("Audio mirror stdout is unavailable")?;
    let (sender, receiver) = mpsc::sync_channel(1);
    std::thread::spawn(move || {
        let mut line = String::new();
        let result = BufReader::new(stdout).read_line(&mut line).map(|_| line);
        let _ = sender.send(result);
    });
    let line = receiver
        .recv_timeout(Duration::from_secs(15))
        .map_err(|_| {
            "Timed out while opening the projector and Realtek audio outputs.".to_string()
        })?
        .map_err(|e| e.to_string())?;
    if let Some(device) = line.trim().strip_prefix("READY\twasapi/") {
        if device.is_empty() {
            return Err("The audio mirror returned an empty source device.".into());
        }
        running.source_device = format!("wasapi/{device}");
        let source = running.source_device.clone();
        *guard = Some(running);
        Ok(source)
    } else {
        Err(line
            .trim()
            .strip_prefix("ERROR\t")
            .unwrap_or("The audio mirror could not start.")
            .to_string())
    }
}

#[tauri::command]
pub async fn audio_bridge_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, AudioBridgeState>,
) -> Result<String, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || start_worker(app, state))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn audio_bridge_stop(state: tauri::State<'_, AudioBridgeState>) -> Result<(), String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || state.stop())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn audio_bridge_status(
    state: tauri::State<'_, AudioBridgeState>,
) -> Result<AudioBridgeStatus, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        if let Some(running) = guard.as_mut() {
            if running
                .child
                .try_wait()
                .map_err(|e| e.to_string())?
                .is_none()
            {
                return Ok(AudioBridgeStatus {
                    enabled: true,
                    error: None,
                });
            }
            let mut error = String::new();
            if let Some(mut stderr) = running.child.stderr.take() {
                let _ = stderr.read_to_string(&mut error);
            }
            guard.take();
            return Ok(AudioBridgeStatus {
                enabled: false,
                error: Some(if error.trim().is_empty() {
                    "The projector audio mirror stopped.".into()
                } else {
                    error.trim().into()
                }),
            });
        }
        Ok(AudioBridgeStatus {
            enabled: false,
            error: None,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}
