fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["performance_snapshot"])),
    )
    .expect("failed to build GrindLobby Tauri manifest");
}
