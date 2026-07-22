<script lang="ts">
	// 自定义拓扑画布：Svelte Flow + 图标库 + 空白节点 + 拖动 +（Phase 2）搜索真实设备加入 + 状态联动。
	// 独立于自动拓扑；节点/边为用户手绘，后续接后端 /api/v1/topology/custom 持久化。
	import {
		SvelteFlow,
		Background,
		BackgroundVariant,
		Controls,
		type Node,
		type Edge,
		type Connection
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { writable, get } from 'svelte/store';
	import { onMount } from 'svelte';
	import BlankNode from './BlankNode.svelte';
	import DeviceRefNode from './DeviceRefNode.svelte';
	import { ICON_LIST, iconSvg } from './icons';
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

	// Svelte Flow 数据
	const nodes = writable<Node[]>([]);
	const edges = writable<Edge[]>([]);
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

	const filteredDevices = $derived(
		devices.filter((d) => {
			if (!query.trim()) return true;
			const q = query.toLowerCase();
			return `${d.name} ${d.type ?? ''} ${d.ip ?? ''}`.toLowerCase().includes(q);
		})
	);

	function randomPos(): { x: number; y: number } {
		return { x: 140 + Math.random() * 220, y: 100 + Math.random() * 180 };
	}

	/** 图标库添加空白节点。 */
	function addBlankNode(iconKey: string, name: string): void {
		const id = `blank-${idCounter++}`;
		nodes.update((list) => [
			...list,
			{ id, type: 'blank', position: randomPos(), data: { icon: iconKey, label: name } }
		]);
	}

	/** 搜索结果添加真实设备节点（引用 host_id，状态实时）。 */
	function addDeviceNode(device: DeviceItem): void {
		const id = `device-${device.id}-${idCounter++}`;
		nodes.update((list) => [
			...list,
			{
				id,
				type: 'device',
				position: randomPos(),
				data: {
					hostId: device.id,
					icon: device.icon ?? 'server',
					label: device.name,
					sub: device.type ?? '',
					up: device.up
				}
			}
		]);
	}

	/** 拖动结束回写位置。 */
	function handleNodeDragStop({ targetNode }: { targetNode: Node | null }): void {
		if (!targetNode) return;
		nodes.update((list) =>
			list.map((n) => (n.id === targetNode.id ? { ...n, position: targetNode.position } : n))
		);
	}

	/** 连线：拖 handle 从起点到终点，按当前线型新增一条边。 */
	function handleConnect(connection: Connection): void {
		if (!connection.source || !connection.target || connection.source === connection.target) return;
		const id = `edge-${edgeCounter++}`;
		const edge: Edge = {
			id,
			source: connection.source,
			target: connection.target,
			data: { kind: linkType },
			style: EDGE_STYLE[linkType]
		};
		edges.update((list) => [...list, edge]);
	}

	// ---- 选中 / 删除 ----
	let selectedId = $state<string | null>(null);

	function handleNodeClick({ node }: { node: Node }): void {
		selectedId = node.id;
	}

	function deleteSelected(): void {
		if (!selectedId) return;
		const target = selectedId;
		nodes.update((list) => list.filter((n) => n.id !== target));
		edges.update((list) => list.filter((e) => e.source !== target && e.target !== target));
		selectedId = null;
	}

	// ---- 序列化 / 保存 ----
	function serializeGraph(): CustomGraphPayload {
		const ns = get(nodes).map((n) => ({
			id: n.id,
			kind: (n.type === 'device' ? 'device_ref' : 'blank') as 'blank' | 'device_ref',
			host_id: (n.data?.hostId as string | undefined) ?? null,
			icon: (n.data?.icon as string | undefined) ?? 'server',
			label: (n.data?.label as string | undefined) ?? '',
			x: n.position.x,
			y: n.position.y
		}));
		const es = get(edges).map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			kind: (e.data?.kind as 'real' | 'draw' | undefined) ?? 'draw',
			label: (e.data?.label as string | undefined) ?? null
		}));
		return { nodes: ns, edges: es };
	}

	function handleSave(): void {
		onsave?.(serializeGraph());
	}

	// ---- 加载初始图 ----
	function loadGraph(g: CustomGraphPayload): void {
		nodes.set(
			g.nodes.map((n) => ({
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
			}))
		);
		edges.set(
			g.edges.map((e) => ({
				id: e.id,
				source: e.source,
				target: e.target,
				data: { kind: e.kind },
				style: EDGE_STYLE[e.kind]
			}))
		);
	}

	onMount(() => {
		if (initialGraph) loadGraph(initialGraph);
	});
</script>

<div class="custom-topology-wrap">
	<header class="toolbar">
		<span class="view-name">📁 {name}</span>
		<span class="spacer"></span>
		<button class="tb-btn" type="button" onclick={deleteSelected} disabled={!selectedId}>
			🗑 删除选中
		</button>
		<button class="tb-btn primary" type="button" onclick={handleSave}>💾 保存</button>
	</header>
	<div class="custom-topology">
		<aside class="library">
		<div class="tabs">
			<button class="tab" class:active={tab === 'icons'} type="button" onclick={() => (tab = 'icons')}>
				📦 图标库
			</button>
			<button
				class="tab"
				class:active={tab === 'devices'}
				type="button"
				onclick={() => (tab = 'devices')}
			>
				🔍 搜索设备
			</button>
		</div>

		{#if tab === 'icons'}
			<div class="lib-grid">
				{#each ICON_LIST as item (item.key)}
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
			<p class="lib-hint">点击图标 = 添加空白节点，可拖动摆放。</p>
		{:else}
			<input class="search" placeholder="搜索真实设备(名称/类型/IP)…" bind:value={query} />
			<div class="dev-list">
				{#each filteredDevices as d (d.id)}
					<button class="dev-row" type="button" onclick={() => addDeviceNode(d)}>
						<span class="dot" class:on={d.up === true} class:off={d.up === false}></span>
						<span class="dev-name">{d.name}</span>
						<span class="dev-type">{d.type ?? ''}</span>
					</button>
				{:else}
					<p class="lib-hint">无设备数据。</p>
				{/each}
			</div>
			<p class="lib-hint">点击 = 加入真实设备，状态实时联动。</p>
		{/if}

		<div class="link-type">
			<div class="lt-title">连线类型（拖节点连接柄）</div>
			<div class="lt-btns">
				<button
					class="lt-btn"
					class:active={linkType === 'real'}
					type="button"
					onclick={() => (linkType = 'real')}>— 实线·真实链路</button
				>
				<button
					class="lt-btn"
					class:active={linkType === 'draw'}
					type="button"
					onclick={() => (linkType = 'draw')}>┅ 虚线·手绘</button
				>
			</div>
		</div>
	</aside>

	<div class="canvas">
		<SvelteFlow
			nodes={$nodes}
			edges={$edges}
			{nodeTypes}
			fitView
			snapGrid={[25, 25]}
			nodesDraggable
			nodesConnectable
			onnodedragstop={handleNodeDragStop}
			onnodeclick={handleNodeClick}
			onconnect={handleConnect}
		>
			<Background variant={BackgroundVariant.Dots} gap={22} />
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
		background: #fff;
		border-bottom: 1px solid #e3e8f0;
		flex-shrink: 0;
	}
	.view-name {
		font-weight: 600;
		font-size: 14px;
		color: #1e293b;
	}
	.spacer {
		flex: 1;
	}
	.tb-btn {
		border: 1px solid #e3e8f0;
		background: #fff;
		color: #334155;
		padding: 6px 12px;
		border-radius: 7px;
		font-size: 13px;
		cursor: pointer;
	}
	.tb-btn:hover {
		background: #f7f9fc;
	}
	.tb-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.tb-btn.primary {
		background: #2d77ee;
		color: #fff;
		border-color: #2d77ee;
	}
	.custom-topology {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.library {
		width: 216px;
		flex-shrink: 0;
		background: #fff;
		border-right: 1px solid #e3e8f0;
		display: flex;
		flex-direction: column;
		padding: 12px;
		gap: 10px;
		overflow: hidden;
	}
	.tabs {
		display: flex;
		gap: 4px;
	}
	.tab {
		flex: 1;
		padding: 6px 4px;
		font-size: 12px;
		border: 1px solid #e3e8f0;
		border-radius: 7px;
		background: #fff;
		color: #64748b;
		cursor: pointer;
	}
	.tab.active {
		background: #2d77ee;
		border-color: #2d77ee;
		color: #fff;
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
		border: 1px solid #e3e8f0;
		border-radius: 9px;
		background: #fff;
		cursor: pointer;
		color: #64748b;
		font-size: 11px;
	}
	.lib-item:hover {
		border-color: #2d77ee;
		background: #f5f9ff;
	}
	.lib-icon :global(svg) {
		width: 26px;
		height: 26px;
		display: block;
		color: #475569;
	}
	.search {
		width: 100%;
		padding: 7px 9px;
		border: 1px solid #e3e8f0;
		border-radius: 7px;
		font-size: 12px;
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
		background: #f2f6ff;
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
		color: #1e293b;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.dev-type {
		color: #94a3b8;
		font-size: 11px;
		margin-left: auto;
		flex-shrink: 0;
	}
	.lib-hint {
		font-size: 11px;
		color: #94a3b8;
		line-height: 1.5;
		margin: 0;
	}
	.link-type {
		margin-top: auto;
		border-top: 1px solid #eef2f7;
		padding-top: 10px;
	}
	.lt-title {
		font-size: 11px;
		color: #64748b;
		margin-bottom: 6px;
	}
	.lt-btns {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}
	.lt-btn {
		padding: 6px 8px;
		font-size: 12px;
		border: 1px solid #e3e8f0;
		border-radius: 7px;
		background: #fff;
		color: #475569;
		cursor: pointer;
		text-align: left;
	}
	.lt-btn.active {
		border-color: #2d77ee;
		color: #2d77ee;
		background: #f5f9ff;
	}
	.canvas {
		flex: 1;
		min-width: 0;
		position: relative;
	}
</style>
