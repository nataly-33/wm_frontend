# Guía de Contribución — wm_frontend

Esta guía define las convenciones y reglas para contribuir al frontend del proyecto WorkflowManager. Seguirla garantiza un código Angular organizado, consistente y fácil de mantener.

---

## Flujo de trabajo con Git

### Rama principal

Este proyecto trabaja sobre **una sola rama: `main`**.

- `main` es la rama de producción y desarrollo
- Cada commit debe dejar el proyecto en estado ejecutable (`ng serve` no puede fallar)
- Hacer `ng build` antes de pushear para verificar que no hay errores de compilación

### Antes de hacer commit

```bash
# 1. Verificar que compila sin errores
ng build --configuration development

# 2. Verificar que no hay errores de TypeScript o lint
ng lint

# 3. Recién entonces, commitear
git add .
git commit -m "feat(modulo): descripción del cambio"
git push origin main
```

---

## Convención de commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/).

### Formato

```
<tipo>(<ámbito>): <descripción corta en minúsculas>
```

### Tipos permitidos

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Nueva página, componente o funcionalidad |
| `fix` | Corrección de bug visual o lógico |
| `style` | Solo cambios de SCSS, colores, espaciado |
| `refactor` | Refactorización sin nueva funcionalidad |
| `docs` | Solo documentación |
| `chore` | Dependencias, configuración |
| `perf` | Mejoras de rendimiento (lazy loading, etc.) |
| `test` | Tests |

### Ámbitos del proyecto

```
auth, admin, admin-depto, funcionario, shared, core,
sidebar, navbar, diagrama, monitor, tramites,
politicas, formularios, usuarios, departamentos
```

### Ejemplos correctos

```bash
# Nuevas funcionalidades
git commit -m "feat(auth): implementar pantalla de login con validación"
git commit -m "feat(admin): agregar tabla de departamentos con paginación"
git commit -m "feat(diagrama): implementar canvas drag & drop con jsPlumb"
git commit -m "feat(monitor): implementar actualización en tiempo real por WebSocket"

# Correcciones
git commit -m "fix(auth): corregir guard que no redirigía según rol"
git commit -m "fix(sidebar): resolver desbordamiento en pantallas pequeñas"

# Estilos
git commit -m "style(admin): aplicar paleta de colores oliva al dashboard"
git commit -m "style(shared): mejorar responsividad de la navbar en mobile"

# Refactoring
git commit -m "refactor(politicas): extraer lógica del editor a PoliticaEditorService"
git commit -m "refactor(core): centralizar manejo de errores HTTP en interceptor"

# Mantenimiento
git commit -m "chore(deps): actualizar Angular Material a 17.3"
git commit -m "chore(env): agregar URL de producción Azure en environment.prod.ts"
```

### Ejemplos incorrectos

```bash
# ❌ Sin tipo ni ámbito
git commit -m "arreglé el login"

# ❌ Sin ámbito
git commit -m "feat: nueva página"

# ❌ Demasiado genérico
git commit -m "fix: varios arreglos de CSS"

# ❌ Descripción en mayúscula
git commit -m "feat(auth): Implementar Login"
```

---

## Proceso de desarrollo por módulo

### Orden obligatorio al crear una nueva funcionalidad

```
1. Model     → Interfaz TypeScript
2. Service   → Llamadas HTTP + lógica
3. Component → Página o componente visual
4. Route     → Registrar en el módulo de rutas
```

### 1. Model — Interfaz TypeScript

**Ubicación:** `src/app/modules/[modulo]/models/[entidad].model.ts`

```typescript
// src/app/modules/admin/models/departamento.model.ts

export interface Departamento {
  id: string;
  nombre: string;
  descripcion?: string;
  adminDepartamentoId?: string;
  activo: boolean;
  empresaId: string;
  creadoEn: string;
}

export interface DepartamentoRequest {
  nombre: string;
  descripcion?: string;
  adminDepartamentoId?: string;
}

export interface DepartamentoResponse extends Departamento {}
```

**Reglas:**
- Siempre `interface`, nunca `class` para modelos de datos
- Separar Request (lo que se envía) de la entidad completa
- Los campos opcionales con `?`
- Las fechas del backend llegan como `string` (ISO 8601)
- Nunca usar `any`

### 2. Service — Llamadas HTTP

**Ubicación:** `src/app/modules/[modulo]/services/[entidad].service.ts`

```typescript
// src/app/modules/admin/services/departamento.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '@core/models/api-response.model';
import { Departamento, DepartamentoRequest } from '../models/departamento.model';

@Injectable({
  providedIn: 'root'
})
export class DepartamentoService {

  private readonly BASE_URL = `${environment.apiUrl}/api/v1/departamentos`;

  constructor(private http: HttpClient) {}

  listarPorEmpresa(empresaId: string): Observable<ApiResponse<Departamento[]>> {
    return this.http.get<ApiResponse<Departamento[]>>(
      `${this.BASE_URL}/empresa/${empresaId}`
    );
  }

  obtenerPorId(id: string): Observable<ApiResponse<Departamento>> {
    return this.http.get<ApiResponse<Departamento>>(`${this.BASE_URL}/${id}`);
  }

  crear(request: DepartamentoRequest): Observable<ApiResponse<Departamento>> {
    return this.http.post<ApiResponse<Departamento>>(this.BASE_URL, request);
  }

  actualizar(id: string, request: DepartamentoRequest): Observable<ApiResponse<Departamento>> {
    return this.http.put<ApiResponse<Departamento>>(
      `${this.BASE_URL}/${id}`,
      request
    );
  }

  eliminar(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.BASE_URL}/${id}`);
  }
}
```

**Reglas:**
- Siempre `Injectable({ providedIn: 'root' })`
- Siempre tipar el Observable: `Observable<ApiResponse<T>>`
- La URL base como propiedad privada `readonly`
- Inyectar solo `HttpClient` en el constructor (el interceptor agrega el JWT automáticamente)
- No suscribirse en el service (`subscribe` va en el componente o en `ngOnInit`)
- Nunca usar `any` en los tipos genéricos

### 3. Component — Página o componente visual

**Ubicación:** `src/app/modules/[modulo]/pages/[pagina]/[pagina].component.ts`

```typescript
// src/app/modules/admin/pages/departamentos/departamentos.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { DepartamentoService } from '../../services/departamento.service';
import { Departamento } from '../../models/departamento.model';

@Component({
  selector: 'app-departamentos',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './departamentos.component.html',
  styleUrls: ['./departamentos.component.scss']
})
export class DepartamentosComponent implements OnInit, OnDestroy {

  departamentos: Departamento[] = [];
  isLoading = false;
  error: string | null = null;

  // Para cancelar suscripciones al destruir el componente
  private destroy$ = new Subject<void>();

  constructor(private departamentoService: DepartamentoService) {}

  ngOnInit(): void {
    this.cargarDepartamentos();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarDepartamentos(): void {
    this.isLoading = true;
    this.error = null;

    this.departamentoService.listarPorEmpresa('empresa-id-actual')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.departamentos = response.data ?? [];
          this.isLoading = false;
        },
        error: (err) => {
          this.error = err.error?.message ?? 'Error al cargar departamentos';
          this.isLoading = false;
        }
      });
  }

  eliminar(id: string): void {
    this.departamentoService.eliminar(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.departamentos = this.departamentos.filter(d => d.id !== id);
        },
        error: (err) => console.error('Error al eliminar', err)
      });
  }
}
```

**Reglas:**
- Siempre `standalone: true`
- Siempre implementar `OnDestroy` y usar `takeUntil(this.destroy$)` para cancelar suscripciones
- Siempre manejar `isLoading` y `error` en cada llamada HTTP
- Nunca suscribirse sin manejar el `error`
- Usar `?.` y `?? []` para valores que pueden ser null/undefined

### 4. Template HTML

```html
<!-- departamentos.component.html -->
<div class="page-container">

  <!-- Header -->
  <div class="page-header">
    <h1 class="page-title">Departamentos</h1>
    <button class="btn btn--primary" (click)="abrirModal()">
      + Agregar departamento
    </button>
  </div>

  <!-- Loading -->
  <div class="loader-container" *ngIf="isLoading">
    <app-loader />
  </div>

  <!-- Error -->
  <div class="alert alert--danger" *ngIf="error && !isLoading">
    {{ error }}
  </div>

  <!-- Tabla -->
  <div class="card" *ngIf="!isLoading && !error">
    <table class="table">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Admin responsable</th>
          <th>Estado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        <tr *ngFor="let depto of departamentos">
          <td>{{ depto.nombre }}</td>
          <td>{{ depto.adminDepartamentoId ?? '—' }}</td>
          <td>
            <span class="badge" [class.badge--success]="depto.activo"
                                [class.badge--danger]="!depto.activo">
              {{ depto.activo ? 'Activo' : 'Inactivo' }}
            </span>
          </td>
          <td class="actions">
            <button class="btn btn--icon" (click)="editar(depto)">✏️</button>
            <button class="btn btn--icon btn--danger" (click)="confirmarEliminar(depto.id)">🗑️</button>
          </td>
        </tr>
        <tr *ngIf="departamentos.length === 0">
          <td colspan="4" class="empty-state">No hay departamentos registrados</td>
        </tr>
      </tbody>
    </table>
  </div>

</div>
```

**Reglas:**
- Siempre mostrar estado de carga (`*ngIf="isLoading"`)
- Siempre mostrar estado de error (`*ngIf="error"`)
- Siempre manejar lista vacía (`*ngIf="lista.length === 0"`)
- Usar clases CSS de los estilos globales: `.card`, `.badge`, `.btn`, `.table`
- Evitar estilos inline en el HTML

### 5. Estilos SCSS del componente

```scss
// departamentos.component.scss
// Solo estilos específicos de ESTE componente
// Los estilos globales van en src/styles/

.page-container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.actions {
  display: flex;
  gap: 8px;
}

// Responsive
@media (max-width: 768px) {
  .page-container {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}
```

**Reglas:**
- Solo estilos específicos del componente en el archivo `.scss` del componente
- Variables de color **siempre** con CSS variables: `var(--primary-300)`, nunca hardcoded
- Siempre incluir breakpoint para mobile (`max-width: 768px`)

---

## Estilos globales

Los estilos globales viven en `src/styles/`. **No duplicar** aquí lo que ya está en los estilos globales.

### Clases disponibles globalmente

```scss
// Botones
.btn              → base de botón
.btn--primary     → botón de acción principal (fondo oliva)
.btn--secondary   → botón secundario (outline)
.btn--danger      → botón de eliminar
.btn--icon        → botón solo con ícono

// Cards
.card             → contenedor con fondo bg-card y borde

// Badges de estado
.badge--success   → verde
.badge--danger    → rojo
.badge--warning   → amarillo
.badge--info      → azul

// Tabla
.table            → tabla con estilos del sistema

// Alertas
.alert--danger    → mensaje de error
.alert--success   → mensaje de éxito
.alert--warning   → mensaje de advertencia

// Loader
.loader-container → centrado del spinner
```

---

## Manejo de errores HTTP

El `AuthInterceptor` maneja automáticamente:
- Token expirado (401) → redirige a login
- El token JWT se agrega automáticamente a cada request

Para errores de la API en componentes, siempre:

```typescript
.subscribe({
  next: (response) => { /* éxito */ },
  error: (err) => {
    // err.error es el ApiResponse del backend
    this.error = err.error?.message ?? 'Ocurrió un error inesperado';
    this.isLoading = false;
  }
});
```

---

## Checklist antes de hacer commit

```
□ ng build --configuration development no tiene errores
□ ng lint no tiene advertencias críticas
□ El componente es standalone: true
□ Se implementa OnDestroy con takeUntil para cancelar suscripciones
□ Se maneja isLoading y error en cada llamada HTTP
□ Los estilos usan CSS variables (var(--primary-300)) en lugar de colores hardcoded
□ El HTML tiene el estado vacío, de carga y de error
□ El componente es responsive (tiene media query para mobile)
□ El commit sigue Conventional Commits
□ No se subieron archivos de credenciales ni environment.prod.ts con datos reales
```
