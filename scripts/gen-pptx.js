/**
 * AI Code Review Platform — 答辩 PPT 生成脚本
 * 生成 11 页专业演示文稿
 */
const pptxgen = require("pptxgenjs");
const path = require("path");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "AI Code Review Team";
pres.title = "AI 智能代码审查与项目管理平台";

// ---- 配色方案: Ocean Gradient ----
const C = {
  darkBg:    "0A1628",  // 深色背景（封面/章节）
  primary:   "065A82",  // 主色（深蓝）
  secondary: "1C7293",  // 辅色（青蓝）
  accent:    "14B8A6",  // 强调（青色）
  lightBg:   "F0F7FA",  // 浅色背景
  white:     "FFFFFF",
  text:      "1A2B3C",  // 正文深色
  muted:     "5A7A8A",  // 减弱文字
  gold:      "E8A817",  // 金色高亮
  green:     "10B981",  // 完成状态
  red:       "EF4444",  // 警告
};

// ---- 辅助函数 ----
function darkSlide() {
  const slide = pres.addSlide();
  slide.background = { color: C.darkBg };
  return slide;
}
function lightSlide() {
  const slide = pres.addSlide();
  slide.background = { color: C.lightBg };
  return slide;
}

// 顶部装饰条
function addTopBar(slide, color = C.accent) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06, fill: { color },
  });
}

// ========== Slide 1: 封面 ==========
(() => {
  const slide = darkSlide();
  // 装饰圆
  slide.addShape(pres.shapes.OVAL, {
    x: 7.5, y: -1.5, w: 4, h: 4,
    fill: { color: C.primary, transparency: 60 },
  });
  slide.addShape(pres.shapes.OVAL, {
    x: -1.5, y: 4, w: 3.5, h: 3.5,
    fill: { color: C.secondary, transparency: 70 },
  });
  // 标题
  slide.addText("AI 智能代码审查\n与项目管理平台", {
    x: 0.8, y: 1.0, w: 7, h: 2.2,
    fontSize: 40, fontFace: "Arial Black", color: C.white, bold: true,
    lineSpacingMultiple: 1.2,
  });
  // 副标题
  slide.addText("AI-Powered Code Review & Project Management", {
    x: 0.8, y: 3.3, w: 7, h: 0.5,
    fontSize: 16, fontFace: "Calibri", color: C.accent, italic: true,
  });
  // 技术标签
  const tags = ["FastAPI", "React 19", "PostgreSQL", "Redis", "Qdrant", "Three.js", "uni-app"];
  tags.forEach((tag, i) => {
    const x = 0.8 + (i % 4) * 1.6;
    const y = 4.1 + Math.floor(i / 4) * 0.45;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 1.35, h: 0.35,
      fill: { color: C.white, transparency: 85 },
    });
    slide.addText(tag, {
      x, y, w: 1.35, h: 0.35,
      fontSize: 11, fontFace: "Calibri", color: C.accent, align: "center", valign: "middle",
      margin: 0,
    });
  });
  // 日期
  slide.addText("2026 年毕业答辩", {
    x: 0.8, y: 5.0, w: 4, h: 0.4,
    fontSize: 13, fontFace: "Calibri", color: C.muted,
  });
})();

// ========== Slide 2: 项目背景 ==========
(() => {
  const slide = lightSlide();
  addTopBar(slide);
  slide.addText("项目背景与痛点", {
    x: 0.6, y: 0.4, w: 9, h: 0.7,
    fontSize: 32, fontFace: "Arial Black", color: C.text, bold: true,
    margin: 0,
  });

  const cards = [
    { title: "🔍 人工审查效率低", desc: "大型项目 PR 动辄数百行代码，人工审查耗时长、易遗漏，缺乏自动化工具支撑" },
    { title: "📚 知识无法沉淀", desc: "历史审查经验和最佳实践散落在聊天记录中，新成员无法快速检索和复用" },
    { title: "📊 缺乏量化指标", desc: "代码质量评估依赖主观判断，缺少客观的 AI 评分、趋势分析和可视化展示" },
    { title: "🌐 多端管理需求", desc: "开发者需要在 Web 后台、移动端、数据大屏等不同场景下管理项目和审查" },
  ];
  cards.forEach((card, i) => {
    const x = 0.4 + (i % 2) * 4.7;
    const y = 1.4 + Math.floor(i / 2) * 1.85;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.3, h: 1.6,
      fill: { color: C.white },
      shadow: { type: "outer", blur: 8, offset: 2, angle: 135, color: "000000", opacity: 0.08 },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.07, h: 1.6, fill: { color: C.accent },
    });
    slide.addText(card.title, {
      x: x + 0.3, y: y + 0.15, w: 3.8, h: 0.4,
      fontSize: 15, fontFace: "Arial", color: C.text, bold: true, margin: 0,
    });
    slide.addText(card.desc, {
      x: x + 0.3, y: y + 0.6, w: 3.8, h: 0.85,
      fontSize: 12, fontFace: "Calibri", color: C.muted, margin: 0,
    });
  });
})();

// ========== Slide 3: 技术架构 ==========
(() => {
  const slide = darkSlide();
  slide.addText("技术架构总览", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: "Arial Black", color: C.white, bold: true, margin: 0,
  });

  // 技术栈三层卡片
  const layers = [
    { label: "前端层", items: ["React 19 + TypeScript", "Ant Design 6", "Three.js 3D", "uni-app 移动端", "Zustand 状态管理"], color: C.accent },
    { label: "后端层", items: ["FastAPI + Python 3.13", "JWT 双 Token 认证", "RBAC 三级权限", "SSE 流式响应", "Pydantic v2 校验"], color: C.secondary },
    { label: "数据层", items: ["PostgreSQL 16", "Redis 7 缓存", "Qdrant 向量数据库", "阿里百炼 AI", "Docker Compose"], color: C.primary },
  ];

  layers.forEach((layer, i) => {
    const y = 1.3 + i * 1.45;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y, w: 8.8, h: 1.25,
      fill: { color: C.white, transparency: 92 },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y, w: 0.07, h: 1.25, fill: { color: layer.color },
    });
    slide.addText(layer.label, {
      x: 0.9, y: y + 0.08, w: 1.2, h: 0.35,
      fontSize: 14, fontFace: "Arial Black", color: layer.color, bold: true, margin: 0,
    });
    slide.addText(layer.items.join("  ·  "), {
      x: 0.9, y: y + 0.5, w: 8.3, h: 0.6,
      fontSize: 12, fontFace: "Calibri", color: C.white, margin: 0,
    });
  });
})();

// ========== Slide 4: 系统架构图 ==========
(() => {
  const slide = lightSlide();
  addTopBar(slide);
  slide.addText("系统架构与模块划分", {
    x: 0.6, y: 0.4, w: 9, h: 0.7,
    fontSize: 32, fontFace: "Arial Black", color: C.text, bold: true, margin: 0,
  });

  const mods = [
    { name: "Web 管理后台", desc: "React + Ant Design\n8 个功能页面\n暗黑/亮色主题", x: 0.4, y: 1.4 },
    { name: "移动端 App", desc: "uni-app Vue 3\n5 个页面\n跨平台编译", x: 3.5, y: 1.4 },
    { name: "3D 数据大屏", desc: "Three.js\n实时数据接入\nOrbitControls", x: 6.6, y: 1.4 },
    { name: "FastAPI 后端", desc: "20 个 API 端点\nJWT + RBAC 认证\nSSE 流式 AI", x: 3.5, y: 3.4 },
    { name: "AI 服务层", desc: "阿里百炼 deepseek-v4\n代码审查 + 对话\nRAG 向量检索", x: 0.4, y: 3.4 },
    { name: "基础设施", desc: "PostgreSQL + Redis\nQdrant + Docker\n阿里云 ECS", x: 6.6, y: 3.4 },
  ];

  mods.forEach((m) => {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: m.x, y: m.y, w: 2.7, h: 1.6,
      fill: { color: C.white },
      shadow: { type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.06 },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: m.x, y: m.y, w: 2.7, h: 0.05, fill: { color: C.accent },
    });
    slide.addText(m.name, {
      x: m.x + 0.15, y: m.y + 0.15, w: 2.4, h: 0.35,
      fontSize: 14, fontFace: "Arial", color: C.text, bold: true, margin: 0,
    });
    slide.addText(m.desc, {
      x: m.x + 0.15, y: m.y + 0.55, w: 2.4, h: 0.9,
      fontSize: 11, fontFace: "Calibri", color: C.muted, margin: 0,
    });
  });
})();

// ========== Slide 5: AI 代码审查（核心功能） ==========
(() => {
  const slide = lightSlide();
  addTopBar(slide);
  slide.addText("核心功能：AI 智能代码审查", {
    x: 0.6, y: 0.4, w: 9, h: 0.7,
    fontSize: 32, fontFace: "Arial Black", color: C.text, bold: true, margin: 0,
  });

  // 左侧流程
  const steps = [
    { label: "1", title: "提交代码", desc: "粘贴代码片段\n选择编程语言" },
    { label: "2", title: "AI 分析", desc: "SSE 流式推送\n实时打字效果" },
    { label: "3", title: "Markdown 报告", desc: "问题分类/评分/建议\n富文本渲染" },
    { label: "4", title: "结果持久化", desc: "自动评分入库\n历史回溯查看" },
  ];
  steps.forEach((s, i) => {
    const y = 1.3 + i * 1.05;
    slide.addShape(pres.shapes.OVAL, {
      x: 0.5, y: y + 0.05, w: 0.5, h: 0.5,
      fill: { color: C.accent },
    });
    slide.addText(s.label, {
      x: 0.5, y: y + 0.05, w: 0.5, h: 0.5,
      fontSize: 16, fontFace: "Arial", color: C.white, bold: true, align: "center", valign: "middle", margin: 0,
    });
    slide.addText(s.title, {
      x: 1.2, y: y, w: 2, h: 0.3,
      fontSize: 14, fontFace: "Arial", color: C.text, bold: true, margin: 0,
    });
    slide.addText(s.desc, {
      x: 1.2, y: y + 0.3, w: 2.5, h: 0.6,
      fontSize: 11, fontFace: "Calibri", color: C.muted, margin: 0,
    });
    if (i < 3) {
      slide.addShape(pres.shapes.LINE, {
        x: 0.75, y: y + 0.6, w: 0, h: 0.4,
        line: { color: C.accent, width: 1.5, dashType: "dash" },
      });
    }
  });

  // 右侧亮点
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 5.5, y: 1.3, w: 4.2, h: 3.8,
    fill: { color: C.primary, transparency: 5 },
  });
  const highlights = [
    { num: "SSE", label: "Server-Sent Events\n实时流式输出" },
    { num: "5 维", label: "Bug/性能/安全\n规范/最佳实践" },
    { num: "0.3s", label: "首字延迟\n打字机效果" },
    { num: "100", label: "百分制评分\n自动提取保存" },
  ];
  highlights.forEach((h, i) => {
    const y = 1.5 + i * 0.9;
    slide.addText(h.num, {
      x: 5.8, y, w: 1, h: 0.5,
      fontSize: 24, fontFace: "Arial Black", color: C.accent, bold: true, margin: 0,
    });
    slide.addText(h.label, {
      x: 7, y, w: 2.5, h: 0.7,
      fontSize: 12, fontFace: "Calibri", color: C.text, margin: 0,
    });
  });
})();

// ========== Slide 6: RAG 知识库 ==========
(() => {
  const slide = darkSlide();
  slide.addText("核心功能：RAG 知识库", {
    x: 0.6, y: 0.3, w: 8, h: 0.7,
    fontSize: 32, fontFace: "Arial Black", color: C.white, bold: true, margin: 0,
  });

  // 流程图
  const flowSteps = ["代码入库", "向量化\n1536 维", "Qdrant\n存储", "语义\n检索", "LLM\n生成"];
  flowSteps.forEach((step, i) => {
    const x = 0.5 + i * 1.9;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.5, w: 1.6, h: 0.8,
      fill: { color: i < 2 ? C.primary : i < 4 ? C.secondary : C.accent, transparency: 20 },
    });
    slide.addText(step, {
      x, y: 1.5, w: 1.6, h: 0.8,
      fontSize: 12, fontFace: "Arial", color: C.white, align: "center", valign: "middle", margin: 0,
    });
    if (i < 4) {
      slide.addText("→", {
        x: x + 1.6, y: 1.5, w: 0.3, h: 0.8,
        fontSize: 18, color: C.accent, align: "center", valign: "middle", margin: 0,
      });
    }
  });

  // 说明
  slide.addText([
    { text: "技术原理", options: { bold: true, fontSize: 16, color: C.accent, breakLine: true } },
    { text: "使用阿里云百炼 text-embedding-v2 模型将代码/文档转为 1536 维向量", options: { breakLine: true, fontSize: 13 } },
    { text: "存入 Qdrant 向量数据库，COSINE 相似度搜索", options: { breakLine: true, fontSize: 13 } },
    { text: "结合 deepseek-v4-pro 大模型，基于检索上下文生成精确答案", options: { fontSize: 13 } },
  ], {
    x: 0.6, y: 2.8, w: 8.5, h: 2,
    fontFace: "Calibri", color: C.white, lineSpacingMultiple: 1.4,
  });
})();

// ========== Slide 7: SSE 流式实现 ==========
(() => {
  const slide = lightSlide();
  addTopBar(slide);
  slide.addText("技术亮点：SSE 流式 AI 审查", {
    x: 0.6, y: 0.4, w: 9, h: 0.7,
    fontSize: 32, fontFace: "Arial Black", color: C.text, bold: true, margin: 0,
  });

  // 左侧代码示例
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.4, y: 1.3, w: 4.8, h: 3.6,
    fill: { color: "1E1E1E" },
  });
  slide.addText([
    { text: "Python (FastAPI)", options: { color: "569CD6", fontSize: 10, breakLine: true } },
    { text: "async def review_code_stream(", options: { color: "DCDCAA", fontSize: 10, breakLine: true } },
    { text: "  code: str, language: str", options: { color: "DCDCAA", fontSize: 10, breakLine: true } },
    { text: "):", options: { color: "DCDCAA", fontSize: 10, breakLine: true } },
    { text: "  stream = await client.chat.", options: { color: "DCDCAA", fontSize: 10, breakLine: true } },
    { text: "    completions.create(", options: { color: "DCDCAA", fontSize: 10, breakLine: true } },
    { text: "      model='deepseek-v4-pro',", options: { color: "CE9178", fontSize: 10, breakLine: true } },
    { text: "      stream=True)", options: { color: "CE9178", fontSize: 10, breakLine: true } },
    { text: "  async for chunk in stream:", options: { color: "C586C0", fontSize: 10, breakLine: true } },
    { text: "    yield chunk.content", options: { color: "DCDCAA", fontSize: 10 } },
  ], {
    x: 0.6, y: 1.5, w: 4.4, h: 3.2,
    fontFace: "Consolas", valign: "top",
  });

  // 右侧说明
  slide.addText([
    { text: "前后端 SSE 通信流程", options: { bold: true, fontSize: 16, color: C.text, breakLine: true } },
    { text: "", options: { fontSize: 8, breakLine: true } },
    { text: "1. 前端 fetch POST 请求", options: { bold: true, fontSize: 13, breakLine: true, color: C.primary } },
    { text: "   后端返回 StreamingResponse", options: { fontSize: 12, breakLine: true, color: C.muted } },
    { text: "", options: { fontSize: 6, breakLine: true } },
    { text: "2. ReadableStream 逐块读取", options: { bold: true, fontSize: 13, breakLine: true, color: C.primary } },
    { text: "   data: {...} JSON 编码传输", options: { fontSize: 12, breakLine: true, color: C.muted } },
    { text: "", options: { fontSize: 6, breakLine: true } },
    { text: "3. react-markdown 实时渲染", options: { bold: true, fontSize: 13, breakLine: true, color: C.primary } },
    { text: "   标题/代码块/表格/评分高亮", options: { fontSize: 12, breakLine: true, color: C.muted } },
    { text: "", options: { fontSize: 6, breakLine: true } },
    { text: "4. 流结束后自动保存到 DB", options: { bold: true, fontSize: 13, breakLine: true, color: C.primary } },
    { text: "   评分提取 + ai_result 持久化", options: { fontSize: 12, color: C.muted } },
  ], {
    x: 5.5, y: 1.3, w: 4.2, h: 3.6,
    fontFace: "Calibri", valign: "top",
  });
})();

// ========== Slide 8: 3D 数据大屏 ==========
(() => {
  const slide = darkSlide();
  slide.addText("数据可视化：3D 实时大屏", {
    x: 0.6, y: 0.3, w: 9, h: 0.7,
    fontSize: 32, fontFace: "Arial Black", color: C.white, bold: true, margin: 0,
  });

  // 特性卡片
  const features = [
    { title: "Three.js 3D 场景", desc: "球体节点代表项目和审查记录，连线表示依赖关系，星空粒子背景" },
    { title: "实时数据接入", desc: "每 10 秒自动拉取后端 /api/stats 接口，节点数量和大小随数据动态变化" },
    { title: "交互控制", desc: "OrbitControls 鼠标旋转/缩放/平移，动态光照环绕，节点微动 + 外环旋转动画" },
    { title: "统计面板", desc: "HTML 覆盖层展示活跃项目数、审查总数、平均 AI 评分、涉及语言等关键指标" },
  ];
  features.forEach((f, i) => {
    const y = 1.3 + i * 1.05;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y, w: 9, h: 0.9,
      fill: { color: C.white, transparency: 92 },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.5, y, w: 0.07, h: 0.9, fill: { color: C.accent },
    });
    slide.addText(f.title, {
      x: 0.8, y: y + 0.08, w: 3, h: 0.3,
      fontSize: 14, fontFace: "Arial", color: C.accent, bold: true, margin: 0,
    });
    slide.addText(f.desc, {
      x: 0.8, y: y + 0.42, w: 8.4, h: 0.4,
      fontSize: 11, fontFace: "Calibri", color: C.white, margin: 0,
    });
  });
})();

// ========== Slide 9: 数据统计 ==========
(() => {
  const slide = lightSlide();
  addTopBar(slide);
  slide.addText("平台能力一览", {
    x: 0.6, y: 0.4, w: 9, h: 0.7,
    fontSize: 32, fontFace: "Arial Black", color: C.text, bold: true, margin: 0,
  });

  // 数据卡片
  const stats = [
    { value: "20", label: "API 端点", sub: "认证/项目/审查/AI/RAG" },
    { value: "9", label: "Web 页面", sub: "含 3 个新建页面" },
    { value: "5", label: "移动端页面", sub: "uni-app 跨平台" },
    { value: "3", label: "用户角色", sub: "ADMIN/REVIEWER/DEV" },
  ];
  stats.forEach((s, i) => {
    const x = 0.4 + i * 2.4;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.5, w: 2.1, h: 2.0,
      fill: { color: C.white },
      shadow: { type: "outer", blur: 6, offset: 2, angle: 135, color: "000000", opacity: 0.06 },
    });
    slide.addText(s.value, {
      x, y: 1.7, w: 2.1, h: 0.7,
      fontSize: 36, fontFace: "Arial Black", color: C.accent, bold: true, align: "center", margin: 0,
    });
    slide.addText(s.label, {
      x, y: 2.4, w: 2.1, h: 0.4,
      fontSize: 14, fontFace: "Arial", color: C.text, bold: true, align: "center", margin: 0,
    });
    slide.addText(s.sub, {
      x, y: 2.8, w: 2.1, h: 0.4,
      fontSize: 11, fontFace: "Calibri", color: C.muted, align: "center", margin: 0,
    });
  });

  // 技术栈表格
  slide.addTable([
    [
      { text: "层级", options: { bold: true, color: C.white, fill: { color: C.primary }, fontSize: 12 } },
      { text: "技术选型", options: { bold: true, color: C.white, fill: { color: C.primary }, fontSize: 12 } },
    ],
    ["前端", "React 19 / TypeScript / Ant Design 6 / Three.js / uni-app"],
    ["后端", "FastAPI / Pydantic v2 / SQLAlchemy 2.0 / JWT / RBAC"],
    ["AI", "阿里百炼 deepseek-v4-pro / text-embedding-v2 / SSE"],
    ["数据", "PostgreSQL 16 / Redis 7 / Qdrant (向量数据库)"],
    ["部署", "Docker Compose / 阿里云 ECS (Ubuntu 22.04)"],
  ], {
    x: 0.5, y: 3.8, w: 9, h: 1.6,
    colW: [2, 7],
    border: { pt: 0.5, color: "D0E0E8" },
    fontFace: "Calibri", fontSize: 11, color: C.text,
  });
})();

// ========== Slide 10: 创新点 ==========
(() => {
  const slide = darkSlide();
  slide.addText("创新点与技术亮点", {
    x: 0.6, y: 0.3, w: 9, h: 0.7,
    fontSize: 32, fontFace: "Arial Black", color: C.white, bold: true, margin: 0,
  });

  const innovations = [
    { num: "01", title: "流式 AI 审查 + 自动回存", desc: "SSE 实时推送审查结果，流结束后自动提取评分并持久化，形成完整的审查→分析→回溯闭环" },
    { num: "02", title: "RAG 知识库语义检索", desc: "1536 维向量嵌入 + Qdrant 近似搜索，将历史审查经验转化为可检索的知识资产" },
    { num: "03", title: "3D 数据可视化大屏", desc: "Three.js 原生实现（非 React Three Fiber），节点/连线/粒子实时反映平台运行状态" },
    { num: "04", title: "全栈多端覆盖", desc: "React Web + uni-app 移动端 + 3D 大屏，同一套 API 支撑三种前端，monorepo 架构统一管理" },
    { num: "05", title: "企业级安全设计", desc: "JWT 双 Token + RBAC 三级权限 + bcrypt 密码哈希 + 软删除，完整的认证授权体系" },
  ];

  innovations.forEach((item, i) => {
    const y = 1.2 + i * 0.85;
    slide.addText(item.num, {
      x: 0.5, y, w: 0.5, h: 0.45,
      fontSize: 18, fontFace: "Arial Black", color: C.accent, bold: true, margin: 0,
    });
    slide.addText(item.title, {
      x: 1.1, y, w: 3, h: 0.45,
      fontSize: 14, fontFace: "Arial", color: C.white, bold: true, margin: 0,
    });
    slide.addText(item.desc, {
      x: 1.1, y: y + 0.4, w: 8.3, h: 0.35,
      fontSize: 11, fontFace: "Calibri", color: "8899AA", margin: 0,
    });
  });
})();

// ========== Slide 11: 总结 ==========
(() => {
  const slide = darkSlide();
  // 装饰
  slide.addShape(pres.shapes.OVAL, {
    x: 8, y: -2, w: 5, h: 5,
    fill: { color: C.primary, transparency: 60 },
  });
  slide.addShape(pres.shapes.OVAL, {
    x: -2, y: 3, w: 4, h: 4,
    fill: { color: C.secondary, transparency: 70 },
  });

  slide.addText("感谢聆听", {
    x: 0.5, y: 1.2, w: 9, h: 1.2,
    fontSize: 48, fontFace: "Arial Black", color: C.white, bold: true, align: "center", margin: 0,
  });

  slide.addText("AI 智能代码审查与项目管理平台", {
    x: 0.5, y: 2.5, w: 9, h: 0.6,
    fontSize: 20, fontFace: "Calibri", color: C.accent, align: "center", margin: 0,
  });

  slide.addText([
    { text: "FastAPI · React 19 · PostgreSQL · Redis · Qdrant · DeepSeek · Three.js", options: { breakLine: true } },
    { text: "SSE 流式 · RAG 知识库 · 3D 大屏 · 多端覆盖 · RBAC 安全", options: { breakLine: true } },
    { text: "", options: { breakLine: true, fontSize: 8 } },
    { text: "2026 年毕业答辩", options: { italic: true } },
  ], {
    x: 0.5, y: 3.3, w: 9, h: 2,
    fontSize: 14, fontFace: "Calibri", color: C.muted, align: "center",
  });
})();

// ---- 输出 ----
const outputPath = path.resolve("D:/答辩项目/ai-code-review/docs/答辩PPT_AI代码审查平台.pptx");
pres.writeFile({ fileName: outputPath }).then(() => {
  console.log("PPT 已生成: " + outputPath);
});
