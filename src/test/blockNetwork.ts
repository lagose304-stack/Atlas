import { vi } from 'vitest';

const blockedRequests: string[] = [];
const NativeXMLHttpRequest = globalThis.XMLHttpRequest;

function block(transport: string): never {
  // No registrar URLs, cabeceras o cuerpos que pudieran contener credenciales.
  blockedRequests.push(transport);
  throw new Error(`Red real bloqueada en pruebas (${transport}). Simula el servicio antes de usarlo.`);
}

export function consumeBlockedRequests(): string[] {
  return blockedRequests.splice(0);
}

export function installNetworkBlock(): void {
  vi.stubGlobal('fetch', async () => block('fetch'));
  vi.spyOn(NativeXMLHttpRequest.prototype, 'send').mockImplementation(() => block('XMLHttpRequest'));
  vi.stubGlobal('WebSocket', class {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    constructor() { block('WebSocket'); }
  });
  vi.stubGlobal('EventSource', class {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;
    constructor() { block('EventSource'); }
  });
  Object.defineProperty(navigator, 'sendBeacon', {
    configurable: true,
    value: () => block('sendBeacon'),
  });
}
