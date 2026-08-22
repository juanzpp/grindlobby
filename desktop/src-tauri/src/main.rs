use tauri::{WebviewUrl, WebviewWindowBuilder};
use url::Url;

#[cfg(feature = "lite")]
const PRODUCTION_URL: &str = "https://grindlobby.onrender.com/desktop-lite?desktop=lite";
#[cfg(not(feature = "lite"))]
const PRODUCTION_URL: &str = "https://grindlobby.onrender.com/?desktop=1";

#[cfg(feature = "lite")]
const WINDOW_TITLE: &str = "GrindLobby Performance";
#[cfg(not(feature = "lite"))]
const WINDOW_TITLE: &str = "GrindLobby";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let url = Url::parse(PRODUCTION_URL).expect("invalid GrindLobby production URL");
            let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title(WINDOW_TITLE)
                .resizable(true)
                .center();

            #[cfg(feature = "lite")]
            let builder = builder
                .inner_size(1180.0, 760.0)
                .min_inner_size(860.0, 560.0);

            #[cfg(not(feature = "lite"))]
            let builder = builder
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 640.0);

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running GrindLobby desktop");
}
