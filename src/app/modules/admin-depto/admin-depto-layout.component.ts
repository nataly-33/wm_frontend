import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { SidebarComponent, SidebarItem } from '../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-admin-depto-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, SidebarComponent],
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
  styles: [
    `
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
      }
    `
  ]
})
export class AdminDeptoLayoutComponent implements OnInit {
  nombreUsuario = '';
  menuItems: SidebarItem[] = [];

  private iconDashboardSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
  private iconFormSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;
  private iconTramiteSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;

  constructor(private authService: AuthService, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.nombreUsuario = user.nombre;
    }

    this.menuItems = [
      { label: 'Dashboard', icon: this.sanitizer.bypassSecurityTrustHtml(this.iconDashboardSvg), route: '/admin-depto' },
      {
        label: 'Mis Formularios',
        icon: this.sanitizer.bypassSecurityTrustHtml(this.iconFormSvg),
        route: '/admin-depto/formularios'
      },
      {
        label: 'Mis Trámites',
        icon: this.sanitizer.bypassSecurityTrustHtml(this.iconTramiteSvg),
        route: '/admin-depto/tramites'
      }
    ];
  }
}
