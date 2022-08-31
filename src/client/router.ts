import { createRouter, createWebHistory } from 'vue-router';
import Home from './components/Home.vue';
import Login from './components/Login.vue';
import Room from './components/Room.vue';

export const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/rooms/:id',
    name: 'Rooms',
    component: Room,
  },
  {
    path: '/login',
    name: 'Login',
    component: Login,
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
