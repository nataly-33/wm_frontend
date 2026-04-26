import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent, SidebarItem } from '../../shared/components/sidebar/sidebar.component';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { AuthService } from '../../core/services/auth.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent, NavbarComponent, CommonModule],
  template: `
    <div class="admin-shell">
      <app-sidebar [items]="menuItems"></app-sidebar>
      <div class="admin-body">
        <app-navbar [userName]="nombreUsuario"></app-navbar>
        <main class="admin-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .admin-shell {
      display: flex;
      height: 100vh;
      background: var(--bg-dark);
      overflow: hidden;
    }

    .admin-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: var(--bg-dark);
    }

    .admin-content {
      flex: 1;
      overflow-y: auto;
      padding: 32px;

      &::-webkit-scrollbar {
        width: 6px;
      }
      &::-webkit-scrollbar-track {
        background: transparent;
      }
      &::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 6px;
      }
    }
  `]
})
export class AdminLayoutComponent implements OnInit {
  nombreUsuario = '';

  // SVG icons como strings para el sidebar
  private iconDashboardSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
  private iconDepartamentosSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
  private iconUsuariosSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  private iconPoliticasSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
  private iconFormulariosSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  private iconTramitesSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
  private iconMonitorSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
  private iconAnalisisSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;

  menuItems: SidebarItem[] = [];

  constructor(
    private authService: AuthService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.nombreUsuario = user.nombre;
    }

    this.menuItems = [
      { label: 'Dashboard',     icon: this.sanitizer.bypassSecurityTrustHtml(this.iconDashboardSvg),     route: '/admin' },
      { label: 'Departamentos', icon: this.sanitizer.bypassSecurityTrustHtml(this.iconDepartamentosSvg),  route: '/admin/departamentos' },
      { label: 'Usuarios',      icon: this.sanitizer.bypassSecurityTrustHtml(this.iconUsuariosSvg),       route: '/admin/usuarios' },
      { label: 'Politicas',     icon: this.sanitizer.bypassSecurityTrustHtml(this.iconPoliticasSvg),      route: '/admin/politicas' },
      { label: 'Formularios',   icon: this.sanitizer.bypassSecurityTrustHtml(this.iconFormulariosSvg),    route: '/admin/formularios' },
      { label: 'Tramites',      icon: this.sanitizer.bypassSecurityTrustHtml(this.iconTramitesSvg),       route: '/admin/tramites' },
      { label: 'Monitor',       icon: this.sanitizer.bypassSecurityTrustHtml(this.iconMonitorSvg),        route: '/admin/monitor' },
      { label: 'Analisis IA',   icon: this.sanitizer.bypassSecurityTrustHtml(this.iconAnalisisSvg),      route: '/admin/analisis' },
    ];
  }
}
