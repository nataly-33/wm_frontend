import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (this.authService.isAuthenticated()) {
      // Verificar si la ruta requiere un rol específico
      const requiredRoles = route.data['roles'] as Array<string>;
      const userRol = this.authService.getRol();

      if (requiredRoles && requiredRoles.length > 0) {
        if (requiredRoles.includes(userRol || '')) {
          return true;
        } else {
          // Usuario no tiene el rol requerido, redirigir según su rol
          this.redirectBasedOnRole(userRol);
          return false;
        }
      }

      return true;
    } else {
      // No autenticado, redirigir a login
      this.router.navigate(['/login']);
      return false;
    }
  }

  private redirectBasedOnRole(rol: string | null): void {
    switch (rol) {
      case 'ADMIN_GENERAL':
        this.router.navigate(['/admin']);
        break;
      case 'ADMIN_DEPARTAMENTO':
        this.router.navigate(['/admin-depto']);
        break;
      case 'FUNCIONARIO':
        this.router.navigate(['/funcionario']);
        break;
      default:
        this.router.navigate(['/login']);
    }
  }
}
