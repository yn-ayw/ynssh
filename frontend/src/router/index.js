import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { requiresGuest: true }
  },
  {
    path: '/dashboard',
    redirect: '/terminal-new'
  },
  {
    path: '/terminal',
    redirect: '/terminal-new'
  },
  {
    path: '/terminal-new',
    name: 'TerminalNew',
    component: () => import('@/views/TerminalNew.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/group-management',
    redirect: '/terminal-new'
  },
  {
    path: '/user-management',
    name: 'UserManagement',
    component: () => import('@/views/UserManagement.vue'),
    meta: { requiresAuth: true, requiresAdmin: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 路由守卫
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore()

  // 需要登录的页面
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next('/login')
    return
  }

  // 已登录用户访问登录/注册，直接进入操作页
  if (to.meta.requiresGuest && authStore.isAuthenticated) {
    next('/terminal-new')
    return
  }

  // 管理员页面权限检查
  if (to.meta.requiresAdmin && (!authStore.isAuthenticated || !authStore.user?.is_admin)) {
    next('/terminal-new')
    return
  }

  next()
})

export default router