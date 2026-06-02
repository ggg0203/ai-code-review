// 共享类型定义 — 前后端一致的业务模型

// ===== 用户 =====
export type UserRole = "ADMIN" | "REVIEWER" | "DEVELOPER"

export interface User {
  id: number
  username: string
  email: string
  role: UserRole
  is_active: boolean
  avatar_url?: string | null
  created_at: string
  updated_at?: string
}

// ===== 项目 =====
export type ProjectStatus = "ACTIVE" | "ARCHIVED" | "DELETED"

export interface Project {
  id: number
  name: string
  description: string | null
  repo_url: string | null
  language: string | null
  status: ProjectStatus
  owner_id: number
  created_at: string
  updated_at: string
}

// ===== 审查记录 =====
export type ReviewStatus = "PENDING" | "REVIEWING" | "COMPLETED" | "APPROVED" | "REJECTED"

export interface Review {
  id: number
  project_id: number
  pr_title: string
  pr_number: number | null
  branch: string | null
  files_changed: number | null
  code_snippet: string | null
  ai_result: string | null
  ai_score: number | null
  status: ReviewStatus
  created_at: string
  updated_at: string
}

// ===== 统计 =====
export interface PlatformStats {
  total_projects: number
  active_projects: number
  total_reviews: number
  completed_reviews: number
  pending_reviews: number
  avg_score: number
  languages: string[]
}

// ===== 认证 =====
export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

// ===== 状态标签映射 =====
export const REVIEW_STATUS_MAP: Record<string, { color: string; label: string }> = {
  PENDING:   { color: "default", label: "待审查" },
  REVIEWING: { color: "processing", label: "分析中" },
  COMPLETED: { color: "success", label: "已完成" },
  APPROVED:  { color: "green", label: "已通过" },
  REJECTED:  { color: "error", label: "已拒绝" },
}

export const PROJECT_STATUS_MAP: Record<string, { color: string; label: string }> = {
  ACTIVE:   { color: "green", label: "活跃" },
  ARCHIVED: { color: "orange", label: "已归档" },
  DELETED:  { color: "red", label: "已删除" },
}
