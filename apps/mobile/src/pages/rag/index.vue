<template>
  <view class="container">
    <text class="title">知识库问答</text>

    <!-- 输入问题 -->
    <textarea
      class="question-input"
      v-model="question"
      placeholder="输入问题，AI 将从知识库中检索相关内容并回答..."
    />

    <button type="primary" :loading="asking" :disabled="!question.trim()" @click="handleAsk" class="btn-ask">
      {{ asking ? '搜索中...' : '搜索知识库' }}
    </button>

    <!-- 回答 -->
    <view v-if="answer" class="answer-box">
      <text class="answer-label">AI 回答</text>
      <view class="answer-content">
        <text class="answer-text" space="nbsp">{{ answer }}</text>
      </view>
    </view>

    <!-- 分割线 -->
    <view class="divider" />

    <!-- 添加知识 -->
    <text class="sub-title">添加知识到知识库</text>
    <textarea
      class="code-input"
      v-model="knowledgeCode"
      placeholder="粘贴代码或文档内容，将向量化后存入 Qdrant..."
    />
    <input class="input" v-model="knowledgeProject" placeholder="所属项目（可选）" />
    <button type="default" :loading="adding" @click="handleAdd" class="btn-add">
      {{ adding ? '入库中...' : '添加到知识库' }}
    </button>

    <!-- 提示 -->
    <text class="tip">文本将转为 1536 维向量存入 Qdrant，支持语义相似度搜索</text>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { apiPost, getToken } from '../../api/config'

const question = ref('')
const asking = ref(false)
const answer = ref('')
const knowledgeCode = ref('')
const knowledgeProject = ref('')
const adding = ref(false)

onMounted(() => {
  if (!getToken()) {
    uni.reLaunch({ url: '/pages/index/index' })
  }
})

async function handleAsk() {
  if (!question.value.trim()) return
  asking.value = true
  answer.value = ''
  try {
    const resp: any = await apiPost('/rag/ask', { question: question.value, top_k: 3 })
    answer.value = resp.answer || '知识库中暂无相关内容'
  } catch (e: any) {
    uni.showToast({ title: e?.data?.detail || '问答失败', icon: 'none' })
  } finally {
    asking.value = false
  }
}

async function handleAdd() {
  if (!knowledgeCode.value.trim()) {
    uni.showToast({ title: '请输入内容', icon: 'none' })
    return
  }
  adding.value = true
  try {
    await apiPost('/rag/add', { text: knowledgeCode.value, project_name: knowledgeProject.value })
    uni.showToast({ title: '已添加到知识库', icon: 'success' })
    knowledgeCode.value = ''
    knowledgeProject.value = ''
  } catch (e: any) {
    uni.showToast({ title: e?.data?.detail || '入库失败', icon: 'none' })
  } finally {
    adding.value = false
  }
}
</script>

<style scoped>
.container { padding: 16px; min-height: 100vh; background: #f5f5f5; }
.title { font-size: 22px; font-weight: 700; color: #1a1a2e; display: block; margin-bottom: 16px; }
.question-input {
  width: 100%; min-height: 100px; padding: 12px; font-size: 14px;
  background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;
  box-sizing: border-box; line-height: 1.6;
}
.btn-ask { margin-top: 10px; width: 100%; }
.answer-box { margin-top: 16px; background: #fff; border-radius: 12px; padding: 16px; }
.answer-label { font-size: 14px; font-weight: 600; color: #1677ff; display: block; margin-bottom: 8px; }
.answer-content { max-height: 40vh; overflow-y: auto; }
.answer-text { font-size: 13px; line-height: 1.8; color: #333; white-space: pre-wrap; }
.divider { height: 1px; background: #e0e0e0; margin: 24px 0; }
.sub-title { font-size: 17px; font-weight: 600; color: #333; display: block; margin-bottom: 10px; }
.code-input {
  width: 100%; min-height: 120px; padding: 10px; font-size: 12px;
  font-family: monospace; background: #1e1e1e; color: #d4d4d4;
  border: none; border-radius: 8px; box-sizing: border-box; line-height: 1.6;
}
.input { border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px 12px; font-size: 14px; width: 100%; box-sizing: border-box; margin-top: 8px; }
.btn-add { margin-top: 10px; width: 100%; }
.tip { font-size: 11px; color: #999; display: block; margin-top: 8px; }
</style>
