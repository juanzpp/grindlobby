use serde::Serialize;
use std::sync::Mutex;
use sysinfo::{get_current_pid, ProcessesToUpdate, System};
use tauri::{State, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const PRODUCTION_HOST: &str = "grindlobby.onrender.com";

#[cfg(feature = "lite")]
const PRODUCTION_URL: &str = "https://grindlobby.onrender.com/desktop-lite?desktop=lite";
#[cfg(not(feature = "lite"))]
const PRODUCTION_URL: &str = "https://grindlobby.onrender.com/?desktop=1";

#[cfg(feature = "lite")]
const WINDOW_TITLE: &str = "GrindLobby Performance";
#[cfg(not(feature = "lite"))]
const WINDOW_TITLE: &str = "GrindLobby";

struct PerformanceState(Mutex<System>);

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

fn is_allowed_navigation(url: &Url) -> bool {
    url.scheme() == "https" && url.host_str() == Some(PRODUCTION_HOST)
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
    let mut system = state.0.lock().map_err(|_| "performance state poisoned".to_string())?;
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

    let process = system.process(pid).ok_or_else(|| "GrindLobby process unavailable".to_string())?;
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
    tauri::Builder::default()
        .manage(PerformanceState(Mutex::new(System::new_all())))
        .invoke_handler(tauri::generate_handler![performance_snapshot])
        .setup(|app| {
            let url = Url::parse(PRODUCTION_URL).expect("invalid GrindLobby production URL");
            let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .on_navigation(is_allowed_navigation)
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
