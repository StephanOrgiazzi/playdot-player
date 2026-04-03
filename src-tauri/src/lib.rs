mod launch;
mod svp;

pub fn run() {
    tauri::Builder::default()
        .on_page_load(|webview, payload| {
            if matches!(payload.event(), tauri::webview::PageLoadEvent::Finished) {
                let _ = webview.window().show();
            }
        })
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_libmpv::init())
        .invoke_handler(tauri::generate_handler![
            launch::get_startup_media_argument,
            svp::resolve_svp_integration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
