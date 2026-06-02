<template>
  <view class="container">
    <!-- 顶部操作栏 -->
    <view class="header">
      <text class="title">项目管理</text>
      <button class="btn-add" size="mini" type="primary" @click="showCreate = true">+ 新建</button>
    </view>

    <!-- 项目列表 -->
    <view v-if="projects.length > 0" class="list">
      <view v-for="item in projects" :key="item.id" class="card">
        <view class="card-header">
          <text class="card-name">{{ item.name }}</text>
          <text class="card-lang" v-if="item.language">{{ item.language }}</text>
        </view>
        <text class="card-desc" v-if="item.description">{{ item.description }}</text>
        <text class="card-desc" v-else style="color:#999">暂无描述</text>
        <view class="card-footer">
          <text class="card-status" :class="item.status">{{ item.status }}</text>
          <text class="card-time">{{ formatDate(item.created_at) }}</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty">
      <text class="empty-text">暂无项目，点击右上角新建</text>
    </view>

    <!-- 新建弹窗 -->
    <view v-if="showCreate" class="modal-mask" @click="showCreate = false">
      <view class="modal" @click.stop>
        <text class="modal-title">新建项目</text>
        <input class="input" v-model="form.name" placeholder="项目名称" />
        <input class="input" v-model="form.description" placeholder="描述（可选）" />
        <input class="input" v-model="form.repo_url" placeholder="仓库地址（可选）" />
        <input class="input" v-model="form.language" placeholder="语言，如 Python" />
        <view class="modal-btns">
          <button size="mini" @click="showCreate = false">取消</button>
          <button size="mini" type="primary" @click="handleCreate" :loading="creating">创建</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiGet, apiPost, getToken } from '../../../api/config'

interface Project {
  id: number
  name: string
  description: string | null
  language: string | null
  status: string
  created_at: string
}

const projects = ref<Project[]>([])
const showCreate = ref(false)
const creating = ref(false)
const form = ref({ name: '', description: '', repo_url: '', language: '' })

onMounted(() => {
  if (!getToken()) {
    uni.reLaunch({ url: '/pages/index/index' })
    return
  }
  fetchProjects()
})

async function fetchProjects() {
  try {
    const data = await apiGet<any[]>('/projects/')
    projects.value = data
  } catch (e) {
    uni.showToast({ title: '加载失败', icon: 'none' })
  }
}

async function handleCreate() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入项目名', icon: 'none' })
    return
  }
  creating.value = true
  try {
    await apiPost('/projects/', form.value)
    uni.showToast({ title: '创建成功', icon: 'success' })
    showCreate.value = false
    form.value = { name: '', description: '', repo_url: '', language: '' }
    fetchProjects()
  } catch (e: any) {
    uni.showToast({ title: e?.data?.detail || '创建失败', icon: 'none' })
  } finally {
    creating.value = false
  }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
.container { padding: 16px; min-height: 100vh; background: #f5f5f5; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.title { font-size: 22px; font-weight: 700; color: #1a1a2e; }
.btn-add { margin: 0; }
.list { display: flex; flex-direction: column; gap: 12px; }
.card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.card-name { font-size: 16px; font-weight: 600; color: #1a1a2e; }
.card-lang { font-size: 12px; color: #fff; background: #1677ff; padding: 2px 8px; border-radius: 10px; }
.card-desc { font-size: 13px; color: #666; margin-bottom: 8px; line-height: 1.5; }
.card-footer { display: flex; justify-content: space-between; align-items: center; }
.card-status { font-size: 11px; padding: 2px 8px; border-radius: 8px; }
.card-status.active { color: #10b981; background: #ecfdf5; }
.card-status.archived { color: #f59e0b; background: #fffbeb; }
.card-time { font-size: 11px; color: #999; }
.empty { text-align: center; padding: 80px 0; }
.empty-text { color: #999; font-size: 14px; }
.modal-mask { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 999; }
.modal { background: #fff; border-radius: 16px; padding: 24px; width: 85vw; max-width: 360px; }
.modal-title { font-size: 18px; font-weight: 700; margin-bottom: 16px; display: block; }
.input { border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; font-size: 14px; width: 100%; box-sizing: border-box; }
.modal-btns { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
</style>
