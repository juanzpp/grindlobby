use livekit::options::{TrackPublishOptions, VideoCodec};
use livekit::prelude::*;
use livekit::track::{LocalTrack, LocalVideoTrack, TrackSource};
use livekit::webrtc::desktop_capturer::{
    CaptureError, CaptureSource, DesktopCaptureSourceType, DesktopCapturer, DesktopCapturerOptions,
    DesktopFrame,
};
use livekit::webrtc::native::yuv_helper;
use livekit::webrtc::prelude::{
    I420Buffer, RtcVideoSource, VideoBuffer, VideoFrame, VideoResolution, VideoRotation,
};
use livekit::webrtc::video_source::native::NativeVideoSource;
use serde::{Deserialize, Serialize};
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::{Arc, Condvar, Mutex};
use std::thread;
use std::time::Duration;
use tauri::State;
use tokio::sync::oneshot;

#[derive(Default)]
pub struct NativeScreenState {
    control: Mutex<Option<NativeShareControl>>,
}

struct NativeShareControl {
    stop_tx: oneshot::Sender<()>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSourceDto {
    id: u64,
    title: String,
    display_id: i64,
    kind: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartNativeShareRequest {
    token: String,
    url: String,
    source_kind: String,
    source_id: u64,
    preset: String,
    include_cursor: bool,
}

enum CaptureCommand {
    Terminate,
}

type ResolutionSignal = Arc<(Mutex<Option<VideoResolution>>, Condvar)>;
type VideoSourceSlot = Arc<Mutex<Option<NativeVideoSource>>>;

fn source_type(kind: &str) -> Result<DesktopCaptureSourceType, String> {
    match kind {
        "screen" => Ok(DesktopCaptureSourceType::Screen),
        "window" => Ok(DesktopCaptureSourceType::Window),
        _ => Err("Tipo de captura inválido.".to_string()),
    }
}

fn preset_spec(preset: &str) -> Result<(u32, u32, Duration), String> {
    match preset {
        "480p30" => Ok((854, 480, Duration::from_millis(33))),
        "480p60" => Ok((854, 480, Duration::from_millis(16))),
        "720p30" => Ok((1280, 720, Duration::from_millis(33))),
        "720p60" => Ok((1280, 720, Duration::from_millis(16))),
        "1080p30" => Ok((1920, 1080, Duration::from_millis(33))),
        "1080p60" => Ok((1920, 1080, Duration::from_millis(16))),
        _ => Err("Perfil de transmissão inválido.".to_string()),
    }
}

fn fitted_dimensions(source_width: i32, source_height: i32, max_width: u32, max_height: u32) -> (u32, u32) {
    let source_width = source_width.max(2) as f64;
    let source_height = source_height.max(2) as f64;
    let scale = (max_width as f64 / source_width)
        .min(max_height as f64 / source_height)
        .min(1.0);
    let mut width = (source_width * scale).round() as u32;
    let mut height = (source_height * scale).round() as u32;
    width = width.max(2) & !1;
    height = height.max(2) & !1;
    (width, height)
}

fn capture_sources(kind: &str) -> Result<Vec<(CaptureSource, CaptureSourceDto)>, String> {
    let source_type = source_type(kind)?;
    let options = DesktopCapturerOptions::new(source_type);
    let capturer = DesktopCapturer::new(options)
        .ok_or_else(|| "A captura nativa do Windows não está disponível neste computador.".to_string())?;

    Ok(capturer
        .get_source_list()
        .into_iter()
        .map(|source| {
            let title = source.title();
            let dto = CaptureSourceDto {
                id: source.id(),
                title: if title.trim().is_empty() {
                    if kind == "screen" { "Monitor".to_string() } else { "Janela".to_string() }
                } else {
                    title
                },
                display_id: source.display_id(),
                kind: kind.to_string(),
            };
            (source, dto)
        })
        .collect())
}

#[tauri::command]
pub fn list_capture_sources(kind: String) -> Result<Vec<CaptureSourceDto>, String> {
    Ok(capture_sources(&kind)?.into_iter().map(|(_, dto)| dto).collect())
}

fn wait_for_resolution(signal: &ResolutionSignal) -> VideoResolution {
    let (lock, cvar) = &**signal;
    let mut guard = lock.lock().expect("resolution mutex poisoned");
    while guard.is_none() {
        guard = cvar.wait(guard).expect("resolution condvar poisoned");
    }
    guard.clone().expect("resolution missing")
}

fn spawn_capture_thread(
    kind: String,
    source_id: u64,
    include_cursor: bool,
    interval: Duration,
    max_width: u32,
    max_height: u32,
    resolution_signal: ResolutionSignal,
    video_source_slot: VideoSourceSlot,
) -> Result<(Sender<CaptureCommand>, thread::JoinHandle<()>), String> {
    let source_type = source_type(&kind)?;
    let (command_tx, command_rx) = mpsc::channel();

    let handle = thread::spawn(move || {
        let callback = {
            let mut frame_buffer = VideoFrame {
                rotation: VideoRotation::VideoRotation0,
                timestamp_us: 0,
                frame_metadata: None,
                buffer: I420Buffer::new(1, 1),
            };
            let mut output_resolution: Option<(u32, u32)> = None;

            move |result: Result<DesktopFrame, CaptureError>| {
                let frame = match result {
                    Ok(frame) => frame,
                    Err(CaptureError::Temporary) | Err(CaptureError::Permanent) => return,
                };

                let width = frame.width();
                let height = frame.height();
                if width <= 0 || height <= 0 {
                    return;
                }

                if frame_buffer.buffer.width() as i32 != width || frame_buffer.buffer.height() as i32 != height {
                    frame_buffer.buffer = I420Buffer::new(width as u32, height as u32);
                }

                let (stride_y, stride_u, stride_v) = frame_buffer.buffer.strides();
                let (y_plane, u_plane, v_plane) = frame_buffer.buffer.data_mut();
                yuv_helper::argb_to_i420(
                    frame.data(),
                    frame.stride(),
                    y_plane,
                    stride_y,
                    u_plane,
                    stride_u,
                    v_plane,
                    stride_v,
                    width,
                    height,
                );

                let (target_width, target_height) = output_resolution
                    .unwrap_or_else(|| fitted_dimensions(width, height, max_width, max_height));
                if output_resolution.is_none() {
                    output_resolution = Some((target_width, target_height));
                    let (lock, cvar) = &*resolution_signal;
                    let mut guard = lock.lock().expect("resolution mutex poisoned");
                    *guard = Some(VideoResolution { width: target_width, height: target_height });
                    cvar.notify_all();
                }

                if let Some(source) = video_source_slot.lock().expect("video source mutex poisoned").as_ref() {
                    if width as u32 == target_width && height as u32 == target_height {
                        source.capture_frame(&frame_buffer);
                    } else {
                        let scaled_buffer = frame_buffer.buffer.scale(target_width as i32, target_height as i32);
                        let scaled_frame = VideoFrame {
                            rotation: VideoRotation::VideoRotation0,
                            timestamp_us: 0,
                            frame_metadata: None,
                            buffer: scaled_buffer,
                        };
                        source.capture_frame(&scaled_frame);
                    }
                }
            }
        };

        let mut options = DesktopCapturerOptions::new(source_type);
        options.set_include_cursor(include_cursor);
        let Some(mut capturer) = DesktopCapturer::new(options) else { return; };
        let selected = capturer.get_source_list().into_iter().find(|source| source.id() == source_id);
        let Some(selected) = selected else { return; };
        capturer.start_capture(Some(selected), callback);

        loop {
            match command_rx.recv_timeout(interval) {
                Ok(CaptureCommand::Terminate) => break,
                Err(RecvTimeoutError::Timeout) => capturer.capture_frame(),
                Err(RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    Ok((command_tx, handle))
}

#[tauri::command]
pub async fn start_native_screen_share(
    request: StartNativeShareRequest,
    state: State<'_, NativeScreenState>,
) -> Result<(), String> {
    let (max_width, max_height, interval) = preset_spec(&request.preset)?;
    let available = capture_sources(&request.source_kind)?;
    if !available.iter().any(|(_, dto)| dto.id == request.source_id) {
        return Err("A tela ou janela selecionada não está mais disponível.".to_string());
    }

    let previous = {
        let mut guard = state.control.lock().map_err(|_| "Falha interna no estado da transmissão.".to_string())?;
        guard.take()
    };
    if let Some(previous) = previous {
        let _ = previous.stop_tx.send(());
    }

    let (stop_tx, stop_rx) = oneshot::channel::<()>();
    let (ready_tx, ready_rx) = oneshot::channel::<Result<(), String>>();
    let request_for_task = request.clone();

    tauri::async_runtime::spawn(async move {
        let setup_result: Result<(Room, Sender<CaptureCommand>, thread::JoinHandle<()>), String> = async {
            let (room, _) = Room::connect(&request_for_task.url, &request_for_task.token, RoomOptions::default())
                .await
                .map_err(|error| format!("Não foi possível conectar o publisher nativo: {error}"))?;

            let resolution_signal: ResolutionSignal = Arc::new((Mutex::new(None), Condvar::new()));
            let video_source_slot: VideoSourceSlot = Arc::new(Mutex::new(None));
            let (capture_tx, capture_handle) = spawn_capture_thread(
                request_for_task.source_kind.clone(),
                request_for_task.source_id,
                request_for_task.include_cursor,
                interval,
                max_width,
                max_height,
                resolution_signal.clone(),
                video_source_slot.clone(),
            )?;

            let signal = resolution_signal.clone();
            let resolution = tauri::async_runtime::spawn_blocking(move || wait_for_resolution(&signal))
                .await
                .map_err(|error| format!("Falha ao iniciar captura: {error}"))?;

            let native_source = NativeVideoSource::new(resolution, true);
            *video_source_slot.lock().map_err(|_| "Falha interna na captura.".to_string())? = Some(native_source.clone());

            let track = LocalVideoTrack::create_video_track(
                "grind-native-screen",
                RtcVideoSource::Native(native_source),
            );

            room.local_participant()
                .publish_track(
                    LocalTrack::Video(track),
                    TrackPublishOptions {
                        source: TrackSource::Screenshare,
                        video_codec: VideoCodec::VP9,
                        ..Default::default()
                    },
                )
                .await
                .map_err(|error| format!("Falha ao publicar tela: {error}"))?;

            Ok((room, capture_tx, capture_handle))
        }
        .await;

        match setup_result {
            Ok((room, capture_tx, capture_handle)) => {
                let _ = ready_tx.send(Ok(()));
                let _ = stop_rx.await;
                let _ = capture_tx.send(CaptureCommand::Terminate);
                let _ = tauri::async_runtime::spawn_blocking(move || capture_handle.join()).await;
                let _ = room.close().await;
            }
            Err(error) => {
                let _ = ready_tx.send(Err(error));
            }
        }
    });

    {
        let mut guard = state.control.lock().map_err(|_| "Falha interna no estado da transmissão.".to_string())?;
        *guard = Some(NativeShareControl { stop_tx });
    }

    match ready_rx.await {
        Ok(Ok(())) => Ok(()),
        Ok(Err(error)) => {
            if let Ok(mut guard) = state.control.lock() {
                *guard = None;
            }
            Err(error)
        }
        Err(_) => {
            if let Ok(mut guard) = state.control.lock() {
                *guard = None;
            }
            Err("O publisher nativo encerrou antes de iniciar.".to_string())
        }
    }
}

#[tauri::command]
pub async fn stop_native_screen_share(state: State<'_, NativeScreenState>) -> Result<(), String> {
    let control = {
        let mut guard = state.control.lock().map_err(|_| "Falha interna no estado da transmissão.".to_string())?;
        guard.take()
    };
    if let Some(control) = control {
        let _ = control.stop_tx.send(());
    }
    Ok(())
}
