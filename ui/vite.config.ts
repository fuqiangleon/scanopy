import { sveltekit } from '@sveltejs/kit/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { defineConfig } from 'vitest/config';
import pkg from './package.json';

// ── dev 代理:后端目标 / 路径改写 / 鉴权注入(均由环境变量驱动,不设时行为不变)──
const DEV_TARGET = process.env.SCANOPY_DEV_API_TARGET || 'http://localhost:60072';
const DEV_REWRITE = process.env.SCANOPY_DEV_API_REWRITE; // 如 /topo-studio/scanopy-api
const DEV_AUTH = process.env.SCANOPY_DEV_API_AUTH; // 如 "Bearer <n9e_topo_access_token>"

// 本地 UI 打远端后端时注入 n9e 鉴权头(浏览器跨源不会带远端凭据)。
type MiniProxy = { on: (e: string, cb: (pr: { setHeader: (k: string, v: string) => void }) => void) => void };
const authConfigure = DEV_AUTH
	? (proxy: MiniProxy) => {
			proxy.on('proxyReq', (proxyReq) => proxyReq.setHeader('Authorization', DEV_AUTH as string));
		}
	: undefined;

export default defineConfig({
	test: {
		include: ['src/tests/**/*.test.ts']
	},
	plugins: [
		sveltekit(),
		paraglideVitePlugin({
			project: './project.inlang',
			outdir: './src/lib/paraglide'
		})
	],
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version)
	},
	server: {
		host: '0.0.0.0',
		allowedHosts: ['scanopy-dev.local'],
		port: 5173,
		proxy: {
			// 独立 dev:UI 的 /api 直接代理到后端(默认本地 scanopy;设 SCANOPY_DEV_API_* 打远端)。
			'/api': {
				target: DEV_TARGET,
				changeOrigin: true,
				secure: false, // 现场自签 HTTPS,dev 放行证书
				...(DEV_REWRITE ? { rewrite: (p: string) => DEV_REWRITE + p } : {}),
				...(authConfigure ? { configure: authConfigure } : {})
			},
			// n9e fe 联调(其 vite 设 TOPO_PROXY=http://localhost:5173):iframe 的 apiBase=
			// /topo-studio/scanopy-api,n9e fe 剥掉 /topo-studio 后到这里是 /scanopy-api/... →
			// 改写回远端 /topo-studio/scanopy-api。仅在设了 DEV_REWRITE 时启用。
			...(DEV_REWRITE
				? {
						'/scanopy-api': {
							target: DEV_TARGET,
							changeOrigin: true,
							secure: false,
							rewrite: (p: string) => p.replace(/^\/scanopy-api/, DEV_REWRITE),
							...(authConfigure ? { configure: authConfigure } : {})
						}
					}
				: {})
		}
	},

	build: {
		outDir: 'build'
	}
});
