use reqwest::{Client, Method};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use sysinfo::{get_current_pid, ProcessesToUpdate, System};
use tauri::{State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const API_ORIGIN: &str = "https://grindlobby.onrender.com";

#[cfg(feature = "lite")]
const WINDOW_TITLE: &str = "GrindLobby Performance";
#[cfg(not(feature = "lite"))]
const WINDOW_TITLE: &str = "GrindLobby";

struct PerformanceState(Mutex<System>);
struct ApiState(Client);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApiRequest {
    method: String,
    path: String,
    body: Option<Value>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiResponse {
    status: u16,
    ok: bool,
    data: Value,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PerformanceSnapshot {
    app_pid: u32,
    app_memory_bytes: u64,
    app_virtual_memory_bytes: u64,
    app_cpu_percent_raw: f32,
    app_cpu_percent_normalized: f32,
    process_tree_memory_bytes: u64,
    process_tree_virtual_memory_bytes: u64,
    process_tree_cpu_percent_raw: f32,
    process_tree_cpu_percent_normalized: f32,
    child_processes: usize,
    system_memory_total_bytes: u64,
    system_memory_used_bytes: u64,
    system_cpu_percent: f32,
    logical_cpu_count: usize,
    process_uptime_seconds: u64,
    disk_read_bytes_delta: u64,
    disk_written_bytes_delta: u64,
}

fn safe_api_path(path: &str) -> bool {
    path.starts_with("/api/")
        && !path.contains("://")
        && !path.contains("..")
        && !path.contains('\\')
        && path.len() <= 512
}

#[tauri::command]
async fn api_request(state: State<'_, ApiState>, request: ApiRequest) -> Result<ApiResponse, String> {
    if !safe_api_path(&request.path) {
        return Err("API path rejected".to_string());
    }

    let method = match request.method.to_ascii_uppercase().as_str() {
        "GET" => Method::GET,
        "POST" => Method::POST,
        "PATCH" => Method::PATCH,
        "DELETE" => Method::DELETE,
        _ => return Err("HTTP method rejected".to_string()),
    };

    let url = format!("{API_ORIGIN}{}", request.path);
    let mut builder = state
        .0
        .request(method.clone(), url)
        .header("Accept", "application/json")
        .header("Origin", API_ORIGIN)
        .header("Referer", format!("{API_ORIGIN}/"));

    if method != Method::GET {
        builder = builder.header("Content-Type", "application/json");
        if let Some(body) = request.body {
            builder = builder.json(&body);
        }
    }

    let response = builder
        .send()
        .await
        .map_err(|error| format!("backend request failed: {error}"))?;
    let status = response.status().as_u16();
    let ok = response.status().is_success();
    let text = response
        .text()
        .await
        .map_err(|error| format!("backend response failed: {error}"))?;
    let data = serde_json::from_str::<Value>(&text).unwrap_or_else(|_| Value::String(text));

    Ok(ApiResponse { status, ok, data })
}

#[tauri::command]
fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|error| error.to_string())
}

#[tauri::command]
fn window_toggle_maximize(window: WebviewWindow) -> Result<(), String> {
    let maximized = window.is_maximized().map_err(|error| error.to_string())?;
    if maximized {
        window.unmaximize().map_err(|error| error.to_string())
    } else {
        window.maximize().map_err(|error| error.to_string())
    }
}

#[tauri::command]
fn window_close(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|error| error.to_string())
}

fn belongs_to_process_tree(system: &System, candidate: sysinfo::Pid, root: sysinfo::Pid) -> bool {
    if candidate == root {
        return true;
    }
    let mut current = candidate;
    for _ in 0..32 {
        let Some(process) = system.process(current) else {
            return false;
        };
        let Some(parent) = process.parent() else {
            return false;
        };
        if parent == root {
            return true;
        }
        if parent == current {
            return false;
        }
        current = parent;
    }
    false
}

#[tauri::command]
fn performance_snapshot(state: State<'_, PerformanceState>) -> Result<PerformanceSnapshot, String> {
    let pid = get_current_pid().map_err(|error| format!("pid unavailable: {error}"))?;
    let mut system = state
        .0
        .lock()
        .map_err(|_| "performance state poisoned".to_string())?;
    system.refresh_memory();
    system.refresh_cpu_usage();
    system.refresh_processes(ProcessesToUpdate::All, true);

    let logical_cpu_count = system.cpus().len().max(1);
    let mut tree_memory = 0_u64;
    let mut tree_virtual_memory = 0_u64;
    let mut tree_cpu = 0_f32;
    let mut child_processes = 0_usize;
    let mut disk_read = 0_u64;
    let mut disk_written = 0_u64;

    for (candidate_pid, process) in system.processes() {
        if belongs_to_process_tree(&system, *candidate_pid, pid) {
            tree_memory = tree_memory.saturating_add(process.memory());
            tree_virtual_memory = tree_virtual_memory.saturating_add(process.virtual_memory());
            tree_cpu += process.cpu_usage();
            let disk = process.disk_usage();
            disk_read = disk_read.saturating_add(disk.read_bytes);
            disk_written = disk_written.saturating_add(disk.written_bytes);
            if *candidate_pid != pid {
                child_processes += 1;
            }
        }
    }

    let process = system
        .process(pid)
        .ok_or_else(|| "GrindLobby process unavailable".to_string())?;
    let app_cpu_raw = process.cpu_usage();
    let normalize = |value: f32| (value / logical_cpu_count as f32).clamp(0.0, 100.0);

    Ok(PerformanceSnapshot {
        app_pid: pid.as_u32(),
        app_memory_bytes: process.memory(),
        app_virtual_memory_bytes: process.virtual_memory(),
        app_cpu_percent_raw: app_cpu_raw,
        app_cpu_percent_normalized: normalize(app_cpu_raw),
        process_tree_memory_bytes: tree_memory,
        process_tree_virtual_memory_bytes: tree_virtual_memory,
        process_tree_cpu_percent_raw: tree_cpu,
        process_tree_cpu_percent_normalized: normalize(tree_cpu),
        child_processes,
        system_memory_total_bytes: system.total_memory(),
        system_memory_used_bytes: system.used_memory(),
        system_cpu_percent: system.global_cpu_usage(),
        logical_cpu_count,
        process_uptime_seconds: process.run_time(),
        disk_read_bytes_delta: disk_read,
        disk_written_bytes_delta: disk_written,
    })
}

fn main() {
    let api_client = Client::builder()
        .cookie_store(true)
        .user_agent("GrindLobbyDesktop/0.2")
        .build()
        .expect("failed to create GrindLobby API client");

    tauri::Builder::default()
        .manage(PerformanceState(Mutex::new(System::new_all())))
        .manage(ApiState(api_client))
        .invoke_handler(tauri::generate_handler![
            api_request,
            performance_snapshot,
            window_minimize,
            window_toggle_maximize,
            window_close
        ])
        .setup(|app| {
            let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title(WINDOW_TITLE)
                .decorations(false)
                .resizable(true)
                .center();

            #[cfg(feature = "lite")]
            let builder = builder
                .inner_size(1180.0, 760.0)
                .min_inner_size(900.0, 620.0);

            #[cfg(not(feature = "lite"))]
            let builder = builder
                .inner_size(1480.0, 920.0)
                .min_inner_size(1080.0, 680.0);

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running GrindLobby desktop");
}
