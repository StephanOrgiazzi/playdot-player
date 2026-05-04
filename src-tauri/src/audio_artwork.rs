use lofty::file::TaggedFileExt;
use lofty::picture::{Picture, PictureType};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub fn extract_audio_artwork(source: String) -> Result<Option<String>, String> {
    let tagged_file = lofty::read_from_path(&source).map_err(|error| error.to_string())?;
    let picture = tagged_file
        .primary_tag()
        .and_then(select_picture)
        .or_else(|| tagged_file.tags().iter().find_map(select_picture));

    let Some(picture) = picture else {
        return Ok(None);
    };

    let Some(extension) = get_picture_extension(picture) else {
        return Ok(None);
    };

    let path = create_artwork_path(extension)?;
    fs::write(&path, picture.data()).map_err(|error| error.to_string())?;
    Ok(Some(path.to_string_lossy().into_owned()))
}

fn select_picture(tag: &lofty::tag::Tag) -> Option<&Picture> {
    tag.get_picture_type(PictureType::CoverFront)
        .or_else(|| tag.pictures().first())
}

fn get_picture_extension(picture: &Picture) -> Option<&'static str> {
    match picture.mime_type()?.as_str() {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/gif" => Some("gif"),
        "image/bmp" => Some("bmp"),
        _ => None,
    }
}

fn create_artwork_path(extension: &str) -> Result<PathBuf, String> {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?;
    let suffix = format!("{}-{}", now.as_millis(), now.subsec_nanos());
    Ok(Path::new(&std::env::temp_dir())
        .join(format!("playdot-player-artwork-{suffix}.{extension}")))
}
