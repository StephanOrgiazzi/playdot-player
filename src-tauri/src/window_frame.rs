use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Runtime, Window};
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Gdi::{CreateRoundRectRgn, DeleteObject, SetWindowRgn};

const NATIVE_CORNER_RADIUS_CSS_PX: f64 = 24.0;
static MODERN_INTERFACE_ENABLED: AtomicBool = AtomicBool::new(true);

pub fn set_enabled<R: Runtime>(window: &Window<R>, enabled: bool) -> Result<(), String> {
    let previous = MODERN_INTERFACE_ENABLED.load(Ordering::Relaxed);
    MODERN_INTERFACE_ENABLED.store(enabled, Ordering::Relaxed);

    if let Err(error) = sync_enabled(window, enabled) {
        MODERN_INTERFACE_ENABLED.store(previous, Ordering::Relaxed);
        let _ = sync_enabled(window, previous);
        return Err(error);
    }

    Ok(())
}

pub fn sync<R: Runtime>(window: &Window<R>) -> Result<(), String> {
    sync_enabled(window, MODERN_INTERFACE_ENABLED.load(Ordering::Relaxed))
}

fn sync_enabled<R: Runtime>(window: &Window<R>, enabled: bool) -> Result<(), String> {
    let native_handle = window.hwnd().map_err(|error| error.to_string())?;
    let hwnd = HWND(native_handle.0);
    let is_fullscreen = window.is_fullscreen().map_err(|error| error.to_string())?;
    let is_maximized = window.is_maximized().map_err(|error| error.to_string())?;
    let should_round = enabled && !is_fullscreen && !is_maximized;

    if !should_round {
        if unsafe { SetWindowRgn(hwnd, None, true) } == 0 {
            return Err(format!(
                "failed to clear the window region: {}",
                std::io::Error::last_os_error()
            ));
        }

        window
            .set_shadow(!enabled && !is_fullscreen && !is_maximized)
            .map_err(|error| format!("failed to update the window shadow: {error}"))?;
        return Ok(());
    }

    window
        .set_shadow(false)
        .map_err(|error| format!("failed to disable the window shadow: {error}"))?;

    let size = window.inner_size().map_err(|error| error.to_string())?;
    let scale_factor = window.scale_factor().map_err(|error| error.to_string())?;
    let corner_diameter = (NATIVE_CORNER_RADIUS_CSS_PX * 2.0 * scale_factor).round() as i32;
    let region = unsafe {
        CreateRoundRectRgn(
            0,
            0,
            size.width as i32 + 1,
            size.height as i32 + 1,
            corner_diameter,
            corner_diameter,
        )
    };

    if region.is_invalid() {
        return Err(format!(
            "failed to create the window region: {}",
            std::io::Error::last_os_error()
        ));
    }

    if unsafe { SetWindowRgn(hwnd, Some(region), true) } == 0 {
        let error = std::io::Error::last_os_error();
        unsafe {
            let _ = DeleteObject(region.into());
        }
        return Err(format!("failed to apply the window region: {error}"));
    }

    Ok(())
}
