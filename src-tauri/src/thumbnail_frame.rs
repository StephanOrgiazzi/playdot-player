use serde::Serialize;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

pub const THUMBNAIL_WIDTH: u32 = 240;
pub const THUMBNAIL_HEIGHT: u32 = 135;

const THUMBNAIL_PREFIX: &str = "playdot-player-thumbnail-";
const RAW_SUFFIX: &str = ".bgra";
const IMAGE_SUFFIX: &str = ".bmp";
const BMP_HEADER_BYTES: usize = 54;
static TARGET_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailTarget {
    raw_path: String,
    image_path: String,
    width: u32,
    height: u32,
}

#[tauri::command]
pub fn create_thumbnail_target() -> Result<ThumbnailTarget, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?;
    let sequence = TARGET_COUNTER.fetch_add(1, Ordering::Relaxed);
    let name = format!(
        "{THUMBNAIL_PREFIX}{}-{}-{sequence}",
        std::process::id(),
        now.as_nanos()
    );
    let raw_path = std::env::temp_dir().join(format!("{name}{RAW_SUFFIX}"));
    let image_path = std::env::temp_dir().join(format!("{name}{IMAGE_SUFFIX}"));

    Ok(ThumbnailTarget {
        raw_path: raw_path.to_string_lossy().into_owned(),
        image_path: image_path.to_string_lossy().into_owned(),
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
    })
}

#[tauri::command]
pub fn discard_thumbnail_frame(raw_path: String) -> Result<(), String> {
    let raw_path = validate_target_path(&raw_path, RAW_SUFFIX)?;
    remove_if_exists(&raw_path)
}

#[tauri::command]
pub fn promote_thumbnail_frame(raw_path: String, image_path: String) -> Result<bool, String> {
    let raw_path = validate_target_path(&raw_path, RAW_SUFFIX)?;
    let image_path = validate_target_path(&image_path, IMAGE_SUFFIX)?;
    let pending_path = raw_path.with_extension("pending.bgra");
    remove_if_exists(&pending_path)?;

    match fs::rename(&raw_path, &pending_path) {
        Ok(()) => {}
        Err(error)
            if matches!(
                error.kind(),
                ErrorKind::NotFound | ErrorKind::PermissionDenied
            ) =>
        {
            return Ok(false);
        }
        Err(error) => return Err(error.to_string()),
    }

    let pixels = fs::read(&pending_path).map_err(|error| error.to_string())?;
    remove_if_exists(&pending_path)?;
    let required_size = (THUMBNAIL_WIDTH * THUMBNAIL_HEIGHT * 4) as usize;
    if pixels.len() != required_size {
        return Ok(false);
    }

    let next_image_path = image_path.with_extension("next.bmp");
    let mut image = create_bmp_header(required_size);
    image.extend_from_slice(&pixels);
    fs::write(&next_image_path, image).map_err(|error| error.to_string())?;
    remove_if_exists(&image_path)?;
    fs::rename(next_image_path, image_path).map_err(|error| error.to_string())?;
    Ok(true)
}

#[tauri::command]
pub fn remove_thumbnail_target(raw_path: String, image_path: String) -> Result<(), String> {
    let raw_path = validate_target_path(&raw_path, RAW_SUFFIX)?;
    let image_path = validate_target_path(&image_path, IMAGE_SUFFIX)?;
    remove_if_exists(&raw_path)?;
    remove_if_exists(&raw_path.with_extension("pending.bgra"))?;
    remove_if_exists(&image_path)?;
    remove_if_exists(&image_path.with_extension("next.bmp"))
}

fn validate_target_path(path: &str, suffix: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "Invalid thumbnail target path".to_string())?;
    if path.parent() != Some(std::env::temp_dir().as_path())
        || !file_name.starts_with(THUMBNAIL_PREFIX)
        || !file_name.ends_with(suffix)
    {
        return Err("Thumbnail target path is outside the application temp scope".to_string());
    }
    Ok(path)
}

fn remove_if_exists(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn create_bmp_header(pixel_size: usize) -> Vec<u8> {
    let image_size = u32::try_from(pixel_size).unwrap_or(0);
    let file_size = (BMP_HEADER_BYTES as u32) + image_size;
    let mut header = Vec::with_capacity(BMP_HEADER_BYTES);
    header.extend_from_slice(b"BM");
    header.extend_from_slice(&file_size.to_le_bytes());
    header.extend_from_slice(&[0; 4]);
    header.extend_from_slice(&(BMP_HEADER_BYTES as u32).to_le_bytes());
    header.extend_from_slice(&40_u32.to_le_bytes());
    header.extend_from_slice(&(THUMBNAIL_WIDTH as i32).to_le_bytes());
    header.extend_from_slice(&(-(THUMBNAIL_HEIGHT as i32)).to_le_bytes());
    header.extend_from_slice(&1_u16.to_le_bytes());
    header.extend_from_slice(&32_u16.to_le_bytes());
    header.extend_from_slice(&0_u32.to_le_bytes());
    header.extend_from_slice(&image_size.to_le_bytes());
    header.extend_from_slice(&[0; 16]);
    header
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn promotes_complete_bgra_frame_to_top_down_bmp() {
        let target = create_thumbnail_target().expect("target should be created");
        let pixel_size = (THUMBNAIL_WIDTH * THUMBNAIL_HEIGHT * 4) as usize;
        fs::write(&target.raw_path, vec![7_u8; pixel_size]).expect("raw frame should be written");

        let promoted = promote_thumbnail_frame(target.raw_path.clone(), target.image_path.clone())
            .expect("frame should promote");
        let bmp = fs::read(&target.image_path).expect("bmp should be readable");

        assert!(promoted);
        assert_eq!(bmp.len(), BMP_HEADER_BYTES + pixel_size);
        assert_eq!(&bmp[0..2], b"BM");
        assert_eq!(
            i32::from_le_bytes(bmp[22..26].try_into().expect("height bytes")),
            -(THUMBNAIL_HEIGHT as i32)
        );
        assert_eq!(bmp[BMP_HEADER_BYTES], 7);

        remove_thumbnail_target(target.raw_path, target.image_path)
            .expect("target should be removed");
    }
}
