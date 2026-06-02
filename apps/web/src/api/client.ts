/**
 * axios 封装 — 统一管理后端请求
 */
import axios from 'axios'

// 创建 axios 实例，baseURL 指向 Vite 代理
const client = axios.create({
  baseURL: '/api',          // 所有请求以 /api 开头 → vite 代理到后端
  timeout: 10000,           // 10秒超时
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截器：自动附加 Token
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：统一错误处理
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // 登录失败 401 是正常业务，不跳转
    const isLoginPage = window.location.pathname === '/login'
    if (error.response?.status === 401 && !isLoginPage) {
      localStorage.removeItem('access_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
