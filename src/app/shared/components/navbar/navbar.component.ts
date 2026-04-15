import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="navbar">
      <div class="navbar-left">
        <div class="nav-title">
          <span class="nav-brand">WorkflowManager</span>
          <span class="nav-role-badge" [ngClass]="getRolClass()">{{ getRolLabel() }}</span>
        </div>
      </div>
      <div class="navbar-right">
        <div class="user-chip">
          <div class="user-avatar">{{ getInitials() }}</div>
          <div class="user-info">
            <span class="user-name">{{ userName }}</span>
            <span class="user-role">{{ getRolLabel() }}</span>
          </div>
        </div>
        <button class="btn-logout" (click)="logout()" title="Cerrar sesion">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Salir</span>
        </button>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 28px;
      background: rgba(34, 34, 18, 0.92);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 12px rgba(0,0,0,0.2);
    }

    .navbar-left {
      display: flex;
      align-items: center;
    }

    .nav-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .nav-brand {
      font-size: 18px;
      font-weight: 800;
      color: var(--primary-100);
      letter-spacing: -0.3px;
    }

    .nav-role-badge {
      font-size: 10px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 20px;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      &.role-admin {
        background: rgba(192, 192, 128, 0.15);
        color: var(--primary-100);
        border: 1px solid rgba(192, 192, 128, 0.3);
      }
      &.role-depto {
        background: rgba(57, 146, 255, 0.12);
        color: var(--info);
        border: 1px solid rgba(57, 146, 255, 0.3);
      }
      &.role-func {
        background: rgba(107, 217, 104, 0.12);
        color: var(--success);
        border: 1px solid rgba(107, 217, 104, 0.3);
      }
    }

    .navbar-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 12px 6px 6px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 24px;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-400), var(--primary-300));
      color: var(--text-primary);
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-info {
      display: flex;
      flex-direction: column;
    }

    .user-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .user-role {
      font-size: 10px;
      color: var(--text-muted);
    }

    .btn-logout {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: rgba(244, 66, 80, 0.08);
      color: var(--danger);
      border: 1px solid rgba(244, 66, 80, 0.2);
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(244, 66, 80, 0.15);
        border-color: rgba(244, 66, 80, 0.4);
        transform: translateY(-1px);
      }
    }
  `]
})
export class NavbarComponent {
  @Input() userName: string = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  getInitials(): string {
    if (!this.userName) return 'U';
    const parts = this.userName.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return this.userName.substring(0, 2).toUpperCase();
  }

  getRolLabel(): string {
    const rol = this.authService.getRol();
    switch (rol) {
      case 'ADMIN_GENERAL': return 'Admin General';
      case 'ADMIN_DEPARTAMENTO': return 'Admin Depto';
      case 'FUNCIONARIO': return 'Funcionario';
      default: return '';
    }
  }

  getRolClass(): string {
    const rol = this.authService.getRol();
    switch (rol) {
      case 'ADMIN_GENERAL': return 'role-admin';
      case 'ADMIN_DEPARTAMENTO': return 'role-depto';
      case 'FUNCIONARIO': return 'role-func';
      default: return '';
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
