// src/composables/useAuth.ts
import { ref } from "vue";

interface AuthUser {
  id: number;
  name: string;
  email?: string;
  roles?: string[];
  // añade lo que devuelva tu backend
}

const token = ref<string | null>(null);
const user = ref<AuthUser | null>(null);
const isAuthLoading = ref(false);
const authError = ref<string | null>(null);

// Cargar token/usuario desde localStorage cuando arranca la app
function initAuth() {
  if (typeof window === "undefined") return;

  const storedToken = localStorage.getItem("hd_token");
  const storedUser = localStorage.getItem("hd_user");

  if (storedToken) {
    token.value = storedToken;
  }

  if (storedUser) {
    try {
      user.value = JSON.parse(storedUser);
    } catch {
      user.value = null;
    }
  }
}

// Hacer login contra el backend
async function login(email: string, password: string) {
  authError.value = null;
  isAuthLoading.value = true;

  try {
    const res = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 400) {
        throw new Error("Credenciales inválidas");
      }
      throw new Error(`Error ${res.status} al iniciar sesión`);
    }

    const data = await res.json();
    // Ajusta los nombres según tu backend (access_token, token, user, etc.)
    const accessToken = data.access_token || data.token;
    const userData = data.user || null;

    if (!accessToken) {
      throw new Error("La respuesta no contiene token");
    }

    token.value = accessToken;
    user.value = userData;

    if (typeof window !== "undefined") {
      localStorage.setItem("hd_token", accessToken);
      localStorage.setItem("hd_user", JSON.stringify(userData || {}));
    }
  } catch (err: any) {
    console.error(err);
    authError.value = err.message || "No se pudo iniciar sesión.";
    throw err;
  } finally {
    isAuthLoading.value = false;
  }
}

// Cerrar sesión
function logout() {
  token.value = null;
  user.value = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("hd_token");
    localStorage.removeItem("hd_user");
  }
}

export function useAuth() {
  return {
    token,
    user,
    isAuthLoading,
    authError,
    initAuth,
    login,
    logout,
  };
}
