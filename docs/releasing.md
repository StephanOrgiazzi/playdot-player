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

## Microsoft Store MSIX

PLAY. has a separate MSIX packaging path for Microsoft Store distribution. It does not replace the NSIS/GitHub release flow.

Partner Center identity used by the package:

- Package/Identity/Name: `DevJamStudio.622382E8743A9`
- Package/Identity/Publisher: `CN=300C6CAC-B727-40B2-8FF0-4C00EBAF31D9`
- Package/Properties/PublisherDisplayName: `Dev Jam Studio`
- Store ID: `9NXXT91JCTHX`

The Store package version is derived from PLAY.'s semantic version by adding one to the semantic major and reserving the fourth component for Store use. For example, PLAY. `0.16.0` produces package version `1.16.0.0`, and PLAY. `1.0.0` produces `2.0.0.0`.

Build locally on Windows with the Windows SDK installed:

```powershell
bun install --frozen-lockfile
bun run release:store
```

The unsigned package is written to `artifacts/msix/`. The build stages the Tauri executable, bundled libmpv runtime and licenses, shaders, generated Store logo assets, file associations, and the Partner Center identity into the MSIX, then unpacks the result to verify the required files are present.

For CI, run the `Microsoft Store MSIX` workflow manually or use the artifact produced by its pull request validation run. Upload the resulting `.msix` to the Packages section of the Microsoft Store submission. The Store signs the package after certification; no private signing certificate is required for the Store submission path.
