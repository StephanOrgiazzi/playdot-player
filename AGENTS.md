# Engineering principles

Apply these as strong defaults, not rigid rules:

The Mythical Man-Month: Preserve conceptual integrity; prefer one coherent design over many clever local designs, and avoid second-system overengineering. Code Complete: Apply YAGNI relentlessly; write only the code needed now, with clear names, explicit control flow, validated inputs, and visible error handling. Refactoring: Keep code easy to change through small continuous refactorings; remove concrete smells instead of introducing speculative abstractions. Clean Architecture: Keep business rules independent from frameworks, databases, network clients, user interfaces, and other infrastructure details. The Pragmatic Programmer: Keep modules orthogonal, follow the Law of Demeter, and DRY duplicated knowledge rather than merely similar-looking code. Domain-Driven Design: Model the business language directly with bounded contexts, invariant-preserving domain types, entities, value objects, and explicit domain rules. A Philosophy of Software Design: Prefer deep modules with small, stable interfaces that hide complexity and volatile implementation decisions. Software Engineering at Google: Optimize APIs and dependencies for long-term maintainability; minimize public surface area and avoid forcing coordinated upgrades.

# Vendored reference repositories

Everything under `vendor/` is read-only reference material. Never edit, format, build, or commit changes inside these repositories, and do not import application code from them. Their purpose is to let agents inspect upstream implementation code as the source of truth when designing or implementing changes in this project.

- `vendor/legacyplayer/`: reference for the earlier player implementation and behaviour.
- `vendor/tauri/`: upstream Tauri framework source.
- `vendor/tauri-plugin-libmpv/`: upstream libmpv integration plugin source.
- `vendor/effect/`: upstream Effect TypeScript monorepo. Its primary implementation is in `packages/` (`effect` is the core runtime; the other packages provide platform, Atom, AI, SQL, telemetry, and tooling integrations). `cookbooks/` contains usage examples, `migration/` contains migration guidance, and `ai-docs/` contains agent-oriented documentation.
