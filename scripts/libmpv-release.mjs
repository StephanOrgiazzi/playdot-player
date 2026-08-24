export const mpvRelease = "2026-08-24-654e9382c0";
export const mpvMirrorTag = `third-party-libmpv-${mpvRelease}`;
export const mpvMirrorBaseUrl = `https://github.com/StephanOrgiazzi/playdot-player/releases/download/${mpvMirrorTag}`;
export const mpvUpstreamBaseUrl = `https://github.com/zhongfly/mpv-winbuild/releases/download/${mpvRelease}`;

/**
 * Resolve the pinned libmpv release metadata.
 *
 * Prefer PLAY.'s durable GitHub Release mirror. Falling back to the upstream
 * release is intentionally limited to the bootstrap case where the mirror has
 * not been created yet.
 *
 * @returns {Promise<{baseUrl: string, shaText: string, source: "mirror" | "upstream"}>}
 */
export async function resolvePinnedMpvRelease() {
  const mirrorShaUrl = `${mpvMirrorBaseUrl}/sha256.txt`;
  const mirrorResponse = await fetch(mirrorShaUrl);

  if (mirrorResponse.ok) {
    return {
      baseUrl: mpvMirrorBaseUrl,
      shaText: await mirrorResponse.text(),
      source: "mirror",
    };
  }

  if (mirrorResponse.status !== 404) {
    throw new Error(
      `Failed to fetch PLAY. libmpv mirror metadata ${mirrorShaUrl}: ${mirrorResponse.status} ${mirrorResponse.statusText}`,
    );
  }

  const upstreamShaUrl = `${mpvUpstreamBaseUrl}/sha256.txt`;
  const upstreamResponse = await fetch(upstreamShaUrl);
  if (!upstreamResponse.ok) {
    throw new Error(
      `PLAY. libmpv mirror is missing and upstream metadata is unavailable ${upstreamShaUrl}: ${upstreamResponse.status} ${upstreamResponse.statusText}`,
    );
  }

  console.warn(
    `PLAY. libmpv mirror ${mpvMirrorTag} is not available yet; falling back to pinned upstream release ${mpvRelease}.`,
  );

  return {
    baseUrl: mpvUpstreamBaseUrl,
    shaText: await upstreamResponse.text(),
    source: "upstream",
  };
}
