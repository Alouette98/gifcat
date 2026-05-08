use gif::{DecodeOptions, DisposalMethod};
use std::fs::File;
use std::path::Path;

pub struct DecodedGif {
    pub width: u32,
    pub height: u32,
    pub delays_ms: Vec<u32>,
    pub frames_rgba: Vec<Vec<u8>>,
}

#[derive(Debug)]
pub enum DecodeError {
    Io(std::io::Error),
    Gif(gif::DecodingError),
}

impl std::fmt::Display for DecodeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DecodeError::Io(e) => write!(f, "IO error: {}", e),
            DecodeError::Gif(e) => write!(f, "GIF decode error: {}", e),
        }
    }
}

pub fn decode_path(path: &Path) -> Result<DecodedGif, DecodeError> {
    let file = File::open(path).map_err(DecodeError::Io)?;
    let mut options = DecodeOptions::new();
    options.set_color_output(gif::ColorOutput::RGBA);
    let mut decoder = options.read_info(file).map_err(DecodeError::Gif)?;

    let width = decoder.width() as u32;
    let height = decoder.height() as u32;
    let byte_count = (width as usize) * (height as usize) * 4;

    let mut canvas = vec![0u8; byte_count];
    let mut previous: Option<Vec<u8>> = None;
    let mut delays_ms: Vec<u32> = Vec::new();
    let mut frames_rgba: Vec<Vec<u8>> = Vec::new();

    while let Some(frame) = decoder.read_next_frame().map_err(DecodeError::Gif)? {
        let delay_ms = (frame.delay as u32) * 10;
        let delay_ms = if delay_ms == 0 { 100 } else { delay_ms };

        let fx = frame.left as u32;
        let fy = frame.top as u32;
        let fw = frame.width as u32;
        let fh = frame.height as u32;

        if matches!(frame.dispose, DisposalMethod::Previous) {
            previous = Some(canvas.clone());
        }

        for row in 0..fh {
            for col in 0..fw {
                let src_idx = ((row * fw + col) * 4) as usize;
                let dst_x = fx + col;
                let dst_y = fy + row;
                if dst_x >= width || dst_y >= height {
                    continue;
                }
                let dst_idx = ((dst_y * width + dst_x) * 4) as usize;
                let a = frame.buffer[src_idx + 3];
                if a == 0 {
                    continue;
                }
                canvas[dst_idx] = frame.buffer[src_idx];
                canvas[dst_idx + 1] = frame.buffer[src_idx + 1];
                canvas[dst_idx + 2] = frame.buffer[src_idx + 2];
                canvas[dst_idx + 3] = 255;
            }
        }

        frames_rgba.push(canvas.clone());
        delays_ms.push(delay_ms);

        match frame.dispose {
            DisposalMethod::Background => {
                for row in 0..fh {
                    for col in 0..fw {
                        let dst_x = fx + col;
                        let dst_y = fy + row;
                        if dst_x >= width || dst_y >= height {
                            continue;
                        }
                        let dst_idx = ((dst_y * width + dst_x) * 4) as usize;
                        canvas[dst_idx] = 0;
                        canvas[dst_idx + 1] = 0;
                        canvas[dst_idx + 2] = 0;
                        canvas[dst_idx + 3] = 0;
                    }
                }
            }
            DisposalMethod::Previous => {
                if let Some(prev) = previous.take() {
                    canvas = prev;
                }
            }
            DisposalMethod::Keep | DisposalMethod::Any => {}
        }
    }

    Ok(DecodedGif {
        width,
        height,
        delays_ms,
        frames_rgba,
    })
}
