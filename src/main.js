import { createRoot } from 'react-dom/client';
import { html } from './h.js';
import { App } from './App.js';

createRoot(document.getElementById('root')).render(html`<${App} />`);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(function () { /* 설치형이 아니어도 게임은 돈다 */ });
}
