/**
 * AI 流式代码审查 — 实时 Markdown 渲染 + 视觉增强
 *
 * 核心设计：
 * 1. 后端 SSE 推送 Markdown 格式审查结果
 * 2. 前端用 react-markdown 实时渲染，即使 Markdown 不完整也能正常显示
 * 3. 自定义组件/样式突出严重程度标签、代码块、评分表格等
 */
import { useState, useRef, useEffect } from 'react'
import { Input, Button, Card, Select, Typography, Space, Tag, Segmented } from 'antd'
import { ThunderboltOutlined, CheckCircleOutlined, TeamOutlined, SyncOutlined } from '@ant-design/icons'
import Editor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStreamStore } from '../stores/stream'
import { MARKDOWN_COMPONENTS } from '@ui/Markdown'

const { Text } = Typography

// 从 LLM 输出中提取评分
function extractScore(text: string): number | null {
  const patterns = [
    /(\d{1,3})\s*\/\s*100/,
    /评分[：:]\s*(\d{1,3})/,
    /评分[（(]\s*(\d{1,3})\s*\/\s*100/,
    /(\d{1,3})\s*分/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) return parseInt(m[1])
  }
  return null
}

const AGENT_COLORS: Record<string, string> = {
  security: '#ff4d4f',
  performance: '#faad14',
  style: '#1890ff',
}

// ---- 主组件 ------------------------------------------------------------------

export default function StreamReview() {
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('Python')
  const [mode, setMode] = useState<'single' | 'multi'>('single')
  const [agentResults, setAgentResults] = useState<Record<string, string>>({ security: '', performance: '', style: '' })
  const [agentLoading, setAgentLoading] = useState(false)
  const [agentTab, setAgentTab] = useState<string>('security')
  const { streamResult: rawResult, streaming: loading, setStreamResult, setStreaming } = useStreamStore()
  const [isCached, setIsCached] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  // 组件挂载时检测是否有缓存结果
  useEffect(() => {
    if (rawResult) setIsCached(true)
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollTop = resultRef.current.scrollHeight
    }
  }, [rawResult])

  // 累积流式内容
  const handleReview = async () => {
    if (!code.trim()) return
    setIsCached(false)
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

  // 多 Agent 审查
  const handleAgentReview = async () => {
    if (!code.trim()) return
    setAgentLoading(true)
    setAgentResults({ security: '', performance: '', style: '' })
    setStreamResult(() => '')

    try {
      const token = localStorage.getItem('access_token')
      const response = await fetch('/api/ai/review/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code, language }),
      })

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      if (!reader) return

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split('\n')) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6)
          if (raw === '[DONE]') { setAgentLoading(false); return }
          try {
            const msg = JSON.parse(raw)
            if (msg.type === 'agent_result') {
              setAgentResults(prev => ({ ...prev, [msg.agent]: msg.content }))
            }
          } catch {}
        }
      }
    } catch {
      setStreamResult(() => '> ❌ **Agent 调用失败**')
    } finally {
      setAgentLoading(false)
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
        <Segmented
          value={mode}
          onChange={(v) => setMode(v as 'single' | 'multi')}
          options={[
            { value: 'single', label: '单次审查' },
            { value: 'multi', label: '多 Agent 协作' },
          ]}
        />
        <div style={{ flex: 1, minHeight: 0, marginTop: 8 }}>
          <Editor
            height="100%"
            language={language.toLowerCase()}
            value={code}
            onChange={(val) => setCode(val || '')}
            theme="vs-dark"
            options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false }}
          />
        </div>
        <Button
          type="primary"
          icon={mode === 'multi' ? <TeamOutlined /> : <ThunderboltOutlined />}
          onClick={mode === 'multi' ? handleAgentReview : handleReview}
          loading={mode === 'multi' ? agentLoading : loading}
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
          {mode === 'multi' ? (
            /* ---- 多 Agent 结果面板 ---- */
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ display: 'flex', gap: 8, padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
                {[
                  { key: 'security', label: '🔴 安全Agent', icon: '🛡' },
                  { key: 'performance', label: '🟡 性能Agent', icon: '⚡' },
                  { key: 'style', label: '🔵 规范Agent', icon: '📐' },
                ].map(a => (
                  <Button
                    key={a.key}
                    size="small"
                    type={agentTab === a.key ? 'primary' : 'default'}
                    onClick={() => setAgentTab(a.key)}
                    loading={agentLoading && !agentResults[a.key]}
                  >
                    {agentResults[a.key] && <CheckCircleOutlined style={{ marginRight: 4, color: '#52c41a' }} />}
                    {a.label}
                  </Button>
                ))}
              </div>
              <div ref={resultRef} style={{ flex: 1, overflow: 'auto', padding: '16px 24px', background: '#fefefe' }}>
                {agentResults[agentTab] ? (
                  <div className="stream-markdown-body">
                    {extractScore(agentResults[agentTab]) !== null && (
                      <div style={{
                        background: AGENT_COLORS[agentTab] || '#666',
                        color: '#fff', padding: '8px 16px', borderRadius: 6,
                        marginBottom: 16, fontWeight: 600, fontSize: 16,
                        textAlign: 'center',
                      }}>
                        {agentTab === 'security' ? '🛡 安全' : agentTab === 'performance' ? '⚡ 性能' : '📐 规范'}评分：{extractScore(agentResults[agentTab])}/100
                      </div>
                    )}
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                      {agentResults[agentTab]}
                    </ReactMarkdown>
                  </div>
                ) : agentLoading ? (
                  <div style={{ textAlign: 'center', marginTop: 80 }}>
                    <SyncOutlined spin style={{ fontSize: 36, color: '#1890ff' }} />
                    <p style={{ marginTop: 16, color: '#999' }}>Agent 正在分析中...</p>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', marginTop: 80 }}>
                    <TeamOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                    <p style={{ marginTop: 16, color: '#999', fontSize: 14 }}>
                      三个 AI Agent 将协作审查代码
                    </p>
                    <p style={{ color: '#bbb', fontSize: 12 }}>
                      安全 · 性能 · 规范 · 三位一体
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : rawResult ? (
            /* ---- 单次审查 react-markdown ---- */
            <>
              {isCached && (
                <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '6px 12px', marginBottom: 12, fontSize: 12, color: '#ad6800' }}>
                  📋 上次审查结果（切换页面已保留）
                </div>
              )}
              <div className="stream-markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={MARKDOWN_COMPONENTS}
              >
                {rawResult}
              </ReactMarkdown>
            </div>
            </>
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
