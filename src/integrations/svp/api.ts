import { invoke } from "@tauri-apps/api/core";
import {
  UNAVAILABLE_SVP_INTEGRATION_STATE,
  type SvpIntegrationState,
} from "./types";

export async function resolveSvpIntegration(requestedEnabled: boolean): Promise<SvpIntegrationState> {
  try {
    return await invoke<SvpIntegrationState>("resolve_svp_integration", {
      requestedEnabled,
    });
  } catch {
    return UNAVAILABLE_SVP_INTEGRATION_STATE;
  }
}
