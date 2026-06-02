# -*- coding: utf-8 -*-
"""
模拟数据种子脚本 — 创建演示用的项目和审查记录
运行方式：cd server && venv\Scripts\python.exe seed.py
"""
import asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy import select

from app.core.config import settings
from app.core.database import async_session
from app.models.user import User, UserRole
from app.models.project import Project, ProjectStatus
from app.models.review import Review, ReviewStatus


# 预生成的 AI 审查结果样例（Markdown 格式）
SAMPLE_REVIEWS = [
    # 1: SQL 注入漏洞
    """## 🔍 代码概览
这是一个用户登录验证函数，通过数据库查询确认用户名密码。

## 🔴 严重问题
> **[高] SQL 注入风险** — 第 3 行
> 使用字符串拼接构造 SQL 查询，攻击者可通过精心构造的密码绕过验证。
> 建议：改用参数化查询，或使用 ORM 框架。

## 💡 优化建议
使用 bcrypt 对密码进行哈希存储，当前明文比较存在严重安全隐患。

## 📊 综合评分
| 维度 | 评分 | 说明 |
|------|------|------|
| **安全性** | 1/10 | SQL 注入 + 明文密码 |
| **性能** | 6/10 | 单条查询，无索引问题 |
| **可读性** | 7/10 | 逻辑清晰 |
| **可维护性** | 5/10 | 硬编码凭据 |
| **综合** | **4/10** | 存在高危安全漏洞，不建议上线 |""",

    # 2: N+1 查询问题
    """## 🔍 代码概览
一个获取用户列表及其订单的函数，使用了嵌套循环查询。

## 🟡 一般问题
> **[中] N+1 查询性能问题** — 第 8-10 行
> 在循环中逐条查询订单，当用户量达到 1000 时会产生 1001 次数据库查询。
> 建议：使用 JOIN 或 `selectinload` 预加载关联数据。

## 💡 优化建议
改为单次联表查询可将查询次数从 N+1 降为 1，响应时间预计降低 90%。

## 📊 综合评分
| 维度 | 评分 | 说明 |
|------|------|------|
| **安全性** | 8/10 | 无明显安全问题 |
| **性能** | 3/10 | N+1 查询，大数据量下不可用 |
| **可读性** | 6/10 | 嵌套循环可读性一般 |
| **可维护性** | 6/10 | 可优化空间大 |
| **综合** | **5/10** | 需要优化查询逻辑 |""",

    # 3: 未处理异常
    """## 🔍 代码概览
一个文件上传处理函数，接收文件并保存到本地存储。

## 🔴 严重问题
> **[高] 未处理的异常** — 第 15 行
> `open()` 操作未使用 try/except 包裹，磁盘满或权限不足时会导致服务器 500 错误。
> 同时 `shutil.copy` 未验证文件类型，存在路径遍历攻击风险。

## 🟡 一般问题
> **[低] 文件名未消毒** — 建议使用 UUID 重命名用户上传文件，避免文件名冲突和安全问题。

## 📊 综合评分
| 维度 | 评分 | 说明 |
|------|------|------|
| **安全性** | 4/10 | 路径遍历 + 未验证文件类型 |
| **性能** | 7/10 | 同步操作，小文件可接受 |
| **可读性** | 8/10 | 代码简洁 |
| **可维护性** | 6/10 | 缺少日志和错误处理 |
| **综合** | **6/10** | 需加强异常处理和文件校验 |""",

    # 4: 内存泄漏
    """## 🔍 代码概览
一个缓存管理类，使用字典存储计算结果。

## 🟡 一般问题
> **[中] 潜在内存泄漏** — 第 7 行
> `_cache` 字典无限增长，没有过期机制和大小限制。长时间运行会耗尽内存。
> 建议：使用 LRU 缓存或 Redis 替代，设置 TTL 和最大容量。

## 💡 优化建议
改用 `functools.lru_cache` 或 Redis，添加定时清理机制。预计内存占用可降低 80%。

## 📊 综合评分
| 维度 | 评分 | 说明 |
|------|------|------|
| **安全性** | 9/10 | 无外部暴露 |
| **性能** | 7/10 | 初始快速，长期退化 |
| **可读性** | 8/10 | 类结构清晰 |
| **可维护性** | 5/10 | 无日志/监控/限制机制 |
| **综合** | **7/10** | 短期可用，需添加容量控制 |""",

    # 5: XSS 漏洞
    """## 🔍 代码概览
一个用户评论展示组件，直接渲染用户输入的 HTML。

## 🔴 严重问题
> **[高] XSS 跨站脚本攻击** — 第 12 行
> 使用 `dangerouslySetInnerHTML` 直接渲染用户输入，攻击者可注入 script 标签窃取 cookie。
> 建议：使用 DOMPurify 过滤 HTML，或使用 React 的默认转义机制。

## 📊 综合评分
| 维度 | 评分 | 说明 |
|------|------|------|
| **安全性** | 2/10 | XSS 风险极高 |
| **性能** | 8/10 | 无性能问题 |
| **可读性** | 7/10 | 组件简洁 |
| **可维护性** | 6/10 | 需增加输入过滤层 |
| **综合** | **5/10** | 高危安全漏洞 |""",

    # 6: 竞态条件
    """## 🔍 代码概览
一个库存扣减函数，先查询库存再更新。

## 🔴 严重问题
> **[高] 竞态条件** — 第 8-12 行
> 先 SELECT 再 UPDATE 是非原子操作。并发请求可能导致超卖。
> 建议：使用 `UPDATE ... WHERE stock >= ?` 原子操作，或加行级锁。

## 📊 综合评分
| 维度 | 评分 | 说明 |
|------|------|------|
| **安全性** | 7/10 | 业务逻辑有漏洞但非安全漏洞 |
| **性能** | 6/10 | 两次查询，可优化为一次 |
| **可读性** | 8/10 | 逻辑直观 |
| **可维护性** | 6/10 | 需改为原子操作 |
| **综合** | **5/10** | 并发场景下不可靠 |""",

    # 7: 密文硬编码
    """## 🔍 代码概览
一个第三方 API 调用模块，包含 API 密钥。

## 🔴 严重问题
> **[高] 密钥硬编码** — 第 3 行
> API_KEY 直接写在代码中并提交到 Git 仓库，任何人可查看、滥用该密钥。
> 建议：使用环境变量或密钥管理服务（如阿里云 KMS）存储。

## 💡 优化建议
立即轮换已泄露的密钥，使用 `.env` 文件管理敏感配置，确保 `.env` 在 `.gitignore` 中。

## 📊 综合评分
| 维度 | 评分 | 说明 |
|------|------|------|
| **安全性** | 1/10 | 密钥泄露 |
| **性能** | 7/10 | 正常 |
| **可读性** | 8/10 | 代码清晰 |
| **可维护性** | 4/10 | 密钥管理不规范 |
| **综合** | **4/10** | 急需安全整改 |""",
]

SAMPLE_CODE = [
    # 1
    """def login(username, password):
    query = "SELECT * FROM users WHERE username='" + username + "' AND password='" + password + "'"
    cursor.execute(query)
    return cursor.fetchone()""",
    # 2
    """def get_users_with_orders():
    users = User.query.all()
    result = []
    for user in users:
        orders = Order.query.filter_by(user_id=user.id).all()
        result.append({'user': user, 'orders': orders})
    return result""",
    # 3
    """def upload_file(file):
    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, 'wb') as f:
        shutil.copyfileobj(file.file, f)
    return path""",
    # 4
    """class SimpleCache:
    def __init__(self):
        self._cache = {}
    def get(self, key):
        return self._cache.get(key)
    def set(self, key, value):
        self._cache[key] = value""",
    # 5
    """function Comment({ text }) {
  return <div dangerouslySetInnerHTML={{ __html: text }} />
}""",
    # 6
    """def deduct_stock(product_id, quantity):
    stock = db.query("SELECT stock FROM products WHERE id=?", product_id)
    if stock >= quantity:
        db.execute("UPDATE products SET stock=stock-? WHERE id=?", quantity, product_id)
        return True
    return False""",
    # 7
    """API_KEY = "sk-abc123def456ghi789jkl"
def call_external_api(data):
    headers = {"Authorization": f"Bearer {API_KEY}"}
    return requests.post("https://api.example.com/v1/process", json=data, headers=headers)""",
]

PR_TITLES = [
    "fix: 修复登录接口 SQL 注入漏洞",
    "perf: 优化用户订单查询 解决 N+1 问题",
    "fix: 文件上传路径遍历安全加固",
    "perf: 添加缓存淘汰策略 防止内存泄漏",
    "fix: 评论组件 XSS 防护",
    "fix: 库存扣减竞态条件修复",
    "security: 移除硬编码 API 密钥",
]

BRANCHES = [
    "fix/sql-injection", "perf/n-plus-one", "fix/path-traversal",
    "perf/cache-eviction", "fix/xss-protection", "fix/race-condition",
    "security/remove-hardcoded-key",
]


async def seed():
    async with async_session() as db:
        # 查找或创建测试项目
        result = await db.execute(
            select(Project).where(Project.name == "AI Code Review Platform")
        )
        project = result.scalar_one_or_none()
        if not project:
            # 获取 admin 用户
            user_result = await db.execute(
                select(User).where(User.email == "admin@test.com")
            )
            admin = user_result.scalar_one_or_none()
            if not admin:
                user_result = await db.execute(select(User).limit(1))
                admin = user_result.scalar_one_or_none()
            if not admin:
                print("❌ 无用户，请先注册")
                return

            project = Project(
                name="AI Code Review Platform",
                description="AI 智能代码审查与项目管理平台",
                language="Python",
                owner_id=admin.id,
                status=ProjectStatus.ACTIVE,
            )
            db.add(project)
            await db.commit()
            await db.refresh(project)
            print(f"✅ 创建项目: {project.name}")

        # 获取 reviewer 用户（取第一个 admin）
        user_result = await db.execute(
            select(User).where(User.role == UserRole.ADMIN).limit(1)
        )
        reviewer = user_result.scalar()

        if not reviewer:
            print("❌ 无用户")
            return

        count = 0
        for i in range(7):
            # 检查是否已存在
            exist = await db.execute(
                select(Review).where(Review.pr_title == PR_TITLES[i])
            )
            if exist.scalar_one_or_none():
                continue

            review = Review(
                project_id=project.id,
                reviewer_id=reviewer.id,
                pr_title=PR_TITLES[i],
                pr_number=42 + i,
                branch=BRANCHES[i],
                files_changed=(i % 3) + 1,
                code_snippet=SAMPLE_CODE[i],
                ai_result=SAMPLE_REVIEWS[i],
                ai_score=[40, 50, 60, 70, 50, 50, 40][i],
                status=ReviewStatus.COMPLETED,
            )
            db.add(review)
            count += 1
        await db.commit()
        print(f"✅ 创建 {count} 条模拟审查记录（共 7 条）")

    print("🎉 模拟数据生成完成！")


if __name__ == "__main__":
    asyncio.run(seed())
