import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from '../../core/services/auth.service';
import { ChatAgenteComponent } from './chat-agente/chat-agente.component';

@Component({
  selector: 'app-cliente-layout',
  standalone: true,
  imports: [RouterOutlet, CommonModule, ChatAgenteComponent],
  template: `
    <div class="cliente-shell">

      <!-- Sidebar -->
      <aside class="cliente-sidebar" [class.collapsed]="sidebarCollapsed">
        <div class="sidebar-logo">
          <div class="logo-mark">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="rgba(192,192,128,0.12)" stroke="rgba(192,192,128,0.35)" stroke-width="1"/>
              <path d="M8 12h16M8 16h12M8 20h8" stroke="#C0C080" stroke-width="2" stroke-linecap="round"/>
              <circle cx="24" cy="20" r="4" fill="rgba(107,217,104,0.2)" stroke="#6BD968" stroke-width="1.5"/>
              <path d="M22.5 20l1 1 2-2" stroke="#6BD968" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="logo-text" *ngIf="!sidebarCollapsed">WorkflowManager</span>
          <button class="sidebar-toggle" (click)="toggleSidebar()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="sidebar-role-badge" *ngIf="!sidebarCollapsed">
          <div class="role-badge">
            <span class="role-dot"></span>
            <span>Portal Cliente</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          <a class="nav-item" [class.active]="isRoute('/cliente/dashboard')" (click)="navegar('/cliente/dashboard')">
            <span class="nav-icon" [innerHTML]="iconDashboard"></span>
            <span class="nav-label" *ngIf="!sidebarCollapsed">Inicio</span>
          </a>
          <a class="nav-item" [class.active]="isRoute('/cliente/mis-tramites')" (click)="navegar('/cliente/mis-tramites')">
            <span class="nav-icon" [innerHTML]="iconTramites"></span>
            <span class="nav-label" *ngIf="!sidebarCollapsed">Mis Tramites</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <button class="logout-btn" (click)="logout()">
            <span class="nav-icon" [innerHTML]="iconLogout"></span>
            <span class="nav-label" *ngIf="!sidebarCollapsed">Cerrar sesion</span>
          </button>
          <div class="user-info" *ngIf="!sidebarCollapsed">
            <div class="user-avatar">{{ iniciales }}</div>
            <div class="user-meta">
              <span class="user-name">{{ nombreUsuario }}</span>
              <span class="user-role">Cliente</span>
            </div>
          </div>
        </div>
      </aside>

      <!-- Main body -->
      <div class="cliente-body">
        <!-- Navbar -->
        <header class="cliente-navbar">
          <div class="navbar-left">
            <h2 class="navbar-title">{{ paginaActual }}</h2>
          </div>
          <div class="navbar-right">
            <div class="navbar-user">
              <div class="user-chip">
                <div class="chip-avatar">{{ iniciales }}</div>
                <span class="chip-name">{{ nombreUsuario }}</span>
              </div>
            </div>
          </div>
        </header>

        <!-- Page content -->
        <main class="cliente-content">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- ── Chat FAB flotante ── -->
      <div class="chat-fab-container" [class.chat-open]="chatAbierto">
        <!-- Panel del chat -->
        <div class="chat-panel" *ngIf="chatAbierto">
          <div class="chat-panel-header">
            <div class="chat-panel-title">
              <div class="agent-avatar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <div>
                <span class="agent-name">Asistente CRE</span>
                <span class="agent-status">
                  <span class="status-dot"></span> En linea
                </span>
              </div>
            </div>
            <button class="chat-close-btn" (click)="toggleChat()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="chat-panel-body">
            <app-chat-agente></app-chat-agente>
          </div>
        </div>

        <!-- Boton FAB -->
        <button class="chat-fab" (click)="toggleChat()" [class.fab-active]="chatAbierto" title="Asistente virtual">
          <span class="fab-icon-open" *ngIf="!chatAbierto" [innerHTML]="iconChat"></span>
          <span class="fab-icon-close" *ngIf="chatAbierto" [innerHTML]="iconClose"></span>
          <span class="fab-badge" *ngIf="mensajesNuevos > 0 && !chatAbierto">{{ mensajesNuevos }}</span>
        </button>
      </div>

    </div>
  `,
  styles: [`
    /* ── Shell ─────────────────────────────────── */
    .cliente-shell {
      display: flex;
      height: 100vh;
      background: var(--bg-dark);
      overflow: hidden;
      position: relative;
    }

    /* ── Sidebar ────────────────────────────────── */
    .cliente-sidebar {
      width: 240px;
      min-width: 240px;
      background: var(--bg-panel);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      transition: width 0.25s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
      z-index: 10;

      &.collapsed {
        width: 64px;
        min-width: 64px;
      }
    }

    .sidebar-logo {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px 16px;
      border-bottom: 1px solid var(--border);
    }

    .logo-mark {
      flex-shrink: 0;
    }

    .logo-text {
      font-size: 13px;
      font-weight: 700;
      color: var(--primary-100);
      letter-spacing: 0.3px;
      white-space: nowrap;
      flex: 1;
    }

    .sidebar-toggle {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 4px;
      border-radius: 6px;
      flex-shrink: 0;
      transition: var(--transition);

      &:hover {
        color: var(--primary-100);
        background: rgba(192, 192, 128, 0.08);
      }
    }

    .sidebar-role-badge {
      padding: 10px 16px 6px;
    }

    .role-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 600;
      color: var(--warning);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      background: rgba(254, 204, 27, 0.06);
      border: 1px solid rgba(254, 204, 27, 0.2);
      padding: 4px 10px;
      border-radius: 20px;
      width: fit-content;
    }

    .role-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--warning);
      animation: pulse-yellow 2s infinite;
    }

    @keyframes pulse-yellow {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .sidebar-nav {
      flex: 1;
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      cursor: pointer;
      transition: var(--transition);
      color: var(--text-muted);
      text-decoration: none;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 500;

      &:hover {
        background: rgba(192, 192, 128, 0.06);
        color: var(--primary-100);
      }

      &.active {
        background: rgba(192, 192, 128, 0.1);
        color: var(--primary-100);
        border-left: 2px solid var(--primary-200);
      }
    }

    .nav-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      flex-shrink: 0;

      ::ng-deep svg {
        display: block;
      }
    }

    .nav-label {
      white-space: nowrap;
      overflow: hidden;
    }

    .sidebar-footer {
      padding: 12px 8px;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .logout-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 10px;
      border: none;
      background: rgba(244, 66, 80, 0.05);
      color: var(--danger);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      width: 100%;
      transition: var(--transition);

      &:hover {
        background: rgba(244, 66, 80, 0.12);
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-400), var(--primary-300));
      color: var(--text-primary);
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .user-meta {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .user-name {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .user-role {
      font-size: 10px;
      color: var(--warning);
      font-weight: 500;
    }

    /* ── Body ────────────────────────────────────── */
    .cliente-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Navbar ──────────────────────────────────── */
    .cliente-navbar {
      height: 60px;
      background: var(--bg-panel);
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 28px;
      flex-shrink: 0;
    }

    .navbar-title {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .user-chip {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px 6px 6px;
      background: rgba(192, 192, 128, 0.05);
      border: 1px solid var(--border);
      border-radius: 40px;
    }

    .chip-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-400), var(--primary-300));
      color: var(--text-primary);
      font-size: 11px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .chip-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
    }

    /* ── Content ─────────────────────────────────── */
    .cliente-content {
      flex: 1;
      overflow-y: auto;
      padding: 32px;

      &::-webkit-scrollbar { width: 5px; }
      &::-webkit-scrollbar-track { background: transparent; }
      &::-webkit-scrollbar-thumb { background: var(--border); border-radius: 6px; }
    }

    /* ── Chat FAB ────────────────────────────────── */
    .chat-fab-container {
      position: fixed;
      bottom: 32px;
      right: 32px;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 12px;
    }

    .chat-panel {
      width: 420px;
      height: 580px;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-xl);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: chatSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes chatSlideUp {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .chat-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: linear-gradient(135deg, var(--primary-500), #2a2a0a);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    .chat-panel-title {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .agent-avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: rgba(192, 192, 128, 0.15);
      border: 1px solid rgba(192, 192, 128, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary-100);
      flex-shrink: 0;
    }

    .agent-name {
      display: block;
      font-size: 14px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .agent-status {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: var(--success);
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--success);
      animation: pulse-green 2s infinite;
    }

    @keyframes pulse-green {
      0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(107, 217, 104, 0.4); }
      50% { opacity: 0.8; box-shadow: 0 0 0 4px rgba(107, 217, 104, 0); }
    }

    .chat-close-btn {
      background: rgba(192, 192, 128, 0.06);
      border: 1px solid rgba(192, 192, 128, 0.2);
      color: var(--text-muted);
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      transition: var(--transition);
      display: flex;

      &:hover {
        background: rgba(244, 66, 80, 0.1);
        border-color: rgba(244, 66, 80, 0.3);
        color: var(--danger);
      }
    }

    .chat-panel-body {
      flex: 1;
      overflow: hidden;
      display: flex;
      flex-direction: column;

      ::ng-deep app-chat-agente {
        display: flex;
        flex-direction: column;
        height: 100%;
        overflow: hidden;
      }

      ::ng-deep .chat-agente-page {
        display: flex !important;
        flex-direction: column;
        height: 100%;
        min-height: unset !important;
        padding: 0 !important;
        background: transparent !important;
      }

      ::ng-deep .chat-container {
        height: 100% !important;
        max-height: unset !important;
        max-width: unset !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }

      ::ng-deep .chat-header {
        display: none !important;
      }
    }

    /* ── FAB button ────────────────────────────── */
    .chat-fab {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--primary-400), var(--primary-300));
      border: 2px solid rgba(192, 192, 128, 0.4);
      box-shadow: 0 6px 24px rgba(86, 86, 32, 0.5);
      color: var(--text-primary);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: var(--transition);
      position: relative;
      flex-shrink: 0;

      &:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow: 0 10px 32px rgba(86, 86, 32, 0.65);
      }

      &.fab-active {
        background: linear-gradient(135deg, #4a4a1e, #333300);
        border-color: rgba(192, 192, 128, 0.6);
      }

      ::ng-deep svg { display: block; }
    }

    .fab-icon-open,
    .fab-icon-close {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .fab-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: var(--danger);
      color: white;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--bg-dark);
    }
  `]
})
export class ClienteLayoutComponent implements OnInit, OnDestroy {
  nombreUsuario = '';
  iniciales = '';
  sidebarCollapsed = false;
  chatAbierto = false;
  mensajesNuevos = 0;
  paginaActual = 'Inicio';

  private routerSub: any;

  readonly iconDashboard: SafeHtml;
  readonly iconTramites: SafeHtml;
  readonly iconLogout: SafeHtml;
  readonly iconChat: SafeHtml;
  readonly iconClose: SafeHtml;

  constructor(
    private authService: AuthService,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {
    this.iconDashboard = this.sanitizer.bypassSecurityTrustHtml(
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`
    );
    this.iconTramites = this.sanitizer.bypassSecurityTrustHtml(
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`
    );
    this.iconLogout = this.sanitizer.bypassSecurityTrustHtml(
      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`
    );
    this.iconChat = this.sanitizer.bypassSecurityTrustHtml(
      `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
    );
    this.iconClose = this.sanitizer.bypassSecurityTrustHtml(
      `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
    );
  }

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.nombreUsuario = user.nombre;
      this.iniciales = this.calcularIniciales(user.nombre);
    }
    this.actualizarTitulo(this.router.url);
    this.routerSub = this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.actualizarTitulo(event.urlAfterRedirects);
      }
    });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleChat(): void {
    this.chatAbierto = !this.chatAbierto;
    if (this.chatAbierto) {
      this.mensajesNuevos = 0;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.chatAbierto) {
      this.chatAbierto = false;
    }
  }

  navegar(ruta: string): void {
    this.router.navigate([ruta]);
    this.actualizarTitulo(ruta);
  }

  isRoute(ruta: string): boolean {
    return this.router.url === ruta;
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private calcularIniciales(nombre: string): string {
    if (!nombre) return 'U';
    const partes = nombre.trim().split(' ');
    if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
    return nombre.substring(0, 2).toUpperCase();
  }

  private actualizarTitulo(url: string): void {
    if (url.includes('mis-tramites')) this.paginaActual = 'Mis Tramites';
    else if (url.includes('chat')) this.paginaActual = 'Asistente Virtual';
    else this.paginaActual = 'Inicio';
  }
}
