<template>
  <view class="container">
    <view v-if="reviews.length" class="list">
      <view v-for="item in reviews" :key="item.id" class="list-item">
        <text class="item-title">{{ item.pr_title }}</text>
        <view class="item-meta">
          <text class="meta-text">{{ item.files_changed ?? '-' }} 文件</text>
          <text :class="['status', item.status]">{{ statusLabel(item.status) }}</text>
        </view>
        <!-- 审批按钮：仅已完成状态的审查可操作 -->
        <view class="actions" v-if="item.status === 'completed'">
          <button size="mini" type="primary" @click="handleApprove(item.id)">批准</button>
          <button size="mini" type="warn" @click="handleReject(item.id)">拒绝</button>
        </view>
        <view class="actions" v-else-if="item.status === 'approved'">
          <text class="approved-tag">✅ 已批准</text>
        </view>
        <view class="actions" v-else-if="item.status === 'rejected'">
          <text class="rejected-tag">❌ 已拒绝</text>
        </view>
      </view>
    </view>
    <view v-else class="empty">暂无审查记录</view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiPut, getToken } from '../../../api/config'

const reviews = ref<any[]>([])

onMounted(async () => {
  const token = getToken()
  if (!token) return
  try {
    reviews.value = await apiGet<any[]>('/reviews/')
  } catch {}
})

function statusLabel(s: string) {
  const map: Record<string, string> = {
    pending: '待审查', reviewing: '分析中', completed: '已完成',
    approved: '已通过', rejected: '已拒绝',
  }
  return map[s] || s
}

async function handleApprove(id: number) {
  try {
    await apiPut(`/reviews/${id}`, { status: 'approved' })
    uni.showToast({ title: '已批准', icon: 'success' })
    reviews.value = await apiGet<any[]>('/reviews/')
  } catch { uni.showToast({ title: '操作失败', icon: 'none' }) }
}

async function handleReject(id: number) {
  try {
    await apiPut(`/reviews/${id}`, { status: 'rejected' })
    uni.showToast({ title: '已拒绝', icon: 'none' })
    reviews.value = await apiGet<any[]>('/reviews/')
  } catch { uni.showToast({ title: '操作失败', icon: 'none' }) }
}
</script>

<style scoped>
.container { padding: 16px; }
.list { background: #fff; border-radius: 10px; }
.list-item { padding: 14px 16px; border-bottom: 1px solid #f0f0f0; }
.item-title { font-size: 15px; font-weight: 500; display: block; }
.item-meta { display: flex; justify-content: space-between; margin-top: 6px; }
.meta-text { font-size: 13px; color: #999; }
.status { font-size: 12px; }
.status.pending { color: #fa8c16; }
.status.completed, .status.approved { color: #52c41a; }
.status.rejected { color: #ff4d4f; }
.empty { text-align: center; color: #999; padding: 40px; font-size: 14px; }
.actions { margin-top: 8px; display: flex; gap: 8px; }
.approved-tag { font-size: 13px; color: #52c41a; }
.rejected-tag { font-size: 13px; color: #ff4d4f; }
</style>
