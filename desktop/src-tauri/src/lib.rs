mod screen_share;

use screen_share::{
    list_capture_sources,
    start_native_screen_share,
    stop_native_screen_share,
    NativeScreenState,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .manage(NativeScreenState::default())
        .setup(|app| {
            #[cfg(all(debug_assertions, windows))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_capture_sources,
            start_native_screen_share,
            stop_native_screen_share
        ])
        .run(tauri::generate_context!())
        .expect("error while running GrindLobby desktop");
}
