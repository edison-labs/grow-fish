import { build } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

const args = new Set(process.argv.slice(2))
const release = args.has('--release')
const onlyWechat = args.has('--wechat')
const onlyWeb = args.has('--web')
const root = resolve(import.meta.dirname, '..')

async function buildWechat() {
  const output = resolve(root, 'dist/wechat/game.js')
  await mkdir(resolve(root, 'dist/wechat'), { recursive: true })
  if (release) await rm(`${output}.map`, { force: true })
  await build({
    entryPoints: [resolve(root, 'src/entry/wechat.js')],
    outfile: output,
    bundle: true,
    format: 'iife',
    platform: 'neutral',
    target: 'es2018',
    minify: release,
    sourcemap: release ? false : 'linked',
    define: { DEBUG_TOOLS: release ? 'false' : 'true' },
    banner: { js: '/* 大鱼吃小鱼 V0.1 - 原创程序化资源 */' }
  })
}

async function buildWeb() {
  const output = resolve(root, 'dist/web/app.js')
  await mkdir(resolve(root, 'dist/web'), { recursive: true })
  if (release) await rm(`${output}.map`, { force: true })
  await build({
    entryPoints: [resolve(root, 'src/entry/browser.js')],
    outfile: output,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome80', 'safari13'],
    minify: release,
    sourcemap: release ? false : 'linked',
    define: { DEBUG_TOOLS: release ? 'false' : 'true' },
    banner: { js: '/* 大鱼吃小鱼 V0.1 - 浏览器同核预览 */' }
  })
  await cp(resolve(root, 'web/index.html'), resolve(root, 'dist/web/index.html'))
}

if (!onlyWeb) await buildWechat()
if (!onlyWechat) await buildWeb()
console.log(`build complete (${release ? 'release' : 'debug'})`)
