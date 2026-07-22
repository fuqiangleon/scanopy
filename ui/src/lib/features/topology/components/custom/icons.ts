// 自定义拓扑图标库（内联 SVG stencil）。
// 后续可替换为 drawio / iconify 的完整图标集；此处提供常用网络/机房图标起步。

export const ICONS: Record<string, string> = {
	switch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="9" width="18" height="7" rx="1.5"/><path d="M6 12h2m3 0h2m3 0h2"/></svg>`,
	server: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="3" width="14" height="8" rx="1.5"/><rect x="5" y="13" width="14" height="8" rx="1.5"/><circle cx="8" cy="7" r=".8"/><circle cx="8" cy="17" r=".8"/></svg>`,
	firewall: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M3 14h18M9 4v5m6-5v5m-9 5v6m6-6v6"/></svg>`,
	lb: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="18" r="3"/><path d="M12 9v3m0 0l-4 3m4-3l4 3"/></svg>`,
	cloud: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 17h11a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1A3.5 3.5 0 0 0 6 17z"/></svg>`,
	db: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/></svg>`,
	ups: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M13 7l-3 5h3l-3 4"/></svg>`,
	router: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="12" width="18" height="6" rx="1.5"/><path d="M7 15h.5m3 0h.5m3 0h.5"/><path d="M8 12V7m8 5V7m-4 5V5"/></svg>`
};

export interface IconMeta {
	key: string;
	name: string;
}

export const ICON_LIST: IconMeta[] = [
	{ key: 'switch', name: '交换机' },
	{ key: 'router', name: '路由器' },
	{ key: 'firewall', name: '防火墙' },
	{ key: 'server', name: '服务器' },
	{ key: 'db', name: '数据库' },
	{ key: 'lb', name: '负载均衡' },
	{ key: 'cloud', name: '云/分组' },
	{ key: 'ups', name: 'UPS' }
];

export function iconSvg(key: string): string {
	return ICONS[key] ?? ICONS.server;
}
