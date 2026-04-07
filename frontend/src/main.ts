// frontend/src/main.ts
import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import './assets/main.css';
import { useTheme } from './composables/useTheme';

const app = createApp(App);
const { initTheme } = useTheme();
initTheme();
app.use(router);

app.mount('#app');
