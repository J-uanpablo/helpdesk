// src/router/index.ts
import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { useAuth } from "../composables/useAuth";

import LoginView from "../views/LoginView.vue";
import HelpdeskPanel from "../views/HelpdeskPanel.vue";
import ClientTicketsView from "../views/ClientTicketsView.vue";
import ClientNewTicketView from "../views/ClientNewTicketView.vue";

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: LoginView,
  },
  {
    path: "/soporte",
    name: "soporte",
    component: HelpdeskPanel,
    meta: { requiresAuth: true }, // panel agente / super admin
  },
  {
    path: "/cliente",
    name: "cliente",
    component: ClientTicketsView,
    meta: { requiresAuth: true },
  },
  {
    path: "/cliente/nuevo",
    name: "cliente-nuevo",
    component: ClientNewTicketView,
    meta: { requiresAuth: true },
  },
  {
    path: "/tickets/:id",
    name: "ClientTicketChat",
    component: () => import("../views/ClientTicketChatView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/cliente/ticket/:id",
    name: "ClientTicketChatCliente",
    component: () => import("../views/ClientTicketChatView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/cliente/nuevo-ticket",
    name: "ClientNewTicket",
    component: () => import("../views/ClientNewTicketView.vue"),
    meta: { requiresAuth: true },
  },

  // 🔹 Vista de administración de AGENTES (solo super-admin)
  {
    path: "/admin/agentes",
    name: "AdminAgents",
    component: () => import("../views/AdminAgentsView.vue"),
    meta: {
      requiresAuth: true,
      superAdminOnly: true,
    },
  },

  // 🔹 Vista de administración de ÁREAS (solo super-admin)
  {
    path: "/admin/areas",
    name: "AdminAreas",
    component: () => import("../views/AdminSupportAreasView.vue"),
    meta: {
      requiresAuth: true,
      superAdminOnly: true,
    },
  },
  {
    path: "/admin/clientes",
    name: "AdminClients",
    component: () => import("../views/AdminClientsView.vue"),
    meta: {
      requiresAuth: true,
      superAdminOnly: true,
    },
  },

  {
    path: "/",
    redirect: "/login",
  },
  {
    path: "/forgot-password",
    name: "forgot-password",
    component: () => import("../views/ForgotPasswordView.vue"),
  },
  {
    path: "/reset-password",
    name: "reset-password",
    component: () => import("../views/ResetPasswordView.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

let authInitialized = false;

// pequeña función helper para no repetirnos
function isStaff(roles: string[] | undefined | null): boolean {
  const list = roles || [];
  return (
    list.includes("admin") ||
    list.includes("support") ||
    list.includes("super-admin")
  );
}

router.beforeEach((to, from, next) => {
  const { token, user, initAuth } = useAuth();

  if (!authInitialized) {
    initAuth();
    authInitialized = true;
  }

  const jwt = (token.value ?? "").trim();
  const roles = user.value?.roles || [];

  // 🔐 Rutas que requieren autenticación
  if (to.meta.requiresAuth && !jwt) {
    return next({ name: "login" });
  }

  // 🔐 Si ya estoy logueado y voy a /login, redirijo según rol
  if (to.name === "login" && jwt && user.value) {
    if (isStaff(roles)) {
      return next({ name: "soporte" });
    } else {
      return next({ name: "cliente" });
    }
  }

  // 🔐 proteger /soporte para que solo entren staff (admin, support, super-admin)
  if (to.name === "soporte" && jwt && user.value && !isStaff(roles)) {
    return next({ name: "cliente" });
  }

  // 🔐 proteger /admin/* solo para super-admin
  if (to.meta.superAdminOnly && jwt && user.value) {
    if (!roles.includes("super-admin")) {
      // si es staff normal, lo mando al panel de soporte
      if (isStaff(roles)) {
        return next({ name: "soporte" });
      }
      // si no es staff, al panel de cliente
      return next({ name: "cliente" });
    }
  }

  next();
});

export default router;
