<script lang="ts">
	// 自定义拓扑容器：接后端 CRUD 的 save/load，渲染画布。
	// devices 由父组件从 hosts/topology 数据映射注入（保持画布解耦）。
	import CustomTopologyCanvas from './CustomTopologyCanvas.svelte';
	import { customTopologyApi, type CustomTopology } from './custom-api';
	import type { DeviceItem, CustomGraphPayload } from './types';

	let {
		networkId,
		devices = [],
		topologyId
	}: { networkId: string; devices?: DeviceItem[]; topologyId?: string } = $props();

	let current = $state<CustomTopology | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let saving = $state(false);

	// topologyId 指定时加载该视图;否则退化为「取第一个/新建」(独立预览用)。
	async function load(id: string | undefined): Promise<void> {
		loading = true;
		error = null;
		try {
			if (id) {
				current = await customTopologyApi.get(id);
			} else {
				const list = await customTopologyApi.list();
				current = list[0] ?? (await customTopologyApi.create(networkId, '自定义拓扑'));
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			loading = false;
		}
	}

	// topologyId 变化(左列切换不同自定义视图)时重新加载。
	$effect(() => {
		load(topologyId);
	});

	async function handleSave(graph: CustomGraphPayload): Promise<void> {
		if (!current || saving) return;
		saving = true;
		error = null;
		try {
			current = await customTopologyApi.save({ ...current, graph });
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}
</script>

{#if loading}
	<div class="state">加载自定义拓扑…</div>
{:else if error}
	<div class="state error">加载失败：{error}</div>
{:else if current}
	{#key current.id}
		<CustomTopologyCanvas
			{devices}
			name={current.name}
			initialGraph={current.graph}
			onsave={handleSave}
		/>
	{/key}
{/if}

<style>
	.state {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: #64748b;
		font-size: 14px;
	}
	.state.error {
		color: #dc2626;
	}
</style>
