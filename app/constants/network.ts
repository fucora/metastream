export const NETWORK_TIMEOUT = 15000
export const RECONNECT_TIMEOUT = 30000
export const WEBSOCKET_PORT_DEFAULT = 27064

export const enum NetworkDisconnectReason {
  HostDisconnect = 1,
  Timeout,
  InvalidClientInfo,
  VersionMismatch,
  DuplicateLicense,
  Full
}

export const NetworkDisconnectMessages = {
  [NetworkDisconnectReason.HostDisconnect]: 'Host closed connection',
  [NetworkDisconnectReason.Timeout]: 'Network timeout',
  [NetworkDisconnectReason.InvalidClientInfo]: 'Invalid client info',
  [NetworkDisconnectReason.VersionMismatch]: `Client version mismatch`,
  [NetworkDisconnectReason.DuplicateLicense]: `Shared license found in session`,
  [NetworkDisconnectReason.Full]: 'Session is full'
}
