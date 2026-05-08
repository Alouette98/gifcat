use serde::Deserialize;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use tauri::{AppHandle, Emitter};

#[derive(Deserialize)]
pub struct TextOverlayDto {
    pub text: String,
    pub x: f64,
    pub y: f64,
    pub scale: f64,
    #[serde(rename = "fontSize")]
    pub font_size: f64,
    #[serde(rename = "fontFamily")]
    pub font_family: String,
    pub color: String,
    #[serde(rename = "strokeColor")]
    pub stroke_color: String,
    #[serde(rename = "strokeWidth")]
    pub stroke_width: f64,
    pub opacity: f64,
    #[serde(rename = "startMs")]
    pub start_ms: f64,
    #[serde(rename = "endMs")]
    pub end_ms: f64,
    #[serde(rename = "fadeInMs")]
    pub fade_in_ms: f64,
    #[serde(rename = "fadeOutMs")]
    pub fade_out_ms: f64,
}

#[derive(Deserialize)]
pub struct ImageOverlayDto {
    pub path: String,
    pub x: f64,
    pub y: f64,
    pub scale: f64,
    pub opacity: f64,
    #[serde(rename = "naturalWidth")]
    pub natural_width: f64,
    #[serde(rename = "naturalHeight")]
    pub natural_height: f64,
    #[serde(rename = "startMs")]
    pub start_ms: f64,
    #[serde(rename = "endMs")]
    pub end_ms: f64,
    #[serde(rename = "fadeInMs")]
    pub fade_in_ms: f64,
    #[serde(rename = "fadeOutMs")]
    pub fade_out_ms: f64,
}

#[derive(Deserialize)]
pub struct GifOverlayDto {
    pub path: String,
    pub x: f64,
    pub y: f64,
    pub scale: f64,
    pub opacity: f64,
    #[serde(rename = "naturalWidth")]
    pub natural_width: f64,
    #[serde(rename = "naturalHeight")]
    pub natural_height: f64,
    #[serde(rename = "startMs")]
    pub start_ms: f64,
    #[serde(rename = "endMs")]
    pub end_ms: f64,
    #[serde(rename = "fadeInMs")]
    pub fade_in_ms: f64,
    #[serde(rename = "fadeOutMs")]
    pub fade_out_ms: f64,
}

#[derive(Deserialize)]
#[serde(tag = "type")]
pub enum OverlayDto {
    #[serde(rename = "text")]
    Text(TextOverlayDto),
    #[serde(rename = "image")]
    Image(ImageOverlayDto),
    #[serde(rename = "gif")]
    Gif(GifOverlayDto),
}

#[derive(Deserialize)]
pub struct ExportRequest {
    #[serde(rename = "basePath")]
    pub base_path: String,
    #[serde(rename = "outputPath")]
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub overlays: Vec<OverlayDto>,
}

fn escape_drawtext(s: &str) -> String {
    s.replace('\\', "\\\\\\\\")
        .replace(':', "\\:")
        .replace('\'', "\\'")
        .replace('%', "%%")
}

fn hex_to_ffmpeg_color(hex: &str) -> String {
    let hex = hex.trim_start_matches('#');
    if hex.len() == 6 {
        format!("0x{hex}")
    } else if hex.len() == 8 {
        let (rgb, alpha) = hex.split_at(6);
        format!("0x{rgb}@0x{alpha}")
    } else {
        "0xffffff".to_string()
    }
}

fn build_filter_graph(req: &ExportRequest) -> String {
    let mut filters = Vec::new();
    let mut input_count = 1;
    let mut last_label = "[0:v]".to_string();

    for overlay in &req.overlays {
        match overlay {
            OverlayDto::Text(t) => {
                let font_size = (t.font_size * t.scale) as u32;
                let color = hex_to_ffmpeg_color(&t.color);
                let escaped = escape_drawtext(&t.text);
                let enable_start = t.start_ms / 1000.0;
                let enable_end = t.end_ms / 1000.0;
                let draw_x = t.x as i32;
                let draw_y = t.y as i32 - font_size as i32 / 2;

                let mut drawtext = format!(
                    "{last_label}drawtext=text='{escaped}':fontsize={font_size}:fontcolor={color}:x={draw_x}:y={draw_y}:enable='between(t,{enable_start:.3},{enable_end:.3})'"
                );

                if t.stroke_width > 0.0 {
                    let border = (t.stroke_width * t.scale) as u32;
                    let border_color = hex_to_ffmpeg_color(&t.stroke_color);
                    drawtext.push_str(&format!(
                        ":borderw={border}:bordercolor={border_color}"
                    ));
                }

                let out_label = format!("[t{}]", input_count);
                filters.push(format!("{drawtext}{out_label}"));
                last_label = out_label;
            }
            OverlayDto::Image(img) => {
                let w = (img.natural_width * img.scale) as u32;
                let h = (img.natural_height * img.scale) as u32;
                let draw_x = img.x as i32 - w as i32 / 2;
                let draw_y = img.y as i32 - h as i32 / 2;
                let enable_start = img.start_ms / 1000.0;
                let enable_end = img.end_ms / 1000.0;
                let in_label = format!("[{}:v]", input_count);
                let scaled_label = format!("[is{}]", input_count);

                filters.push(format!(
                    "{in_label}scale={w}:{h}{scaled_label}"
                ));

                let out_label = format!("[o{}]", input_count);
                filters.push(format!(
                    "{last_label}{scaled_label}overlay={draw_x}:{draw_y}:enable='between(t,{enable_start:.3},{enable_end:.3})'{out_label}"
                ));
                last_label = out_label;
                input_count += 1;
            }
            OverlayDto::Gif(gif) => {
                let w = (gif.natural_width * gif.scale) as u32;
                let h = (gif.natural_height * gif.scale) as u32;
                let draw_x = gif.x as i32 - w as i32 / 2;
                let draw_y = gif.y as i32 - h as i32 / 2;
                let enable_start = gif.start_ms / 1000.0;
                let enable_end = gif.end_ms / 1000.0;
                let in_label = format!("[{}:v]", input_count);
                let scaled_label = format!("[gs{}]", input_count);

                filters.push(format!(
                    "{in_label}scale={w}:{h}{scaled_label}"
                ));

                let out_label = format!("[o{}]", input_count);
                filters.push(format!(
                    "{last_label}{scaled_label}overlay={draw_x}:{draw_y}:shortest=1:enable='between(t,{enable_start:.3},{enable_end:.3})'{out_label}"
                ));
                last_label = out_label;
                input_count += 1;
            }
        }
    }

    let palette_label = format!("[pal{}]", input_count);
    let final_label = format!("[final{}]", input_count);
    filters.push(format!(
        "{last_label}split[s1][s2];[s1]palettegen=max_colors=256:stats_mode=diff{palette_label};[s2]{palette_label}paletteuse=dither=floyd_steinberg{final_label}"
    ));

    filters.join(";")
}

#[tauri::command]
pub async fn export_gif(app: AppHandle, request: ExportRequest) -> Result<String, String> {
    let ffmpeg = which_ffmpeg().ok_or_else(|| "ffmpeg not found in PATH".to_string())?;

    let filter = build_filter_graph(&request);

    let mut args: Vec<String> = Vec::new();
    args.push("-y".into());
    args.push("-i".into());
    args.push(request.base_path.clone());

    for overlay in &request.overlays {
        match overlay {
            OverlayDto::Image(img) => {
                args.push("-i".into());
                args.push(img.path.clone());
            }
            OverlayDto::Gif(gif) => {
                args.push("-ignore_loop".into());
                args.push("0".into());
                args.push("-i".into());
                args.push(gif.path.clone());
            }
            _ => {}
        }
    }

    args.push("-filter_complex".into());
    args.push(filter);

    let last_label_idx = {
        let mut c = 1;
        for o in &request.overlays {
            match o {
                OverlayDto::Image(_) | OverlayDto::Gif(_) => c += 1,
                _ => {}
            }
        }
        c
    };
    args.push("-map".into());
    args.push(format!("[final{}]", last_label_idx));

    args.push("-loop".into());
    args.push("0".into());
    args.push(request.output_path.clone());

    let mut child = Command::new(&ffmpeg)
        .args(&args)
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;

    let stderr = child.stderr.take().unwrap();
    let reader = BufReader::new(stderr);

    for line in reader.lines() {
        if let Ok(line) = line {
            let _ = app.emit("export-progress", &line);
        }
    }

    let status = child.wait().map_err(|e| format!("ffmpeg wait error: {e}"))?;
    if !status.success() {
        return Err(format!("ffmpeg exited with code {}", status.code().unwrap_or(-1)));
    }

    let out = PathBuf::from(&request.output_path);
    if !out.exists() {
        return Err("Output file was not created".into());
    }

    Ok(request.output_path)
}

fn which_ffmpeg() -> Option<PathBuf> {
    let output = Command::new("which")
        .arg("ffmpeg")
        .output()
        .ok()?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(PathBuf::from(path));
        }
    }
    None
}
