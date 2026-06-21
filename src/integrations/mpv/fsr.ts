import { toError } from "@shared/lib/error";
import { command } from "./libmpv-api";

export type FsrToggleResult = {
  enabled: boolean;
  appliedShaderPaths: string[];
};

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

  const nextShaderPaths = await enableFsrShaders(shaderBundles);
  if (!nextShaderPaths) {
    throw new Error("FSR shader resource is unavailable");
  }

  return { enabled: true, appliedShaderPaths: nextShaderPaths };
}

async function enableFsrShaders(shaderBundles: string[][]): Promise<string[] | null> {
  let lastError: Error | null = null;

  for (const bundle of shaderBundles) {
    const appliedBundlePaths: string[] = [];
    try {
      for (const shaderPath of bundle) {
        await command("change-list", ["glsl-shaders", "append", shaderPath]);
        appliedBundlePaths.push(shaderPath);
      }

      return appliedBundlePaths;
    } catch (error) {
      lastError = toError(error);
      await removeShaders(appliedBundlePaths);
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

async function removeShaders(shaderPaths: string[]): Promise<void> {
  for (const shaderPath of [...shaderPaths].reverse()) {
    await command("change-list", ["glsl-shaders", "remove", shaderPath]).catch(() => undefined);
  }
}
