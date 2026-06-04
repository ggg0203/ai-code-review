<template>
  <view class="container">
    <text class="title">AI 代码审查</text>

    <!-- 语言选择 + 代码输入 -->
    <view class="select-row">
      <picker :value="langIndex" :range="languages" @change="onLangChange">
        <view class="picker">{{ languages[langIndex] }}</view>
      </picker>
    </view>

    <textarea
      class="code-input"
      v-model="code"
      placeholder="粘贴待审查的代码..."
      :disabled="reviewing"
      maxlength="-1"
    />

    <!-- 审查按钮 -->
    <button
      type="primary"
      :loading="reviewing"
      :disabled="!code.trim()"
      @click="handleReview"
      class="btn-review"
    >
      {{ reviewing ? 'AI 分析中...' : '开始 AI 审查' }}
    </button>

    <!-- 审查结果 -->
    <view v-if="result" class="result-box">
      <text class="result-label">审查结果</text>
      <view class="result-content">
        <text class="result-text" space="nbsp">{{ result }}</text>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="!result && !reviewing" class="empty">
      <text class="empty-text">输入代码后点击审查，AI 将逐字输出分析结果</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { API_BASE, getToken } from '../../../api/config'

const languages = ['Python', 'JavaScript', 'TypeScript', 'Java', 'Go', 'Rust', 'C++', 'Vue SFC', 'React JSX', 'React TSX']
const langIndex = ref(0)
const code = ref('')
const reviewing = ref(false)
const result = ref('')

onMounted(() => {
  if (!getToken()) {
    uni.reLaunch({ url: '/pages/index/index' })
  }
})

function onLangChange(e: any) {
  langIndex.value = e.detail.value
}

async function handleReview() {
  if (!code.value.trim()) return
  reviewing.value = true
  result.value = ''

  const token = getToken()
  const body = JSON.stringify({ code: code.value, language: languages[langIndex.value] })

  // #ifdef H5
  // H5 端：原生 fetch + ReadableStream 真流式 SSE
  try {
    const response = await fetch(`${API_BASE}/ai/review/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body,
    })

    if (!response.ok) {
      result.value = `[请求失败: ${response.status}]`
      reviewing.value = false
      return
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()
    if (!reader) { reviewing.value = false; return }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const text = decoder.decode(value, { stream: true })
      const lines = text.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') {
          uni.showToast({ title: '分析完成', icon: 'success' })
          return
        }
        if (data.startsWith('[ERROR]')) {
          result.value += '\n[错误] ' + data.slice(8)
          return
        }
        try {
          result.value += JSON.parse(data)
        } catch {
          result.value += data
        }
      }
    }
  } catch (e) {
    result.value += '\n[网络错误]'
  } finally {
    reviewing.value = false
  }
  // #endif

  // #ifndef H5
  // 非 H5 端：一次性请求返回结果（SSE 兼容性限制）
  try {
    const resp = await uni.request({
      url: `${API_BASE}/ai/review/stream`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      data: { code: code.value, language: languages[langIndex.value] },
      responseType: 'text',
    })
    // 收集所有 SSE 事件
    const raw = (resp.data as string) || ''
    const lines = raw.split('\n')
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue
      if (data.startsWith('[ERROR]')) { result.value += '\n[错误] ' + data.slice(8); continue }
      try {
        result.value += JSON.parse(data)
      } catch {
        result.value += data
      }
    }
    uni.showToast({ title: '分析完成', icon: 'success' })
  } catch (e) {
    result.value += '\n[请求失败]'
  } finally {
    reviewing.value = false
  }
  // #endif
}
</script>

<style scoped>
.container { padding: 16px; min-height: 100vh; background: #f5f5f5; }
.title { font-size: 22px; font-weight: 700; color: #1a1a2e; display: block; margin-bottom: 16px; }
.select-row { margin-bottom: 12px; }
.picker { padding: 10px 14px; background: #fff; border-radius: 8px; border: 1px solid #e0e0e0; font-size: 14px; color: #333; }
.code-input {
  width: 100%; min-height: 180px; padding: 12px; font-size: 13px;
  font-family: monospace; background: #1e1e1e; color: #d4d4d4;
  border: none; border-radius: 8px; box-sizing: border-box; line-height: 1.6;
}
.btn-review { margin-top: 12px; width: 100%; }
.result-box { margin-top: 16px; background: #fff; border-radius: 12px; padding: 16px; }
.result-label { font-size: 14px; font-weight: 600; color: #1677ff; display: block; margin-bottom: 8px; }
.result-content { max-height: 60vh; overflow-y: auto; }
.result-text { font-size: 13px; line-height: 1.8; color: #333; white-space: pre-wrap; word-break: break-word; }
.empty { text-align: center; padding: 60px 0; }
.empty-text { color: #999; font-size: 14px; }
</style>
