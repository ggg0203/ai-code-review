/**
 * CI/CD 实时监控大屏 — 构建状态 + 成功率趋势 + 流水线可视化
 */
import { useState, useEffect, useCallback } from 'react'
import { Card, Tag, Table, Typography, Spin, Empty, Statistic } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined, ClockCircleOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'

const { Title, Text } = Typography

// ---- 模拟 CI/CD 数据生成器 --------------------------------------------------
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

function generateBuildData(): { builds: BuildRecord[]; successRate: number; avgDuration: string } {
  const buildCount = 12 + Math.floor(Math.random() * 5)
  const builds: BuildRecord[] = []
  let successes = 0
  const stageNames = ['Lint', 'Type Check', 'Unit Test', 'Build', 'Deploy']

  for (let i = 0; i < buildCount; i++) {
    const status = Math.random() > 0.15 ? 'success' : (Math.random() > 0.5 ? 'failure' : 'running')
    if (status === 'success') successes++

    const commitHashes = ['a3f8b2c', '7d1e9f4', 'c2b6a0d', 'f9e3c7a', '1b5d8e2', '4a7c0f9']
    const minutes = 2 + Math.floor(Math.random() * 8)
    const seconds = Math.floor(Math.random() * 60)

    const stages = stageNames.map((name, si) => {
      let stageStatus = 'success'
      const stageDuration = `${Math.floor(Math.random() * 45) + 5}s`
      if (status === 'failure' && si >= 3) stageStatus = 'failure'
      if (status === 'running' && si === 4) stageStatus = 'running'
      if (status === 'running' && si > 4) return { name, status: 'pending', duration: '-' }
      if (status === 'pending' && si > 0) return { name, status: 'pending', duration: '-' }
      return { name, status: stageStatus, duration: stageDuration }
    })

    const now = new Date()
    now.setMinutes(now.getMinutes() - i * 45)

    builds.push({
      id: 300 + buildCount - i,
      name: `CI #${300 + buildCount - i}`,
      status: status as BuildRecord['status'],
      branch: i === 0 ? 'main' : ['main', 'feat/rag', 'fix/auth', 'chore/deps'][i % 4],
      duration: status === 'running' ? '进行中...' : `${minutes}m ${seconds}s`,
      commit: commitHashes[i % commitHashes.length],
      time: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      stages,
    })
  }

  return {
    builds,
    successRate: Math.round((successes / buildCount) * 100),
    avgDuration: `${2 + Math.floor(Math.random() * 5)}m ${Math.floor(Math.random() * 60)}s`,
  }
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

// ---- 成功趋势图配置 --------------------------------------------------------
function successRateChartOption(rate: number) {
  const days = ['6/1', '6/2', '6/3', '6/4', '6/5', '6/6', '6/7']
  const rates = days.map(() => 75 + Math.floor(Math.random() * 25))
  rates[rates.length - 1] = rate
  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 20, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: days, axisLine: { lineStyle: { color: '#ccc' } } },
    yAxis: { type: 'value', min: 60, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      data: rates, type: 'line', smooth: true,
      lineStyle: { color: '#1890ff', width: 2 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: 'rgba(24,144,255,0.3)' }, { offset: 1, color: 'rgba(24,144,255,0.02)' }] } },
      itemStyle: { color: '#1890ff' },
      markLine: { silent: true, data: [{ yAxis: 90, lineStyle: { color: '#52c41a', type: 'dashed' } }] },
    }],
  }
}

// ---- 构建时长分布 ----------------------------------------------------------
function durationChartOption() {
  const jobs = ['Lint', 'TypeCheck', 'Test', 'Build', 'Deploy']
  return {
    tooltip: { trigger: 'axis' },
    grid: { top: 20, right: 20, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: jobs },
    yAxis: { type: 'value', name: '秒' },
    series: [{
      data: [12, 28, 45, 58, 42], type: 'bar',
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#1890ff' }, { offset: 1, color: '#69c0ff' }] },
        borderRadius: [4, 4, 0, 0],
      },
    }],
  }
}

export default function CICDMonitor() {
  const [data, setData] = useState<ReturnType<typeof generateBuildData> | null>(null)
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setData(generateBuildData()), [])

  useEffect(() => { refresh() }, [tick])

  // 自动刷新：每 8 秒更新
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 8000)
    return () => clearInterval(timer)
  }, [])

  if (!data) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />

  const columns = [
    { title: '构建', dataIndex: 'name', width: 100,
      render: (_: any, r: BuildRecord) => <span style={{ fontWeight: 500 }}>{r.name}</span> },
    { title: '分支', dataIndex: 'branch', width: 100,
      render: (v: string) => <Tag>{v}</Tag> },
    { title: '提交', dataIndex: 'commit', width: 90,
      render: (v: string) => <code style={{ fontSize: 12, background: '#f5f5f5', padding: '1px 6px', borderRadius: 3 }}>{v}</code> },
    { title: '状态', dataIndex: 'status', width: 90,
      render: (v: string) => getStatusTag(v) },
    {
      title: '流水线', key: 'pipeline', width: 280,
      render: (_: any, r: BuildRecord) => (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {r.stages.map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              {getStatusIcon(s.status)}
              <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{s.name}</div>
            </div>
          ))}
        </div>
      ),
    },
    { title: '耗时', dataIndex: 'duration', width: 90 },
    { title: '时间', dataIndex: 'time', width: 70 },
  ]

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 24 }}>
        <SyncOutlined spin style={{ marginRight: 8, color: '#1890ff' }} />
        CI/CD 实时监控
        <Text type="secondary" style={{ fontSize: 13, marginLeft: 12, fontWeight: 400 }}>
          自动刷新 · 每 8 秒
        </Text>
      </Title>

      {/* ---- 统计卡片 ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <Card size="small">
          <Statistic title="成功率" value={data.successRate} suffix="%" valueStyle={{ color: data.successRate >= 90 ? '#52c41a' : '#faad14' }} />
        </Card>
        <Card size="small">
          <Statistic title="平均构建时长" value={data.avgDuration} />
        </Card>
        <Card size="small">
          <Statistic title="最近构建" value={data.builds.length} suffix="次" />
        </Card>
      </div>

      {/* ---- 图表区 ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card title={<><CheckCircleOutlined style={{ color: '#52c41a' }} /> 成功率趋势（近7天）</>} size="small">
          <ReactECharts option={successRateChartOption(data.successRate)} style={{ height: 240 }} />
        </Card>
        <Card title="⏱️ 各阶段平均耗时" size="small">
          <ReactECharts option={durationChartOption()} style={{ height: 240 }} />
        </Card>
      </div>

      {/* ---- 构建历史列表 ---- */}
      <Card title="📋 构建历史" size="small">
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data.builds}
          pagination={false}
          size="small"
          locale={{ emptyText: <Empty description="暂无构建记录" /> }}
        />
      </Card>
    </div>
  )
}
