/**
 * CI/CD 实时监控大屏 — SSE 流式推送 + GitHub Actions 真实数据
 */
import { useState, useEffect, useRef } from 'react'
import { Card, Tag, Table, Typography, Spin, Empty, Statistic, message, Badge } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, ClockCircleOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'

const { Title, Text } = Typography

interface BuildRecord {
  id: number
  name: string
  status: 'success' | 'failure' | 'running' | 'pending'
  branch: string
  duration: string
  commit: string
  time: string
  stages: { name: string; status: string; duration: string }[]
}

interface CiData {
  success_rate: number
  avg_duration: string
  total_runs: number
  builds: BuildRecord[]
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success': return <CheckCircleOutlined style={{ color: '#52c41a' }} />
    case 'failure': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
    case 'running': return <SyncOutlined spin style={{ color: '#1890ff' }} />
    default: return <ClockCircleOutlined style={{ color: '#d9d9d9' }} />
  }
}

function getStatusTag(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    success: { color: 'success', label: '通过' },
    failure: { color: 'error', label: '失败' },
    running: { color: 'processing', label: '运行中' },
    pending: { color: 'default', label: '等待' },
  }
  const cfg = map[status] || map.pending
  return <Tag color={cfg.color}>{cfg.label}</Tag>
}

function successChartOption(rate: number) {
  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 20, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: ['#1', '#2', '#3', '#4', '#5'] },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      data: [rate, rate, rate, rate, rate], type: 'line', smooth: true,
      lineStyle: { color: '#1890ff', width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(24,144,255,0.3)' }, { offset: 1, color: 'rgba(24,144,255,0.02)' }] } },
      markLine: { silent: true, data: [{ yAxis: rate, lineStyle: { color: '#52c41a', type: 'dashed' } }] },
    }],
  }
}

function durationChartOption(builds: BuildRecord[]) {
  const jobs = ['Lint', 'TypeCheck', 'Test', 'Build', 'Deploy'];
  const durations = jobs.map(job =>
    Math.round(builds.reduce((sum, b) => {
      const s = b.stages.find(st => st.name.includes(job))
      if (s && s.duration !== '-') { const m = s.duration.match(/(\d+)/); return sum + (m ? parseInt(m[1]) : 0) }
      return sum
    }, 0) / Math.max(builds.length, 1))
  )
  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 20, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: jobs },
    yAxis: { type: 'value', name: '秒' },
    series: [{ data: durations.map(d => d || 5), type: 'bar', itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#1890ff' }, { offset: 1, color: '#69c0ff' }] }, borderRadius: [4, 4, 0, 0] } }],
  }
}

export default function CICDMonitor() {
  const [data, setData] = useState<CiData | null>(null)
  const [connected, setConnected] = useState(false)
  const [eventTip, setEventTip] = useState('')
  const eventRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource(`/api/ci/stream?token=${encodeURIComponent(token!)}`)
      setConnected(true)

      es.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data)
          if (msg.type === 'full') {
            // 全量数据更新
            setData({
              success_rate: msg.success_rate,
              avg_duration: msg.avg_duration,
              total_runs: msg.total_runs,
              builds: msg.builds,
            })
          } else if (msg.type === 'workflow_job') {
            // 单个 Job 状态变更 → 闪烁提示 + 拉全量数据
            const statusMap: Record<string, string> = {
              completed: msg.conclusion === 'success' ? '✅ 通过' : '❌ 失败',
              in_progress: '🔄 执行中',
              queued: '⏳ 排队中',
            }
            setEventTip(`${msg.job_name}: ${statusMap[msg.status] || msg.status}`)
            if (eventRef.current) clearTimeout(eventRef.current)
            eventRef.current = setTimeout(() => setEventTip(''), 4000)

            // 触发全量刷新（短轮询兜底）
            setTimeout(() => refreshData(), 500)
          } else if (msg.type === 'workflow_run') {
            setEventTip(`Workflow #${msg.run_number}: ${msg.action}`)
            if (eventRef.current) clearTimeout(eventRef.current)
            eventRef.current = setTimeout(() => setEventTip(''), 4000)
            setTimeout(() => refreshData(), 500)
          }
        } catch {}
      }

      es.onerror = () => {
        setConnected(false)
        es?.close()
        reconnectTimer = setTimeout(connect, 3000)  // 断开 3s 后重连
      }
    }

    connect()

    return () => {
      es?.close()
      clearTimeout(reconnectTimer)
      if (eventRef.current) clearTimeout(eventRef.current)
    }
  }, [])

  const refreshData = async () => {
    try {
      const res = await fetch('/api/ci/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      })
      if (res.ok) setData(await res.json())
    } catch {}
  }

  if (!data) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />

  const columns = [
    { title: '构建', dataIndex: 'name', width: 120, render: (_: any, r: BuildRecord) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { title: '分支', dataIndex: 'branch', width: 100, render: (v: string) => <Tag>{v}</Tag> },
    { title: '提交', dataIndex: 'commit', width: 90, render: (v: string) => v ? <code style={{ fontSize: 12, background: '#f5f5f5', padding: '1px 6px', borderRadius: 3 }}>{v}</code> : '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => getStatusTag(v) },
    { title: 'Jobs', key: 'pipeline', width: 280, render: (_: any, r: BuildRecord) => r.stages.length > 0 ? (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {r.stages.map((s, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center' }}>
            {getStatusIcon(s.status)}
            <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{s.name.slice(0, 8)}</div>
          </div>
        ))}
      </div>) : <Text type="secondary">-</Text> },
    { title: '耗时', dataIndex: 'duration', width: 90 },
    { title: '时间', dataIndex: 'time', width: 80 },
  ]

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <Badge status={connected ? 'success' : 'error'} />
        <SyncOutlined spin={connected} style={{ margin: '0 8px', color: connected ? '#52c41a' : '#ff4d4f' }} />
        CI/CD 实时监控
        <Text type="secondary" style={{ fontSize: 13, marginLeft: 12, fontWeight: 400 }}>
          {connected ? '🟢 SSE 实时连接' : '🔴 连接断开 · 重连中'}
        </Text>
        {eventTip && (
          <Tag color="blue" style={{ marginLeft: 12 }}>{eventTip}</Tag>
        )}
      </Title>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card size="small"><Statistic title="成功率" value={data.success_rate} suffix="%" valueStyle={{ color: data.success_rate >= 90 ? '#52c41a' : '#faad14' }} /></Card>
        <Card size="small"><Statistic title="平均耗时" value={data.avg_duration} /></Card>
        <Card size="small"><Statistic title="总构建" value={data.total_runs} suffix="次" /></Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> 成功率</>} size="small">
          <ReactECharts option={successChartOption(data.success_rate)} style={{ height: 240 }} />
        </Card>
        <Card title="⏱️ 各 Job 平均耗时" size="small">
          <ReactECharts option={durationChartOption(data.builds)} style={{ height: 240 }} />
        </Card>
      </div>

      <Card title={`📋 最近构建 (${data.builds.length})`} size="small">
        <Table rowKey="id" columns={columns} dataSource={data.builds} pagination={false} size="small"
          locale={{ emptyText: <Empty description="暂无构建记录" /> }} />
      </Card>
    </div>
  )
}
