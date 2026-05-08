mod commands;
mod gif;

use commands::decode_gif::decode_gif;
use commands::export_gif::export_gif;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![decode_gif, export_gif])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
