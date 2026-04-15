# wm_frontend

> Sistema de Gestión de Trámites y Políticas de Negocio — Frontend Web

Panel de administración web del sistema **WorkflowManager**, construido con Angular 17. Permite diseñar políticas de negocio mediante diagramas de actividades, gestionar trámites en tiempo real y monitorear el estado de cada proceso.

---

## Stack

| Tecnología | Versión | Uso |
|------------|---------|-----|
| Angular | 17.x | Framework principal |
| TypeScript | 5.x | Lenguaje principal |
| Angular Material | 17.x | Componentes UI |
| SCSS | — | Estilos con variables |
| @stomp/stompjs | 7.x | WebSockets (STOMP sobre SockJS) |
| sockjs-client | 1.x | Fallback para WebSockets |
| jwt-decode | 4.x | Decodificación de JWT en cliente |
| html2canvas | 1.x | Exportar diagrama como imagen |
| jsPDF | 2.x | Exportar diagrama como PDF |
| RxJS | 7.x | Programación reactiva |

---

## Requisitos previos

```bash
node --version     # Node.js 18+
npm --version      # npm 9+
ng version         # Angular CLI 17+
git --version      # Git (cualquier versión reciente)
```

---

## Instalación y ejecución local

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/wm_frontend.git
cd wm_frontend
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar entorno local

Verifica que `src/environments/environment.ts` apunte al backend local:

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080',
  wsUrl: 'http://localhost:8080/ws'
};
```

### 4. Ejecutar en modo desarrollo

```bash
ng serve
# La aplicación inicia en: http://localhost:4200
```

> El backend (`wm_backend`) debe estar corriendo en `http://localhost:8080` para que el frontend funcione.

---

## Estructura del proyecto

```
src/
├── app/
│   ├── core/                           ← Servicios y lógica global
│   │   ├── auth/
│   │   │   ├── auth.guard.ts           ← Protección de rutas
│   │   │   ├── auth.interceptor.ts     ← Agrega JWT a cada request
│   │   │   └── role.guard.ts           ← Protección por rol
│   │   ├── models/                     ← Interfaces TypeScript globales
│   │   │   ├── api-response.model.ts
│   │   │   └── user.model.ts
│   │   └── services/
│   │       ├── auth.service.ts         ← Login, logout, JWT storage
│   │       └── notification.service.ts
│   │
│   ├── shared/                         ← Componentes reutilizables
│   │   ├── components/
│   │   │   ├── navbar/
│   │   │   ├── sidebar/
│   │   │   ├── loader/
│   │   │   └── confirm-dialog/
│   │   └── pipes/
│   │
│   ├── modules/                        ← Módulos por rol
│   │   ├── admin/                      ← ADMIN_GENERAL
│   │   │   ├── pages/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── empresas/
│   │   │   │   ├── departamentos/
│   │   │   │   ├── usuarios/
│   │   │   │   ├── politicas/
│   │   │   │   │   ├── lista/
│   │   │   │   │   ├── editor-diagrama/ ← Canvas drag & drop
│   │   │   │   │   └── monitor/         ← Verde/amarillo/rojo
│   │   │   │   └── tramites/
│   │   │   ├── models/
│   │   │   ├── services/
│   │   │   └── admin.routes.ts
│   │   │
│   │   ├── admin-depto/                ← ADMIN_DEPARTAMENTO
│   │   │   ├── pages/
│   │   │   │   ├── formularios/
│   │   │   │   └── tramites/
│   │   │   ├── models/
│   │   │   ├── services/
│   │   │   └── admin-depto.routes.ts
│   │   │
│   │   └── funcionario/                ← FUNCIONARIO
│   │       ├── pages/
│   │       │   ├── tareas/
│   │       │   └── ejecutar-tarea/
│   │       ├── models/
│   │       ├── services/
│   │       └── funcionario.routes.ts
│   │
│   ├── app.component.ts
│   ├── app.config.ts
│   └── app.routes.ts
│
├── environments/
│   ├── environment.ts          ← URLs locales
│   └── environment.prod.ts     ← URLs de Azure
│
└── styles/
    ├── _variables.scss         ← Paleta de colores y variables
    └── _reset.scss             ← Reset CSS global
```

---

## Paleta de colores

El sistema usa un tema militar/oliva oscuro:

| Variable CSS | Color | Uso |
|-------------|-------|-----|
| `--primary-100` | `#C0C080` | Elementos interactivos claros |
| `--primary-200` | `#9D9D60` | Texto secundario, iconos |
| `--primary-300` | `#7A7A40` | Bordes, separadores |
| `--primary-400` | `#565620` | Botones secundarios |
| `--primary-500` | `#333300` | Texto oscuro sobre fondo claro |
| `--bg-dark` | `#1a1a00` | Fondo principal de la app |
| `--bg-panel` | `#242410` | Fondo del sidebar y panels |
| `--bg-card` | `#2e2e14` | Fondo de cards y modales |
| `--text-primary` | `#f5f5e8` | Texto principal |
| `--success` | `#6bd968` | Estado exitoso |
| `--danger` | `#f44250` | Estado de error/rechazo |
| `--warning` | `#fecc1b` | Estado pendiente/advertencia |
| `--info` | `#3992ff` | Estado en proceso |

---

## Módulos y acceso por rol

| Módulo | Rol requerido | Acceso |
|--------|---------------|--------|
| `/admin` | `ADMIN_GENERAL` | Dashboard, empresas, departamentos, usuarios, políticas, monitor |
| `/admin-depto` | `ADMIN_DEPARTAMENTO` | Formularios de su departamento, trámites de su área |
| `/funcionario` | `FUNCIONARIO` | Lista de tareas pendientes, ejecutar tareas |

---

## Variables de entorno

| Archivo | Uso |
|---------|-----|
| `environment.ts` | Desarrollo local (`ng serve`) |
| `environment.prod.ts` | Producción Azure (`ng build --configuration production`) |

---

## Despliegue en Azure

```bash
# Build de producción
ng build --configuration production

# Deploy en Azure Static Web Apps (con Azure CLI)
az staticwebapp deploy \
  --name wm-frontend \
  --resource-group rg-workflow-parcial \
  --source ./dist/workflow-front
```

---

## Convención de commits

Este proyecto sigue [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(admin): agregar página de gestión de departamentos
fix(auth): corregir redirección post-login según rol
style(sidebar): ajustar responsividad en pantallas medianas
refactor(politicas): separar lógica del editor en servicio
chore(deps): actualizar @angular/material a 17.3
```

---

## Licencia

Proyecto académico — Universidad Autónoma Gabriel René Moreno  
Materia: Ingeniería de Software I — Ing. Martínez Canedo
