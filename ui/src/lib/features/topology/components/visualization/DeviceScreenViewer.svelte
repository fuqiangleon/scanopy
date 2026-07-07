<script lang="ts">
	// 设备互联图:用 LLDP 主机名(lldp_sys_name)在前端重建设备互联链路。
	// scanopy 后端 resolve_lldp_links 只用 chassis MAC(本环境基本失效,只出 ~8 条),
	// 这里改用「邻居主机名 → 设备 sys_name」+「端口名 → if_descr/if_name」自算链路。
	// 展示:每台设备一个图标(按角色),力导向布局;节点可拖拽并按网络持久化(localStorage);
	//       悬浮链路显示两端接口名。纯前端、零后端改动。数据来自 RenderableTopology 实体数组。
	import type { RenderableTopology } from '../../types/base';
	import { SvelteMap } from 'svelte/reactivity';
	// 厂商中立网络设备图标(bwks/network-icons-svg, GPL-3.0),Vite ?url 引入
	import routerIcon from '../../assets/deviceicons/router.svg?url';
	import switchL3Icon from '../../assets/deviceicons/switch-l3.svg?url';
	import switchL2Icon from '../../assets/deviceicons/switch-l2.svg?url';
	import firewallIcon from '../../assets/deviceicons/firewall.svg?url';

	let { topology }: { topology: RenderableTopology | null | undefined } = $props();

	type Role = 'core' | 'agg' | 'sec' | 'wlan' | 'acc';
	type Dev = { id: string; name: string; role: Role };

	const norm = (s: unknown) => String(s ?? '').trim();
	let networkId = $derived(norm((topology as any)?.network_id) || norm((topology as any)?.id) || 'default');
	let storageKey = $derived(`scanopy-devscreen-pos:${networkId}`);

	function classify(name: string, desc: string): Role {
		const n = name.toLowerCase();
		const d = (desc || '').toLowerCase();
		if (n.includes('core') || d.includes('s10506')) return 'core';
		if (/-hj$/.test(n) || n.endsWith('hj')) return 'agg';
		if (
			['hillstone', 'secgate', 'firewall', 'nsg', ' ips'].some((k) => d.includes(k)) ||
			['-fw', 'fw-', 'ips', 'sg-6000'].some((k) => n.includes(k))
		)
			return 'sec';
		if (['ac-', '-ac', 'wx'].some((k) => n.includes(k))) return 'wlan';
		return 'acc';
	}

	const ROLE_COLOR: Record<Role, string> = {
		core: '#a855f7',
		agg: '#3b82f6',
		sec: '#ef4444',
		wlan: '#f59e0b',
		acc: '#22c55e'
	};
	const ROLE_LABEL: Record<Role, string> = {
		core: '核心',
		agg: '汇聚',
		sec: '安全',
		wlan: '无线',
		acc: '接入'
	};
	const ROLE_ICON: Record<Role, string> = {
		core: routerIcon,
		agg: switchL3Icon,
		acc: switchL2Icon,
		sec: firewallIcon,
		wlan: ''
	};

	// ---- 链路重建 ----
	let ifByHost = $derived.by(() => {
		const m = new Map<string, any[]>();
		for (const i of (topology?.interfaces ?? []) as any[]) {
			if (!i.host_id) continue;
			let arr = m.get(i.host_id);
			if (!arr) m.set(i.host_id, (arr = []));
			arr.push(i);
		}
		return m;
	});

	// host_id → IP 列表(按 IPv4 数值升序,主 IP 取最小,通常即管理口)
	let hostIps = $derived.by(() => {
		const val = (s: string) => {
			const p = s.split('.').map(Number);
			return p.length === 4 && p.every((n) => n >= 0 && n <= 255)
				? p[0] * 16777216 + p[1] * 65536 + p[2] * 256 + p[3]
				: Number.MAX_SAFE_INTEGER;
		};
		const m = new Map<string, string[]>();
		for (const a of (topology?.ip_addresses ?? []) as any[]) {
			const h = a.host_id,
				ip = norm(a.ip_address);
			if (!h || !ip) continue;
			let arr = m.get(h);
			if (!arr) m.set(h, (arr = []));
			if (!arr.includes(ip)) arr.push(ip);
		}
		for (const arr of m.values()) arr.sort((x, y) => val(x) - val(y));
		return m;
	});

	let sysToHost = $derived.by(() => {
		const m = new Map<string, string>();
		for (const h of (topology?.hosts ?? []) as any[]) {
			const sn = norm(h.sys_name);
			const cnt = ifByHost.get(h.id)?.length ?? 0;
			if (!sn || cnt === 0) continue;
			const prev = m.get(sn);
			if (!prev || cnt > (ifByHost.get(prev)?.length ?? 0)) m.set(sn, h.id);
		}
		return m;
	});

	let portIndex = $derived.by(() => {
		const m = new Map<string, Map<string, any>>();
		for (const [hid, list] of ifByHost) {
			const pm = new Map<string, any>();
			for (const i of list) {
				const d = norm(i.if_descr),
					n = norm(i.if_name);
				if (d && !pm.has(d)) pm.set(d, i);
				if (n && !pm.has(n)) pm.set(n, i);
			}
			m.set(hid, pm);
		}
		return m;
	});

	// 接口 oper_status → up/down/unk
	type St = 'up' | 'down' | 'unk';
	const stOf = (s: unknown): St => (s === 'Up' || s === 1 ? 'up' : s === 'Down' || s === 2 ? 'down' : 'unk');

	// 无向去重的主机链路(带两端接口名 + 两端状态)
	type HL = { a: string; aName: string; aStat: St; b: string; bName: string; bStat: St };
	let hostLinks = $derived.by<HL[]>(() => {
		if (!topology) return [];
		const seen = new Set<string>();
		const out: HL[] = [];
		for (const i of (topology.interfaces ?? []) as any[]) {
			const sn = norm(i.lldp_sys_name);
			const pid = i.lldp_port_id as any;
			if (!sn || !pid || pid.subtype !== 'InterfaceName') continue;
			const dstHost = sysToHost.get(sn);
			if (!dstHost || dstHost === i.host_id) continue;
			const dstIf = portIndex.get(dstHost)?.get(norm(pid.value));
			if (!dstIf) continue;
			const key = [i.id, dstIf.id].sort().join(' ');
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({
				a: i.host_id,
				aName: norm(i.if_descr) || norm(i.if_name),
				aStat: stOf(i.oper_status),
				b: dstHost,
				bName: norm(dstIf.if_descr) || norm(dstIf.if_name),
				bStat: stOf(dstIf.oper_status)
			});
		}
		return out;
	});

	let devices = $derived.by<Dev[]>(() => {
		if (!topology) return [];
		const ids = new Set<string>();
		for (const l of hostLinks) {
			ids.add(l.a);
			ids.add(l.b);
		}
		const hostById = new Map((topology.hosts ?? []).map((h: any) => [h.id, h]));
		const devs: Dev[] = [];
		for (const id of ids) {
			const h: any = hostById.get(id);
			const name = norm(h?.sys_name) || norm(h?.name) || norm(h?.hostname) || id.slice(0, 8);
			devs.push({ id, name, role: classify(name, norm(h?.sys_descr)) });
		}
		return devs;
	});

	let devIdx = $derived(new Map(devices.map((d, i) => [d.id, i])));

	// 设备对聚合链路,保留每条端口对(s=小下标,t=大下标)+ 两端状态 + 链路总状态
	type PP = { sName: string; tName: string; sStat: St; tStat: St };
	type DL = { s: number; t: number; ports: PP[]; status: St };
	let deviceLinks = $derived.by<DL[]>(() => {
		const m = new Map<string, DL>();
		for (const l of hostLinks) {
			const ia = devIdx.get(l.a),
				ib = devIdx.get(l.b);
			if (ia == null || ib == null || ia === ib) continue;
			const s = Math.min(ia, ib),
				t = Math.max(ia, ib);
			const sFromA = s === ia;
			const key = `${s}-${t}`;
			let e = m.get(key);
			if (!e) m.set(key, (e = { s, t, ports: [], status: 'unk' }));
			e.ports.push({
				sName: sFromA ? l.aName : l.bName,
				tName: sFromA ? l.bName : l.aName,
				sStat: sFromA ? l.aStat : l.bStat,
				tStat: sFromA ? l.bStat : l.aStat
			});
		}
		// 链路总状态:任一端口有 down 端 → down;全部两端 up → up;否则 unk
		const arr = [...m.values()];
		for (const e of arr) {
			let anyDown = false,
				allUp = true;
			for (const p of e.ports) {
				if (p.sStat === 'down' || p.tStat === 'down') anyDown = true;
				if (!(p.sStat === 'up' && p.tStat === 'up')) allUp = false;
			}
			e.status = anyDown ? 'down' : allUp ? 'up' : 'unk';
		}
		return arr;
	});

	// 选中设备详情(点击节点)
	let selected = $state(-1);
	let selectedInfo = $derived.by(() => {
		if (selected < 0 || selected >= devices.length) return null;
		const d = devices[selected];
		const h = ((topology?.hosts ?? []) as any[]).find((x) => x.id === d.id);
		const ips = hostIps.get(d.id) ?? [];
		const ifCount = ifByHost.get(d.id)?.length ?? 0;
		const neigh: { name: string; role: Role; ports: { self: string; other: string }[] }[] = [];
		for (const e of deviceLinks) {
			if (e.s !== selected && e.t !== selected) continue;
			const other = e.s === selected ? e.t : e.s;
			const ports = e.ports.map((pp) => ({
				self: e.s === selected ? pp.sName : pp.tName,
				other: e.s === selected ? pp.tName : pp.sName
			}));
			neigh.push({ name: devices[other].name, role: devices[other].role, ports });
		}
		neigh.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
		return { dev: d, ips, model: norm(h?.model), ifCount, neigh };
	});

	// 选中链路详情(点击链路)
	let selectedLink = $state(-1);
	let selectedLinkInfo = $derived.by(() => {
		if (selectedLink < 0 || selectedLink >= deviceLinks.length) return null;
		const e = deviceLinks[selectedLink];
		return { a: devices[e.s], b: devices[e.t], status: e.status, ports: e.ports };
	});
	const stColor = (s: St) => (s === 'up' ? '#22c55e' : s === 'down' ? '#ef4444' : '#94a3b8');
	const stText = (s: St) => (s === 'up' ? 'Up' : s === 'down' ? 'Down' : '未知');

	// ---- 力导向布局(确定性初始化)----
	let forceLayout = $derived.by(() => {
		const N = devices.length;
		if (N === 0) return { pos: [] as { x: number; y: number }[], x0: 0, y0: 0, x1: 1, y1: 1 };
		const W = 2600,
			H = 1800;
		const pos = devices.map((_, i) => {
			const a = (i / N) * Math.PI * 2,
				r = Math.min(W, H) * 0.42;
			return { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r };
		});
		const K = Math.sqrt((W * H) / N) * 1.05; // 更大理想边长 → 更大间距
		let temp = Math.min(W, H) * 0.1;
		const es = deviceLinks;
		for (let it = 0; it < 460; it++) {
			const dx = new Array(N).fill(0),
				dy = new Array(N).fill(0);
			for (let i = 0; i < N; i++)
				for (let j = i + 1; j < N; j++) {
					let ddx = pos[i].x - pos[j].x,
						ddy = pos[i].y - pos[j].y,
						d = Math.hypot(ddx, ddy);
					if (d < 0.01) {
						d = 0.01;
						ddx = (i - j) * 0.01;
						ddy = 0.01;
					}
					const rep = (K * K) / d,
						ux = ddx / d,
						uy = ddy / d;
					dx[i] += ux * rep;
					dy[i] += uy * rep;
					dx[j] -= ux * rep;
					dy[j] -= uy * rep;
				}
			for (const e of es) {
				let ddx = pos[e.s].x - pos[e.t].x,
					ddy = pos[e.s].y - pos[e.t].y,
					d = Math.hypot(ddx, ddy) || 0.01;
				const att = (d * d) / K,
					ux = ddx / d,
					uy = ddy / d;
				dx[e.s] -= ux * att;
				dy[e.s] -= uy * att;
				dx[e.t] += ux * att;
				dy[e.t] += uy * att;
			}
			for (let i = 0; i < N; i++) {
				let d = Math.hypot(dx[i], dy[i]) || 0.01;
				const lim = Math.min(d, temp);
				pos[i].x += (dx[i] / d) * lim + (W / 2 - pos[i].x) * 0.003;
				pos[i].y += (dy[i] / d) * lim + (H / 2 - pos[i].y) * 0.003;
			}
			temp *= 0.97;
		}
		// 防重叠:碰撞半径 = 图标半径 + 间距;过近成对推开,保证节点两两不重叠。
		const R = devices.map((d) => radius(d.role) + 42);
		for (let pass = 0; pass < 90; pass++) {
			let moved = false;
			for (let i = 0; i < N; i++)
				for (let j = i + 1; j < N; j++) {
					let ddx = pos[j].x - pos[i].x,
						ddy = pos[j].y - pos[i].y,
						d = Math.hypot(ddx, ddy);
					if (d < 0.01) {
						d = 0.01;
						ddx = (i - j) * 0.01;
						ddy = 0.007;
					}
					const minD = R[i] + R[j];
					if (d < minD) {
						const push = (minD - d) / 2,
							ux = ddx / d,
							uy = ddy / d;
						pos[i].x -= ux * push;
						pos[i].y -= uy * push;
						pos[j].x += ux * push;
						pos[j].y += uy * push;
						moved = true;
					}
				}
			if (!moved) break;
		}
		let x0 = Infinity,
			y0 = Infinity,
			x1 = -Infinity,
			y1 = -Infinity;
		for (const p of pos) {
			x0 = Math.min(x0, p.x);
			y0 = Math.min(y0, p.y);
			x1 = Math.max(x1, p.x);
			y1 = Math.max(y1, p.y);
		}
		return { pos, x0, y0, x1, y1, tierInfo: [] as { y: number; label: string }[] };
	});

	// ---- 分层布局(参考 PDF 纵向结构:安全→核心→汇聚→接入→无线),同层重心法减交叉 ----
	// 角色分层布局(参考 PDF 纵向结构:核心→汇聚→接入→无线),同层重心法减交叉,宽层折行。
	const TIER: Record<Role, number> = { sec: 0, core: 1, agg: 2, acc: 3, wlan: 4 };
	const ROLE_BY_TIER: Role[] = ['sec', 'core', 'agg', 'acc', 'wlan'];
	let layeredLayout = $derived.by(() => {
		const N = devices.length;
		if (!N) return { pos: [] as { x: number; y: number }[], x0: 0, y0: 0, x1: 1, y1: 1, tierInfo: [] as { y: number; label: string }[] };
		const tierOf = devices.map((d) => TIER[d.role]);
		const usedTiers = [...new Set(tierOf)].sort((a, b) => a - b);
		const rowOfTier = new Map(usedTiers.map((t, r) => [t, r]));
		const rows = usedTiers.length;
		const bands: number[][] = usedTiers.map(() => []);
		devices.forEach((_, i) => bands[rowOfTier.get(tierOf[i])!].push(i));
		const rowOf = new Array<number>(N);
		bands.forEach((b, r) => b.forEach((id) => (rowOf[id] = r)));
		const adjL: number[][] = devices.map(() => []);
		for (const e of deviceLinks) {
			adjL[e.s].push(e.t);
			adjL[e.t].push(e.s);
		}
		const ord = bands.map((b) => b.slice());
		const pil = new Array(N).fill(0);
		const reindex = () => ord.forEach((b) => b.forEach((id, k) => (pil[id] = k)));
		reindex();
		const bary = (id: number, refRow: number) => {
			let s = 0,
				c = 0;
			for (const v of adjL[id])
				if (rowOf[v] === refRow) {
					s += pil[v];
					c++;
				}
			return c ? s / c : pil[id];
		};
		for (let sw = 0; sw < 16; sw++) {
			for (let r = 1; r < rows; r++) ord[r].sort((a, b) => bary(a, r - 1) - bary(b, r - 1));
			reindex();
			for (let r = rows - 2; r >= 0; r--) ord[r].sort((a, b) => bary(a, r + 1) - bary(b, r + 1));
			reindex();
		}
		const SLOT = 118,
			SUBV = 96,
			TIERGAP = 74,
			MAXCOL = 20;
		const pos = new Array<{ x: number; y: number }>(N);
		const tierInfo: { y: number; label: string }[] = [];
		let yCursor = 0;
		ord.forEach((b, r) => {
			const subrows = Math.max(1, Math.ceil(b.length / MAXCOL));
			const perRow = Math.ceil(b.length / subrows);
			b.forEach((id, k) => {
				const sr = Math.floor(k / perRow);
				const col = k % perRow;
				const cnt = Math.min(perRow, b.length - sr * perRow);
				const tot = (cnt - 1) * SLOT;
				pos[id] = { x: col * SLOT - tot / 2, y: yCursor + sr * SUBV };
			});
			tierInfo.push({ y: yCursor + ((subrows - 1) * SUBV) / 2, label: ROLE_LABEL[ROLE_BY_TIER[usedTiers[r]]] });
			yCursor += (subrows - 1) * SUBV + TIERGAP + SUBV;
		});
		let x0 = Infinity,
			y0 = Infinity,
			x1 = -Infinity,
			y1 = -Infinity;
		for (const p of pos) {
			x0 = Math.min(x0, p.x);
			y0 = Math.min(y0, p.y);
			x1 = Math.max(x1, p.x);
			y1 = Math.max(y1, p.y);
		}
		return { pos, x0, y0, x1, y1, tierInfo };
	});

	// 树形布局:BFS 生成树(每台设备挂到上联)+ tidy 叶子排布,子树不重叠 → 上联连线不交叉。
	// 非树边(双上联/同层互联)仍会少量交叉——任意图无法完全无交叉。
	let treeLayout = $derived.by(() => {
		const N = devices.length;
		if (!N) return { pos: [] as { x: number; y: number }[], x0: 0, y0: 0, x1: 1, y1: 1, tierInfo: [] as { y: number; label: string }[] };
		const adj: number[][] = devices.map(() => []);
		for (const e of deviceLinks) {
			adj[e.s].push(e.t);
			adj[e.t].push(e.s);
		}
		// 根:核心;无核心取最大度。度大的子节点先入队 → 枢纽子树更集中。
		const byDeg = (a: number, b: number) => adj[b].length - adj[a].length;
		let roots = devices.map((_, i) => i).filter((i) => devices[i].role === 'core');
		if (!roots.length) {
			let m = 0;
			devices.forEach((_, i) => {
				if (adj[i].length > adj[m].length) m = i;
			});
			roots = [m];
		}
		const depth = new Array(N).fill(-1);
		const children: number[][] = devices.map(() => []);
		const bfsQ: number[] = [];
		const seed = (r: number) => {
			depth[r] = 0;
			bfsQ.push(r);
		};
		roots.forEach(seed);
		for (let h = 0; h < bfsQ.length; h++) {
			const u = bfsQ[h];
			for (const v of [...adj[u]].sort(byDeg))
				if (depth[v] < 0) {
					depth[v] = depth[u] + 1;
					children[u].push(v);
					bfsQ.push(v);
				}
		}
		// 未连通分量:各自作根接在末尾
		for (let i = 0; i < N; i++)
			if (depth[i] < 0) {
				roots.push(i);
				depth[i] = 0;
				bfsQ.push(i);
				for (let h = bfsQ.length - 1; h < bfsQ.length; h++) {
					const u = bfsQ[h];
					for (const v of [...adj[u]].sort(byDeg))
						if (depth[v] < 0) {
							depth[v] = depth[u] + 1;
							children[u].push(v);
							bfsQ.push(v);
						}
				}
			}
		// tidy:迭代 DFS,叶子按序占列,内部节点取首末子节点中点(子树不重叠)
		const xCol = new Array(N).fill(0);
		let cursor = 0;
		for (const r of roots) {
			const stack: { u: number; ci: number }[] = [{ u: r, ci: 0 }];
			while (stack.length) {
				const top = stack[stack.length - 1];
				const ch = children[top.u];
				if (top.ci < ch.length) {
					stack.push({ u: ch[top.ci++], ci: 0 });
				} else {
					xCol[top.u] = ch.length === 0 ? cursor++ : (xCol[ch[0]] + xCol[ch[ch.length - 1]]) / 2;
					stack.pop();
				}
			}
		}
		const SLOTX = 64,
			VGAP = 150;
		let maxDepth = 0;
		for (let i = 0; i < N; i++) maxDepth = Math.max(maxDepth, depth[i]);
		const pos = new Array<{ x: number; y: number }>(N);
		for (let i = 0; i < N; i++) pos[i] = { x: xCol[i] * SLOTX, y: depth[i] * VGAP };
		let x0 = Infinity,
			y0 = Infinity,
			x1 = -Infinity,
			y1 = -Infinity;
		for (const p of pos) {
			x0 = Math.min(x0, p.x);
			y0 = Math.min(y0, p.y);
			x1 = Math.max(x1, p.x);
			y1 = Math.max(y1, p.y);
		}
		const DEPTH_LABEL = ['核心', '汇聚', '接入', '下层', '下层', '下层'];
		const tierInfo: { y: number; label: string }[] = [];
		for (let dth = 0; dth <= maxDepth; dth++)
			tierInfo.push({ y: dth * VGAP, label: DEPTH_LABEL[Math.min(dth, DEPTH_LABEL.length - 1)] });
		return { pos, x0, y0, x1, y1, tierInfo };
	});

	let mode = $state<'tree' | 'layered' | 'force'>('tree');
	let activeLayout = $derived(
		mode === 'tree' ? treeLayout : mode === 'layered' ? layeredLayout : forceLayout
	);
	const MODE_LABEL: Record<typeof mode, string> = { tree: '树形', layered: '分层', force: '力导向' };
	function cycleMode() {
		mode = mode === 'tree' ? 'layered' : mode === 'layered' ? 'force' : 'tree';
	}

	// ---- 手动拖拽的持久化坐标(localStorage 按网络)----
	let saved = new SvelteMap<string, { x: number; y: number }>();
	let loadedKey = '';
	$effect(() => {
		const key = storageKey;
		if (key === loadedKey || typeof localStorage === 'undefined') return;
		loadedKey = key;
		saved.clear();
		try {
			const raw = localStorage.getItem(key);
			if (raw) for (const [id, p] of Object.entries(JSON.parse(raw) as Record<string, any>))
				saved.set(id, { x: p.x, y: p.y });
		} catch {
			/* ignore */
		}
	});
	function persist() {
		if (typeof localStorage === 'undefined') return;
		try {
			localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(saved)));
		} catch {
			/* ignore */
		}
	}
	function resetPositions() {
		saved.clear();
		if (typeof localStorage !== 'undefined') localStorage.removeItem(storageKey);
		fittedKey = ''; // 触发重新 fit
	}

	// 渲染坐标:优先手动保存的,否则用布局结果
	function nodePos(i: number) {
		const d = devices[i];
		return saved.get(d.id) ?? (activeLayout as any).pos[i] ?? { x: 0, y: 0 };
	}

	// ---- 视图变换(缩放/平移),初始 fit ----
	let tx = $state(0),
		ty = $state(0),
		scale = $state(1);
	let vpW = $state(1200),
		vpH = $state(800);
	let containerEl: HTMLDivElement | null = $state(null);
	let fittedKey = $state('');
	$effect(() => {
		const L = activeLayout as any;
		const key = mode + ':' + devices.length + ':' + Math.round(L.x1 - L.x0) + 'x' + Math.round(L.y1 - L.y0) + '@' + vpW + 'x' + vpH;
		if (!L.pos.length || key === fittedKey) return;
		fittedKey = key;
		// 力导向:不适配画布,保持 1:1 真实间距,仅把质心居中(靠滚轮/拖拽浏览)
		if (mode === 'force') {
			scale = 1;
			tx = vpW / 2 - ((L.x0 + L.x1) / 2) * scale;
			ty = vpH / 2 - ((L.y0 + L.y1) / 2) * scale;
			return;
		}
		// fit 时把已保存的手动坐标也纳入包围盒
		let x0 = L.x0,
			y0 = L.y0,
			x1 = L.x1,
			y1 = L.y1;
		for (const p of saved.values()) {
			x0 = Math.min(x0, p.x);
			y0 = Math.min(y0, p.y);
			x1 = Math.max(x1, p.x);
			y1 = Math.max(y1, p.y);
		}
		const pad = 90;
		const s = Math.max(0.2, Math.min(vpW / (x1 - x0 + pad * 2), vpH / (y1 - y0 + pad * 2), 1.6));
		scale = s;
		tx = vpW / 2 - ((x0 + x1) / 2) * s;
		ty = vpH / 2 - ((y0 + y1) / 2) * s;
	});

	// 悬停高亮
	let hover = $state(-1);
	let neighbors = $derived.by(() => {
		const s = new Set<number>();
		if (hover < 0) return s;
		for (const e of deviceLinks) {
			if (e.s === hover) s.add(e.t);
			if (e.t === hover) s.add(e.s);
		}
		return s;
	});

	// 链路悬停 tooltip
	let hoverLink = $state(-1);
	let tipX = $state(0),
		tipY = $state(0);

	function radius(role: Role) {
		return role === 'core' ? 28 : role === 'agg' ? 24 : role === 'sec' ? 24 : role === 'wlan' ? 18 : 19;
	}

	// ---- 交互:缩放 / 平移 / 拖节点 ----
	let panning = false,
		lx = 0,
		ly = 0;
	let dragNode = $state(-1);
	let dsx = 0,
		dsy = 0,
		movedDrag = false;

	function toGraph(clientX: number, clientY: number) {
		const rect = containerEl?.getBoundingClientRect();
		const ox = rect?.left ?? 0,
			oy = rect?.top ?? 0;
		return { x: (clientX - ox - tx) / scale, y: (clientY - oy - ty) / scale };
	}
	function onWheel(ev: WheelEvent) {
		ev.preventDefault();
		const f = ev.deltaY < 0 ? 1.12 : 0.89;
		const rect = containerEl?.getBoundingClientRect();
		const mx = ev.clientX - (rect?.left ?? 0),
			my = ev.clientY - (rect?.top ?? 0);
		tx = mx - (mx - tx) * f;
		ty = my - (my - ty) * f;
		scale *= f;
	}
	function onContainerDown(ev: MouseEvent) {
		panning = true;
		lx = ev.clientX;
		ly = ev.clientY;
	}
	function onNodeDown(ev: MouseEvent, i: number) {
		ev.stopPropagation();
		dragNode = i;
		dsx = ev.clientX;
		dsy = ev.clientY;
		movedDrag = false;
	}
	function onMove(ev: MouseEvent) {
		if (dragNode >= 0) {
			if (Math.hypot(ev.clientX - dsx, ev.clientY - dsy) > 3) movedDrag = true;
			if (movedDrag) saved.set(devices[dragNode].id, toGraph(ev.clientX, ev.clientY));
			return;
		}
		if (!panning) return;
		tx += ev.clientX - lx;
		ty += ev.clientY - ly;
		lx = ev.clientX;
		ly = ev.clientY;
	}
	function onUp() {
		if (dragNode >= 0) {
			if (movedDrag) persist();
			else {
				// 未拖动 = 点击 → 切换设备详情(并关闭链路详情)
				selected = selected === dragNode ? -1 : dragNode;
				selectedLink = -1;
			}
			dragNode = -1;
		}
		panning = false;
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="device-screen"
	bind:this={containerEl}
	bind:clientWidth={vpW}
	bind:clientHeight={vpH}
	role="application"
	onwheel={onWheel}
	onmousedown={onContainerDown}
	onmousemove={onMove}
	onmouseup={onUp}
	onmouseleave={onUp}
>
	{#if devices.length === 0}
		<div class="empty">当前无可重建的设备互联链路(需 LLDP 邻居 + SNMP 主机名)。</div>
	{:else}
		<div class="hud">
			设备 <b>{devices.length}</b> · 链路对 <b>{deviceLinks.length}</b>
			<span class="legend">
				{#each Object.keys(ROLE_COLOR) as r}
					<span>
						{#if ROLE_ICON[r as Role]}
							<img class="leg-icon" src={ROLE_ICON[r as Role]} alt="" />
						{:else}
							<i style="background:{ROLE_COLOR[r as Role]}"></i>
						{/if}
						{ROLE_LABEL[r as Role]}
					</span>
				{/each}
			</span>
			<span class="legend">
				<span><i style="background:#22c55e"></i>链路Up</span>
				<span><i style="background:#ef4444"></i>Down</span>
			</span>
			<button class="reset" onmousedown={(e) => e.stopPropagation()} onclick={cycleMode}
				>布局: {MODE_LABEL[mode]}</button
			>
			<button class="reset" onmousedown={(e) => e.stopPropagation()} onclick={resetPositions}
				>重置布局</button
			>
		</div>

		<svg class="stage" width="100%" height="100%">
			<g transform="translate({tx},{ty}) scale({scale})">
				<!-- 分层/树形模式:层引导线 + 左侧层名 -->
				{#if mode !== 'force'}
					{@const L = activeLayout as any}
					{#each L.tierInfo as ti}
						<line
							class="band-line"
							x1={L.x0 - 40}
							y1={ti.y}
							x2={L.x1 + 40}
							y2={ti.y}
							stroke-width={1 / scale}
							stroke-dasharray="2 7"
						/>
						<text class="tier-label" x={L.x0 - 52} y={ti.y + 4} text-anchor="end">{ti.label}</text>
					{/each}
				{/if}
				<!-- 连线 -->
				{#each deviceLinks as e, li}
					{@const a = nodePos(e.s)}
					{@const b = nodePos(e.t)}
					{@const rel = e.s === hover || e.t === hover}
					{@const scol = e.status === 'up' ? '#22c55e' : e.status === 'down' ? '#ef4444' : '#94a3b8'}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<line
						x1={a.x}
						y1={a.y}
						x2={b.x}
						y2={b.y}
						style="stroke:{scol}"
						stroke-width={(hoverLink === li || selectedLink === li
							? 4
							: Math.min(1 + e.ports.length * 0.6, 3.5)) / scale}
						opacity={hover < 0 ? (hoverLink === li || selectedLink === li ? 1 : 0.72) : rel ? 0.98 : 0.07}
						class="edge"
						onmousedown={(ev) => ev.stopPropagation()}
						onclick={() => {
							selectedLink = selectedLink === li ? -1 : li;
							selected = -1;
						}}
						onmouseenter={(ev) => {
							hoverLink = li;
							tipX = ev.clientX;
							tipY = ev.clientY;
						}}
						onmousemove={(ev) => {
							tipX = ev.clientX;
							tipY = ev.clientY;
						}}
						onmouseleave={() => (hoverLink = -1)}
					/>
				{/each}

				<!-- 设备图标 -->
				{#each devices as d, i}
					{@const p = nodePos(i)}
					{@const r = radius(d.role)}
					{@const c = ROLE_COLOR[d.role]}
					{@const ip = hostIps.get(d.id)?.[0]}
					{@const dim = hover >= 0 && hover !== i && !neighbors.has(i)}
					<g
						transform="translate({p.x},{p.y})"
						class="node"
						class:dragging={dragNode === i}
						opacity={dim ? 0.2 : 1}
						role="button"
						tabindex="-1"
						onmousedown={(ev) => onNodeDown(ev, i)}
						onmouseenter={() => (hover = i)}
						onmouseleave={() => (hover = -1)}
					>
						{#if selected === i}
							<circle r={r + 7} fill="none" stroke="#ffd873" stroke-width={2.5 / scale} />
						{/if}
						{#if d.role === 'wlan'}
							<!-- 无线:自绘 wifi(上游图标集无 AP 图标)-->
							<rect class="wlan-base" x={-r * 0.9} y={r * 0.35} width={r * 1.8} height={r * 0.5} rx="3" stroke={c} stroke-width="2" />
							<g stroke={c} stroke-width="2" fill="none">
								<path d="M {-r * 0.7} {r * 0.05} A {r * 0.9} {r * 0.9} 0 0 1 {r * 0.7} {r * 0.05}" />
								<path d="M {-r * 0.4} {r * 0.28} A {r * 0.5} {r * 0.5} 0 0 1 {r * 0.4} {r * 0.28}" />
							</g>
							<circle cy={r * 0.5} r="2.4" fill={c} />
						{:else}
							<!-- 真实网络设备图标(bwks/network-icons-svg, GPL-3.0)-->
							<image
								href={ROLE_ICON[d.role]}
								x={-r}
								y={-r}
								width={r * 2}
								height={r * 2}
								preserveAspectRatio="xMidYMid meet"
							/>
						{/if}
						<text class="label" class:hl={hover === i} y={r + 13} text-anchor="middle">{d.name}</text>
						{#if ip}
							<text class="ip-label" y={r + 25} text-anchor="middle">{ip}</text>
						{/if}
					</g>
				{/each}
			</g>
		</svg>

		<!-- 链路端口 tooltip -->
		{#if hoverLink >= 0 && containerEl}
			{@const e = deviceLinks[hoverLink]}
			{@const rect = containerEl.getBoundingClientRect()}
			<div
				class="tip"
				style="left:{Math.min(tipX - rect.left + 14, vpW - 300)}px; top:{tipY - rect.top + 14}px"
			>
				<div class="tip-head">{devices[e.s].name} ⇄ {devices[e.t].name}</div>
				<div class="tip-sub">{e.ports.length} 条端口链路</div>
				{#each e.ports as pp}
					<div class="tip-port">{devices[e.s].name}:{pp.sName} ⇄ {devices[e.t].name}:{pp.tName}</div>
				{/each}
			</div>
		{/if}

		<!-- 节点详情面板(点击节点) -->
		{#if selectedInfo}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="detail" onmousedown={(e) => e.stopPropagation()} onwheel={(e) => e.stopPropagation()}>
				<div class="detail-head">
					<span class="detail-name">{selectedInfo.dev.name}</span>
					<span class="detail-role" style="color:{ROLE_COLOR[selectedInfo.dev.role]}"
						>{ROLE_LABEL[selectedInfo.dev.role]}</span
					>
					<button class="detail-close" onclick={() => (selected = -1)}>✕</button>
				</div>
				<div class="detail-body">
					{#if selectedInfo.model}
						<div class="row"><span class="k">型号</span><span class="v">{selectedInfo.model}</span></div>
					{/if}
					<div class="row"><span class="k">接口数</span><span class="v">{selectedInfo.ifCount}</span></div>
					<div class="row">
						<span class="k">IP</span>
						<span class="v">
							{#each selectedInfo.ips.slice(0, 8) as ip}<span class="ipchip">{ip}</span>{/each}
							{#if selectedInfo.ips.length > 8}<span class="more">+{selectedInfo.ips.length - 8}</span>{/if}
							{#if selectedInfo.ips.length === 0}—{/if}
						</span>
					</div>
					<div class="detail-neigh-head">邻居 {selectedInfo.neigh.length}</div>
					{#each selectedInfo.neigh as n}
						<div class="neigh">
							{#if ROLE_ICON[n.role]}
								<img class="leg-icon" src={ROLE_ICON[n.role]} alt="" />
							{:else}
								<span class="dot" style="background:{ROLE_COLOR[n.role]}"></span>
							{/if}
							<span class="nname">{n.name}</span>
							<div class="nports">
								{#each n.ports as pp}<div class="np">{pp.self} → {pp.other}</div>{/each}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- 链路详情面板(点击链路)-->
		{#if selectedLinkInfo}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="detail" onmousedown={(e) => e.stopPropagation()} onwheel={(e) => e.stopPropagation()}>
				<div class="detail-head">
					<span class="detail-name">{selectedLinkInfo.a.name} ⇄ {selectedLinkInfo.b.name}</span>
					<span class="detail-role" style="color:{stColor(selectedLinkInfo.status)}"
						>● {stText(selectedLinkInfo.status)}</span
					>
					<button class="detail-close" onclick={() => (selectedLink = -1)}>✕</button>
				</div>
				<div class="detail-body">
					<div class="row"><span class="k">端口链路</span><span class="v">{selectedLinkInfo.ports.length}</span></div>
					<div class="detail-neigh-head">端口对(两端接口 + 状态)</div>
					{#each selectedLinkInfo.ports as p}
						<div class="pp">
							<span class="dot" style="background:{stColor(p.sStat)}"></span>
							<span class="pp-txt"
								>{selectedLinkInfo.a.name}:{p.sName} ⇄ {selectedLinkInfo.b.name}:{p.tName}</span
							>
							<span class="dot" style="background:{stColor(p.tStat)}"></span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	/* 全部走 scanopy 主题变量(:root 浅色 / .dark 深色),light/dark 自适应 */
	.device-screen {
		position: relative;
		width: 100%;
		height: calc(100vh - 120px);
		overflow: hidden;
		background: var(--color-bg-body);
		cursor: grab;
	}
	.device-screen:active {
		cursor: grabbing;
	}
	.stage {
		display: block;
	}
	.hud {
		position: absolute;
		top: 12px;
		left: 16px;
		z-index: 3;
		font-size: 12px;
		color: var(--color-text-secondary);
		background: var(--color-bg-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 6px 12px;
		display: flex;
		align-items: center;
		backdrop-filter: blur(6px);
	}
	.hud b {
		color: var(--color-text-primary);
	}
	.legend {
		margin-left: 12px;
	}
	.legend span {
		margin-left: 10px;
	}
	.legend i {
		display: inline-block;
		width: 9px;
		height: 9px;
		border-radius: 2px;
		margin-right: 4px;
		vertical-align: -1px;
	}
	.leg-icon {
		display: inline-block;
		width: 16px;
		height: 16px;
		object-fit: contain;
		margin-right: 3px;
		vertical-align: -4px;
	}
	.reset {
		margin-left: 14px;
		padding: 2px 10px;
		font-size: 11px;
		color: var(--color-text-secondary);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: 5px;
		cursor: pointer;
	}
	.reset:hover {
		color: var(--color-text-primary);
		border-color: #3b82f6;
	}
	.node {
		cursor: grab;
	}
	.node.dragging {
		cursor: grabbing;
	}
	/* 连线颜色按接口状态(up=绿 / down=红 / 未知=灰),透明度由 inline 控制 */
	.edge {
		cursor: pointer;
	}
	.band-line {
		stroke: var(--color-border);
	}
	.wlan-base {
		fill: var(--color-bg-surface);
	}
	.label {
		font-size: 11px;
		fill: var(--color-text-primary);
		paint-order: stroke;
		stroke: var(--color-bg-body);
		stroke-width: 3px;
		pointer-events: none;
	}
	.label.hl {
		font-weight: 700;
	}
	.tier-label {
		fill: var(--color-text-secondary);
		font-size: 13px;
		font-weight: 600;
		pointer-events: none;
	}
	.ip-label {
		fill: var(--color-text-secondary);
		font-size: 9px;
		paint-order: stroke;
		stroke: var(--color-bg-body);
		stroke-width: 3px;
		pointer-events: none;
	}
	/* 对齐原生 L2/L3 inspector 的 .card 风格:bg-surface + 毛玻璃 + 大圆角 + 阴影 */
	.detail {
		position: absolute;
		top: 12px;
		right: 12px;
		z-index: 6;
		width: 300px;
		max-height: calc(100% - 24px);
		display: flex;
		flex-direction: column;
		background: var(--color-bg-surface);
		border: 1px solid var(--color-border);
		border-radius: 16px;
		box-shadow:
			0 20px 25px -5px rgba(0, 0, 0, 0.25),
			0 8px 10px -6px rgba(0, 0, 0, 0.25);
		backdrop-filter: blur(8px);
		overflow: hidden;
	}
	.detail-head {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--color-border);
	}
	.detail-name {
		font-weight: 600;
		font-size: 14px;
		color: var(--color-text-primary);
		flex: 1;
		word-break: break-all;
	}
	.detail-role {
		font-size: 12px;
		font-weight: 600;
	}
	.detail-close {
		background: transparent;
		border: none;
		color: var(--color-text-secondary);
		cursor: pointer;
		font-size: 14px;
		line-height: 1;
	}
	.detail-close:hover {
		color: var(--color-text-primary);
	}
	.detail-body {
		padding: 10px 12px;
		overflow: auto;
		font-size: 12px;
		color: var(--color-text-secondary);
	}
	.row {
		display: flex;
		gap: 8px;
		margin-bottom: 6px;
	}
	.row .k {
		flex: 0 0 44px;
		color: var(--color-text-secondary);
	}
	.row .v {
		flex: 1;
		color: var(--color-text-primary);
		word-break: break-all;
	}
	.ipchip {
		display: inline-block;
		background: var(--color-bg-surface-hover);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		padding: 0 5px;
		margin: 0 4px 4px 0;
		font-family: ui-monospace, Menlo, monospace;
		font-size: 11px;
		color: var(--color-text-secondary);
	}
	.more {
		color: var(--color-text-secondary);
		font-size: 11px;
	}
	.detail-neigh-head {
		margin: 8px 0 6px;
		padding-top: 8px;
		border-top: 1px solid var(--color-border);
		color: var(--color-text-secondary);
		font-weight: 600;
	}
	.neigh {
		display: grid;
		grid-template-columns: 16px 1fr;
		gap: 4px 6px;
		margin-bottom: 7px;
	}
	.neigh .leg-icon {
		margin: 0;
		vertical-align: 0;
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		margin-top: 4px;
		flex: 0 0 auto;
	}
	.pp {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		margin-bottom: 6px;
	}
	.pp-txt {
		flex: 1;
		font-family: ui-monospace, Menlo, monospace;
		font-size: 11px;
		color: var(--color-text-secondary);
		word-break: break-all;
	}
	.nname {
		color: var(--color-text-primary);
		font-size: 12px;
		word-break: break-all;
	}
	.nports {
		grid-column: 2;
	}
	.np {
		font-family: ui-monospace, Menlo, monospace;
		font-size: 10px;
		color: var(--color-text-secondary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tip {
		position: absolute;
		z-index: 5;
		max-width: 300px;
		pointer-events: none;
		background: var(--color-bg-surface);
		border: 1px solid var(--color-border);
		border-radius: 10px;
		padding: 8px 11px;
		font-size: 12px;
		color: var(--color-text-primary);
		box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
		backdrop-filter: blur(8px);
	}
	.tip-head {
		font-weight: 600;
		margin-bottom: 3px;
	}
	.tip-sub {
		color: var(--color-text-secondary);
		margin-bottom: 5px;
	}
	.tip-port {
		font-family: ui-monospace, Menlo, monospace;
		font-size: 11px;
		color: var(--color-text-secondary);
		white-space: nowrap;
	}
	.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-secondary);
		font-size: 13px;
	}
</style>
