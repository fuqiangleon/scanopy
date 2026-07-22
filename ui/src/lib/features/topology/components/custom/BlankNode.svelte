<script lang="ts">
	// 自定义拓扑「空白图标」节点：图标库拖出的手绘节点（无实时状态）。
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { iconSvg } from './icons';

	let { data }: NodeProps = $props();

	const icon = $derived((data?.icon as string | undefined) ?? 'server');
	const label = $derived((data?.label as string | undefined) ?? '');
</script>

<div class="blank-node">
	<!-- 四边连接桩：Loose 连接模式下每边可作起点/终点 -->
	<Handle id="t" type="source" position={Position.Top} />
	<Handle id="r" type="source" position={Position.Right} />
	<Handle id="b" type="source" position={Position.Bottom} />
	<Handle id="l" type="source" position={Position.Left} />
	<div class="icon">{@html iconSvg(icon)}</div>
	<div class="label">{label}</div>
</div>

<style>
	.blank-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 10px;
		min-width: 76px;
		background: var(--color-topology-node-bg);
		border: 1.5px solid var(--color-border);
		border-radius: 12px;
		color: var(--color-text-tertiary);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}
	.icon :global(svg) {
		width: 28px;
		height: 28px;
		display: block;
		color: var(--color-text-tertiary);
	}
	.label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
