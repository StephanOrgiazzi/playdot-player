use serde::Serialize;
use std::env;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SvpIntegrationState {
    pub available: bool,
    pub enabled: bool,
}

#[tauri::command]
pub fn resolve_svp_integration(requested_enabled: bool) -> SvpIntegrationState {
    let Some(install_dir) = find_svp_install_dir() else {
        return SvpIntegrationState {
            available: false,
            enabled: false,
        };
    };

    let mpv64_dir = install_dir.join("mpv64");
    prepend_env_path("PATH", &mpv64_dir);
    prepend_env_path("PYTHONPATH", &mpv64_dir);

    SvpIntegrationState {
        available: true,
        enabled: requested_enabled,
    }
}

fn prepend_env_path(name: &str, value: &Path) {
    let value = value.as_os_str();
    let existing = env::var_os(name).unwrap_or_default();
    let already_present = env::split_paths(&existing).any(|segment| segment.as_os_str() == value);

    if already_present {
        return;
    }

    let paths = env::split_paths(&existing);
    let next_value = env::join_paths(std::iter::once(PathBuf::from(value)).chain(paths));

    if let Ok(next_value) = next_value {
        // SAFETY: Integration resolution runs on the main Tauri thread before libmpv starts.
        // Later calls find the same path already present and return without mutating it again.
        unsafe {
            env::set_var(name, next_value);
        }
    }
}

fn find_svp_install_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        windows::find_svp_install_dir()
    }

    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}

#[cfg(target_os = "windows")]
mod windows {
    use super::*;

    pub fn find_svp_install_dir() -> Option<PathBuf> {
        candidate_install_dirs()
            .into_iter()
            .find(|dir| is_valid_svp_install_dir(dir))
    }

    fn candidate_install_dirs() -> Vec<PathBuf> {
        let mut candidates = Vec::new();

        for env_name in ["ProgramFiles(x86)", "ProgramFiles"] {
            if let Some(root) = env::var_os(env_name) {
                let root = PathBuf::from(root);
                candidates.push(root.join("SVP 4"));
                candidates.push(root.join("SVP"));
            }
        }

        candidates
    }

    fn is_valid_svp_install_dir(dir: &Path) -> bool {
        let mpv64_dir = dir.join("mpv64");

        mpv64_dir.is_dir()
            && mpv64_dir.join("vapoursynth.dll").is_file()
            && mpv64_dir.join("VSScript.dll").is_file()
            && has_any_existing_path(
                &mpv64_dir,
                &["python312.dll", "python311.dll", "python310.dll"],
            )
            && has_any_existing_path(dir, &["SVPManager.exe", "SVP Manager.exe"])
    }

    fn has_any_existing_path(root: &Path, relative_paths: &[&str]) -> bool {
        relative_paths.iter().any(|path| root.join(path).exists())
    }
}
