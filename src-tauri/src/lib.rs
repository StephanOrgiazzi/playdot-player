mod audio_artwork;
mod launch;
mod svp;

use tauri::{Emitter, Manager};

pub fn run() {
    tauri::Builder::default()
        .on_page_load(|webview, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                let _ = webview.window().show();
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
            svp::resolve_svp_integration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
