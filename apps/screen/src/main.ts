/**
 * Three.js 数据大屏 — 实时平台数据 3D 可视化
 *
 * 功能：
 * 1. 从后端 GET /api/stats 拉取实时统计数据
 * 2. Three.js 3D 场景：球体节点代表项目/审查，连线代表依赖关系
 * 3. HTML 覆盖层展示四个统计卡片
 * 4. 星空粒子背景 + 动态光照 + OrbitControls 交互
 * 5. 每 10 秒自动刷新数据，节点随数据变化
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// ========== 类型定义 ==========
interface PlatformStats {
  total_projects: number
  active_projects: number
  total_reviews: number
  completed_reviews: number
  pending_reviews: number
  avg_score: number
  languages: string[]
}

interface SceneNode {
  mesh: THREE.Mesh
  ring: THREE.Mesh     // 外环
  baseY: number        // 基准 Y 坐标
  phase: number        // 浮动相位
}

// ========== 1. 初始化场景 ==========
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a1a)
// 添加微弱的雾效增强纵深感
scene.fog = new THREE.FogExp2(0x0a0a1a, 0.00008)

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100)
camera.position.set(8, 5, 14)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.08
controls.minDistance = 5
controls.maxDistance = 30
controls.target.set(0, 1, 0)

// ========== 2. 光照 ==========
const ambientLight = new THREE.AmbientLight(0x334466, 1.5)
scene.add(ambientLight)

const pointLight1 = new THREE.PointLight(0x4488ff, 3, 50)
pointLight1.position.set(8, 6, 8)
scene.add(pointLight1)

const pointLight2 = new THREE.PointLight(0x44cc88, 2, 30)
pointLight2.position.set(-6, -2, -6)
scene.add(pointLight2)

// ========== 3. 粒子星空 ==========
const starsGeo = new THREE.BufferGeometry()
const starsCount = 800
const starsPositions = new Float32Array(starsCount * 3)
const starsSizes = new Float32Array(starsCount)
for (let i = 0; i < starsCount; i++) {
  starsPositions[i * 3] = (Math.random() - 0.5) * 40
  starsPositions[i * 3 + 1] = (Math.random() - 0.5) * 30
  starsPositions[i * 3 + 2] = (Math.random() - 0.5) * 30
  starsSizes[i] = Math.random() * 2 + 0.5
}
starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3))
starsGeo.setAttribute('size', new THREE.BufferAttribute(starsSizes, 1))
const starsMat = new THREE.PointsMaterial({
  color: 0x6688cc,
  size: 0.04,
  transparent: true,
  opacity: 0.7,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
})
const stars = new THREE.Points(starsGeo, starsMat)
scene.add(stars)

// ========== 4. 底盘网格 ==========
const gridHelper = new THREE.PolarGridHelper(10, 32, 20, 64, 0x223344, 0x112233)
gridHelper.position.y = -5
scene.add(gridHelper)

// ========== 5. 动态节点管理 ==========
let nodes: SceneNode[] = []
const lineGroup = new THREE.Group()
scene.add(lineGroup)

/** 材质色板（按模块类型分配颜色） */
const colorPalette = [
  0x44cc88, 0x4488ff, 0xcc8844, 0xcc4488, 0x8844cc,
  0x44aacc, 0xcc4444, 0x88cc44, 0xccaa44, 0x44ccaa,
]

/** 创建单个节点球体 */
function createSphereNode(color: number, radius: number, pos: THREE.Vector3): { mesh: THREE.Mesh; ring: THREE.Mesh } {
  // 主体球
  const geo = new THREE.SphereGeometry(radius, 32, 32)
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.25,
    metalness: 0.7,
    emissive: color,
    emissiveIntensity: 0.4,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.copy(pos)
  mesh.castShadow = true

  // 外环
  const ringGeo = new THREE.TorusGeometry(radius * 1.4, 0.04, 16, 48)
  const ringMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.5,
    emissive: color,
    emissiveIntensity: 0.6,
    transparent: true,
    opacity: 0.7,
  })
  const ring = new THREE.Mesh(ringGeo, ringMat)
  ring.position.copy(pos)

  scene.add(mesh)
  scene.add(ring)

  return { mesh, ring }
}

/** 清除所有节点和连线 */
function clearScene() {
  nodes.forEach(({ mesh, ring }) => {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose()
    ring.geometry.dispose();
    (ring.material as THREE.Material).dispose()
    scene.remove(mesh)
    scene.remove(ring)
  })
  nodes = []

  lineGroup.children.forEach(child => {
    if (child instanceof THREE.Line) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose()
    }
  })
  lineGroup.clear()
}

/** 创建连线 */
function createLine(a: THREE.Vector3, b: THREE.Vector3, color: number, opacity: number) {
  const points = [a.clone(), b.clone()]
  const geo = new THREE.BufferGeometry().setFromPoints(points)
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  lineGroup.add(new THREE.Line(geo, mat))
}

/** 根据数据重建场景节点 */
function buildScene(data: PlatformStats) {
  clearScene()

  const totalNodes = Math.min(data.active_projects + Math.floor(data.total_reviews / 2), 20)
  const count = Math.max(totalNodes, 5) // 最少 5 个节点

  // 在 3D 空间中均匀分布节点（螺旋分布）
  const positions: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 * 3 // 多圈螺旋
    const radius = 3 + Math.sin(i * 0.5) * 3
    const x = Math.cos(angle) * radius
    const z = Math.sin(angle) * radius
    const y = (Math.random() - 0.5) * 4 + 1
    positions.push(new THREE.Vector3(x, y, z))
  }

  // 创建节点
  positions.forEach((pos, i) => {
    const color = colorPalette[i % colorPalette.length]
    // 节点大小：前几个（代表项目）比后面的（代表审查）稍大
    const radius = i < data.active_projects ? 0.45 : 0.3
    const { mesh, ring } = createSphereNode(color, radius, pos)
    nodes.push({ mesh, ring, baseY: pos.y, phase: Math.random() * Math.PI * 2 })
  })

  // 创建连线：相邻节点之间
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      // 仅连接距离适中的节点对
      const dist = positions[i].distanceTo(positions[j])
      if (dist < 7 && Math.random() < 0.35) {
        createLine(positions[i], positions[j], 0x334488, 0.25 + (1 - dist / 7) * 0.3)
      }
    }
  }
}

// ========== 6. 数据获取 ==========
const API_BASE = 'http://localhost:8000'

async function fetchStats(): Promise<PlatformStats | null> {
  try {
    const resp = await fetch(`${API_BASE}/api/stats`)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

/** 更新 HTML 统计卡片 */
function updateStatsPanel(data: PlatformStats) {
  const projectsEl = document.getElementById('val-projects')
  const reviewsEl = document.getElementById('val-reviews')
  const scoreEl = document.getElementById('val-score')
  const subProjectsEl = document.getElementById('sub-projects')
  const subReviewsEl = document.getElementById('sub-reviews')

  if (projectsEl) projectsEl.textContent = String(data.active_projects)
  if (reviewsEl) reviewsEl.textContent = String(data.total_reviews)
  if (scoreEl) {
    scoreEl.textContent = data.avg_score > 0 ? String(data.avg_score) : '—'
    // 评分颜色
    if (data.avg_score >= 80) scoreEl.style.color = '#44cc88'
    else if (data.avg_score >= 60) scoreEl.style.color = '#ccaa44'
    else if (data.avg_score > 0) scoreEl.style.color = '#cc4444'
  }
  if (subProjectsEl) {
    subProjectsEl.textContent = data.languages.length > 0
      ? `语言：${data.languages.join(' / ')}`
      : '暂未添加项目'
  }
  if (subReviewsEl) {
    subReviewsEl.textContent = `已完成 ${data.completed_reviews} · 待处理 ${data.pending_reviews}`
  }
}

// ========== 7. 主循环 ==========
const clock = new THREE.Clock()
let lastFetchTime = 0
const FETCH_INTERVAL = 10 // 每 10 秒刷新数据

async function animate() {
  requestAnimationFrame(animate)

  const elapsed = clock.getElapsedTime()

  // 定时刷新数据
  if (elapsed - lastFetchTime > FETCH_INTERVAL) {
    lastFetchTime = elapsed
    const data = await fetchStats()
    if (data) {
      updateStatsPanel(data)
      buildScene(data)
    }
  }

  // 节点微动 + 外环旋转
  nodes.forEach(({ mesh, ring, baseY, phase }) => {
    // 上下微浮动
    mesh.position.y = baseY + Math.sin(elapsed * 1.2 + phase) * 0.25
    ring.position.y = mesh.position.y
    // 外环绕自身旋转
    ring.rotation.x += 0.005
    ring.rotation.z += 0.003
  })

  // 光源旋转
  pointLight1.position.x = Math.cos(elapsed * 0.3) * 8
  pointLight1.position.z = Math.sin(elapsed * 0.3) * 8

  // 星空缓慢旋转
  stars.rotation.y += 0.0003
  stars.rotation.x += 0.0001

  controls.update()
  renderer.render(scene, camera)
}

// ========== 8. 初始化 ==========
async function init() {
  // 首次加载数据
  const data = await fetchStats()
  if (data) {
    updateStatsPanel(data)
    buildScene(data)
  } else {
    // 后端不可用时使用默认数据展示
    updateStatsPanel({
      total_projects: 0, active_projects: 0,
      total_reviews: 0, completed_reviews: 0, pending_reviews: 0,
      avg_score: 0, languages: [],
    })
    buildScene({
      total_projects: 8, active_projects: 5,
      total_reviews: 12, completed_reviews: 8, pending_reviews: 4,
      avg_score: 78, languages: ['Python', 'TypeScript', 'Go'],
    })
  }
  lastFetchTime = clock.getElapsedTime()
  animate()
}

init()

// 窗口大小响应
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})
