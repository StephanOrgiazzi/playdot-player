use lofty::file::TaggedFileExt;
use lofty::picture::{Picture, PictureType};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Default)]
pub struct AudioArtwork {
    current_path: Mutex<Option<PathBuf>>,
}

impl AudioArtwork {
    fn extract(&self, source: Option<&str>) -> Result<Option<PathBuf>, String> {
        let mut current_path = self
            .current_path
            .lock()
            .map_err(|error| error.to_string())?;
        replace_current_artwork(&mut current_path, None)?;

        let Some(source) = source else {
            return Ok(None);
        };

        let tagged_file = lofty::read_from_path(source).map_err(|error| error.to_string())?;
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
        replace_current_artwork(&mut current_path, Some(path.clone()))?;
        Ok(Some(path))
    }
}

impl Drop for AudioArtwork {
    fn drop(&mut self) {
        let current_path = self
            .current_path
            .get_mut()
            .unwrap_or_else(|error| error.into_inner());
        let _ = remove_current_artwork(current_path);
    }
}

#[tauri::command]
pub fn extract_audio_artwork(
    source: Option<String>,
    artwork: State<'_, AudioArtwork>,
) -> Result<Option<String>, String> {
    artwork
        .extract(source.as_deref())
        .map(|path| path.map(|path| path.to_string_lossy().into_owned()))
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

fn remove_current_artwork(current_path: &mut Option<PathBuf>) -> Result<(), String> {
    let Some(path) = current_path.as_ref() else {
        return Ok(());
    };

    match fs::remove_file(path) {
        Ok(()) => {
            *current_path = None;
            Ok(())
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            *current_path = None;
            Ok(())
        }
        Err(error) => Err(error.to_string()),
    }
}

fn replace_current_artwork(
    current_path: &mut Option<PathBuf>,
    replacement: Option<PathBuf>,
) -> Result<(), String> {
    remove_current_artwork(current_path)?;
    *current_path = replacement;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_artwork() -> PathBuf {
        let path = create_artwork_path("test").expect("test artwork path should be created");
        fs::write(&path, b"artwork").expect("test artwork should be written");
        path
    }

    #[test]
    fn removing_current_artwork_deletes_the_file() {
        let path = create_test_artwork();
        let mut current_path = Some(path.clone());

        remove_current_artwork(&mut current_path).expect("artwork should be removed");

        assert_eq!(current_path, None);
        assert!(!path.exists());
    }

    #[test]
    fn removing_missing_artwork_clears_the_tracked_path() {
        let path = create_artwork_path("missing").expect("test artwork path should be created");
        let mut current_path = Some(path);

        remove_current_artwork(&mut current_path).expect("missing artwork should be ignored");

        assert_eq!(current_path, None);
    }

    #[test]
    fn replacing_current_artwork_deletes_only_the_previous_file() {
        let previous_path = create_test_artwork();
        let replacement_path = create_test_artwork();
        let mut current_path = Some(previous_path.clone());

        replace_current_artwork(&mut current_path, Some(replacement_path.clone()))
            .expect("artwork should be replaced");

        assert_eq!(current_path, Some(replacement_path.clone()));
        assert!(!previous_path.exists());
        assert!(replacement_path.exists());

        fs::remove_file(replacement_path).expect("replacement artwork should be removed");
    }

    #[test]
    fn dropping_audio_artwork_deletes_the_current_file() {
        let path = create_test_artwork();
        let artwork = AudioArtwork {
            current_path: Mutex::new(Some(path.clone())),
        };

        drop(artwork);

        assert!(!path.exists());
    }
}
