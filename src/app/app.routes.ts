import { Routes } from '@angular/router';
import { LoginComponent } from './modules/auth/login/login.component';
import { AuthGuard } from './core/auth/auth.guard';
import { AdminLayoutComponent } from './modules/admin/admin-layout.component';

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
      }
    ]
  },

  {
    path: 'admin-depto',
    canActivate: [AuthGuard],
    data: { roles: ['ADMIN_DEPARTAMENTO'] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./modules/admin-depto/pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
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
        loadComponent: () =>
          import('./modules/funcionario/pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent
          )
      }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
