use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const PRODUCTION_URL: &str = "https://grindlobby.onrender.com/?desktop=1";
const DESKTOP_INIT_SCRIPT: &str = r#"
(() => {
  if (window.location.origin !== 'https://grindlobby.onrender.com') return;
  try {
    Object.defineProperty(window, '__GRIND_DESKTOP__', {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });
  } catch (_) {
    window.__GRIND_DESKTOP__ = true;
  }
})();
"#;

fn navigation_is_safe(url: &Url) -> bool {
    url.scheme() == "https" || url.as_str() == "about:blank"
}

fn main() {
    let self_test = std::env::args().any(|arg| arg == "--self-test");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(move |app| {
            let url = Url::parse(PRODUCTION_URL).expect("invalid GrindLobby production URL");
            let mut window = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("GrindLobby")
                .inner_size(1440.0, 900.0)
                .min_inner_size(960.0, 640.0)
                .resizable(true)
                .center()
                .initialization_script(DESKTOP_INIT_SCRIPT)
                .on_navigation(navigation_is_safe);

            if self_test {
                window = window.additional_browser_args("--remote-debugging-port=9222");
            }

            window.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running GrindLobby desktop");
}
