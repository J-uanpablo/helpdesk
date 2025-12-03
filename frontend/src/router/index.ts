// src/router/index.ts
import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";
import { useAuth } from "../composables/useAuth";

import LoginView from "../views/LoginView.vue";
import HelpdeskPanel from "../views/HelpdeskPanel.vue";
import ClientTicketsView from "../views/ClientTicketsView.vue";

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
    meta: { requiresAuth: true },
  },
  {
    path: "/cliente",
    name: "cliente",
    component: ClientTicketsView,
    meta: { requiresAuth: true },
  },
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
