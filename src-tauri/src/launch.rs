use std::env;

#[tauri::command]
pub fn get_startup_media_argument() -> Option<String> {
    parse_media_argument(&collect_launch_arguments())
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

#[cfg(test)]
mod tests {
    use super::parse_media_argument;

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
}
