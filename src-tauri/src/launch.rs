use std::{env, path::Path};

pub const OPEN_MEDIA_SOURCE_EVENT: &str = "open-media-source";

#[tauri::command]
pub fn get_startup_media_argument() -> Option<String> {
    parse_media_argument(&collect_launch_arguments()).map(|argument| {
        let cwd = env::current_dir()
            .ok()
            .and_then(|path| path.to_str().map(ToOwned::to_owned))
            .unwrap_or_default();
        resolve_media_argument(argument, &cwd)
    })
}

pub fn get_media_argument_from_process_arguments(
    arguments: &[String],
    cwd: &str,
) -> Option<String> {
    let launch_arguments = arguments.iter().skip(1).cloned().collect::<Vec<_>>();
    parse_media_argument(&launch_arguments).map(|argument| resolve_media_argument(argument, cwd))
}

fn collect_launch_arguments() -> Vec<String> {
    env::args_os()
        .skip(1)
        .map(|argument| argument.to_string_lossy().into_owned())
        .collect()
}

fn parse_media_argument(arguments: &[String]) -> Option<String> {
    let mut index = 0usize;

    while let Some(raw_argument) = arguments.get(index) {
        let argument = raw_argument.trim();

        if argument.is_empty() || argument == "--" {
            index += 1;
            continue;
        }

        if argument == "--open" {
            if let Some(next_value) = arguments.get(index + 1) {
                let next_value = next_value.trim();
                if !next_value.is_empty() {
                    return Some(next_value.to_owned());
                }
            }

            return None;
        }

        if let Some(value) = argument.strip_prefix("--open=") {
            let value = value.trim();
            if !value.is_empty() {
                return Some(value.to_owned());
            }
            index += 1;
            continue;
        }

        if argument.starts_with('-') {
            index += 1;
            continue;
        }

        return Some(argument.to_owned());
    }

    None
}

fn resolve_media_argument(argument: String, cwd: &str) -> String {
    if cwd.is_empty() || is_web_url(&argument) || Path::new(&argument).is_absolute() {
        return argument;
    }

    Path::new(cwd).join(argument).to_string_lossy().into_owned()
}

fn is_web_url(argument: &str) -> bool {
    let lower_argument = argument.to_ascii_lowercase();
    lower_argument.starts_with("http://") || lower_argument.starts_with("https://")
}

#[cfg(test)]
mod tests {
    use super::{get_media_argument_from_process_arguments, parse_media_argument};

    fn parse(input: &[&str]) -> Option<String> {
        let arguments = input
            .iter()
            .map(|argument| (*argument).to_owned())
            .collect::<Vec<_>>();
        parse_media_argument(&arguments)
    }

    #[test]
    fn returns_none_for_empty_args() {
        assert_eq!(parse(&[]), None);
    }

    #[test]
    fn skips_flag_arguments() {
        assert_eq!(
            parse(&["--silent", "--profiling", "C:\\media\\clip.mp4"]),
            Some("C:\\media\\clip.mp4".to_owned())
        );
    }

    #[test]
    fn supports_explicit_open_flag() {
        assert_eq!(
            parse(&["--open", "C:\\media\\clip.mp4"]),
            Some("C:\\media\\clip.mp4".to_owned())
        );
    }

    #[test]
    fn supports_inline_open_flag() {
        assert_eq!(
            parse(&["--open=C:\\media\\clip.mp4"]),
            Some("C:\\media\\clip.mp4".to_owned())
        );
    }

    #[test]
    fn skips_executable_for_process_arguments() {
        let arguments = ["playdot-player.exe", "C:\\media\\clip.mp4"]
            .iter()
            .map(|argument| (*argument).to_owned())
            .collect::<Vec<_>>();

        assert_eq!(
            get_media_argument_from_process_arguments(&arguments, "C:\\unused"),
            Some("C:\\media\\clip.mp4".to_owned())
        );
    }

    #[test]
    fn resolves_relative_process_arguments_against_launch_cwd() {
        let arguments = ["playdot-player.exe", "clip.mp4"]
            .iter()
            .map(|argument| (*argument).to_owned())
            .collect::<Vec<_>>();

        assert_eq!(
            get_media_argument_from_process_arguments(&arguments, "C:\\media"),
            Some("C:\\media\\clip.mp4".to_owned())
        );
    }
}
