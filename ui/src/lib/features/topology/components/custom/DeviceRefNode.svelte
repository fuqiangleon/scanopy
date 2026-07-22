<script lang="ts">
	// 自定义拓扑「设备引用」节点：引用真实设备(host_id),右上角状态点实时联动。
	import { Handle, Position, type NodeProps } from '@xyflow/svelte';
	import Icon from '@iconify/svelte';
	import { iconName } from './icons';

	let { data }: NodeProps = $props();

	const icon = $derived((data?.icon as string | undefined) ?? 'server');
	const label = $derived((data?.label as string | undefined) ?? '');
	const sub = $derived((data?.sub as string | undefined) ?? '');
	// up 为 undefined 时视为未知（灰）
	const up = $derived(data?.up as boolean | undefined);
</script>

<div class="device-node">
	<!-- 四边连接桩：Loose 连接模式下每边可作起点/终点 -->
	<Handle id="t" type="source" position={Position.Top} />
	<Handle id="r" type="source" position={Position.Right} />
	<Handle id="b" type="source" position={Position.Bottom} />
	<Handle id="l" type="source" position={Position.Left} />
	<span
		class="status"
		class:online={up === true}
		class:offline={up === false}
		class:unknown={up === undefined}
	></span>
	<div class="icon"><Icon icon={iconName(icon)} /></div>
	<div class="text">
		<div class="label">{label}</div>
		{#if sub}<div class="sub">{sub}</div>{/if}
	</div>
</div>

<style>
	.device-node {
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px 8px 10px;
		min-width: 96px;
		background: var(--color-topology-node-bg);
		border: 1.5px solid var(--color-border);
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	.status {
		position: absolute;
		top: 8px;
		right: 8px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.status.online {
		background: #22c55e;
	}
	.status.offline {
		background: #ef4444;
	}
	.status.unknown {
		background: #94a3b8;
	}
	.icon :global(svg) {
		width: 28px;
		height: 28px;
		display: block;
		color: #2d77ee;
	}
	.label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-primary);
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.sub {
		font-size: 10px;
		color: var(--color-text-tertiary);
	}
</style>
