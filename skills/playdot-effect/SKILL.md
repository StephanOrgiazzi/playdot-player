---
name: playdot-effect
description: Project-specific guidance for changing Effect code or Effect tooling in playdot-player. Use for Effect implementation work; skip for unrelated TypeScript or UI changes.
---

# Effect in playdot-player

The app uses Effect v4. Check `package.json` for the pinned version before editing. The installed `node_modules/effect/src` is the source of truth for APIs and signatures.

The [official Effect skill](https://github.com/Effect-TS/skills/tree/main/skills/effect-ts) points to `node_modules/effect/AGENTS.md`. Read that guide when the installed package provides it, then follow relevant links as needed. If the read-only `vendor/effect/` checkout is present and matches the installed version, use its source and `ai-docs/` as additional references; verify examples against the installed source. The checkout is ignored by the main Git repository and may lag behind the dependency.

Follow nearby application patterns and the root `AGENTS.md`. Keep Effect failures typed, preserve service requirements, and run effects at application or external callback boundaries. Choose between `Effect.fn`, `Effect.fnUntraced`, and `Effect.gen` based on the operation and existing tracing conventions.

The project configures `@effect/tsgo` in `tsconfig.json`. After changing Effect code, run `bunx effect-tsgo diagnostics --project tsconfig.json --severity error --format text` and `bun run build`. Resolve new diagnostic errors in the implementation; suppress a rule only when its finding is incorrect and explain the reason at that site.
