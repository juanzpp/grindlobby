use tauri::{WebviewUrl, WebviewWindowBuilder};
use url::Url;

const PRODUCTION_URL: &str = "https://grindlobby.onrender.com/?desktop=1";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let url = Url::parse(PRODUCTION_URL).expect("invalid GrindLobby production URL");
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("GrindLobby")
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 640.0)
                .resizable(true)
                .center()
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running GrindLobby desktop");
}
