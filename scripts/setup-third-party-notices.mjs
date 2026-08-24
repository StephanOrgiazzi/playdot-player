import fs from "node:fs";
import path from "node:path";
import {
  mpvMirrorTag,
  mpvRelease as mpvBuildRelease,
  resolvePinnedMpvRelease,
} from "./libmpv-release.mjs";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "src-tauri", "lib", "licenses");
const tempOutputDir = path.join(projectRoot, "src-tauri", "lib", ".licenses-tmp");

const mpvRevision = "654e9382c0";
const wrapperRelease = "v0.1.1";
const pluginVersion = "0.3.2";
const pluginSourceRevision = "5da4e044c276245dcfd8a279310e5106394a0679";

/**
 * @param {string} url
 */
async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

/**
 * @param {string} fileName
 * @param {string} url
 */
async function writeRemoteFile(fileName, url) {
  const contents = await fetchText(url);
  await fs.promises.writeFile(path.join(tempOutputDir, fileName), contents, "utf8");
}

/**
 * @param {string} shaText
 */
function findFfmpegRevision(shaText) {
  const revisions = [
    ...shaText.matchAll(/ffmpeg-lgpl-(?:x86_64|aarch64)(?:-v3)?-git-([0-9a-f]+)\.7z/g),
  ]
    .map((match) => match[1])
    .filter(Boolean);
  const uniqueRevisions = [...new Set(revisions)];

  if (uniqueRevisions.length !== 1) {
    throw new Error(
      `Expected one FFmpeg LGPL revision in ${mpvBuildRelease} sha256.txt, found ${uniqueRevisions.length}`,
    );
  }

  return uniqueRevisions[0];
}

async function main() {
  const { shaText: releaseSha, source: mpvMetadataSource } = await resolvePinnedMpvRelease();
  const ffmpegRevision = findFfmpegRevision(releaseSha);

  await fs.promises.rm(tempOutputDir, { recursive: true, force: true });
  await fs.promises.mkdir(tempOutputDir, { recursive: true });

  try {
    await Promise.all([
      writeRemoteFile(
        "mpv-LGPL-2.1.txt",
        `https://raw.githubusercontent.com/mpv-player/mpv/${mpvRevision}/LICENSE.LGPL`,
      ),
      writeRemoteFile(
        "mpv-Copyright.txt",
        `https://raw.githubusercontent.com/mpv-player/mpv/${mpvRevision}/Copyright`,
      ),
      writeRemoteFile(
        "libmpv-wrapper-LGPL-2.1.txt",
        `https://raw.githubusercontent.com/nini22P/libmpv-wrapper/${wrapperRelease}/LICENSE`,
      ),
      writeRemoteFile(
        "FFmpeg-LGPL-3.0.txt",
        `https://raw.githubusercontent.com/FFmpeg/FFmpeg/${ffmpegRevision}/COPYING.LGPLv3`,
      ),
      writeRemoteFile(
        "FFmpeg-GPL-3.0.txt",
        `https://raw.githubusercontent.com/FFmpeg/FFmpeg/${ffmpegRevision}/COPYING.GPLv3`,
      ),
      writeRemoteFile(
        "tauri-plugin-libmpv-MPL-2.0.txt",
        `https://raw.githubusercontent.com/nini22P/tauri-plugin-libmpv/${pluginSourceRevision}/LICENSE`,
      ),
    ]);

    await fs.promises.copyFile(
      path.join(projectRoot, "THIRD-PARTY-NOTICES.md"),
      path.join(tempOutputDir, "THIRD-PARTY-NOTICES.md"),
    );

    const provenance = [
      "PLAY. third-party source provenance",
      "",
      `mpv revision: ${mpvRevision}`,
      `mpv source: https://github.com/mpv-player/mpv/tree/${mpvRevision}`,
      `Windows LGPL build release: https://github.com/zhongfly/mpv-winbuild/releases/tag/${mpvBuildRelease}`,
      `PLAY. binary mirror: https://github.com/StephanOrgiazzi/playdot-player/releases/tag/${mpvMirrorTag}`,
      `Build metadata source used for this package: ${mpvMetadataSource}`,
      `FFmpeg revision: ${ffmpegRevision}`,
      `FFmpeg source: https://github.com/FFmpeg/FFmpeg/tree/${ffmpegRevision}`,
      `libmpv-wrapper release: https://github.com/nini22P/libmpv-wrapper/tree/${wrapperRelease}`,
      `tauri-plugin-libmpv crate version: ${pluginVersion}`,
      `tauri-plugin-libmpv crate: https://crates.io/crates/tauri-plugin-libmpv/${pluginVersion}`,
      `tauri-plugin-libmpv license source revision: ${pluginSourceRevision}`,
      `tauri-plugin-libmpv upstream: https://github.com/nini22P/tauri-plugin-libmpv/tree/${pluginSourceRevision}`,
      "Windows build recipes: https://github.com/zhongfly/mpv-winbuild",
      "",
    ].join("\n");

    await fs.promises.writeFile(
      path.join(tempOutputDir, "SOURCE-PROVENANCE.txt"),
      provenance,
      "utf8",
    );
    await fs.promises.rm(outputDir, { recursive: true, force: true });
    await fs.promises.rename(tempOutputDir, outputDir);
    console.log(`Third-party notices are ready in ${outputDir}`);
  } finally {
    await fs.promises.rm(tempOutputDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
