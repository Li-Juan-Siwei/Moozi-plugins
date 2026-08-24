/**
 * 生成 plugins.json 清单
 *
 * 扫描 plugins/ 下每个插件目录，读取 manifest.json，并对目录内所有文件
 * 计算 SHA-256 哈希（应用端下载后逐文件校验，防止 CDN 缓存污染/传输损坏）。
 *
 * 用法：node build-manifest.js
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const pluginsDir = path.join(__dirname, 'plugins')
const outputPath = path.join(__dirname, 'plugins.json')

function sha256(filePath) {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

const list = []
for (const entry of fs.readdirSync(pluginsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = path.join(pluginsDir, entry.name)
    const manifestPath = path.join(dir, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
        console.warn(`跳过 ${entry.name}：缺少 manifest.json`)
        continue
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))

    const files = {}
    for (const f of fs.readdirSync(dir)) {
        const fp = path.join(dir, f)
        if (fs.statSync(fp).isFile()) files[f] = sha256(fp)
    }

    list.push({
        id: entry.name,
        name: manifest.name || entry.name,
        version: manifest.version || '1.0.0',
        description: manifest.description || '',
        author: manifest.author || '',
        icon: manifest.icon || '',
        entry: manifest.entry || 'main.js',
        category: manifest.category || 'module',
        dependencies: manifest.dependencies || [],
        permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
        files
    })
}

fs.writeFileSync(outputPath, JSON.stringify(list, null, 2) + '\n', 'utf-8')
console.log(`已生成 plugins.json（${list.length} 个插件）`)
