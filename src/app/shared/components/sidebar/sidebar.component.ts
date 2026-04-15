import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface SidebarItem {
  label: string;
  icon: string; // SVG path string
  route: string;
  submenu?: SidebarItem[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <!-- Logo/Brand -->
      <div class="sidebar-brand">
        <div class="brand-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
            <path d="M17.5 14v6M14.5 17h6"/>
          </svg>
        </div>
        <span class="brand-name">WorkflowMgr</span>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <div *ngFor="let item of items; trackBy: trackByRoute" class="sidebar-item">
          <a
            class="sidebar-link"
            [routerLink]="item.route"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.route.split('/').length <= 2 }"
          >
            <span class="link-icon" [innerHTML]="item.icon"></span>
            <span class="link-label">{{ item.label }}</span>
            <span class="link-indicator"></span>
          </a>
        </div>
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <div class="footer-version">v1.0 — Parcial 1</div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 260px;
      background: var(--bg-panel);
      border-right: 1px solid var(--border);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      flex-shrink: 0;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px 20px 20px;
      border-bottom: 1px solid var(--border);
    }

    .brand-icon {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, var(--primary-400), var(--primary-300));
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-primary);
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(86, 86, 32, 0.4);
    }

    .brand-name {
      font-size: 14px;
      font-weight: 700;
      color: var(--primary-100);
      letter-spacing: 0.3px;
    }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 2px;

      &::-webkit-scrollbar {
        width: 4px;
      }
      &::-webkit-scrollbar-thumb {
        background: var(--border);
        border-radius: 4px;
      }
    }

    .sidebar-item {
      width: 100%;
    }

    .sidebar-link {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      border-radius: 10px;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.2s ease;
      text-align: left;
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      letter-spacing: 0.1px;
      position: relative;
      border-left: 3px solid transparent;

      &:hover {
        background: rgba(192, 192, 128, 0.07);
        color: var(--primary-100);
        border-left-color: rgba(192, 192, 128, 0.3);
      }

      &.active {
        background: rgba(192, 192, 128, 0.12);
        color: var(--primary-100);
        border-left-color: var(--primary-200);
        font-weight: 600;

        .link-indicator {
          opacity: 1;
        }
      }
    }

    .link-icon {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      ::ng-deep svg {
        width: 18px;
        height: 18px;
      }
    }

    .link-label {
      flex: 1;
    }

    .link-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary-200);
      opacity: 0;
      transition: opacity 0.2s ease;
      flex-shrink: 0;
    }

    .sidebar-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border);

      .footer-version {
        font-size: 11px;
        color: var(--text-muted);
        opacity: 0.6;
        text-align: center;
      }
    }
  `]
})
export class SidebarComponent {
  @Input() items: SidebarItem[] = [];

  trackByRoute(index: number, item: SidebarItem): string {
    return item.route;
  }
}
