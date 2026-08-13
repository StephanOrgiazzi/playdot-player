import { Effect, Schema } from "effect";
import { command } from "./libmpv-api";

export type FsrToggleResult = {
  enabled: boolean;
  appliedShaderPaths: string[];
};

class FsrShaderError extends Schema.TaggedErrorClass<FsrShaderError>()("Fsr.ShaderError", {
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return this.cause instanceof Error && this.cause.message
      ? this.cause.message
      : "Failed to apply FSR shaders";
  }
}

export async function toggleFsrShaders(
  appliedShaderPaths: string[],
  shaderBundles: string[][],
): Promise<FsrToggleResult> {
  if (appliedShaderPaths.length > 0) {
    for (const shaderPath of [...appliedShaderPaths].reverse()) {
      await command("change-list", ["glsl-shaders", "remove", shaderPath]);
    }

    return { enabled: false, appliedShaderPaths: [] };
  }

  const nextShaderPaths = await Effect.runPromise(enableFsrShaders(shaderBundles));
  if (!nextShaderPaths) {
    throw new Error("FSR shader resource is unavailable");
  }

  return { enabled: true, appliedShaderPaths: nextShaderPaths };
}

const applyShaderBundle = Effect.fn("Fsr.applyShaderBundle")(function* (bundle: string[]) {
  const appliedShaderPaths: string[] = [];
  const apply = Effect.forEach(
    bundle,
    (shaderPath) =>
      Effect.tryPromise({
        try: () => command("change-list", ["glsl-shaders", "append", shaderPath]),
        catch: (cause) => new FsrShaderError({ cause }),
      }).pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            appliedShaderPaths.push(shaderPath);
          }),
        ),
      ),
    { discard: true },
  );

  return yield* apply.pipe(
    Effect.as(appliedShaderPaths),
    Effect.catch((error) =>
      Effect.promise(() => removeShaders(appliedShaderPaths)).pipe(
        Effect.andThen(Effect.fail(error)),
      ),
    ),
  );
});

const enableFsrShaders = Effect.fn("Fsr.enableShaders")(function* (shaderBundles: string[][]) {
  let lastError: FsrShaderError | null = null;

  for (const bundle of shaderBundles) {
    const [appliedShaderPaths, error] = yield* applyShaderBundle(bundle).pipe(
      Effect.map((paths) => [paths, null] as const),
      Effect.catch((failure) => Effect.succeed([null, failure] as const)),
    );

    if (appliedShaderPaths) {
      return appliedShaderPaths;
    }
    lastError = error;
  }

  if (lastError) {
    return yield* Effect.fail(lastError);
  }

  return null;
});

async function removeShaders(shaderPaths: string[]): Promise<void> {
  for (const shaderPath of [...shaderPaths].reverse()) {
    await command("change-list", ["glsl-shaders", "remove", shaderPath]).catch(() => undefined);
  }
}
