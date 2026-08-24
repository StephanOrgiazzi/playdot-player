import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const outputDir = path.join(projectRoot, "src-tauri", "lib", "licenses");

const mpvRevision = "94335ab87a";
const mpvBuildRelease = "2026-07-18-94335ab87a";
const wrapperRelease = "v0.1.1";

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

async function writePluginLicense() {
  const vendoredLicense = path.join(projectRoot, "vendor", "tauri-plugin-libmpv", "LICENSE");
  const destination = path.join(outputDir, "tauri-plugin-libmpv-MPL-2.0.txt");

  try {
    await fs.promises.copyFile(vendoredLicense, destination);
    return;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  await writeRemoteFile(
    "tauri-plugin-libmpv-MPL-2.0.txt",
    "https://raw.githubusercontent.com/nini22P/tauri-plugin-libmpv/main/LICENSE",
  );
}

async function main() {
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
      "FFmpeg-LGPL-2.1.txt",
      "https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/COPYING.LGPLv2.1",
    ),
    writePluginLicense(),
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
    `libmpv-wrapper release: https://github.com/nini22P/libmpv-wrapper/tree/${wrapperRelease}`,
    "tauri-plugin-libmpv upstream: https://github.com/nini22P/tauri-plugin-libmpv",
    "FFmpeg upstream source: https://github.com/FFmpeg/FFmpeg",
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
