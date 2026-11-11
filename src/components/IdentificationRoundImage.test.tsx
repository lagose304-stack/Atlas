import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IdentificationRoundImage from './IdentificationRoundImage';

describe('Carga de imagen del desafío', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16));
    vi.stubGlobal('cancelAnimationFrame', window.clearTimeout);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  function loaded(image: HTMLImageElement, decode: () => Promise<void>) {
    Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 600 }, naturalHeight: { value: 300 }, decode: { value: decode } });
    fireEvent.load(image);
  }

  it('no inicia durante una descarga lenta y permite reintentar un error sin iniciar el reloj', () => {
    const onReady = vi.fn();
    render(<IdentificationRoundImage src="/slow.jpg" onReady={onReady} />);
    act(() => vi.advanceTimersByTime(20000));
    expect(onReady).not.toHaveBeenCalled();
    expect(screen.getByText('La imagen está tardando en cargar')).toBeInTheDocument();
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('No se pudo cargar la placa')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar carga' }));
    expect(onReady).not.toHaveBeenCalled();
    expect(screen.queryByText('No se pudo cargar la placa')).not.toBeInTheDocument();
  });

  it('espera la decodificación y dos fotogramas antes de iniciar una sola vez', async () => {
    let finish!: () => void;
    const decode = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const onReady = vi.fn();
    render(<IdentificationRoundImage src="/photo.jpg" onReady={onReady} />);
    const image = screen.getByRole('img') as HTMLImageElement;
    loaded(image, decode);
    act(() => vi.advanceTimersByTime(2000));
    expect(onReady).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(image).toHaveStyle({ opacity: '1' });
    act(() => vi.advanceTimersByTime(16));
    expect(onReady).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(16));
    expect(onReady).toHaveBeenCalledOnce();
    fireEvent.load(image);
    act(() => vi.advanceTimersByTime(1000));
    expect(onReady).toHaveBeenCalledOnce();
  });

  it('ignora la decodificación de una ronda que ya fue desmontada', async () => {
    let finish!: () => void;
    const onReady = vi.fn();
    const { unmount } = render(<IdentificationRoundImage src="/old.jpg" onReady={onReady} />);
    loaded(screen.getByRole('img') as HTMLImageElement, () => new Promise(resolve => { finish = resolve; }));
    unmount();
    await act(async () => finish());
    act(() => vi.advanceTimersByTime(100));
    expect(onReady).not.toHaveBeenCalled();
  });

  it('no inicia si falla la decodificación', async () => {
    const onReady = vi.fn();
    render(<IdentificationRoundImage src="/broken.jpg" onReady={onReady} />);
    await act(async () => loaded(screen.getByRole('img') as HTMLImageElement, () => Promise.reject(new Error('decode'))));
    act(() => vi.advanceTimersByTime(1000));
    expect(onReady).not.toHaveBeenCalled();
    expect(screen.getByText('No se pudo cargar la placa')).toBeInTheDocument();
  });

  it('reconoce imágenes de caché sin depender de otro evento de carga', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(600);
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(300);
    const onReady = vi.fn();
    render(<IdentificationRoundImage src="/cached.jpg" onReady={onReady} />);
    expect(onReady).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(32));
    expect(onReady).toHaveBeenCalledOnce();
  });
});
