use crate::gif::decoder;
use serde::Serialize;
use std::path::PathBuf;

#[derive(Serialize)]
pub struct DecodedGifDto {
    pub width: u32,
    pub height: u32,
    #[serde(rename = "delaysMs")]
    pub delays_ms: Vec<u32>,
    #[serde(rename = "framesRgba")]
    pub frames_rgba: Vec<Vec<u8>>,
}

#[tauri::command]
pub fn decode_gif(path: String) -> Result<DecodedGifDto, String> {
    let p = PathBuf::from(path);
    let decoded = decoder::decode_path(&p).map_err(|e| e.to_string())?;
    Ok(DecodedGifDto {
        width: decoded.width,
        height: decoded.height,
        delays_ms: decoded.delays_ms,
        frames_rgba: decoded.frames_rgba,
    })
}
