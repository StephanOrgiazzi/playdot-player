import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import SevenZip from "7z-wasm";

const projectRoot = process.cwd();
const targetDir = path.join(projectRoot, "src-tauri", "lib");
const tempDir = path.join(targetDir, ".setup-lib-tmp");

const wrapperBaseUrl = "https://github.com/nini22P/libmpv-wrapper/releases/latest/download";
const mpvBaseUrl = "https://github.com/zhongfly/mpv-winbuild/releases/latest/download";

function getSystemInfo() {
  const platform = os.platform();
  const arch = os.arch();

  if (platform !== "win32") {
    throw new Error(`Unsupported platform for this app setup: ${platform}`);
  }

  if (arch !== "x64" && arch !== "arm64") {
    throw new Error(`Unsupported architecture: ${arch}`);
  }

  return {
    platform,
    osName: "windows",
    archName: arch === "x64" ? "x86_64" : "aarch64",
    wrapperLibName: "libmpv-wrapper.dll"
  };
}

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
 * @param {string} url
 * @param {string} destinationPath
 */
async function downloadFile(url, destinationPath) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error(`Response body missing for ${url}`);
  }

  await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });

  const fileStream = fs.createWriteStream(destinationPath);
  const bodyStream = Readable.fromWeb(response.body);
  await pipeline(bodyStream, fileStream);
}

async function extractArchive(archivePath, extractDir) {
  await fs.promises.rm(extractDir, { recursive: true, force: true });
  await fs.promises.mkdir(extractDir, { recursive: true });

  const archiveName = path.basename(archivePath);
  const archiveDir = path.dirname(archivePath);
  const sevenZip = await SevenZip({
    print: () => undefined,
    printErr: () => undefined
  });

  const sourceMount = "/archive_source";
  const destinationMount = "/archive_dest";

  sevenZip.FS.mkdir(sourceMount);
  sevenZip.FS.mkdir(destinationMount);
  sevenZip.FS.mount(sevenZip.NODEFS, { root: archiveDir }, sourceMount);
  sevenZip.FS.mount(sevenZip.NODEFS, { root: extractDir }, destinationMount);

  try {
    sevenZip.callMain(["x", `${sourceMount}/${archiveName}`, `-o${destinationMount}`, "-y"]);
  } catch (error) {
    if (!(error && typeof error === "object" && "status" in error && error.status === 0)) {
      throw error;
    }
  } finally {
    try {
      sevenZip.FS.unmount(sourceMount);
      sevenZip.FS.unmount(destinationMount);
    } catch {
      // Ignore cleanup failures from the WASM fs layer.
    }
  }
}

async function findFile(searchDir, fileName) {
  const entries = await fs.promises.readdir(searchDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(searchDir, entry.name);

    if (entry.isDirectory()) {
      const nested = await findFile(fullPath, fileName);
      if (nested) {
        return nested;
      }
      continue;
    }

    if (entry.isFile() && entry.name === fileName) {
      return fullPath;
    }
  }

  return null;
}

/**
 * @param {string} shaText
 * @param {(fileName: string) => boolean} predicate
 */
function pickReleaseFile(shaText, predicate) {
  for (const rawLine of shaText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const parts = line.split(/\s+/);
    const fileName = parts.at(-1);
    if (fileName && predicate(fileName)) {
      return fileName;
    }
  }

  return null;
}

/**
 * @param {string} baseUrl
 * @param {string} releaseFileName
 * @param {string} desiredFileName
 */
async function extractFileFromRelease(baseUrl, releaseFileName, desiredFileName) {
  const archivePath = path.join(tempDir, releaseFileName);
  const extractDir = path.join(tempDir, `${desiredFileName}-extract`);

  console.log(`Downloading ${releaseFileName}...`);
  await downloadFile(`${baseUrl}/${releaseFileName}`, String(archivePath));

  console.log(`Extracting ${releaseFileName}...`);
  await extractArchive(archivePath, extractDir);

  const foundFile = await findFile(extractDir, desiredFileName);
  if (!foundFile) {
    throw new Error(`${desiredFileName} not found in ${releaseFileName}`);
  }

  const destinationPath = path.join(targetDir, desiredFileName);
  await fs.promises.copyFile(foundFile, destinationPath);
}

async function main() {
  const { archName, wrapperLibName } = getSystemInfo();
  await fs.promises.mkdir(targetDir, { recursive: true });
  await fs.promises.rm(tempDir, { recursive: true, force: true });
  await fs.promises.mkdir(tempDir, { recursive: true });

  try {
    console.log(`Detected windows (${archName})`);

    const wrapperSha = await fetchText(`${wrapperBaseUrl}/sha256.txt`);
    const wrapperArchive = pickReleaseFile(
      wrapperSha,
      (fileName) => fileName.includes(`libmpv-wrapper-windows-${archName}`) && fileName.endsWith(".zip")
    );

    if (!wrapperArchive) {
      throw new Error(`Wrapper archive not found for windows ${archName}`);
    }

    await extractFileFromRelease(wrapperBaseUrl, wrapperArchive, wrapperLibName);

    const mpvSha = await fetchText(`${mpvBaseUrl}/sha256.txt`);
    const mpvArchive = pickReleaseFile(
      mpvSha,
      (fileName) => fileName.includes(`mpv-dev-lgpl-${archName}`) && !fileName.includes("v3")
    );

    if (!mpvArchive) {
      throw new Error(`libmpv archive not found for windows ${archName}`);
    }

    await extractFileFromRelease(mpvBaseUrl, mpvArchive, "libmpv-2.dll");
    console.log(`Libraries are ready in ${targetDir}`);
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
