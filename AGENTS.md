# AGENTS.md

Windows video player aiming to feel like an IINA-style app on Windows.

## Vendored Upstream References

- Tauri source is vendored at `vendor/tauri`.
- tauri-plugin-libmpv source is vendored at `vendor/tauri-plugin-libmpv`.

Use these directories as read-only upstream references when behavior depends on internals. Do not rely on memory or external clones.

## Editing Rule

Make app-specific changes only in this repository's own source files. Do not modify vendored subtrees unless explicitly asked.

## Core requirements

- Windows-first desktop app
- Tauri 2 app with Rust backend
- Preserve the existing product direction: an IINA-style player feel on Windows