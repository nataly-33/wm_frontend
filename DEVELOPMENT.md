# Guía de Desarrollo — wm_frontend

Referencia técnica completa para el desarrollo del frontend Angular. Cubre arquitectura, patrones, decisiones técnicas y guías paso a paso para agregar nuevas funcionalidades.

---

## Arquitectura general

```
Angular App (Standalone Components)
│
├── core/          → Singleton services (AuthService, interceptors, guards)
├── shared/        → Componentes UI reutilizables (navbar, sidebar, loader)
└── modules/       → Funcionalidad organizada por rol
    ├── admin/          → ADMIN_GENERAL
    ├── admin-depto/    → ADMIN_DEPARTAMENTO
    └── funcionario/    → FUNCIONARIO
```

### Principios de diseño

1. **Standalone Components**: Todos los componentes son `standalone: true`. No se usan NgModules tradicionales.
2. **Lazy Loading por módulo**: Cada módulo de rol se carga solo cuando el usuario lo necesita.
3. **Reactive (RxJS)**: Las llamadas HTTP retornan `Observable` y se manejan con `subscribe` + `takeUntil` para evitar memory leaks.
4. **Tipado estricto**: `any` está prohibido. Todos los datos tienen interfaces TypeScript.

---

## Routing — Cómo funciona

### Estructura de rutas

```typescript
// src/app/app.routes.ts
export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./core/auth/auth.routes')
  },
  {
    path: 'admin',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN_GENERAL'] },
    loadChildren: () => import('./modules/admin/admin.routes')
  },
  {
    path: 'admin-depto',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['ADMIN_DEPARTAMENTO'] },
    loadChildren: () => import('./modules/admin-depto/admin-depto.routes')
  },
  {
    path: 'funcionario',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['FUNCIONARIO'] },
    loadChildren: () => import('./modules/funcionario/funcionario.routes')
  },
  { path: '**', redirectTo: 'auth/login' }
];
```

### Agregar una nueva ruta dentro de un módulo

```typescript
// src/app/modules/admin/admin.routes.ts
export const adminRoutes: Routes = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'departamentos', component: DepartamentosComponent },
      // Agregar aquí la nueva ruta:
      { path: 'nueva-pagina', component: NuevaPaginaComponent },
    ]
  }
];
```

---

## Guards — Protección de rutas

### AuthGuard

Verifica que el usuario esté autenticado (tenga JWT válido). Si no, redirige a `/auth/login`.

```typescript
// Se aplica automáticamente a todos los módulos en app.routes.ts
canActivate: [AuthGuard]
```

### RoleGuard

Verifica que el usuario tenga el rol requerido. Si no, redirige al dashboard de su rol.

```typescript
// Se aplica con datos de rol
canActivate: [AuthGuard, RoleGuard],
data: { roles: ['ADMIN_GENERAL'] }
```

---

## Interceptor JWT

El `AuthInterceptor` agrega automáticamente el header `Authorization: Bearer {token}` a **todas** las requests HTTP. No necesitas agregar el token manualmente en ningún servicio.

```typescript
// Esto lo hace automáticamente el interceptor:
headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiIs...' }
```

El interceptor también maneja el error `401 Unauthorized`: limpia el token y redirige a login.

---

## ApiResponse — Interfaz de respuesta estándar

Todas las respuestas del backend tienen la misma estructura:

```typescript
// src/app/core/models/api-response.model.ts
export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T | null;
}
```

Uso en los servicios:

```typescript
// Siempre tipar con ApiResponse<T>
listarDepartamentos(): Observable<ApiResponse<Departamento[]>> {
  return this.http.get<ApiResponse<Departamento[]>>(`${this.BASE_URL}`);
}
```

Uso en los componentes:

```typescript
this.departamentoService.listarDepartamentos()
  .pipe(takeUntil(this.destroy$))
  .subscribe({
    next: (response) => {
      // response.data es Departamento[] | null
      this.departamentos = response.data ?? [];
    },
    error: (err) => {
      // err.error es ApiResponse con el mensaje de error del backend
      this.error = err.error?.message ?? 'Error inesperado';
    }
  });
```

---

## WebSockets

El sistema usa STOMP sobre SockJS para comunicación en tiempo real.

### Canales disponibles

| Canal | Descripción |
|-------|-------------|
| `/topic/politica/{politicaId}` | Cambios en el monitor de una política |
| `/topic/usuario/{usuarioId}` | Notificaciones personales |

### Uso del WebSocketService

```typescript
// Suscribirse al canal del monitor
this.wsService.suscribir(`/topic/politica/${politicaId}`, (mensaje) => {
  const cambio = JSON.parse(mensaje.body);
  // Actualizar colores del monitor
  this.actualizarColorNodo(cambio.nodoId, cambio.estado);
});

// Desconectar al salir del componente
ngOnDestroy(): void {
  this.wsService.desconectar();
}
```

---

## Paleta de colores — Cómo usar

Nunca usar colores hardcoded. Siempre usar las CSS variables definidas en `src/styles/_variables.scss`.

```scss
// ✅ CORRECTO
color: var(--text-primary);
background: var(--bg-card);
border-color: var(--border);

// ❌ INCORRECTO
color: #f5f5e8;
background: #2e2e14;
```

### Variables disponibles

```scss
var(--primary-100)   // #C0C080 — oliva claro
var(--primary-200)   // #9D9D60 — oliva medio
var(--primary-300)   // #7A7A40 — oliva
var(--primary-400)   // #565620 — oliva oscuro
var(--primary-500)   // #333300 — oliva muy oscuro

var(--bg-dark)       // Fondo principal
var(--bg-panel)      // Sidebar, panels
var(--bg-card)       // Cards, modales
var(--border)        // Bordes

var(--text-primary)  // Texto principal
var(--text-muted)    // Texto secundario

var(--success)       // Verde
var(--danger)        // Rojo
var(--warning)       // Amarillo
var(--info)          // Azul
```

---

## Responsividad

Todos los componentes deben ser responsive. Breakpoints estándar del proyecto:

```scss
// Mobile (< 768px)
@media (max-width: 767px) { }

// Tablet (768px - 1023px)
@media (min-width: 768px) and (max-width: 1023px) { }

// Desktop (>= 1024px)
@media (min-width: 1024px) { }
```

### Sidebar en mobile

En pantallas menores a 768px, el sidebar colapsa y se abre con un botón hamburguesa. El componente `SidebarComponent` maneja esto automáticamente. No necesitas implementarlo en cada página.

---

## Cómo agregar un nuevo módulo completo

### Paso 1 — Crear los archivos

```bash
# Desde la raíz de wm_frontend
MODULO="admin"
PAGINA="reportes"
BASE="src/app/modules/$MODULO"

mkdir -p $BASE/pages/$PAGINA
touch $BASE/pages/$PAGINA/$PAGINA.component.ts
touch $BASE/pages/$PAGINA/$PAGINA.component.html
touch $BASE/pages/$PAGINA/$PAGINA.component.scss
```

### Paso 2 — Crear la interfaz (model)

```typescript
// src/app/modules/admin/models/reporte.model.ts
export interface Reporte {
  id: string;
  tipo: string;
  politicaId: string;
  generadoEn: string;
  sugerencias: string[];
}
```

### Paso 3 — Crear el servicio

```typescript
// src/app/modules/admin/services/reporte.service.ts
@Injectable({ providedIn: 'root' })
export class ReporteService {
  private readonly BASE_URL = `${environment.apiUrl}/api/v1/reportes`;

  constructor(private http: HttpClient) {}

  obtenerPorPolitica(politicaId: string): Observable<ApiResponse<Reporte[]>> {
    return this.http.get<ApiResponse<Reporte[]>>(
      `${this.BASE_URL}/politica/${politicaId}`
    );
  }
}
```

### Paso 4 — Crear el componente

```typescript
// src/app/modules/admin/pages/reportes/reportes.component.ts
@Component({
  selector: 'app-reportes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reportes.component.html',
  styleUrls: ['./reportes.component.scss']
})
export class ReportesComponent implements OnInit, OnDestroy {
  reportes: Reporte[] = [];
  isLoading = false;
  error: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(private reporteService: ReporteService) {}

  ngOnInit(): void { this.cargar(); }
  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  cargar(): void {
    this.isLoading = true;
    this.reporteService.obtenerPorPolitica('id-actual')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => { this.reportes = r.data ?? []; this.isLoading = false; },
        error: (e) => { this.error = e.error?.message; this.isLoading = false; }
      });
  }
}
```

### Paso 5 — Agregar la ruta

```typescript
// src/app/modules/admin/admin.routes.ts
{ path: 'reportes', component: ReportesComponent },
```

### Paso 6 — Agregar al sidebar

```typescript
// src/app/shared/components/sidebar/sidebar.component.ts
{
  label: 'Reportes',
  icon: 'bar_chart',
  route: '/admin/reportes',
  roles: ['ADMIN_GENERAL']
}
```

---

## Formularios reactivos — Patrón estándar

Todos los formularios usan **Reactive Forms** de Angular. Nunca Template-driven forms.

```typescript
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule]
})
export class DepartamentoFormComponent {

  form: FormGroup;

  constructor(private fb: FormBuilder) {
    this.form = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      descripcion: ['', Validators.maxLength(500)]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    const request: DepartamentoRequest = this.form.value;
    // llamar al service
  }

  // Helper para acceder fácilmente a los controles en el template
  get nombreCtrl() { return this.form.get('nombre'); }
}
```

```html
<form [formGroup]="form" (ngSubmit)="onSubmit()">
  <div class="form-group">
    <label>Nombre *</label>
    <input formControlName="nombre" class="input" placeholder="Nombre del departamento" />
    <span class="error" *ngIf="nombreCtrl?.invalid && nombreCtrl?.touched">
      <span *ngIf="nombreCtrl?.errors?.['required']">El nombre es requerido</span>
      <span *ngIf="nombreCtrl?.errors?.['minlength']">Mínimo 2 caracteres</span>
    </span>
  </div>

  <button type="submit" class="btn btn--primary" [disabled]="form.invalid">
    Guardar
  </button>
</form>
```

---

## Comandos de referencia rápida

```bash
# Iniciar en desarrollo
ng serve

# Build de producción
ng build --configuration production

# Generar componente standalone
ng generate component modules/admin/pages/nueva-pagina --standalone

# Generar servicio
ng generate service modules/admin/services/nuevo-service

# Verificar errores TypeScript
ng build --configuration development

# Lint
ng lint

# Analizar bundle (ver qué pesa)
ng build --stats-json
npx webpack-bundle-analyzer dist/workflow-front/stats.json
```

---

## Herramientas recomendadas

| Herramienta | Uso |
|-------------|-----|
| **VS Code** | IDE principal |
| **Angular DevTools** | Extensión Chrome para debuggear Angular |
| **Redux DevTools** | Si se usa NgRx (no aplica aún) |
| **Postman** | Verificar que los endpoints del back retornan lo esperado |

### Extensiones VS Code recomendadas

- **Angular Language Service** — Autocompletado en templates HTML
- **ESLint** — Análisis de código en tiempo real
- **Prettier** — Formateo automático
- **SCSS IntelliSense** — Autocompletado de variables SCSS
- **GitLens** — Mejor visualización de Git

---

## Glosario del proyecto

| Término Angular | Significado |
|----------------|-------------|
| Standalone Component | Componente sin NgModule, se importa directamente |
| Lazy Loading | Módulo que se carga solo cuando el usuario navega a él |
| Guard | Clase que protege rutas antes de renderizarlas |
| Interceptor | Middleware que modifica requests/responses HTTP |
| Observable | Stream de datos asíncrono de RxJS |
| takeUntil | Operador RxJS para cancelar suscripciones al destruir el componente |
| Subject | Observable que también puede emitir valores manualmente |
