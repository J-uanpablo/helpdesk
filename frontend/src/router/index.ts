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

  // Panel de soporte (agentes)
  {
    path: "/soporte",
    name: "soporte",
    component: HelpdeskPanel,
    meta: { requiresAuth: true },
  },

  // Bandeja de tickets del cliente
  {
    path: "/cliente",
    name: "cliente",
    component: ClientTicketsView,
    meta: { requiresAuth: true },
  },

  // Crear nuevo ticket (cliente)
  {
    path: "/cliente/nuevo",
    name: "cliente-nuevo",
    component: ClientNewTicketView,
    meta: { requiresAuth: true },
  },

  // Chat del ticket (cliente)
  {
    path: "/cliente/tickets/:id",
    name: "ClientTicketChat",
    component: () => import("../views/ClientTicketChatView.vue"),
    meta: { requiresAuth: true },
  },

  // Admin: gestión de agentes
  {
    path: "/admin/agentes",
    name: "AdminAgents",
    component: () => import("../views/AdminAgentsView.vue"),
    meta: { requiresAuth: true },
  },

  // Redirección raíz
  {
    path: "/",
    redirect: "/login",
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

let authInitialized = false;

router.beforeEach((to, from, next) => {
  const { token, user, initAuth } = useAuth();

  if (!authInitialized) {
    initAuth();
    authInitialized = true;
  }

  if (to.meta.requiresAuth && !token.value) {
    return next({ name: "login" });
  }

  if (to.name === "login" && token.value && user.value) {
    const roles = user.value.roles || [];

    if (roles.includes("admin") || roles.includes("support")) {
      return next({ name: "soporte" });
    } else {
      return next({ name: "cliente" });
    }
  }

  next();
});

export default router;
