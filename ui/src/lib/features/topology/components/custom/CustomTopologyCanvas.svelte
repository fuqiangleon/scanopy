<script lang="ts">
	// 自定义拓扑画布：Svelte Flow + 图标库 + 空白节点 + 拖动 +（Phase 2）搜索真实设备加入 + 状态联动。
	// 独立于自动拓扑；节点/边为用户手绘，后续接后端 /api/v1/topology/custom 持久化。
	import {
		SvelteFlow,
		Background,
		BackgroundVariant,
		Controls,
		ConnectionMode,
		type Node,
		type Edge,
		type Connection
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { onMount } from 'svelte';
	import BlankNode from './BlankNode.svelte';
	import DeviceRefNode from './DeviceRefNode.svelte';
	import { Trash2, Save, Boxes, Search, FolderOpen } from 'lucide-svelte';
	import SegmentedControl from '$lib/shared/components/forms/SegmentedControl.svelte';
	import { ICON_GROUPS, iconSvg } from './icons';
	import type { DeviceItem } from './types';

	import type { CustomGraphPayload } from './types';

	// props：真实设备列表、视图名、初始图、保存回调（父组件接后端持久化）。
	let {
		devices = [],
		name = '未命名视图',
		initialGraph,
		onsave
	}: {
		devices?: DeviceItem[];
		name?: string;
		initialGraph?: CustomGraphPayload;
		onsave?: (graph: CustomGraphPayload) => void;
	} = $props();

	// Svelte Flow 数据(1.5 官方推荐 $state.raw + bind:,拖动时由 Flow 直接写回,避免全量重渲染)
	let nodes = $state.raw<Node[]>([]);
	let edges = $state.raw<Edge[]>([]);
	const nodeTypes = { blank: BlankNode, device: DeviceRefNode };

	let idCounter = $state(0);
	let edgeCounter = $state(0);
	let tab = $state<'icons' | 'devices'>('icons');
	let query = $state('');
	// 连线类型：real=引用真实链路(蓝实线) draw=手绘逻辑(灰虚线)
	let linkType = $state<'real' | 'draw'>('real');

	const EDGE_STYLE = {
		real: 'stroke:#2d77ee;stroke-width:2',
		draw: 'stroke:#94a3b8;stroke-width:2;stroke-dasharray:6 5'
	} as const;

	// 名称分档:真实名(0)优先,纯 IP(1)其次,UUID 兜底(2)垫底。
	function nameRank(name: string): number {
		if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return 1; // IP
		if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-/i.test(name)) return 2; // UUID
		return 0; // 真实名/主机名
	}

	const filteredDevices = $derived(
		devices
			.filter((d) => {
				if (!query.trim()) return true;
				const q = query.toLowerCase();
				return `${d.name} ${d.type ?? ''} ${d.ip ?? ''}`.toLowerCase().includes(q);
			})
			// 排序:真实名 → IP(数字序)→ UUID;同档内自然排序(IP 按数字、名称按字母)
			.sort(
				(a, b) =>
					nameRank(a.name) - nameRank(b.name) ||
					a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
			)
	);

	function randomPos(): { x: number; y: number } {
		return { x: 140 + Math.random() * 220, y: 100 + Math.random() * 180 };
	}

	/** 图标库添加空白节点。 */
	function addBlankNode(iconKey: string, name: string): void {
		const id = `blank-${idCounter++}`;
		nodes = [
			...nodes,
			{ id, type: 'blank', position: randomPos(), data: { icon: iconKey, label: name } }
		];
	}

	/** 搜索结果添加真实设备节点（引用 host_id，状态实时）。 */
	function addDeviceNode(device: DeviceItem): void {
		const id = `device-${device.id}-${idCounter++}`;
		nodes = [
			...nodes,
			{
				id,
				type: 'device',
				position: randomPos(),
				data: {
					hostId: device.id,
					icon: device.icon ?? 'server',
					label: device.name,
					// 副标题优先显示 IP(名称已是 IP 时不重复),否则显示类型
					sub: device.ip && device.ip !== device.name ? device.ip : (device.type ?? ''),
					up: device.up
				}
			}
		];
	}

	/** 连线：拖 handle 从起点到终点，按当前线型新增一条边。 */
	function handleConnect(connection: Connection): void {
		if (!connection.source || !connection.target || connection.source === connection.target) return;
		const id = `edge-${edgeCounter++}`;
		const edge: Edge = {
			id,
			source: connection.source,
			target: connection.target,
			// 记录连在哪条边(t/r/b/l),重载后连线仍落在原位
			sourceHandle: connection.sourceHandle ?? undefined,
			targetHandle: connection.targetHandle ?? undefined,
			data: { kind: linkType },
			style: EDGE_STYLE[linkType]
		};
		edges = [...edges, edge];
	}

	// ---- 选中 / 删除 ----
	let selectedId = $state<string | null>(null);

	function handleNodeClick({ node }: { node: Node }): void {
		selectedId = node.id;
	}

	function deleteSelected(): void {
		if (!selectedId) return;
		const target = selectedId;
		nodes = nodes.filter((n) => n.id !== target);
		edges = edges.filter((e) => e.source !== target && e.target !== target);
		selectedId = null;
	}

	// ---- 序列化 / 保存 ----
	function serializeGraph(): CustomGraphPayload {
		const ns = nodes.map((n) => ({
			id: n.id,
			kind: (n.type === 'device' ? 'device_ref' : 'blank') as 'blank' | 'device_ref',
			host_id: (n.data?.hostId as string | undefined) ?? null,
			icon: (n.data?.icon as string | undefined) ?? 'server',
			label: (n.data?.label as string | undefined) ?? '',
			x: n.position.x,
			y: n.position.y
		}));
		const es = edges.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			kind: (e.data?.kind as 'real' | 'draw' | undefined) ?? 'draw',
			label: (e.data?.label as string | undefined) ?? null,
			source_handle: e.sourceHandle ?? null,
			target_handle: e.targetHandle ?? null
		}));
		return { nodes: ns, edges: es };
	}

	function handleSave(): void {
		onsave?.(serializeGraph());
	}

	// ---- 加载初始图 ----
	function loadGraph(g: CustomGraphPayload): void {
		nodes = g.nodes.map((n) => ({
				id: n.id,
				type: n.kind === 'device_ref' ? 'device' : 'blank',
				position: { x: n.x, y: n.y },
				data:
					n.kind === 'device_ref'
						? {
								hostId: n.host_id,
								icon: n.icon,
								label: n.label,
								up: devices.find((d) => d.id === n.host_id)?.up
							}
						: { icon: n.icon, label: n.label }
		}));
		edges = g.edges.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			sourceHandle: e.source_handle ?? undefined,
			targetHandle: e.target_handle ?? undefined,
			data: { kind: e.kind },
			style: EDGE_STYLE[e.kind]
		}));
	}

	onMount(() => {
		if (initialGraph) loadGraph(initialGraph);
	});
</script>

<div class="custom-topology-wrap">
	<header class="toolbar">
		<span class="view-name"><FolderOpen class="h-4 w-4 flex-shrink-0" />{name}</span>
		<span class="spacer"></span>
		<button class="btn-danger text-sm" type="button" onclick={deleteSelected} disabled={!selectedId}>
			<Trash2 class="h-4 w-4" />删除选中
		</button>
		<button class="btn-primary text-sm" type="button" onclick={handleSave}>
			<Save class="h-4 w-4" />保存
		</button>
	</header>
	<div class="custom-topology">
		<aside class="library">
			<SegmentedControl
				options={[
					{ value: 'icons', label: '图标库', icon: Boxes },
					{ value: 'devices', label: '搜索设备', icon: Search }
				]}
				selected={tab}
				onchange={(v) => (tab = v as 'icons' | 'devices')}
				fullWidth
			/>

		{#if tab === 'icons'}
			<div class="lib-scroll">
				{#each ICON_GROUPS as g (g.name)}
					<div class="lib-group">{g.name}</div>
					<div class="lib-grid">
						{#each g.items as item (item.key)}
							<button
								class="lib-item"
								type="button"
								title={item.name}
								onclick={() => addBlankNode(item.key, item.name)}
							>
								<span class="lib-icon">{@html iconSvg(item.key)}</span>
								<span class="lib-name">{item.name}</span>
							</button>
						{/each}
					</div>
				{/each}
			</div>
			<p class="lib-hint">点击图标 = 添加空白节点，可拖动摆放。</p>
		{:else}
			<input
				class="input-secondary w-full text-sm"
				placeholder="搜索真实设备(名称/类型/IP)…"
				bind:value={query}
			/>
			<div class="dev-list">
				{#each filteredDevices as d (d.id)}
					<button class="dev-row" type="button" onclick={() => addDeviceNode(d)}>
						<span class="dot" class:on={d.up === true} class:off={d.up === false}></span>
						<span class="dev-name">{d.name}</span>
						<span class="dev-type">{d.ip && d.ip !== d.name ? d.ip : (d.type ?? '')}</span>
					</button>
				{:else}
					<p class="lib-hint">无设备数据。</p>
				{/each}
			</div>
			<p class="lib-hint">点击 = 加入真实设备，状态实时联动。</p>
		{/if}

		<div class="link-type">
			<div class="lt-title">连线类型（拖节点连接柄）</div>
			<SegmentedControl
				options={[
					{ value: 'real', label: '实线·真实链路' },
					{ value: 'draw', label: '虚线·手绘' }
				]}
				selected={linkType}
				onchange={(v) => (linkType = v as 'real' | 'draw')}
				fullWidth
			/>
		</div>
	</aside>

	<div class="canvas">
		<SvelteFlow
			bind:nodes
			bind:edges
			{nodeTypes}
			connectionMode={ConnectionMode.Loose}
			proOptions={{ hideAttribution: true }}
			fitView
			nodesDraggable
			nodesConnectable
			onnodeclick={handleNodeClick}
			onconnect={handleConnect}
		>
			<Background variant={BackgroundVariant.Dots} gap={22} bgColor="var(--color-topology-bg)" />
			<Controls />
		</SvelteFlow>
		</div>
	</div>
</div>

<style>
	.custom-topology-wrap {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
	}
	.toolbar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 14px;
		background: var(--color-bg-surface);
		border-bottom: 1px solid var(--color-border);
		flex-shrink: 0;
	}
	.view-name {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		font-size: 14px;
		color: var(--color-text-primary);
	}
	.spacer {
		flex: 1;
	}
	.custom-topology {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.library {
		width: 216px;
		flex-shrink: 0;
		background: var(--color-bg-surface);
		border-right: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		padding: 12px;
		gap: 10px;
		overflow: hidden;
	}
	.lib-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 0 -6px;
		padding: 0 6px;
	}
	.lib-group {
		font-size: 11px;
		font-weight: 600;
		color: var(--color-text-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
		padding: 6px 2px 0;
	}
	.lib-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}
	.lib-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 4px;
		border: 1px solid var(--color-border);
		border-radius: 9px;
		background: var(--color-bg-elevated);
		cursor: pointer;
		color: var(--color-text-tertiary);
		font-size: 11px;
	}
	.lib-item:hover {
		border-color: #2d77ee;
		background: var(--color-bg-surface-hover);
	}
	.lib-icon :global(svg) {
		width: 26px;
		height: 26px;
		display: block;
		color: var(--color-text-secondary);
	}
	.dev-list {
		flex: 1;
		overflow: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.dev-row {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 6px 7px;
		border: none;
		border-radius: 7px;
		background: transparent;
		cursor: pointer;
		font-size: 12px;
		text-align: left;
	}
	.dev-row:hover {
		background: var(--color-bg-surface-hover);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #94a3b8;
		flex-shrink: 0;
	}
	.dot.on {
		background: #22c55e;
	}
	.dot.off {
		background: #ef4444;
	}
	.dev-name {
		color: var(--color-text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dev-type {
		color: var(--color-text-muted);
		font-size: 11px;
		margin-left: auto;
		flex-shrink: 0;
	}
	.lib-hint {
		font-size: 11px;
		color: var(--color-text-muted);
		line-height: 1.5;
		margin: 0;
	}
	.link-type {
		margin-top: auto;
		border-top: 1px solid var(--color-border);
		padding-top: 10px;
	}
	.lt-title {
		font-size: 11px;
		color: var(--color-text-tertiary);
		margin-bottom: 6px;
	}
	.canvas {
		flex: 1;
		min-width: 0;
		position: relative;
	}
	/* SvelteFlow 画布 pane 用拓扑专用底色(与默认 L2/L3 拓扑一致,暗色 #15131e)*/
	.canvas :global(.svelte-flow) {
		background: var(--color-topology-bg);
		/* Controls(缩放/适配/锁定)按钮跟随明暗主题,避免暗色下白框突兀 */
		--xy-controls-button-background-color: var(--color-bg-elevated);
		--xy-controls-button-background-color-hover: var(--color-bg-surface-hover);
		--xy-controls-button-color: var(--color-text-secondary);
		--xy-controls-button-color-hover: var(--color-text-primary);
		--xy-controls-button-border-color: var(--color-border);
	}
</style>
