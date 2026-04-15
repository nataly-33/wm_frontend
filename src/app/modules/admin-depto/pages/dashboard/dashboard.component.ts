import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { NavbarComponent } from '../../../../shared/components/navbar/navbar.component';
import { SidebarComponent, SidebarItem } from '../../../../shared/components/sidebar/sidebar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NavbarComponent, SidebarComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  userName: string = '';
  sidebarItems: SidebarItem[] = [
    { label: 'Dashboard', icon: '▸', route: '/admin-depto' },
    { label: 'Usuarios de Depto', icon: '▸', route: '/admin-depto/usuarios' },
    { label: 'Mis Políticas', icon: '▸', route: '/admin-depto/politicas' },
    { label: 'Monitor', icon: '▸', route: '/admin-depto/monitor' }
  ];

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName = user.nombre;
    }
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
