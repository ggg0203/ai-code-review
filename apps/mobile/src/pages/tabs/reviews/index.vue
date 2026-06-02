<template>
  <view class="container">
    <view v-if="reviews.length" class="list">
      <view v-for="item in reviews" :key="item.id" class="list-item">
        <text class="item-title">{{ item.pr_title }}</text>
        <view class="item-meta">
          <text class="meta-text">{{ item.files_changed ?? '-' }} 文件</text>
          <text :class="['status', item.status]">{{ item.status }}</text>
        </view>
      </view>
    </view>
    <view v-else class="empty">暂无审查记录</view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, getToken } from '../../../api/config'

const reviews = ref<any[]>([])

onMounted(async () => {
  const token = getToken()
  if (!token) return
  try {
    reviews.value = await apiGet<any[]>('/reviews/')
  } catch {}
})
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
</style>
