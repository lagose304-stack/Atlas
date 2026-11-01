import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, expect } from 'vitest';
import { consumeBlockedRequests, installNetworkBlock } from './blockNetwork';

// Instalar antes de importar los módulos de cada suite y renovar entre casos.
installNetworkBlock();
beforeEach(installNetworkBlock);
afterEach(() => {
  // También detecta una solicitud bloqueada si el código capturó su error.
  expect(consumeBlockedRequests(), 'Una prueba intentó usar red real; simula su dependencia.').toEqual([]);
});
