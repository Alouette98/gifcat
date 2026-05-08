use serde::Deserialize;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
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
    #[serde(default)]
    pub quality: Quality,
    #[serde(rename = "fps", default = "default_fps")]
    pub fps: u32,
}

#[derive(Deserialize, Default, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
    #[default]
    Standard,
    High,
}

fn default_fps() -> u32 {
    25
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
    build_filter_chain(req, true)
}

fn build_filter_chain(req: &ExportRequest, with_palette: bool) -> String {
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

    if with_palette {
        let palette_label = format!("[pal{}]", input_count);
        let final_label = format!("[final{}]", input_count);
        filters.push(format!(
            "{last_label}split[s1][s2];[s1]palettegen=max_colors=256:stats_mode=diff{palette_label};[s2]{palette_label}paletteuse=dither=floyd_steinberg{final_label}"
        ));
    } else {
        let final_label = format!("[final{}]", input_count);
        filters.push(format!("{last_label}copy{final_label}"));
    }

    filters.join(";")
}

fn final_label_idx(req: &ExportRequest) -> u32 {
    let mut c = 1u32;
    for o in &req.overlays {
        match o {
            OverlayDto::Image(_) | OverlayDto::Gif(_) => c += 1,
            _ => {}
        }
    }
    c
}

fn push_input_args(args: &mut Vec<String>, req: &ExportRequest) {
    args.push("-y".into());
    args.push("-i".into());
    args.push(req.base_path.clone());

    for overlay in &req.overlays {
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
}

fn run_and_stream(
    app: &AppHandle,
    bin: &Path,
    args: &[String],
    label: &str,
) -> Result<(), String> {
    let mut child = Command::new(bin)
        .args(args)
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn {label}: {e}"))?;

    let stderr = child.stderr.take().unwrap();
    for line in BufReader::new(stderr).lines().flatten() {
        let _ = app.emit("export-progress", &line);
    }

    let status = child
        .wait()
        .map_err(|e| format!("{label} wait error: {e}"))?;
    if !status.success() {
        return Err(format!(
            "{label} exited with code {}",
            status.code().unwrap_or(-1)
        ));
    }
    Ok(())
}

#[tauri::command]
pub async fn export_gif(app: AppHandle, request: ExportRequest) -> Result<String, String> {
    match request.quality {
        Quality::Standard => export_standard(app, request),
        Quality::High => export_high_quality(app, request),
    }
}

fn export_standard(app: AppHandle, request: ExportRequest) -> Result<String, String> {
    let ffmpeg = which_ffmpeg().ok_or_else(|| "ffmpeg not found in PATH".to_string())?;

    let filter = build_filter_graph(&request);

    let mut args: Vec<String> = Vec::new();
    push_input_args(&mut args, &request);
    args.push("-filter_complex".into());
    args.push(filter);
    args.push("-map".into());
    args.push(format!("[final{}]", final_label_idx(&request)));
    args.push("-loop".into());
    args.push("0".into());
    args.push(request.output_path.clone());

    run_and_stream(&app, &ffmpeg, &args, "ffmpeg")?;

    let out = PathBuf::from(&request.output_path);
    if !out.exists() {
        return Err("Output file was not created".into());
    }
    Ok(request.output_path)
}

fn export_high_quality(app: AppHandle, request: ExportRequest) -> Result<String, String> {
    let ffmpeg = which_ffmpeg().ok_or_else(|| "ffmpeg not found in PATH".to_string())?;
    let gifski = which_bin("gifski").ok_or_else(|| {
        "gifski not found in PATH. Install with `brew install gifski` or `cargo install gifski`, \
         or use Standard quality."
            .to_string()
    })?;

    let tmp_dir = make_tmp_dir("gifcat-export").map_err(|e| format!("tempdir: {e}"))?;
    let frame_pattern = tmp_dir.join("frame-%05d.png");

    let filter = build_filter_chain(&request, false);
    let mut args: Vec<String> = Vec::new();
    push_input_args(&mut args, &request);
    args.push("-filter_complex".into());
    args.push(filter);
    args.push("-map".into());
    args.push(format!("[final{}]", final_label_idx(&request)));
    args.push("-r".into());
    args.push(request.fps.to_string());
    args.push(frame_pattern.to_string_lossy().into_owned());

    run_and_stream(&app, &ffmpeg, &args, "ffmpeg")?;

    let mut frames: Vec<PathBuf> = fs::read_dir(&tmp_dir)
        .map_err(|e| format!("read tmp dir: {e}"))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("png"))
        .collect();
    frames.sort();
    if frames.is_empty() {
        let _ = fs::remove_dir_all(&tmp_dir);
        return Err("ffmpeg produced no frames for gifski".into());
    }

    let mut gargs: Vec<String> = Vec::new();
    gargs.push("--fps".into());
    gargs.push(request.fps.to_string());
    gargs.push("--quality".into());
    gargs.push("90".into());
    gargs.push("-o".into());
    gargs.push(request.output_path.clone());
    for f in &frames {
        gargs.push(f.to_string_lossy().into_owned());
    }

    let result = run_and_stream(&app, &gifski, &gargs, "gifski");
    let _ = fs::remove_dir_all(&tmp_dir);
    result?;

    let out = PathBuf::from(&request.output_path);
    if !out.exists() {
        return Err("Output file was not created".into());
    }
    Ok(request.output_path)
}

fn make_tmp_dir(prefix: &str) -> std::io::Result<PathBuf> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("{prefix}-{nanos}"));
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn which_bin(name: &str) -> Option<PathBuf> {
    let output = Command::new("which").arg(name).output().ok()?;
    if output.status.success() {
        let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !path.is_empty() {
            return Some(PathBuf::from(path));
        }
    }
    None
}

fn which_ffmpeg() -> Option<PathBuf> {
    which_bin("ffmpeg")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn req_empty() -> ExportRequest {
        ExportRequest {
            base_path: "/tmp/base.gif".into(),
            output_path: "/tmp/out.gif".into(),
            width: 320,
            height: 240,
            overlays: vec![],
            quality: Quality::Standard,
            fps: 25,
        }
    }

    fn text(x: f64, y: f64, text: &str) -> OverlayDto {
        OverlayDto::Text(TextOverlayDto {
            text: text.into(),
            x,
            y,
            scale: 1.0,
            font_size: 48.0,
            font_family: "sans".into(),
            color: "#ffffff".into(),
            stroke_color: "#000000".into(),
            stroke_width: 0.0,
            opacity: 1.0,
            start_ms: 0.0,
            end_ms: 1000.0,
            fade_in_ms: 0.0,
            fade_out_ms: 0.0,
        })
    }

    fn image(path: &str) -> OverlayDto {
        OverlayDto::Image(ImageOverlayDto {
            path: path.into(),
            x: 100.0,
            y: 100.0,
            scale: 1.0,
            opacity: 1.0,
            natural_width: 50.0,
            natural_height: 50.0,
            start_ms: 0.0,
            end_ms: 1000.0,
            fade_in_ms: 0.0,
            fade_out_ms: 0.0,
        })
    }

    #[test]
    fn hex_conversion() {
        assert_eq!(hex_to_ffmpeg_color("#ffffff"), "0xffffff");
        assert_eq!(hex_to_ffmpeg_color("ff0000"), "0xff0000");
        assert_eq!(hex_to_ffmpeg_color("#ff000080"), "0xff0000@0x80");
        assert_eq!(hex_to_ffmpeg_color("bad"), "0xffffff");
    }

    #[test]
    fn drawtext_escapes_colons_and_backslashes() {
        let s = escape_drawtext("a:b\\c'd%e");
        assert!(s.contains("\\:"));
        assert!(s.contains("\\'"));
        assert!(s.contains("%%"));
    }

    #[test]
    fn empty_overlays_palette_graph() {
        let r = req_empty();
        let g = build_filter_graph(&r);
        assert!(g.contains("palettegen"));
        assert!(g.contains("paletteuse"));
        assert!(g.contains("[final1]"));
    }

    #[test]
    fn empty_overlays_plain_graph() {
        let r = req_empty();
        let g = build_filter_chain(&r, false);
        assert!(!g.contains("palettegen"));
        assert!(g.contains("[final1]"));
    }

    #[test]
    fn text_overlay_included_in_graph() {
        let mut r = req_empty();
        r.overlays.push(text(10.0, 20.0, "Hi"));
        let g = build_filter_graph(&r);
        assert!(g.contains("drawtext"));
        assert!(g.contains("text='Hi'"));
    }

    #[test]
    fn image_overlay_advances_input_index() {
        let mut r = req_empty();
        r.overlays.push(image("/tmp/a.png"));
        r.overlays.push(image("/tmp/b.png"));
        // 1 base + 2 images => final index should be 3
        assert_eq!(final_label_idx(&r), 3);
        let g = build_filter_graph(&r);
        assert!(g.contains("[final3]"));
        assert!(g.contains("[1:v]"));
        assert!(g.contains("[2:v]"));
    }

    #[test]
    fn quality_default_is_standard() {
        let r = req_empty();
        assert!(matches!(r.quality, Quality::Standard));
    }

    #[test]
    fn quality_parses_from_json() {
        let j = r#"{
            "basePath": "/a.gif",
            "outputPath": "/b.gif",
            "width": 100, "height": 100,
            "overlays": [],
            "quality": "high"
        }"#;
        let r: ExportRequest = serde_json::from_str(j).unwrap();
        assert!(matches!(r.quality, Quality::High));
        assert_eq!(r.fps, 25);
    }
}
