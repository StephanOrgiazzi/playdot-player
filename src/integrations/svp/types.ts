export type SvpIntegrationState = {
  available: boolean;
  enabled: boolean;
};

export const UNAVAILABLE_SVP_INTEGRATION_STATE: SvpIntegrationState = {
  available: false,
  enabled: false,
};
