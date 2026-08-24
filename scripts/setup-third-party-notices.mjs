import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "src-tauri", "lib", "licenses");

const mpvRevision = "94335ab87a";
const mpvBuildRelease = "2026-07-18-94335ab87a";
const wrapperRelease = "v0.1.1";
const pluginVersion = "0.3.2";
const pluginSourceRevision = "5da4e044c276245dcfd8a279310e5106394a0679";
const mpvBuildBaseUrl = `https://github.com/zhongfly/mpv-winbuild/releases/download/${mpvBuildRelease}`;

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function writeRemoteFile(fileName, url) {
  const contents = await fetchText(url);
  await fs.promises.writeFile(path.join(outputDir, fileName), contents, "utf8");
}

function findFfmpegRevision(shaText) {
  const match = shaText.match(/ffmpeg-lgpl-(?:x86_64|aarch64)(?:-v3)?-git-([0-9a-f]+)\.7z/);
  if (!match?.[1]) {
    throw new Error(`FFmpeg LGPL revision not found in ${mpvBuildRelease} sha256.txt`);
  }
  return match[1];
}

async function main() {
  const releaseSha = await fetchText(`${mpvBuildBaseUrl}/sha256.txt`);
  const ffmpegRevision = findFfmpegRevision(releaseSha);

  await fs.promises.rm(outputDir, { recursive: true, force: true });
  await fs.promises.mkdir(outputDir, { recursive: true });

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
    path.join(outputDir, "THIRD-PARTY-NOTICES.md"),
  );

  const provenance = [
    "PLAY. third-party source provenance",
    "",
    `mpv revision: ${mpvRevision}`,
    `mpv source: https://github.com/mpv-player/mpv/tree/${mpvRevision}`,
    `Windows LGPL build release: https://github.com/zhongfly/mpv-winbuild/releases/tag/${mpvBuildRelease}`,
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

  await fs.promises.writeFile(path.join(outputDir, "SOURCE-PROVENANCE.txt"), provenance, "utf8");
  console.log(`Third-party notices are ready in ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
