use crate::gif::decoder;
use std::path::PathBuf;
use tauri::ipc::Response;

fn pack_decoded(decoded: &decoder::DecodedGif) -> Vec<u8> {
    let n = decoded.delays_ms.len() as u32;
    let stride = (decoded.width as usize) * (decoded.height as usize) * 4;
    let header_len = 12 + (n as usize) * 4;
    let mut out = Vec::with_capacity(header_len + (n as usize) * stride);

    out.extend_from_slice(&decoded.width.to_le_bytes());
    out.extend_from_slice(&decoded.height.to_le_bytes());
    out.extend_from_slice(&n.to_le_bytes());
    for d in &decoded.delays_ms {
        out.extend_from_slice(&d.to_le_bytes());
    }
    for frame in &decoded.frames_rgba {
        debug_assert_eq!(frame.len(), stride);
        out.extend_from_slice(frame);
    }
    out
}

#[tauri::command]
pub fn decode_gif(path: String) -> Result<Response, String> {
    let p = PathBuf::from(path);
    let decoded = decoder::decode_path(&p).map_err(|e| e.to_string())?;
    Ok(Response::new(pack_decoded(&decoded)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make(n: u32, w: u32, h: u32) -> decoder::DecodedGif {
        let stride = (w * h * 4) as usize;
        decoder::DecodedGif {
            width: w,
            height: h,
            delays_ms: (0..n).map(|i| (i + 1) * 10).collect(),
            frames_rgba: (0..n)
                .map(|i| {
                    let byte = (i % 255) as u8;
                    vec![byte; stride]
                })
                .collect(),
        }
    }

    #[test]
    fn packs_header_and_frames_little_endian() {
        let d = make(2, 3, 2);
        let buf = pack_decoded(&d);
        assert_eq!(u32::from_le_bytes(buf[0..4].try_into().unwrap()), 3);
        assert_eq!(u32::from_le_bytes(buf[4..8].try_into().unwrap()), 2);
        assert_eq!(u32::from_le_bytes(buf[8..12].try_into().unwrap()), 2);
        assert_eq!(u32::from_le_bytes(buf[12..16].try_into().unwrap()), 10);
        assert_eq!(u32::from_le_bytes(buf[16..20].try_into().unwrap()), 20);
        let stride = 3 * 2 * 4;
        let rgba_start = 20;
        assert_eq!(buf[rgba_start], 0);
        assert_eq!(buf[rgba_start + stride], 1);
        assert_eq!(buf.len(), rgba_start + 2 * stride);
    }

    #[test]
    fn empty_frames_ok() {
        let d = decoder::DecodedGif {
            width: 1,
            height: 1,
            delays_ms: vec![],
            frames_rgba: vec![],
        };
        let buf = pack_decoded(&d);
        assert_eq!(buf.len(), 12);
    }
}
