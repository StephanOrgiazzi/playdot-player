use tauri::{Runtime, Window};
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Dwm::{
    DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_DEFAULT, DWMWCP_ROUND,
};

pub fn sync<R: Runtime>(window: &Window<R>) -> Result<(), String> {
    let native_handle = window.hwnd().map_err(|error| error.to_string())?;
    let hwnd = HWND(native_handle.0);
    let is_fullscreen = window.is_fullscreen().map_err(|error| error.to_string())?;
    let is_maximized = window.is_maximized().map_err(|error| error.to_string())?;

    // Native shadows add non-client insets to undecorated Windows windows.
    window
        .set_shadow(false)
        .map_err(|error| format!("failed to disable the window shadow: {error}"))?;

    let preference = if is_fullscreen || is_maximized {
        DWMWCP_DEFAULT
    } else {
        DWMWCP_ROUND
    };
    if let Err(error) = unsafe {
        DwmSetWindowAttribute(
            hwnd,
            DWMWA_WINDOW_CORNER_PREFERENCE,
            std::ptr::from_ref(&preference).cast(),
            std::mem::size_of_val(&preference) as u32,
        )
    } {
        // Windows 10 does not support the Windows 11 corner preference.
        if error.code() != windows::Win32::Foundation::E_INVALIDARG {
            return Err(format!("failed to update the window corners: {error}"));
        }
    }

    Ok(())
}
