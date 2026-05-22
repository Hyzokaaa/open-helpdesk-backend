export interface MtaHookEnvelopeAddress {
  address: string;
  parameters?: Record<string, unknown>;
}

export interface MtaHookPayload {
  envelope: {
    from: MtaHookEnvelopeAddress;
    to: MtaHookEnvelopeAddress[];
  };
  message: {
    headers: [string, string][];
    contents: string;
    size?: number;
  };
}
