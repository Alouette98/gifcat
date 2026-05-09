use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;
use tauri::window::{Effect, EffectState, EffectsBuilder};
use tauri::{AppHandle, Manager, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_autostart::ManagerExt;

#[tauri::command]
pub fn open_settings_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("settings") {
        let _ = win.show();
        let _ = win.set_focus();
        return Ok(());
    }

    WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("index.html#settings".into()))
        .title("Settings")
        .inner_size(560.0, 420.0)
        .min_inner_size(520.0, 360.0)
        .resizable(false)
        .minimizable(false)
        .maximizable(false)
        .center()
        .title_bar_style(TitleBarStyle::Overlay)
        .hidden_title(true)
        .effects(
            EffectsBuilder::new()
                .effect(Effect::HudWindow)
                .state(EffectState::FollowsWindowActiveState)
                .build(),
        )
        .build()
        .map_err(|e| format!("failed to open settings window: {e}"))?;

    Ok(())
}

#[tauri::command]
pub fn autostart_is_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| format!("autostart check: {e}"))
}

#[tauri::command]
pub fn autostart_enable(app: AppHandle) -> Result<(), String> {
    app.autolaunch()
        .enable()
        .map_err(|e| format!("autostart enable: {e}"))
}

#[tauri::command]
pub fn autostart_disable(app: AppHandle) -> Result<(), String> {
    app.autolaunch()
        .disable()
        .map_err(|e| format!("autostart disable: {e}"))
}

#[derive(Serialize)]
pub struct ExtensionStatus {
    name: String,
    installed: bool,
    version: Option<String>,
    path: Option<String>,
}

fn allowed(name: &str) -> bool {
    matches!(name, "ffmpeg" | "gifski")
}

fn which(name: &str) -> Option<PathBuf> {
    let output = Command::new("which").arg(name).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        return None;
    }
    Some(PathBuf::from(path))
}

fn probe_version(name: &str, path: &PathBuf) -> Option<String> {
    let output = Command::new(path)
        .arg(if name == "gifski" { "--version" } else { "-version" })
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let first_line = stdout.lines().next().unwrap_or("").trim().to_string();
    if first_line.is_empty() {
        None
    } else {
        Some(first_line)
    }
}

#[tauri::command]
pub fn extension_status(name: String) -> Result<ExtensionStatus, String> {
    if !allowed(&name) {
        return Err("unknown extension".into());
    }
    match which(&name) {
        Some(path) => {
            let version = probe_version(&name, &path);
            Ok(ExtensionStatus {
                name,
                installed: true,
                version,
                path: Some(path.to_string_lossy().into_owned()),
            })
        }
        None => Ok(ExtensionStatus {
            name,
            installed: false,
            version: None,
            path: None,
        }),
    }
}

#[tauri::command]
pub fn extension_install(name: String) -> Result<(), String> {
    if !allowed(&name) {
        return Err("unknown extension".into());
    }
    let brew = which("brew")
        .ok_or_else(|| "Homebrew not found. Install it from https://brew.sh".to_string())?;
    let status = Command::new(brew)
        .args(["install", &name])
        .status()
        .map_err(|e| format!("failed to spawn brew: {e}"))?;
    if !status.success() {
        return Err(format!(
            "brew install {name} exited with {}",
            status.code().unwrap_or(-1)
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allowed_list_is_closed() {
        assert!(allowed("ffmpeg"));
        assert!(allowed("gifski"));
        assert!(!allowed("evil"));
        assert!(!allowed("ffmpeg; rm -rf /"));
    }
}
