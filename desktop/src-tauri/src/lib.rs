mod screen_share;

use screen_share::{
    list_capture_sources,
    start_native_screen_share,
    stop_native_screen_share,
    NativeScreenState,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(NativeScreenState::default())
        .invoke_handler(tauri::generate_handler![
            list_capture_sources,
            start_native_screen_share,
            stop_native_screen_share
        ])
        .run(tauri::generate_context!())
        .expect("error while running GrindLobby desktop");
}
