use std::{env, fs, path::PathBuf};

fn main() {
    let source = fs::read_to_string("src/main.rs").expect("failed to read desktop main.rs");
    let patched = source.replace(
        "const API_ORIGIN: &str = \"https://grindlobby.onrender.com\";",
        "const API_ORIGIN: &str = \"https://eilaxaklqgyvgjgpkonv.supabase.co/functions/v1/grind-gateway\";",
    );
    let out = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR missing")).join("main_patched.rs");
    fs::write(out, patched).expect("failed to write patched desktop main");

    println!("cargo:rerun-if-changed=src/main.rs");

    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(&["performance_snapshot"])),
    )
    .expect("failed to build GrindLobby Tauri manifest");
}
