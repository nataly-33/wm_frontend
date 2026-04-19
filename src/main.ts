import 'zone.js';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';

// Algunos paquetes (ej. sockjs-client) asumen que existe `global` (Node).
// En el navegador lo mapeamos a `window` para evitar errores en runtime.
(window as any).global = window;

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

registerLocaleData(localeEs);

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
