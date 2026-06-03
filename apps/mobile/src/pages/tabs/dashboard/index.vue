<template>
  <view class="container">
    <!-- 头部问候 -->
    <view class="hero">
      <view class="hero-greeting">
        <text class="hero-title">Hi, {{ username }} 👋</text>
        <text class="hero-sub">今日代码质量概览</text>
      </view>
      <view class="hero-avatar">{{ avatar }}</view>
    </view>

    <!-- 统计卡片 -->
    <view class="stat-grid">
      <view class="stat-card">
        <view class="stat-icon" style="background: #e6f7ff">📁</view>
        <text class="stat-num" style="color: #1677ff">{{ stats.projects }}</text>
        <text class="stat-label">项目</text>
      </view>
      <view class="stat-card">
        <view class="stat-icon" style="background: #f9f0ff">📋</view>
        <text class="stat-num" style="color: #722ed1">{{ stats.reviews }}</text>
        <text class="stat-label">审查</text>
      </view>
      <view class="stat-card">
        <view class="stat-icon" style="background: #f6ffed">✅</view>
        <text class="stat-num" style="color: #52c41a">{{ stats.completed }}</text>
        <text class="stat-label">完成</text>
      </view>
      <view class="stat-card">
        <view class="stat-icon" style="background: #fff7e6">⏳</view>
        <text class="stat-num" style="color: #fa8c16">{{ stats.pending }}</text>
        <text class="stat-label">待处理</text>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="quick-section">
      <text class="section-title">快捷入口</text>
      <view class="quick-grid">
        <view class="quick-item" @click="goRag">
          <text class="quick-icon">📚</text>
          <text class="quick-text">RAG 问答</text>
        </view>
        <view class="quick-item" @click="switchTab('ai-review')">
          <text class="quick-icon">🤖</text>
          <text class="quick-text">AI 审查</text>
        </view>
        <view class="quick-item" @click="switchTab('reviews')">
          <text class="quick-icon">📝</text>
          <text class="quick-text">审查列表</text>
        </view>
        <view class="quick-item" @click="switchTab('projects')">
          <text class="quick-icon">🗂</text>
          <text class="quick-text">项目</text>
        </view>
      </view>
    </view>

    <!-- 最近审查 -->
    <view class="recent-section">
      <text class="section-title">最近审查</text>
      <view v-if="recent.length" class="recent-list">
        <view v-for="item in recent" :key="item.id" class="recent-item">
          <view class="recent-left">
            <text class="recent-title">{{ item.pr_title }}</text>
            <text class="recent-meta">{{ item.files_changed || 0 }} 个文件</text>
          </view>
          <view :class="['recent-status', item.status]">{{ statusLabel(item.status) }}</view>
        </view>
      </view>
      <view v-else class="empty-state">
        <text class="empty-icon">📭</text>
        <text class="empty-text">暂无审查记录</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet } from '../../../api/config'

const username = ref(uni.getStorageSync('username') || '用户')
const avatar = ref((uni.getStorageSync('username') || '用')[0])

const stats = ref({ projects: 0, reviews: 0, completed: 0, pending: 0 })
const recent = ref<any[]>([])

onMounted(async () => {
  try {
    const [p, r] = await Promise.all([apiGet<any[]>('/projects/'), apiGet<any[]>('/reviews/')])
    stats.value.projects = p.length
    stats.value.reviews = r.length
    stats.value.completed = r.filter((x: any) => x.status === 'completed' || x.status === 'approved').length
    stats.value.pending = r.filter((x: any) => x.status === 'pending').length
    recent.value = r.slice(0, 4)
  } catch {}
})

function statusLabel(s: string) {
  const map: Record<string, string> = { pending: '待审查', reviewing: '分析中', completed: '已完成', approved: '已通过', rejected: '已拒绝' }
  return map[s] || s
}

function switchTab(key: string) {
  uni.switchTab({ url: `/pages/tabs/${key}/index` })
}

function goRag() {
  uni.navigateTo({ url: '/pages/rag/index' })
}
</script>

<style scoped>
.container { padding: 20px 16px; background: #f5f6fa; min-height: 100vh; }
.hero { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 0 4px; }
.hero-title { font-size: 22px; font-weight: 800; color: #1a1a2e; display: block; }
.hero-sub { font-size: 13px; color: #888; margin-top: 4px; display: block; }
.hero-avatar {
  width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff; font-size: 18px; font-weight: 700; display: flex; align-items: center; justify-content: center;
}

.stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 24px; }
.stat-card {
  background: #fff; border-radius: 14px; padding: 14px 8px; text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.stat-icon { width: 32px; height: 32px; border-radius: 10px; margin: 0 auto 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
.stat-num { font-size: 22px; font-weight: 800; display: block; }
.stat-label { font-size: 11px; color: #999; margin-top: 2px; display: block; }

.quick-section { margin-bottom: 24px; }
.section-title { font-size: 16px; font-weight: 700; color: #1a1a2e; margin-bottom: 12px; display: block; }
.quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
.quick-item {
  background: #fff; border-radius: 14px; padding: 16px 8px; text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.quick-icon { font-size: 24px; display: block; margin-bottom: 6px; }
.quick-text { font-size: 12px; color: #555; font-weight: 500; }

.recent-section { margin-bottom: 24px; }
.recent-list { background: #fff; border-radius: 14px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
.recent-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; border-bottom: 1px solid #f5f5f5; }
.recent-item:last-child { border-bottom: none; }
.recent-left { flex: 1; min-width: 0; }
.recent-title { font-size: 14px; font-weight: 500; color: #333; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-meta { font-size: 11px; color: #aaa; margin-top: 4px; display: block; }
.recent-status { font-size: 12px; padding: 4px 10px; border-radius: 10px; font-weight: 500; flex-shrink: 0; margin-left: 10px; }
.recent-status.pending { background: #fff7e6; color: #fa8c16; }
.recent-status.reviewing { background: #e6f7ff; color: #1677ff; }
.recent-status.completed { background: #f6ffed; color: #52c41a; }
.recent-status.approved { background: #f6ffed; color: #52c41a; }
.recent-status.rejected { background: #fff1f0; color: #ff4d4f; }

.empty-state { background: #fff; border-radius: 14px; padding: 40px; text-align: center; }
.empty-icon { font-size: 36px; display: block; margin-bottom: 8px; }
.empty-text { font-size: 14px; color: #bbb; display: block; }
</style>
