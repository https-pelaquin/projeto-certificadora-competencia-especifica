export { handlers } from './handlers';
export { worker } from './browser';

/**
 * Inicializa o Mock Service Worker no navegador antes da renderização do React
 * exclusivamente quando VITE_ENABLE_MSW === 'true'.
 */
export async function enableMocking(): Promise<void> {
  if (
    import.meta.env.VITE_ENABLE_MSW !== 'true' ||
    typeof window === 'undefined'
  ) {
    return;
  }

  try {
    const { worker } = await import('./browser');
    await worker.start({
      onUnhandledFrame: 'bypass',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
  } catch (error) {
    console.warn('[MSW] Não foi possível inicializar o Service Worker:', error);
  }
}
