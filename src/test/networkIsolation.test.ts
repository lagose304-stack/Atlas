import { describe, expect, it, vi } from 'vitest';
import { consumeBlockedRequests } from './blockNetwork';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../services/supabase';
import axios from 'axios';

describe('aislamiento de red de las pruebas', () => {
  it('utiliza destinos ficticios aunque exista configuración de desarrollo', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBe('https://supabase.atlas-tests.invalid');
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBe('atlas-test-key-not-a-credential');
    expect(import.meta.env.VITE_BACKEND_BASE_URL).toBe('https://api.atlas-tests.invalid');
    expect(import.meta.env.VITE_R2_PUBLIC_DOMAIN).toBe('https://r2.atlas-tests.invalid');
    expect(SUPABASE_URL).toBe('https://supabase.atlas-tests.invalid');
    expect(SUPABASE_ANON_KEY).toBe('atlas-test-key-not-a-credential');
  });

  it('impide que una consulta del cliente Supabase sin simular salga a la red', async () => {
    const result = await supabase.from('temas').select('id').limit(1);
    expect(result.error?.message).toContain('Red real bloqueada');
    expect(result.data).toBeNull();
    expect(consumeBlockedRequests()).toEqual(['fetch']);
  });

  it.each(['https://example.invalid/api', '/api/images-delete'])(
    'bloquea fetch hacia %s antes de enviarlo', async destination => {
      await expect(fetch(destination, { method: 'DELETE' })).rejects.toThrow('Red real bloqueada');
      expect(consumeBlockedRequests()).toEqual(['fetch']);
    },
  );

  it('bloquea XMLHttpRequest, usado por Axios en el navegador', () => {
    const request = new XMLHttpRequest();
    request.open('POST', 'https://example.invalid/upload');
    expect(() => request.send('contenido de prueba')).toThrow('Red real bloqueada');
    expect(consumeBlockedRequests()).toEqual(['XMLHttpRequest']);
  });

  it('impide una eliminación real desde Axios aunque se olvide simular la API de imágenes', async () => {
    await expect(axios.delete('https://api.atlas-tests.invalid/api/images-delete', {
      params: { publicId: 'placa-de-prueba.webp' },
    })).rejects.toThrow('Red real bloqueada');
    expect(consumeBlockedRequests()).toEqual(['XMLHttpRequest']);
  });

  it('bloquea conexiones persistentes y telemetría del navegador', () => {
    expect(() => new WebSocket('wss://example.invalid')).toThrow('Red real bloqueada');
    expect(() => new EventSource('https://example.invalid/events')).toThrow('Red real bloqueada');
    expect(() => navigator.sendBeacon('/analytics', 'prueba')).toThrow('Red real bloqueada');
    expect(consumeBlockedRequests()).toEqual(['WebSocket', 'EventSource', 'sendBeacon']);
  });

  it('permite respuestas simuladas sin abrir la red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ ok: true }) }));
    expect(await (await fetch('/servicio-simulado')).json()).toEqual({ ok: true });
    expect(consumeBlockedRequests()).toEqual([]);
  });

  it('restablece el bloqueo después de una prueba que simuló fetch', async () => {
    await expect(fetch('/sin-simular')).rejects.toThrow('Red real bloqueada');
    expect(consumeBlockedRequests()).toEqual(['fetch']);
  });
});
