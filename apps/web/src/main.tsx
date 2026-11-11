import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

async function prepareApp(): Promise<void> {
  if (import.meta.env.VITE_ENABLE_MSW === 'true') {
    const { enableMocking } = await import('@/mocks');
    await enableMocking();
  }
}

prepareApp().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
