/**
 * AI 流式代码审查 — 实时 Markdown 渲染 + 视觉增强
 *
 * 核心设计：
 * 1. 后端 SSE 推送 Markdown 格式审查结果
 * 2. 前端用 react-markdown 实时渲染，即使 Markdown 不完整也能正常显示
 * 3. 自定义组件/样式突出严重程度标签、代码块、评分表格等
 */
import { useState, useRef, useEffect, useMemo } from 'react'
import { Input, Button, Card, Select, Typography, Space, Tag } from 'antd'
import { ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const { TextArea } = Input
const { Text } = Typography

// ---- Markdown 自定义渲染组件 --------------------------------------------------

/** 代码块渲染：带语言标签 + 深色背景 + 等宽字体 */
function CodeBlock({ className, children, ...props }: any) {
  const language = className ? className.replace('language-', '') : ''
  return (
    <div style={{ margin: '12px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8' }}>
      {/* 语言标签栏 */}
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
function InlineCode({ children, ...props }: any) {
  return (
    <code
      {...props}
      style={{
        background: '#f5f2f0', color: '#c7254e',
        padding: '2px 6px', borderRadius: 4,
        fontFamily: '"Fira Code", Consolas, monospace',
        fontSize: '0.9em',
      }}
    >
      {children}
    </code>
  )
}

/** 标题渲染：不同级别不同样式 */
function HeadingRenderer({ level, children, ...props }: any) {
  const sizes: Record<number, { fontSize: number; color: string; border?: boolean }> = {
    1: { fontSize: 24, color: '#1a1a2e' },
    2: { fontSize: 20, color: '#16213e' },
    3: { fontSize: 17, color: '#0f3460' },
    4: { fontSize: 15, color: '#333' },
  }
  const style = sizes[level] || sizes[4]
  const Tag = `h${level}` as keyof JSX.IntrinsicElements

  return (
    <Tag
      {...props}
      style={{
        fontSize: style.fontSize, fontWeight: 700, color: style.color,
        marginTop: level <= 2 ? 24 : 16, marginBottom: 8,
        paddingBottom: level <= 2 ? 8 : 0,
        borderBottom: level <= 2 ? '2px solid #e8e8e8' : 'none',
        lineHeight: 1.4,
      }}
    >
      {children}
    </Tag>
  )
}

/** 段落渲染：增加行间距 */
function ParagraphRenderer({ children, ...props }: any) {
  return <p {...props} style={{ margin: '6px 0', lineHeight: 1.8, fontSize: 14 }}>{children}</p>
}

/** 引用块渲染：用于提示信息 */
function BlockquoteRenderer({ children, ...props }: any) {
  return (
    <blockquote
      {...props}
      style={{
        margin: '12px 0', padding: '8px 16px',
        borderLeft: '4px solid #1890ff',
        background: '#e6f7ff', borderRadius: '0 6px 6px 0',
        color: '#333',
      }}
    >
      {children}
    </blockquote>
  )
}

/** 列表项渲染 */
function ListItemRenderer({ children, ordered, ...props }: any) {
  return (
    <li {...props} style={{ margin: '4px 0', lineHeight: 1.8, fontSize: 14 }}>
      {children}
    </li>
  )
}

/** 表格渲染：企业级样式 */
function TableRenderer({ children, ...props }: any) {
  return (
    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table
        {...props}
        style={{
          width: '100%', borderCollapse: 'collapse',
          fontSize: 14, borderRadius: 8, overflow: 'hidden',
          border: '1px solid #e8e8e8',
        }}
      >
        {children}
      </table>
    </div>
  )
}

/** 表头渲染 */
function TheadRenderer({ children, ...props }: any) {
  return (
    <thead {...props} style={{ background: '#fafafa' }}>
      {children}
    </thead>
  )
}

/** 表头单元格 */
function ThRenderer({ children, ...props }: any) {
  return (
    <th
      {...props}
      style={{
        padding: '10px 16px', textAlign: 'left', fontWeight: 600,
        borderBottom: '1px solid #e8e8e8', color: '#555',
        fontSize: 13,
      }}
    >
      {children}
    </th>
  )
}

/** 表格数据单元格 */
function TdRenderer({ children, ...props }: any) {
  return (
    <td
      {...props}
      style={{
        padding: '10px 16px', borderBottom: '1px solid #f0f0f0',
        fontSize: 14, verticalAlign: 'top',
     }}
    >
      {children}
    </td>
  )
}

/** 加粗文本：使用主题色 */
function StrongRenderer({ children, ...props }: any) {
  return (
    <strong {...props} style={{ color: '#1a1a2e', fontWeight: 700 }}>
      {children}
    </strong>
  )
}

// ---- 主组件 ------------------------------------------------------------------

export default function StreamReview() {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('Python')
  const [loading, setLoading] = useState(false)
  const [rawResult, setRawResult] = useState('')  // 原始 Markdown 文本（用于传给 react-markdown）
  const resultRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight
    }
  }, [rawResult])

  // 累积流式内容
  const handleReview = async () => {
    if (!code.trim()) return
    setLoading(true)
    setRawResult('')

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/ai/review/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code, language }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      // 流式读取 SSE
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value)
        const lines = text.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue
            if (data.startsWith('[ERROR]')) {
              setRawResult(prev => prev + `\n\n> ❌ **错误：** ${data.slice(8)}`)
              continue
            }
            // 后端已 JSON 编码，解码后直接拼接
            try {
              setRawResult(prev => prev + JSON.parse(data))
            } catch {
              setRawResult(prev => prev + data)
            }
          }
        }
      }
    } catch (err: any) {
      setRawResult(prev => prev + '\n\n> ❌ **连接失败，请检查网络后重试**')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', gap: 24, height: 'calc(100vh - 140px)' }}>
      {/* ====== 左侧：代码输入区 ====== */}
      <Card
        title="提交代码"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 16 } }}
      >
        <Space style={{ marginBottom: 12 }}>
          <Select
            value={language}
            onChange={setLanguage}
            style={{ width: 130 }}
            options={[
              'Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust', 'C++', 'C',
            ].map(v => ({ value: v }))}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>选择语言后粘贴代码</Text>
        </Space>
        <TextArea
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder={`// 在此粘贴 ${language} 代码...`}
          style={{
            flex: 1, fontFamily: '"Fira Code", Consolas, monospace',
            fontSize: 13, resize: 'none',
          }}
        />
        <Button
          type="primary"
          icon={<ThunderboltOutlined />}
          onClick={handleReview}
          loading={loading}
          block
          style={{ marginTop: 12, height: 44 }}
          size="large"
        >
          {loading ? 'AI 审查中...' : 'AI 审查'}
        </Button>
      </Card>

      {/* ====== 右侧：审查结果区（Markdown 渲染） ====== */}
      <Card
        title={
          <Space>
            <span>审查结果</span>
            {!loading && rawResult && (
              <Tag icon={<CheckCircleOutlined />} color="success">审查完成</Tag>
            )}
          </Space>
        }
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, overflow: 'hidden', padding: 0 } }}
      >
        <div
          ref={resultRef}
          style={{
            height: '100%', overflow: 'auto',
            padding: '16px 24px',
            background: '#fefefe',
          }}
        >
          {rawResult ? (
            /* ---- react-markdown 实时渲染 ---- */
            <div className="stream-markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // 代码块
                  code({ className, children, ...props }: any) {
                    const isBlock = className?.startsWith('language-')
                    if (isBlock) {
                      return <CodeBlock className={className} {...props}>{children}</CodeBlock>
                    }
                    return <InlineCode {...props}>{children}</InlineCode>
                  },
                  // 标题
                  h1: HeadingRenderer,
                  h2: HeadingRenderer,
                  h3: HeadingRenderer,
                  h4: HeadingRenderer,
                  // 段落
                  p: ParagraphRenderer,
                  // 引用
                  blockquote: BlockquoteRenderer,
                  // 列表
                  li: ListItemRenderer,
                  // 表格
                  table: TableRenderer,
                  thead: TheadRenderer,
                  th: ThRenderer,
                  td: TdRenderer,
                  // 加粗
                  strong: StrongRenderer,
                  // 水平线
                  hr: () => (
                    <hr style={{ border: 'none', borderTop: '1px solid #e8e8e8', margin: '20px 0' }} />
                  ),
                }}
              >
                {rawResult}
              </ReactMarkdown>
            </div>
          ) : (
            /* 空状态 */
            <div style={{ textAlign: 'center', marginTop: 80 }}>
              <ThunderboltOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <p style={{ marginTop: 16, color: '#999', fontSize: 14 }}>
                输入代码并点击审查，AI 将逐字输出结果
              </p>
              <p style={{ color: '#bbb', fontSize: 12 }}>
                支持 Markdown 实时渲染：标题、代码块、表格、评分高亮
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
