use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use std::collections::{HashMap, HashSet};
use std::io::{Read, Write};
use std::sync::Mutex;
use std::time::Duration;
use sysinfo::{Pid, System};
use tauri::{AppHandle, Emitter, Manager, State};

struct PtyHandle {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child_pid: Option<u32>,
    #[allow(dead_code)]
    child: Box<dyn Child + Send + Sync>,
}

#[derive(Default)]
struct PtyState(Mutex<HashMap<String, PtyHandle>>);

#[tauri::command]
fn spawn_pty(
    app: AppHandle,
    state: State<PtyState>,
    id: String,
    shell: Option<String>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell_cmd = shell.unwrap_or_else(|| {
        if cfg!(windows) {
            "cmd.exe".to_string()
        } else {
            std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
        }
    });
    let mut cmd = CommandBuilder::new(&shell_cmd);
    if let Some(cwd) = cwd {
        cmd.cwd(cwd);
    }
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if cfg!(windows) && shell_cmd.to_lowercase().contains("cmd") {
        cmd.env("PROMPT", "$e]9;9;$P$e\\$P$G");
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| e.to_string())?;
    let child_pid = child.process_id();
    drop(pair.slave);

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    let event_name = format!("pty-data-{}", id);
    let close_event = format!("pty-close-{}", id);
    let app_clone = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let s = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_clone.emit(&event_name, s);
                }
                Err(_) => break,
            }
        }
        let _ = app_clone.emit(&close_event, ());
    });

    state.0.lock().unwrap().insert(
        id,
        PtyHandle {
            writer,
            master: pair.master,
            child_pid,
            child,
        },
    );
    Ok(())
}

#[tauri::command]
fn write_pty(state: State<PtyState>, id: String, data: String) -> Result<(), String> {
    let mut map = state.0.lock().unwrap();
    let handle = map.get_mut(&id).ok_or_else(|| "no pty".to_string())?;
    handle
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    handle.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn resize_pty(
    state: State<PtyState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let map = state.0.lock().unwrap();
    let handle = map.get(&id).ok_or_else(|| "no pty".to_string())?;
    handle
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn kill_pty(state: State<PtyState>, id: String) -> Result<(), String> {
    state.0.lock().unwrap().remove(&id);
    Ok(())
}

#[tauri::command]
fn save_paste_image(bytes: Vec<u8>) -> Result<String, String> {
    let mut dir = std::env::temp_dir();
    dir.push("gridterm");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    dir.push(format!("paste-{}.png", ts));
    std::fs::write(&dir, &bytes).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

// Reads a bitmap image from the OS clipboard (e.g. Windows Snipping Tool),
// encodes it as PNG, and saves it to the same temp dir as `save_paste_image`.
// Returns the saved path, or an empty string if the clipboard has no image.
// Runs entirely on the Rust side so the WebView never has to prompt for
// clipboard permission.
#[tauri::command]
fn read_clipboard_image() -> Result<String, String> {
    let mut clipboard = arboard::Clipboard::new().map_err(|e| e.to_string())?;
    let img = match clipboard.get_image() {
        Ok(img) => img,
        Err(_) => return Ok(String::new()),
    };
    let width = img.width as u32;
    let height = img.height as u32;
    let buffer: image::RgbaImage =
        image::ImageBuffer::from_raw(width, height, img.bytes.into_owned())
            .ok_or_else(|| "invalid clipboard bitmap".to_string())?;
    let mut dir = std::env::temp_dir();
    dir.push("gridterm");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();
    dir.push(format!("paste-{}.png", ts));
    buffer.save(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

fn descendant_status(sys: &System, root: Pid) -> &'static str {
    let mut queue = vec![root];
    let mut seen: HashSet<Pid> = HashSet::new();
    seen.insert(root);
    while let Some(pid) = queue.pop() {
        for (_, p) in sys.processes() {
            if p.parent() == Some(pid) && seen.insert(p.pid()) {
                let name = p.name().to_string_lossy().to_lowercase();
                let cmdline: String = p
                    .cmd()
                    .iter()
                    .map(|s| s.to_string_lossy().to_lowercase())
                    .collect::<Vec<_>>()
                    .join(" ");
                let hay = format!("{} {}", name, cmdline);
                if hay.contains("claude") {
                    return "claude";
                }
                queue.push(p.pid());
            }
        }
    }
    "shell"
}

fn start_status_poller(app: AppHandle) {
    std::thread::spawn(move || {
        let mut sys = System::new();
        let mut last: HashMap<String, String> = HashMap::new();
        loop {
            std::thread::sleep(Duration::from_millis(1500));
            sys.refresh_all();
            let ids_pids: Vec<(String, u32)> = {
                let state = app.state::<PtyState>();
                let map = state.0.lock().unwrap();
                map.iter()
                    .filter_map(|(id, h)| h.child_pid.map(|p| (id.clone(), p)))
                    .collect()
            };
            for (id, pid) in ids_pids {
                let status = descendant_status(&sys, Pid::from_u32(pid)).to_string();
                if last.get(&id) != Some(&status) {
                    let _ = app.emit(&format!("pty-status-{}", id), &status);
                    last.insert(id, status);
                }
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(PtyState::default())
        .setup(|app| {
            start_status_poller(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            spawn_pty, write_pty, resize_pty, kill_pty, save_paste_image, read_clipboard_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
