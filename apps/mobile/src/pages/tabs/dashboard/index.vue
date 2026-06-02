<template>
  <view class="container">
    <view class="cards">
      <view class="card"><text class="card-num">{{ stats.projects }}</text><text class="card-label">项目</text></view>
      <view class="card"><text class="card-num" style="color:#722ed1">{{ stats.reviews }}</text><text class="card-label">审查</text></view>
      <view class="card"><text class="card-num" style="color:#52c41a">{{ stats.completed }}</text><text class="card-label">完成</text></view>
      <view class="card"><text class="card-num" style="color:#fa8c16">{{ stats.pending }}</text><text class="card-label">待处理</text></view>
    </view>
    <view class="quick-actions">
      <view class="action-btn" @click="goRag">
        <text class="action-icon">📚</text>
        <text class="action-text">知识库问答</text>
        <text class="action-sub">AI 检索 · 语义搜索</text>
      </view>
    </view>
    <view class="section">
      <text class="section-title">最近审查</text>
      <view v-if="recent.length" class="list">
        <view v-for="item in recent" :key="item.id" class="list-item">
          <text class="item-title">{{ item.pr_title }}</text>
          <text :class="['status', item.status]">{{ item.status }}</text>
        </view>
      </view>
      <view v-else class="empty">暂无数据</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, getToken } from '../../../api/config'

const stats = ref({ projects: 0, reviews: 0, completed: 0, pending: 0 })
const recent = ref<any[]>([])

onMounted(async () => {
  const token = getToken()
  if (!token) {
    uni.redirectTo({ url: '/pages/index/index' })
    return
  }
  try {
    const [p, r] = await Promise.all([
      apiGet<any[]>('/projects/'),
      apiGet<any[]>('/reviews/'),
    ])
    stats.value.projects = p.length
    stats.value.reviews = r.length
    stats.value.completed = r.filter((x: any) => x.status === 'completed' || x.status === 'approved').length
    stats.value.pending = r.filter((x: any) => x.status === 'pending').length
    recent.value = r.slice(0, 5)
  } catch {}
})

function goRag() {
  uni.navigateTo({ url: '/pages/rag/index' })
}
</script>

<style scoped>
.container { padding: 16px; }
.cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
.card { flex: 1 1 45%; background: #fff; border-radius: 10px; padding: 16px; text-align: center; }
.card-num { font-size: 28px; font-weight: bold; color: #1677ff; }
.card-label { display: block; font-size: 13px; color: #999; margin-top: 4px; }
.section { background: #fff; border-radius: 10px; padding: 16px; }
.section-title { font-size: 16px; font-weight: bold; margin-bottom: 12px; display: block; }
.list-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
.item-title { font-size: 14px; flex: 1; }
.status { font-size: 12px; }
.status.pending { color: #fa8c16; }
.status.completed, .status.approved { color: #52c41a; }
.empty { text-align: center; color: #999; padding: 20px; font-size: 14px; }
.quick-actions { margin-bottom: 16px; }
.action-btn {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 12px; padding: 16px; display: flex;
  flex-direction: column; align-items: center;
}
.action-icon { font-size: 28px; }
.action-text { font-size: 15px; font-weight: 600; color: #fff; margin-top: 4px; }
.action-sub { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 2px; }
</style>
