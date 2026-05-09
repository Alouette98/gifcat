use serde::Deserialize;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Emitter};

#[derive(Deserialize, Default, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Quality {
    #[default]
    Standard,
    High,
}

#[derive(Deserialize)]
pub struct ExportRequest {
    #[serde(rename = "outputPath")]
    pub output_path: String,
    pub fps: u32,
    #[serde(default)]
    pub quality: Quality,
    #[serde(rename = "framesDir")]
    pub frames_dir: String,
}

#[tauri::command]
pub fn export_create_tempdir() -> Result<String, String> {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("gifcat-export-{nanos}"));
    fs::create_dir_all(&dir).map_err(|e| format!("create tempdir: {e}"))?;
    Ok(dir.to_string_lossy().into_owned())
}

fn write_frame_to_disk(dir: &str, index: u32, bytes: &[u8]) -> Result<(), String> {
    let dir_path = PathBuf::from(dir);
    if !dir_path.is_dir() {
        return Err("frames dir does not exist".into());
    }
    let path = dir_path.join(format!("frame-{index:05}.png"));
    let mut f = fs::File::create(&path).map_err(|e| format!("create frame: {e}"))?;
    f.write_all(bytes).map_err(|e| format!("write frame: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn export_write_frame(request: Request<'_>) -> Result<(), String> {
    let bytes = match request.body() {
        InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("expected raw binary body".into()),
    };
    let headers = request.headers();
    let dir = headers
        .get("x-dir")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| "missing x-dir header".to_string())?;
    let index: u32 = headers
        .get("x-index")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| "missing/invalid x-index header".to_string())?;
    write_frame_to_disk(dir, index, bytes)
}

#[tauri::command]
pub async fn export_gif(app: AppHandle, request: ExportRequest) -> Result<String, String> {
    let frames_dir = PathBuf::from(&request.frames_dir);
    if !frames_dir.is_dir() {
        return Err(format!("frames dir not found: {}", request.frames_dir));
    }

    let mut frames: Vec<PathBuf> = fs::read_dir(&frames_dir)
        .map_err(|e| format!("read frames dir: {e}"))?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().and_then(|s| s.to_str()) == Some("png"))
        .collect();
    frames.sort();
    if frames.is_empty() {
        return Err("no frames to encode".into());
    }

    let result = match request.quality {
        Quality::Standard => encode_ffmpeg(&app, &frames_dir, &request),
        Quality::High => encode_gifski(&app, &frames, &request),
    };

    let _ = fs::remove_dir_all(&frames_dir);
    result?;

    let out = PathBuf::from(&request.output_path);
    if !out.exists() {
        return Err("Output file was not created".into());
    }
    Ok(request.output_path)
}

fn encode_ffmpeg(
    app: &AppHandle,
    frames_dir: &Path,
    req: &ExportRequest,
) -> Result<(), String> {
    let ffmpeg = which_bin("ffmpeg").ok_or_else(|| "ffmpeg not found in PATH".to_string())?;
    let pattern = frames_dir.join("frame-%05d.png");

    let args: Vec<String> = vec![
        "-y".into(),
        "-framerate".into(),
        req.fps.to_string(),
        "-i".into(),
        pattern.to_string_lossy().into_owned(),
        "-vf".into(),
        "split[s1][s2];[s1]palettegen=max_colors=256:stats_mode=diff[pal];[s2][pal]paletteuse=dither=floyd_steinberg"
            .into(),
        "-loop".into(),
        "0".into(),
        req.output_path.clone(),
    ];

    run_and_stream(app, &ffmpeg, &args, "ffmpeg")
}

fn encode_gifski(
    app: &AppHandle,
    frames: &[PathBuf],
    req: &ExportRequest,
) -> Result<(), String> {
    let gifski = which_bin("gifski").ok_or_else(|| {
        "gifski not found in PATH. Install with `brew install gifski`, or use Standard quality."
            .to_string()
    })?;

    let mut args: Vec<String> = Vec::new();
    args.push("--fps".into());
    args.push(req.fps.to_string());
    args.push("--quality".into());
    args.push("90".into());
    args.push("-o".into());
    args.push(req.output_path.clone());
    for f in frames {
        args.push(f.to_string_lossy().into_owned());
    }

    run_and_stream(app, &gifski, &args, "gifski")
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quality_parses_lowercase() {
        let j = r#"{
            "outputPath": "/tmp/out.gif",
            "fps": 25,
            "quality": "high",
            "framesDir": "/tmp/frames"
        }"#;
        let r: ExportRequest = serde_json::from_str(j).unwrap();
        assert!(matches!(r.quality, Quality::High));
        assert_eq!(r.fps, 25);
    }

    #[test]
    fn quality_default_is_standard() {
        let j = r#"{
            "outputPath": "/tmp/out.gif",
            "fps": 20,
            "framesDir": "/tmp/frames"
        }"#;
        let r: ExportRequest = serde_json::from_str(j).unwrap();
        assert!(matches!(r.quality, Quality::Standard));
    }

    #[test]
    fn tempdir_is_created_and_unique() {
        let a = export_create_tempdir().unwrap();
        let b = export_create_tempdir().unwrap();
        assert_ne!(a, b);
        assert!(PathBuf::from(&a).is_dir());
        assert!(PathBuf::from(&b).is_dir());
        let _ = fs::remove_dir_all(&a);
        let _ = fs::remove_dir_all(&b);
    }

    #[test]
    fn write_frame_creates_file() {
        let dir = export_create_tempdir().unwrap();
        let bytes: [u8; 8] = [137, 80, 78, 71, 13, 10, 26, 10];
        write_frame_to_disk(&dir, 7, &bytes).unwrap();
        let p = PathBuf::from(&dir).join("frame-00007.png");
        assert!(p.is_file());
        let _ = fs::remove_dir_all(&dir);
    }
}
