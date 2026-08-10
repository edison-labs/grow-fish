import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')
const testDirectory = resolve(root, 'tests')
const testFiles = (await readdir(testDirectory))
  .filter((name) => name.endsWith('.test.js'))
  .sort()
  .map((name) => resolve(testDirectory, name))

if (testFiles.length === 0) throw new Error('未发现 tests/*.test.js')

const runNode = (label, args) => {
  console.log(`\n=== ${label} ===`)
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: 'inherit'
  })

  if (result.error) throw new Error(`${label} 无法启动`, { cause: result.error })
  if (result.signal) throw new Error(`${label} 被信号 ${result.signal} 终止`)
  if (result.status !== 0) throw new Error(`${label} 失败（退出码 ${result.status}）`)
}

const gateSteps = [
  ['全部自动化测试', ['--test', ...testFiles]],
  ['Debug 构建', ['scripts/build.mjs']],
  ['Debug 微信 Bundle smoke', ['scripts/wechat-bundle-smoke.mjs']],
  ['Release 构建', ['scripts/build.mjs', '--release']],
  ['Release 微信 Bundle smoke', ['scripts/wechat-bundle-smoke.mjs', '--release']]
]

let gateError = null
let restoreError = null

try {
  for (const [label, args] of gateSteps) runNode(label, args)
} catch (error) {
  gateError = error
} finally {
  try {
    runNode('恢复 Debug 构建产物', ['scripts/build.mjs'])
  } catch (error) {
    restoreError = error
  }
}

if (gateError) console.error(`\nR3 验证失败：${gateError.message}`)
if (restoreError) console.error(`\nDebug 构建产物恢复失败：${restoreError.message}`)

if (gateError || restoreError) process.exitCode = 1
else console.log('\nR3 验证通过，dist 已恢复为 Debug 构建。')
