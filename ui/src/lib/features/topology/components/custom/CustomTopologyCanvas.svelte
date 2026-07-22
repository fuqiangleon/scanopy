<script lang="ts">
	// 自定义拓扑画布：Svelte Flow + 图标库 + 空白节点 + 拖动 +（Phase 2）搜索真实设备加入 + 状态联动。
	// 独立于自动拓扑；节点/边为用户手绘，后续接后端 /api/v1/topology/custom 持久化。
	import {
		SvelteFlow,
		Background,
		BackgroundVariant,
		Controls,
		type Node,
		type Edge
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { writable } from 'svelte/store';
	import BlankNode from './BlankNode.svelte';
	import DeviceRefNode from './DeviceRefNode.svelte';
	import { ICON_LIST, iconSvg } from './icons';
	import type { DeviceItem } from './types';

	// 父组件注入的真实设备列表（从 hosts/topology 数据映射）；缺省空。
	let { devices = [] }: { devices?: DeviceItem[] } = $props();

	// Svelte Flow 数据
	const nodes = writable<Node[]>([]);
	const edges = writable<Edge[]>([]);
	const nodeTypes = { blank: BlankNode, device: DeviceRefNode };

	let idCounter = $state(0);
	let tab = $state<'icons' | 'devices'>('icons');
	let query = $state('');

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
</script>

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
	</aside>

	<div class="canvas">
		<SvelteFlow
			nodes={$nodes}
			edges={$edges}
			{nodeTypes}
			fitView
			snapGrid={[25, 25]}
			nodesDraggable
			onnodedragstop={handleNodeDragStop}
		>
			<Background variant={BackgroundVariant.Dots} gap={22} />
			<Controls />
		</SvelteFlow>
	</div>
</div>

<style>
	.custom-topology {
		display: flex;
		height: 100%;
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
	.canvas {
		flex: 1;
		min-width: 0;
		position: relative;
	}
</style>
