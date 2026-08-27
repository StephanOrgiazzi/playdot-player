mod audio_artwork;
mod launch;
mod svp;
mod thumbnail_frame;
#[cfg(windows)]
mod window_frame;

use tauri::{Emitter, Manager};

#[tauri::command]
fn set_modern_interface_enabled(window: tauri::Window, enabled: bool) -> Result<(), String> {
    #[cfg(windows)]
    return window_frame::set_enabled(&window, enabled);

    #[cfg(not(windows))]
    {
        let _ = (window, enabled);
        Ok(())
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(audio_artwork::AudioArtwork::default())
        .on_page_load(|webview, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                #[cfg(windows)]
                let _ = window_frame::sync(&webview.window());
                let _ = webview.window().show();
            }
        })
        .on_window_event(|window, event| {
            #[cfg(windows)]
            if matches!(
                event,
                tauri::WindowEvent::Resized(_) | tauri::WindowEvent::ScaleFactorChanged { .. }
            ) {
                let _ = window_frame::sync(window);
            }

            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                let _ = window.hide();
            }
        })
        .plugin(tauri_plugin_single_instance::init(|app, arguments, cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }

            if let Some(media_source) =
                launch::get_media_argument_from_process_arguments(&arguments, &cwd)
            {
                let _ = app.emit(launch::OPEN_MEDIA_SOURCE_EVENT, media_source);
            }
        }))
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_libmpv::init())
        .invoke_handler(tauri::generate_handler![
            audio_artwork::extract_audio_artwork,
            launch::get_startup_media_argument,
            svp::resolve_svp_integration,
            thumbnail_frame::create_thumbnail_target,
            thumbnail_frame::discard_thumbnail_frame,
            thumbnail_frame::promote_thumbnail_frame,
            thumbnail_frame::remove_thumbnail_target,
            set_modern_interface_enabled
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
