<script lang="ts">
	// 自定义拓扑画布（Phase 1）：Svelte Flow + 图标库 + 空白节点 + 拖动。
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
	import { ICON_LIST, iconSvg } from './icons';

	// Svelte Flow 数据（writable store,与 BaseTopologyViewer 同模式）
	const nodes = writable<Node[]>([]);
	const edges = writable<Edge[]>([]);
	const nodeTypes = { blank: BlankNode };

	let idCounter = $state(0);

	/** 从图标库添加一个空白节点。 */
	function addBlankNode(iconKey: string, name: string): void {
		const id = `blank-${idCounter++}`;
		const node: Node = {
			id,
			type: 'blank',
			position: { x: 140 + Math.random() * 220, y: 100 + Math.random() * 180 },
			data: { icon: iconKey, label: name }
		};
		nodes.update((list) => [...list, node]);
	}

	/** 拖动结束后回写位置到 store(保持持久化前的一致性)。 */
	function handleNodeDragStop({ targetNode }: { targetNode: Node | null }): void {
		if (!targetNode) return;
		nodes.update((list) =>
			list.map((n) => (n.id === targetNode.id ? { ...n, position: targetNode.position } : n))
		);
	}
</script>

<div class="custom-topology">
	<aside class="library">
		<div class="lib-title">图标库</div>
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
		width: 200px;
		flex-shrink: 0;
		background: #fff;
		border-right: 1px solid #e3e8f0;
		display: flex;
		flex-direction: column;
		padding: 12px;
		gap: 10px;
	}
	.lib-title {
		font-size: 13px;
		font-weight: 600;
		color: #334155;
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
