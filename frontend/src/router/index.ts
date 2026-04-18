// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuth } from '../composables/useAuth';

import LoginView from '../views/LoginView.vue';
import ClientLayout from '../layouts/ClientLayout.vue';
import HelpdeskLayout from '../layouts/HelpdeskLayout.vue';

import ClientTicketsView from '../views/ClientTicketsView.vue';
import ClientNewTicketView from '../views/ClientNewTicketView.vue';
import HelpdeskPanel from '../views/HelpdeskPanel.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { hideHeader: true },
  },

  /* ===========================
     CLIENTE (con layout)
  =========================== */
  {
    path: '/cliente',
    component: ClientLayout,
    meta: { requiresAuth: true, title: 'Mis tickets de ayuda' },
    children: [
      { path: '', name: 'cliente', component: ClientTicketsView },
      { path: 'nuevo-ticket', name: 'cliente-nuevo', component: ClientNewTicketView },
      {
        path: 'ticket/:id',
        name: 'cliente-chat',
        component: () => import('../views/ClientTicketChatView.vue'),
        meta: { title: 'Ticket – Chat' },
      },
      {
        path: 'nuevo',
        redirect: { name: 'cliente-nuevo' },
      },
    ],
  },

  /* ===========================
     SOPORTE (con layout)
  =========================== */
  {
    path: '/soporte',
    component: HelpdeskLayout,
    meta: { requiresAuth: true, title: 'Mesa de ayuda – Chat' },
    children: [
      { path: '', name: 'soporte', component: HelpdeskPanel },

      // ✅ Dashboard operativo para admin y super-admin
      {
        path: 'operations-dashboard',
        name: 'AdminOperationsDashboard',
        component: () => import('../views/AdminOperationsDashboardView.vue'),
        meta: {
          requiresAuth: true,
          adminOnly: true,
          title: 'Dashboard Operativo',
        },
      },
    ],
  },

  /* ===========================
     ADMIN (con layout)
  =========================== */
  {
    path: '/admin',
    component: HelpdeskLayout,
    meta: { requiresAuth: true, superAdminOnly: true, title: 'Administración' },
    children: [
      {
        path: 'agentes',
        name: 'AdminAgents',
        component: () => import('../views/AdminAgentsView.vue'),
        meta: { superAdminOnly: true, title: 'Admin. agentes' },
      },
      {
        path: 'areas',
        name: 'AdminAreas',
        component: () => import('../views/AdminSupportAreasView.vue'),
        meta: { superAdminOnly: true, title: 'Admin. áreas' },
      },
      {
        path: 'clientes',
        name: 'AdminClients',
        component: () => import('../views/AdminClientsView.vue'),
        meta: { superAdminOnly: true, title: 'Admin. clientes' },
      },
    ],
  },

  /* ===========================
     Otros
  =========================== */
  { path: '/', redirect: '/login' },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('../views/ForgotPasswordView.vue'),
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('../views/ResetPasswordView.vue'),
  },

  // compatibilidad ruta vieja si existía
  { path: '/tickets/:id', redirect: to => `/cliente/ticket/${to.params.id}` },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

let authInitialized = false;

function isStaff(roles: string[] | undefined | null): boolean {
  const list = roles || [];
  return list.includes('admin') || list.includes('support') || list.includes('super-admin');
}

function isAdminLevel(roles: string[] | undefined | null): boolean {
  const list = roles || [];
  return list.includes('admin') || list.includes('super-admin');
}

router.beforeEach((to, from, next) => {
  const { token, user, initAuth } = useAuth();

  if (!authInitialized) {
    initAuth();
    authInitialized = true;
  }

  const jwt = (token.value ?? '').trim();
  const roles = user.value?.roles || [];

  // 🔐 requiere auth
  if (to.meta.requiresAuth && !jwt) {
    return next({ name: 'login' });
  }

  // 🔐 si estoy logueado y voy a /login
  if (to.name === 'login' && jwt && user.value) {
    return next({ name: isStaff(roles) ? 'soporte' : 'cliente' });
  }

  // 🔐 /soporte solo staff
  if (to.matched.some(r => r.path === '/soporte') && jwt && user.value && !isStaff(roles)) {
    return next({ name: 'cliente' });
  }

  // 🔐 rutas con adminOnly => admin o super-admin
  if (to.matched.some(r => r.meta?.adminOnly) && jwt && user.value) {
    if (!isAdminLevel(roles)) {
      return next({ name: 'soporte' });
    }
  }

  // 🔐 /admin solo super-admin
  if (to.matched.some(r => r.path === '/admin') && jwt && user.value) {
    if (!roles.includes('super-admin')) {
      return next({ name: isStaff(roles) ? 'soporte' : 'cliente' });
    }
  }

  next();
});

export default router;
