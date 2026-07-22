// 重新生成「自定义拓扑」图标的离线内联 SVG(icon-svgs.ts)。
//
// 用法:改完 icons.ts 的 ICON_NAMES(加/删/换图标)后,运行:
//     node scripts/gen-topo-icons.mjs        (需联网,从 api.iconify.design 抓)
// 产物 icon-svgs.ts 是离线内联 SVG,运行时/内网不再请求公网,也不依赖 @iconify/svelte。
//
// 加新图标步骤:①先在 https://icones.js.org 找到图标名(prefix:name)
//   ②icons.ts 的 ICON_NAMES 加 `key: 'prefix:name'`、ICON_LIST 加显示项(名称+分类)
//   ③跑本脚本 → icon-svgs.ts 自动含新图标。渲染管线不变,效果与老图标一致。

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const base = join(dir, '../src/lib/features/topology/components/custom');
const iconsPath = join(base, 'icons.ts');
const outPath = join(base, 'icon-svgs.ts');

// 从 icons.ts 的 ICON_NAMES 块提取所有 iconify 名(prefix:name)
const src = readFileSync(iconsPath, 'utf8');
const start = src.indexOf('ICON_NAMES');
const block = src.slice(start, src.indexOf('};', start));
const names = [...new Set([...block.matchAll(/'([a-z0-9-]+:[a-z0-9-]+)'/g)].map((m) => m[1]))];
if (!names.length) throw new Error('未从 icons.ts 解析到 ICON_NAMES');

async function fetchSvg(name) {
	const [prefix, icon] = name.split(':');
	for (let i = 0; i < 4; i++) {
		try {
			const res = await fetch(`https://api.iconify.design/${prefix}/${icon}.svg`);
			if (!res.ok) throw new Error(`http ${res.status}`);
			const svg = await res.text();
			if (!svg.startsWith('<svg')) throw new Error(`非 SVG(图标名可能不存在):${name}`);
			// 只去掉根 <svg> 标签上写死的 width/height(尺寸交给 CSS),保留 viewBox 与内部属性
			return svg
				.replace(/<svg([^>]*)>/, (_, a) => `<svg${a.replace(/\s(width|height)="[^"]*"/g, '')}>`)
				.trim();
		} catch (e) {
			if (i === 3) throw new Error(`抓取失败 ${name}: ${e.message}`);
			await new Promise((r) => setTimeout(r, 1500));
		}
	}
}

const svgs = {};
for (const name of names) {
	svgs[name] = await fetchSvg(name);
	console.log(`  ✓ ${name}`);
}

const out =
	'// 自动生成,勿手改:自定义拓扑图标的完整内联 SVG(离线,无运行时依赖 @iconify/svelte)。\n' +
	'// 改 icons.ts 的 ICON_NAMES 后运行 `node scripts/gen-topo-icons.mjs` 重新生成。\n' +
	'/* eslint-disable */\n' +
	`export const ICON_SVGS: Record<string, string> = ${JSON.stringify(svgs)};\n`;
writeFileSync(outPath, out);
console.log(`\n✅ 写入 ${names.length} 个图标 → icon-svgs.ts`);
