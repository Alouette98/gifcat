use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::menu::{
    AboutMetadataBuilder, MenuBuilder, MenuEvent, MenuItemBuilder, PredefinedMenuItem,
    SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Manager, Wry};

#[derive(Deserialize, Default)]
pub struct MenuLabels {
    pub app_name: String,
    pub about: String,
    pub settings: String,
    pub services: String,
    pub hide: String,
    pub hide_others: String,
    pub show_all: String,
    pub quit: String,

    pub file: String,
    pub open_gif: String,
    pub export: String,
    pub close: String,

    pub edit: String,
    pub undo: String,
    pub redo: String,
    pub cut: String,
    pub copy: String,
    pub paste: String,
    pub select_all: String,

    pub view: String,
    pub play_pause: String,
    pub add_image: String,
    pub add_text: String,
    pub add_gif: String,
    pub watermark: String,

    pub window: String,
    pub minimize: String,
    pub zoom: String,
    pub bring_all_to_front: String,

    pub help: String,
    pub repository: String,
    pub report_issue: String,
}

#[derive(Serialize, Clone)]
struct MenuPayload {
    id: String,
}

const REPO_URL: &str = "https://github.com/momotou/gifcat";
const ISSUES_URL: &str = "https://github.com/momotou/gifcat/issues";

pub fn build_and_set_app_menu(app: &AppHandle, labels: MenuLabels) -> tauri::Result<()> {
    let about_metadata = AboutMetadataBuilder::new()
        .name(Some(labels.app_name.clone()))
        .version(Some(env!("CARGO_PKG_VERSION").to_string()))
        .build();

    let app_menu = SubmenuBuilder::new(app, &labels.app_name)
        .item(&PredefinedMenuItem::about(
            app,
            Some(&format!("{} {}", labels.about, labels.app_name)),
            Some(about_metadata),
        )?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("app:settings", &labels.settings)
                .accelerator("Cmd+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::services(app, Some(&labels.services))?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some(&labels.hide))?)
        .item(&PredefinedMenuItem::hide_others(app, Some(&labels.hide_others))?)
        .item(&PredefinedMenuItem::show_all(app, Some(&labels.show_all))?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some(&labels.quit))?)
        .build()?;

    let file_menu = SubmenuBuilder::new(app, &labels.file)
        .item(
            &MenuItemBuilder::with_id("file:open", &labels.open_gif)
                .accelerator("Cmd+O")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("file:export", &labels.export)
                .accelerator("Cmd+E")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::close_window(app, Some(&labels.close))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, &labels.edit)
        .item(
            &MenuItemBuilder::with_id("edit:undo", &labels.undo)
                .accelerator("Cmd+Z")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("edit:redo", &labels.redo)
                .accelerator("Cmd+Shift+Z")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some(&labels.cut))?)
        .item(&PredefinedMenuItem::copy(app, Some(&labels.copy))?)
        .item(&PredefinedMenuItem::paste(app, Some(&labels.paste))?)
        .item(&PredefinedMenuItem::select_all(app, Some(&labels.select_all))?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, &labels.view)
        .item(
            &MenuItemBuilder::with_id("view:play_pause", &labels.play_pause)
                .accelerator("Space")
                .build(app)?,
        )
        .separator()
        .item(&MenuItemBuilder::with_id("view:add_image", &labels.add_image).build(app)?)
        .item(&MenuItemBuilder::with_id("view:add_text", &labels.add_text).build(app)?)
        .item(&MenuItemBuilder::with_id("view:add_gif", &labels.add_gif).build(app)?)
        .item(&MenuItemBuilder::with_id("view:watermark", &labels.watermark).build(app)?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, &labels.window)
        .item(&PredefinedMenuItem::minimize(app, Some(&labels.minimize))?)
        .item(&PredefinedMenuItem::maximize(app, Some(&labels.zoom))?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, &labels.help)
        .item(&MenuItemBuilder::with_id("help:repository", &labels.repository).build(app)?)
        .item(&MenuItemBuilder::with_id("help:issue", &labels.report_issue).build(app)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ])
        .build()?;

    app.set_menu(menu)?;
    Ok(())
}

#[tauri::command]
pub fn rebuild_app_menu(app: AppHandle, labels: MenuLabels) -> Result<(), String> {
    build_and_set_app_menu(&app, labels).map_err(|e| format!("rebuild menu: {e}"))
}

pub fn handle_menu_event(app: &AppHandle<Wry>, event: MenuEvent) {
    let id = event.id().0.clone();

    let payload = MenuPayload { id: id.clone() };
    let _ = app.emit("gifcat://menu", &payload);

    match id.as_str() {
        "app:settings" => {
            if let Some(win) = app.get_webview_window("settings") {
                let _ = win.show();
                let _ = win.set_focus();
                return;
            }
            let _ = super::settings::open_settings_window(app.clone());
        }
        "help:repository" => {
            let _ = open_url(app, REPO_URL);
        }
        "help:issue" => {
            let _ = open_url(app, ISSUES_URL);
        }
        _ => {}
    }
}

fn open_url(app: &AppHandle, url: &str) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| format!("open url: {e}"))
}

pub fn default_labels() -> HashMap<&'static str, MenuLabels> {
    let mut m = HashMap::new();
    m.insert(
        "en",
        MenuLabels {
            app_name: "gifcat".into(),
            about: "About".into(),
            settings: "Settings…".into(),
            services: "Services".into(),
            hide: "Hide gifcat".into(),
            hide_others: "Hide Others".into(),
            show_all: "Show All".into(),
            quit: "Quit gifcat".into(),
            file: "File".into(),
            open_gif: "Open GIF…".into(),
            export: "Export…".into(),
            close: "Close Window".into(),
            edit: "Edit".into(),
            undo: "Undo".into(),
            redo: "Redo".into(),
            cut: "Cut".into(),
            copy: "Copy".into(),
            paste: "Paste".into(),
            select_all: "Select All".into(),
            view: "View".into(),
            play_pause: "Play / Pause".into(),
            add_image: "Add Image".into(),
            add_text: "Add Text".into(),
            add_gif: "Add GIF".into(),
            watermark: "Watermark".into(),
            window: "Window".into(),
            minimize: "Minimize".into(),
            zoom: "Zoom".into(),
            bring_all_to_front: "Bring All to Front".into(),
            help: "Help".into(),
            repository: "Repository".into(),
            report_issue: "Report Issue".into(),
        },
    );
    m
}
