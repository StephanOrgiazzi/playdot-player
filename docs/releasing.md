# Releasing PLAY.

## Versioning before 1.0

- Publish a minor release for a meaningful batch of user-visible capabilities or behavior changes.
- Publish a patch release for corrections to the latest supported release.
- Do not publish a release for refactoring, tooling, documentation, or isolated internal cleanup.
- Prefer one supported milestone over several short-lived releases produced during the same development cycle.

## Commit structure

- Keep each commit focused on one feature, fix, refactor, or project concern.
- Use descriptive conventional prefixes such as `feat`, `fix`, `refactor`, `chore`, and `docs`.
- Keep every commit buildable so the history remains useful for review and bisection.
- Put version changes in a dedicated `chore(release): prepare vX.Y.Z` commit.

## Release checklist

1. Confirm the intended changes form a coherent user-facing milestone.
2. Update the version in `package.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`.
3. Run `bun run format`, `bun run lint`, and `bun run build`.
4. Run `bun run release` and verify the generated installer checksums.
5. Commit the version changes and create an annotated `vX.Y.Z` tag.
6. Push the branch and tag together.
7. Publish the versioned installer, stable installer filename, and `SHA256SUMS.txt`.
8. Write curated release notes with Highlights, Fixes, Engineering, and Downloads sections as applicable.

Release notes should explain user impact. Commit messages and generated diffs are supporting material, not substitutes for release notes.
