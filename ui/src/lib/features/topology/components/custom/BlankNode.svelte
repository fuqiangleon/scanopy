<script lang="ts">
	// 自定义拓扑「空白图标」节点：图标库拖出的手绘节点（无实时状态）。
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import { iconSvg } from './icons';

	let { data }: NodeProps = $props();

	const icon = $derived((data?.icon as string | undefined) ?? 'server');
	const label = $derived((data?.label as string | undefined) ?? '');
</script>

<div class="blank-node">
	<Handle type="target" position={Position.Top} />
	<div class="icon">{@html iconSvg(icon)}</div>
	<div class="label">{label}</div>
	<Handle type="source" position={Position.Bottom} />
</div>

<style>
	.blank-node {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 10px;
		min-width: 76px;
		background: #fff;
		border: 1.5px solid #d6dbe4;
		border-radius: 12px;
		color: #64748b;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
	}
	.icon :global(svg) {
		width: 28px;
		height: 28px;
		display: block;
		color: #64748b;
	}
	.label {
		font-size: 12px;
		font-weight: 600;
		color: #334155;
		max-width: 120px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
