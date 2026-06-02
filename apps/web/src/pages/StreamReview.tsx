/**
 * AI 流式代码审查 — 实时 Markdown 渲染 + 视觉增强
 *
 * 核心设计：
 * 1. 后端 SSE 推送 Markdown 格式审查结果
 * 2. 前端用 react-markdown 实时渲染，即使 Markdown 不完整也能正常显示
 * 3. 自定义组件/样式突出严重程度标签、代码块、评分表格等
 */
import { useState, useRef, useEffect } from 'react'
import { Input, Button, Card, Select, Typography, Space, Tag } from 'antd'
import { ThunderboltOutlined, CheckCircleOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStreamStore } from '../stores/stream'
import { MARKDOWN_COMPONENTS } from '@ui/Markdown'

const { TextArea } = Input
const { Text } = Typography

// ---- 主组件 ------------------------------------------------------------------

export default function StreamReview() {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('Python')
  const { streamResult: rawResult, streaming: loading, setStreamResult, setStreaming } = useStreamStore()
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
    setStreaming(true)
    setStreamResult(() => '')

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
              setStreamResult(prev => prev + `\n\n> ❌ **错误：** ${data.slice(8)}`)
              continue
            }
            // 后端已 JSON 编码，解码后直接拼接
            try {
              setStreamResult(prev => prev + JSON.parse(data))
            } catch {
              setStreamResult(prev => prev + data)
            }
          }
        }
      }
    } catch (err: any) {
      setStreamResult(prev => prev + '\n\n> ❌ **连接失败，请检查网络后重试**')
    } finally {
      setStreaming(false)
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
                components={MARKDOWN_COMPONENTS}
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
