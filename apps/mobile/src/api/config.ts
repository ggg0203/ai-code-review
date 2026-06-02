// 移动端 API 统一配置
// 所有页面引用此文件，避免硬编码 API 地址

export const API_BASE = 'http://localhost:8000'

// 获取存储的 token
export function getToken(): string {
  return uni.getStorageSync('access_token') || ''
}

// 带 token 的请求头
export function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`,
  }
}

// 通用 GET 请求
export async function apiGet<T = any>(url: string): Promise<T> {
  const resp = await uni.request({
    url: API_BASE + url,
    method: 'GET',
    header: authHeaders(),
  })
  return resp.data as T
}

// 通用 POST 请求
export async function apiPost<T = any>(url: string, data?: any): Promise<T> {
  const resp = await uni.request({
    url: API_BASE + url,
    method: 'POST',
    header: authHeaders(),
    data,
  })
  return resp.data as T
}
