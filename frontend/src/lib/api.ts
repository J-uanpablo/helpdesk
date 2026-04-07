import router from '../router';
import { useAuth } from '../composables/useAuth';

let isRedirecting = false;

export async function apiFetch(url: string, options: RequestInit = {}) {
  const { token, clearAuth } = useAuth();

  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;

  if (token.value) {
    headers.set('Authorization', `Bearer ${token.value}`);
  }

  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearAuth();

    if (!isRedirecting) {
      isRedirecting = true;

      try {
        const currentRoute = router.currentRoute.value;

        if (currentRoute.name !== 'login') {
          await router.replace({
            name: 'login',
            query: { expired: '1' },
          });
        }
      } finally {
        isRedirecting = false;
      }
    }

    const err = new Error('SESSION_EXPIRED');
    throw err;
  }

  return response;
}
