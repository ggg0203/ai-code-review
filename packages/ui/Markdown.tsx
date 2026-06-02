/**
 * 共享 Markdown 渲染组件 — Web / RAG / 审查详情 三页统一使用
 */
import React from 'react'
import type { Components } from 'react-markdown'

/** 代码块渲染：带语言标签 + 深色背景 + 等宽字体 */
export function CodeBlock({ className, children, ...props }: any) {
  const language = className ? className.replace('language-', '') : ''
  return (
    <div style={{ margin: '12px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
      {language && (
        <div style={{
          padding: '4px 16px', fontSize: 12, color: '#888',
          background: '#fafafa', borderBottom: '1px solid #e8e8e8',
          fontFamily: 'monospace',
        }}>
          {language}
        </div>
      )}
      <pre style={{
        margin: 0, padding: '16px', overflow: 'auto',
        background: '#1e1e1e', color: '#d4d4d4',
        fontFamily: '"Fira Code", "Cascadia Code", Consolas, monospace',
        fontSize: 13, lineHeight: 1.7,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        <code className={className} {...props}>{children}</code>
      </pre>
    </div>
  )
}

/** 内联代码渲染 */
export function InlineCode({ children, ...props }: any) {
  return (
    <code {...props} style={{
      background: '#f5f2f0', color: '#c7254e',
      padding: '2px 6px', borderRadius: 4,
      fontFamily: '"Fira Code", Consolas, monospace', fontSize: '0.9em',
    }}>
      {children}
    </code>
  )
}

/** 标题渲染 */
export function HeadingRenderer({ level, children, ...props }: any) {
  const sizes: Record<number, { fontSize: number; color: string }> = {
    1: { fontSize: 24, color: '#1a1a2e' },
    2: { fontSize: 20, color: '#16213e' },
    3: { fontSize: 17, color: '#0f3460' },
    4: { fontSize: 15, color: '#333' },
  }
  const style = sizes[level] || sizes[4]
  const Tag = `h${level}` as keyof React.JSX.IntrinsicElements
  return (
    <Tag {...props} style={{
      fontSize: style.fontSize, fontWeight: 700, color: style.color,
      marginTop: level <= 2 ? 24 : 16, marginBottom: 8,
      paddingBottom: level <= 2 ? 8 : 0,
      borderBottom: level <= 2 ? '2px solid #e8e8e8' : 'none',
      lineHeight: 1.4,
    }}>
      {children}
    </Tag>
  )
}

/** 引用块渲染 */
export function BlockquoteRenderer({ children, ...props }: any) {
  return (
    <blockquote {...props} style={{
      margin: '12px 0', padding: '8px 16px',
      borderLeft: '4px solid #1890ff', background: '#e6f7ff',
      borderRadius: '0 6px 6px 0', color: '#333',
    }}>
      {children}
    </blockquote>
  )
}

/** 表格渲染 */
export function TableRenderer({ children, ...props }: any) {
  return (
    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table {...props} style={{
        width: '100%', borderCollapse: 'collapse', fontSize: 14,
        borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8',
      }}>
        {children}
      </table>
    </div>
  )
}

/** 表头渲染 */
export function TheadRenderer({ children, ...props }: any) {
  return <thead {...props} style={{ background: '#fafafa' }}>{children}</thead>
}

/** 表头单元格 */
export function ThRenderer({ children, ...props }: any) {
  return (
    <th {...props} style={{
      padding: '10px 16px', textAlign: 'left', fontWeight: 600,
      borderBottom: '1px solid #e8e8e8', color: '#555', fontSize: 13,
    }}>
      {children}
    </th>
  )
}

/** 表格数据单元格 */
export function TdRenderer({ children, ...props }: any) {
  return (
    <td {...props} style={{
      padding: '10px 16px', borderBottom: '1px solid #f0f0f0',
      fontSize: 14, verticalAlign: 'top',
    }}>
      {children}
    </td>
  )
}

/**
 * 统一的 react-markdown components 配置对象
 * 用法：
 * <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
 *   {content}
 * </ReactMarkdown>
 */
export const MARKDOWN_COMPONENTS: Components = {
  code({ className, children, ...props }: any) {
    const isBlock = className?.startsWith('language-')
    if (isBlock) return <CodeBlock className={className} {...props}>{children}</CodeBlock>
    return <InlineCode {...props}>{children}</InlineCode>
  },
  h1: HeadingRenderer,
  h2: HeadingRenderer,
  h3: HeadingRenderer,
  h4: HeadingRenderer,
  blockquote: BlockquoteRenderer,
  table: TableRenderer,
  thead: TheadRenderer,
  th: ThRenderer,
  td: TdRenderer,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #e8e8e8', margin: '20px 0' }} />,
} as any
