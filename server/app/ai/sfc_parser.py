# -*- coding: utf-8 -*-
"""
SFC (Single File Component) 解析器
支持 .vue / .jsx / .tsx 文件的代码块拆分
"""
import re
from typing import Optional


# SFC 类型标识
VUE_SFC = "vue"
REACT_JSX = "jsx"
REACT_TSX = "tsx"
REGULAR = "regular"


def detect_sfc_type(code: str, language: str) -> str:
    """
    检测代码是否为单文件组件类型
    language 是前端传入的语言名（如 "Vue SFC"、"React TSX"）
    """
    lang_lower = language.lower()
    if "vue" in lang_lower or "sfc" in lang_lower:
        return VUE_SFC
    if "tsx" in lang_lower:
        return REACT_TSX
    if "jsx" in lang_lower:
        return REACT_JSX
    # 启发式：如果代码同时包含 <template> 和 <script>，判定为 Vue SFC
    if re.search(r'<\s*template\b', code, re.IGNORECASE) and re.search(r'<\s*script\b', code, re.IGNORECASE):
        return VUE_SFC
    return REGULAR


def split_vue_sfc(code: str) -> dict:
    """
    拆分 Vue 单文件组件
    返回: {
        "template": "模板代码" or None,
        "script": "脚本代码" or None,
        "style": "样式代码" or None,
        "full": "完整代码",
    }
    """
    result = {"template": None, "script": None, "style": None, "full": code}

    # 提取 <template> 块（可能有属性如 <template lang="pug">）
    tmpl_match = re.search(
        r'<\s*template\b[^>]*>(.*?)<\s*/\s*template\s*>',
        code, re.IGNORECASE | re.DOTALL
    )
    if tmpl_match:
        result["template"] = tmpl_match.group(1).strip()

    # 提取 <script> 块（可能有 setup、lang="ts" 等属性）
    script_match = re.search(
        r'<\s*script\b[^>]*>(.*?)<\s*/\s*script\s*>',
        code, re.IGNORECASE | re.DOTALL
    )
    if script_match:
        result["script"] = script_match.group(1).strip()

    # 提取所有 <style> 块（可能有 scoped、lang="scss" 等属性）
    style_matches = re.findall(
        r'<\s*style\b[^>]*>(.*?)<\s*/\s*style\s*>',
        code, re.IGNORECASE | re.DOTALL
    )
    if style_matches:
        # 合并多个 style 块
        result["style"] = "\n\n".join(s.strip() for s in style_matches)

    return result


def build_sfc_prompt(code: str, language: str) -> tuple[str, str]:
    """
    构建 SFC 审查提示词
    返回 (prompt, 语言标识)
    """
    sfc_type = detect_sfc_type(code, language)

    if sfc_type == VUE_SFC:
        parts = split_vue_sfc(code)
        sections = []
        if parts["template"]:
            sections.append(f"### 📌 Template（模板）\n```html\n{parts['template']}\n```")
        if parts["script"]:
            lang = "typescript" if '<script lang="ts"' in code or '<script setup lang="ts"' in code else "javascript"
            sections.append(f"### 📌 Script（逻辑）\n```{lang}\n{parts['script']}\n```")
        if parts["style"]:
            sections.append(f"### 📌 Style（样式）\n```css\n{parts['style']}\n```")

        prompt = f"""你是一位资深前端代码审查专家，请审查以下 Vue 单文件组件（SFC）。

审查要点（按区域分别审查）：
1. **Template 模板** — 指令使用（v-if/v-for/v-model）、事件绑定、slot 插槽、XSS风险
2. **Script 逻辑** — reactive/ref 使用、computed/watcher 效率、生命周期钩子、异步处理
3. **Style 样式** — scoped 隔离、深度选择器滥用、CSS 性能

请按以下 Markdown 格式输出审查结果：

## 🔍 代码概览
（2-3 句话概述组件功能）

## 📌 Template 审查
（模板相关问题）

## 📝 Script 审查
（逻辑相关问题）

## 🎨 Style 审查
（样式相关问题）

## 📊 综合评分

---
待审查代码：
{chr(10).join(sections)}"""
        return prompt, "Vue SFC"

    elif sfc_type in (REACT_JSX, REACT_TSX):
        lang = "typescript" if sfc_type == REACT_TSX else "javascript"
        prompt = f"""你是一位资深前端代码审查专家，请审查以下 React 组件（{sfc_type.upper()}）。

审查要点：
1. **JSX 结构** — 条件渲染、列表渲染、事件处理、无障碍（a11y）
2. **Hooks 使用** — useState/useEffect 依赖数组、自定义 Hook、闭包陷阱
3. **性能优化** — 不必要的重渲染、useMemo/useCallback、React.memo
4. **类型安全** — Props/State 类型定义、any 类型滥用
5. **样式方案** — CSS-in-JS、className 动态拼接

请按以下 Markdown 格式输出审查结果：

## 🔍 代码概览
（2-3 句话概述组件功能）

## 🔴 严重问题
## 🟡 一般问题
## 💡 优化建议
## 📊 综合评分

---
待审查代码：
```{lang}
{code}
```"""
        return prompt, language

    return "", "unknown"


def build_sfc_prompt_stream(code: str, language: str) -> tuple[str, str]:
    """
    构建 SFC 流式审查提示词（更结构化的输出要求）
    返回 (prompt, 语言标识)
    """
    sfc_type = detect_sfc_type(code, language)

    if sfc_type == VUE_SFC:
        parts = split_vue_sfc(code)
        sections = []
        if parts["template"]:
            sections.append(f"### 📌 Template（模板）\n```html\n{parts['template']}\n```")
        if parts["script"]:
            lang = "typescript" if '<script lang="ts"' in code or '<script setup lang="ts"' in code else "javascript"
            sections.append(f"### 📌 Script（逻辑）\n```{lang}\n{parts['script']}\n```")
        if parts["style"]:
            sections.append(f"### 📌 Style（样式）\n```css\n{parts['style']}\n```")

        prompt = f"""你是一位资深前端代码审查专家，请审查以下 Vue 单文件组件（SFC）。请严格遵循以下 Markdown 格式输出。

审查维度：Template 模板 | Script 逻辑 | Style 样式 | 性能 | 安全

---

**输出格式要求（严格遵守）：**

## 🔍 代码概览
（用 2-3 句话概述组件功能和结构）

## 📌 Template 审查
> 模板相关的 Bug、性能、安全问题

## 📝 Script 审查
> 逻辑相关的类型安全、副作用管理、状态管理问题

## 🎨 Style 审查
> 样式隔离、深度选择器、响应式布局问题

## 🔴 严重问题
> 使用 `[高]` 标签标注严重程度

## 🟡 一般问题
> 使用 `[中]` 或 `[低]` 标签

## 💡 优化建议
> 具体的代码改进方案

## 📊 综合评分
>
> | 维度 | 评分 | 说明 |
> |------|------|------|
> | **模板** | X/10 | 简要说明 |
> | **逻辑** | X/10 | 简要说明 |
> | **样式** | X/10 | 简要说明 |
> | **安全性** | X/10 | 简要说明 |
> | **性能** | X/10 | 简要说明 |
> | **综合** | **X/10** | 总结一句话 |

---
待审查代码：
{chr(10).join(sections)}"""
        return prompt, "Vue SFC"

    elif sfc_type in (REACT_JSX, REACT_TSX):
        lang = "typescript" if sfc_type == REACT_TSX else "javascript"
        prompt = f"""你是一位资深前端代码审查专家，请审查以下 React 组件（{sfc_type.upper()}）。请严格遵循以下 Markdown 格式输出。

审查维度：JSX 结构 | Hooks 使用 | 性能 | 类型安全 | 可维护性

---

**输出格式要求（严格遵守）：**

## 🔍 代码概览
## 🔴 严重问题
> 使用 `[高]` 标签
## 🟡 一般问题
> 使用 `[中]` 或 `[低]` 标签
## 💡 优化建议
## 📊 综合评分
>
> | 维度 | 评分 | 说明 |
> |------|------|------|
> | **类型安全** | X/10 | 简要说明 |
> | **性能** | X/10 | 简要说明 |
> | **可读性** | X/10 | 简要说明 |
> | **可维护性** | X/10 | 简要说明 |
> | **综合** | **X/10** | 总结一句话 |

---
待审查代码：
```{lang}
{code}
```"""
        return prompt, language

    return "", "unknown"
