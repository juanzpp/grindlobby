use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const PRODUCTION_ORIGIN: &str = "grindlobby.onrender.com";
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

  const activateDesktopMode = () => {
    const root = document.documentElement;
    if (!root) return;
    root.classList.add('grind-desktop-runtime');
    root.dataset.grindDesktop = '1';
  };

  activateDesktopMode();
  document.addEventListener('DOMContentLoaded', activateDesktopMode, { once: true });
})();
"#;

fn navigation_is_safe(url: &Url) -> bool {
    if url.as_str() == "about:blank" {
        return true;
    }

    url.scheme() == "https"
        && url.host_str() == Some(PRODUCTION_ORIGIN)
        && url.port_or_known_default() == Some(443)
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
