import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import { isEditor2PreviewFrame } from './editor2/public/previewFrame';
import './styles/utopia.css';
import './style.css';
import './styles/temario-typography.css';

const Root = isEditor2PreviewFrame()
  ? lazy(() => import('./editor2/pages/Editor2PreviewFrame'))
  : lazy(() => import('./App'));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense>
      <Root />
    </Suspense>
  </React.StrictMode>
);
