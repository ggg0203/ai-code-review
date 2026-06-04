/**
 * CI/CD 实时监控大屏 — 短轮询 GitHub Actions 真实数据
 */
import { useState, useEffect, useCallback } from 'react'
import { Card, Tag, Table, Typography, Spin, Empty, Statistic, Button, Space, Result } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import client from '../api/client'

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
  const jobs = ['Lint', 'TypeCheck', 'Test', 'Build', 'Deploy']
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pollFailCount, setPollFailCount] = useState(0)

  const fetchData = useCallback(async () => {
    try {
      const res = await client.get('/ci/status')
      setData(res.data)
      setError(null)
      setPollFailCount(0)
    } catch (err: any) {
      // 打印完整错误到控制台方便排查
      console.error('[CICD] 请求失败:', {
        message: err?.message,
        code: err?.code,
        status: err?.response?.status,
        data: err?.response?.data,
        config: err?.config?.url,
      })

      const status = err?.response?.status
      const detail = err?.response?.data?.detail || err?.message || '未知错误'
      if (status === 401) {
        setError('登录已过期，请重新登录 (Token 无效)')
      } else if (status === 500) {
        setError(`服务器错误: ${detail}`)
      } else if (err?.code === 'ECONNABORTED') {
        setError('请求超时，请检查网络或后端负载')
      } else if (!err?.response) {
        setError(`无法连接到后端 (${err?.code || 'NET_ERR'}): ${err?.message || '请确认 localhost:8000 已启动'}`)
      } else {
        setError(`请求失败 (${status}): ${detail}`)
      }
      setPollFailCount(c => c + 1)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // 3 秒短轮询，但连续失败 5 次后停止
  useEffect(() => {
    if (pollFailCount >= 5) return
    const timer = setInterval(fetchData, 3000)
    return () => clearInterval(timer)
  }, [fetchData, pollFailCount])

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />

  if (error) return (
    <div style={{ maxWidth: 500, margin: '100px auto', textAlign: 'center' }}>
      <Result
        status="warning"
        title="CI/CD 数据获取失败"
        subTitle={error}
        extra={
          <Space>
            {pollFailCount < 5 && (
              <Button type="primary" onClick={() => { setPollFailCount(0); fetchData(); }}>
                🔄 立即重试
              </Button>
            )}
            {pollFailCount >= 5 && (
              <Button type="primary" onClick={() => { setPollFailCount(0); setLoading(true); fetchData(); }}>
                <ReloadOutlined /> 重新连接
              </Button>
            )}
          </Space>
        }
      />
      {pollFailCount >= 5 && (
        <Typography.Text type="secondary">
          连续 {pollFailCount} 次失败，已停止自动轮询。检查后端是否启动、Token 是否有效，然后点击重新连接。
        </Typography.Text>
      )}
    </div>
  )

  if (!data) return <Empty description="暂无 CI 数据" style={{ marginTop: 200 }} />

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
        <SyncOutlined spin style={{ marginRight: 8, color: '#1890ff' }} />
        CI/CD 实时监控
        <Text type="secondary" style={{ fontSize: 13, marginLeft: 12, fontWeight: 400 }}>
          GitHub Actions · 3s 实时轮询
        </Text>
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
