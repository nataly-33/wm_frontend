import { Routes } from '@angular/router';
import { LoginComponent } from './modules/auth/login/login.component';
import { AuthGuard } from './core/auth/auth.guard';
import { AdminLayoutComponent } from './modules/admin/admin-layout.component';
import { AdminDeptoLayoutComponent } from './modules/admin-depto/admin-depto-layout.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },

  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN_GENERAL'] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./modules/admin/pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          )
      },
      {
        path: 'departamentos',
        loadComponent: () =>
          import('./modules/admin/pages/departamentos/departamentos.component').then(
            (m) => m.DepartamentosComponent
          )
      },
      {
        path: 'usuarios',
        loadComponent: () =>
          import('./modules/admin/pages/usuarios/usuarios.component').then(
            (m) => m.UsuariosComponent
          )
      },
      {
        path: 'politicas',
        loadComponent: () =>
          import('./modules/admin/pages/politicas/politicas.component').then(
            (m) => m.PoliticasComponent
          )
      },
      {
        path: 'politicas/:id/editor',
        loadComponent: () =>
          import('./modules/admin/pages/politicas/editor-diagrama/editor-diagrama.component').then(
            (m) => m.EditorDiagramaComponent
          )
      },
      {
        path: 'monitor',
        loadComponent: () =>
          import('./modules/admin/pages/monitor/monitor.component').then(
            (m) => m.MonitorComponent
          )
      },
      {
        path: 'formularios',
        loadComponent: () =>
          import('./modules/admin/pages/formularios/formularios.component').then(
            (m) => m.FormulariosComponent
          )
      },
      {
        path: 'tramites',
        loadComponent: () =>
          import('./modules/admin/pages/tramites/tramites.component').then(
            (m) => m.TramitesComponent
          )
      },
      {
        path: 'tramites/:id',
        loadComponent: () =>
          import('./modules/admin/pages/tramites/tramite-detalle/tramite-detalle.component').then(
            (m) => m.TramiteDetalleComponent
          )
      }
    ]
  },

  {
    path: 'admin-depto',
    component: AdminDeptoLayoutComponent,
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN_DEPARTAMENTO'] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./modules/admin-depto/pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          )
      },
      {
        path: 'formularios',
        loadComponent: () =>
          import('./modules/admin-depto/pages/formularios/formularios.component').then(
            (m) => m.FormulariosComponent
          )
      },
      {
        path: 'tramites',
        loadComponent: () =>
          import('./modules/admin-depto/pages/tramites/tramites.component').then(
            (m) => m.TramitesComponent
          )
      }
    ]
  },

  {
    path: 'funcionario',
    canActivate: [AuthGuard],
    data: { roles: ['FUNCIONARIO'] },
    children: [
      {
        path: '',
        redirectTo: 'tareas',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./modules/funcionario/pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          )
      },
      {
        path: 'tareas',
        loadComponent: () =>
          import('./modules/funcionario/pages/tareas/tareas.component').then(
            (m) => m.TareasComponent
          )
      },
      {
        path: 'ejecutar-tarea/:id',
        loadComponent: () =>
          import('./modules/funcionario/pages/ejecutar-tarea/ejecutar-tarea.component').then(
            (m) => m.EjecutarTareaComponent
          )
      }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
