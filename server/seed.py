# -*- coding: utf-8 -*-
"""
真实 AI 审查种子脚本 — 调用百炼 deepseek-v4-pro 生成 5 条审查记录
"""
import asyncio, sys, json, time
from datetime import datetime, timezone

sys.path.insert(0, ".")
asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.core.config import settings
from app.core.database import async_session
from app.models.user import User, UserRole
from app.models.project import Project, ProjectStatus
from app.models.review import Review, ReviewStatus
from sqlalchemy import select
from openai import AsyncOpenAI

client = AsyncOpenAI(
    api_key=settings.DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)
MODEL = "deepseek-v4-pro"

PRS = [
    ("fix: 修复登录接口 SQL 注入漏洞", "Python",
     '''def login(username, password):
    conn = get_db_connection()
    query = "SELECT * FROM users WHERE username='" + username + "' AND password='" + password + "'"
    return conn.execute(query).fetchone()'''),
    ("perf: 解决用户订单 N+1 查询问题", "Python",
     '''def get_users_with_orders():
    users = User.query.all()
    result = []
    for user in users:
        orders = Order.query.filter_by(user_id=user.id).all()
        result.append({"user": user, "orders": orders})
    return result'''),
    ("fix: 文件上传路径遍历安全加固", "Python",
     '''def upload_file(file):
    path = os.path.join(UPLOAD_DIR, file.filename)
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return path'''),
    ("security: 移除硬编码 API 密钥", "JavaScript",
     '''const API_KEY = "sk-abc123def456ghi789jkl";
function callExternalAPI(data) {
    return fetch("https://api.example.com/v1/process", {
        method: "POST",
        headers: { Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify(data),
    });
}'''),
    ("fix: 评论组件 XSS 防护", "JavaScript",
     '''function Comment({ text }) {
  return <div dangerouslySetInnerHTML={{ __html: text }} />;
}'''),
]

REVIEW_PROMPT = """你是一个资深代码审查专家。请审查以下代码，从安全性、性能、可读性、可维护性四个维度分析。

输出格式（Markdown）：

## 🔍 代码概览
简要概括代码功能。

## 发现的问题
对每个问题：
> **[严重/高/中/低] 问题名称** — 位置
> 详细说明
> 修复建议

## 📊 综合评分
| 维度 | 评分 | 说明 |
|------|------|------|
| **安全性** | X/10 | ... |
| **性能** | X/10 | ... |
| **可读性** | X/10 | ... |
| **可维护性** | X/10 | ... |
| **综合** | **X/10** | ... |

注意：综合评分必须为数字，格式为 **X/10**。"""


async def seed():
    # 获取 reviewer
    async with async_session() as db:
        r = await db.execute(select(User).where(User.role == UserRole.ADMIN).limit(1))
        reviewer = r.scalar()
        if not reviewer:
            r = await db.execute(select(User).limit(1))
            reviewer = r.scalar()

        # 获取项目
        r = await db.execute(select(Project).where(Project.name == "AI Code Review Platform"))
        project = r.scalar_one_or_none()
        if not project:
            project = Project(name="AI Code Review Platform", description="AI 智能代码审查平台",
                              language="Python", owner_id=reviewer.id)
            db.add(project)
            await db.commit()
            await db.refresh(project)

    for title, lang, code in PRS:
        print(f"审查: {title} ...", end=" ", flush=True)
        try:
            resp = await client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": REVIEW_PROMPT},
                    {"role": "user", "content": f"请审查以下{lang}代码：\n\n```{lang.lower()}\n{code}\n```"},
                ],
                temperature=0.3,
                max_tokens=1500,
            )
            ai_result = resp.choices[0].message.content or ""
            # 提取评分
            import re
            m = re.search(r'\*\*综合\*\*.*?\*\*(\d+)/10\*\*', ai_result)
            score = int(m.group(1)) * 10 if m else None

            async with async_session() as db:
                review = Review(
                    project_id=project.id,
                    reviewer_id=reviewer.id,
                    pr_title=title,
                    branch="main",
                    code_snippet=code,
                    ai_result=ai_result,
                    ai_score=score,
                    status=ReviewStatus.COMPLETED,
                )
                db.add(review)
                await db.commit()

            print(f"OK (评分:{score})")
            time.sleep(0.5)  # 避免 API 限流
        except Exception as e:
            print(f"FAIL: {e}")

    print("🎉 真实 AI 审查数据生成完成")

asyncio.run(seed())
