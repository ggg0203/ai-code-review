# Day 7 — RAG 知识库 + uni-app 移动端

> 日期：2026-06-01  
> 项目：AI Code Review Platform

---

## ✅ 今日完成

### 1. RAG 知识库
- Qdrant 嵌入 1536 维向量
- 通义千问 text-embedding-v2 向量化
- deepseek-v4-pro 回答生成
- API：`POST /rag/add`（添加知识）+ `POST /rag/ask`（智能问答）
- 测试：问"如何防范SQL注入"→ 正确回答参数化查询

### 2. uni-app 移动端（5 页面）
```
apps/mobile/src/pages/
├── index/index.vue          # 登录页（渐变背景）
├── register/index.vue       # 注册页
└── tabs/
    ├── dashboard/index.vue  # 首页（4 统计卡片 + 最近审查）
    ├── reviews/index.vue    # 审查列表
    └── profile/index.vue    # 个人中心（蓝顶头像区）
```
- 底部三 tab 导航
- 未登录自动跳转登录页
- 数据从后端 API 实时加载

### 3. 踩坑记录
| 问题 | 解决 |
|------|------|
| 登录 401 拦截器刷新页面 | 在登录页跳过 401 拦截 |
| Qdrant 维度不匹配（1024→1536） | 删集合重建 |
| `qdrant.search` 不存在 | 改用 `qdrant.query_points` |
| uni-app tabBar 不显示 | tab 页面必须放主包，用 reLaunch 跳转 |

### 4. 项目全貌

```
ai-code-review/
├── server/              # FastAPI（16 个 API 接口）
├── apps/
│   ├── web/            # React 管理后台（暗黑/亮色主题）
│   ├── screen/         # Three.js 3D 大屏
│   └── mobile/         # uni-app 移动端
├── docker/             # PostgreSQL + Redis + Qdrant
└── docs/               # Day1~Day7 文档
```
