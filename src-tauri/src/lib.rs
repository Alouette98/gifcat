mod commands;
mod gif;

use commands::decode_gif::decode_gif;
use commands::export_gif::{export_create_tempdir, export_gif, export_write_frame};
use commands::settings::{
    autostart_disable, autostart_enable, autostart_is_enabled, extension_install,
    extension_status, open_settings_window,
};
use tauri_plugin_autostart::MacosLauncher;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            decode_gif,
            export_gif,
            export_create_tempdir,
            export_write_frame,
            open_settings_window,
            autostart_is_enabled,
            autostart_enable,
            autostart_disable,
            extension_status,
            extension_install
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
