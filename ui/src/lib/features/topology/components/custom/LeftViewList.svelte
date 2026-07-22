<script lang="ts">
	// 拓扑页左侧视图分类列表：默认视图(L2/L3/设备互联图) + 自定义视图(可增删)。
	// 替换原顶部 RichSelect 切换器。选中项由父组件(TopologyTab)驱动渲染。
	import { Plus, Trash2 } from 'lucide-svelte';

	export interface BuiltinView {
		value: string;
		label: string;
	}
	export interface CustomView {
		id: string;
		name: string;
	}
	export type Selection = { kind: 'builtin'; value: string } | { kind: 'custom'; id: string };

	let {
		builtinViews = [],
		customViews = [],
		selected,
		onSelectBuiltin,
		onSelectCustom,
		onCreate,
		onDelete
	}: {
		builtinViews?: BuiltinView[];
		customViews?: CustomView[];
		selected: Selection;
		onSelectBuiltin: (value: string) => void;
		onSelectCustom: (id: string) => void;
		onCreate: () => void;
		onDelete: (id: string) => void;
	} = $props();

	function isBuiltinActive(value: string): boolean {
		return selected.kind === 'builtin' && selected.value === value;
	}
	function isCustomActive(id: string): boolean {
		return selected.kind === 'custom' && selected.id === id;
	}
</script>

<nav class="view-list">
	<div class="group-title">默认视图</div>
	<ul>
		{#each builtinViews as v (v.value)}
			<li>
				<button
					class="item"
					class:active={isBuiltinActive(v.value)}
					type="button"
					onclick={() => onSelectBuiltin(v.value)}
				>
					{v.label}
				</button>
			</li>
		{/each}
	</ul>

	<div class="group-title with-action">
		<span>自定义视图</span>
		<button class="add" type="button" title="新建自定义视图" onclick={onCreate}>
			<Plus size={14} />
		</button>
	</div>
	<ul>
		{#each customViews as c (c.id)}
			<li class="custom-row" class:active={isCustomActive(c.id)}>
				<button class="item" type="button" onclick={() => onSelectCustom(c.id)}>{c.name}</button>
				<button class="del" type="button" title="删除" onclick={() => onDelete(c.id)}>
					<Trash2 size={13} />
				</button>
			</li>
		{:else}
			<li class="empty">暂无，点 + 新建</li>
		{/each}
	</ul>
</nav>

<style>
	.view-list {
		width: 208px;
		flex-shrink: 0;
		background: #fff;
		border-right: 1px solid #e3e8f0;
		padding: 12px 8px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.group-title {
		font-size: 11px;
		font-weight: 600;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 10px 8px 4px;
	}
	.group-title.with-action {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.add {
		border: none;
		background: transparent;
		color: #2d77ee;
		cursor: pointer;
		display: flex;
		padding: 2px;
		border-radius: 5px;
	}
	.add:hover {
		background: #eef4ff;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.item {
		width: 100%;
		text-align: left;
		border: none;
		background: transparent;
		padding: 7px 10px;
		border-radius: 8px;
		font-size: 13px;
		color: #334155;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item:hover {
		background: #f2f6ff;
	}
	.item.active,
	.custom-row.active .item {
		background: #2d77ee;
		color: #fff;
	}
	.custom-row {
		display: flex;
		align-items: center;
	}
	.custom-row .item {
		flex: 1;
	}
	.del {
		border: none;
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
		padding: 4px;
		border-radius: 5px;
		opacity: 0;
	}
	.custom-row:hover .del {
		opacity: 1;
	}
	.del:hover {
		color: #dc2626;
		background: #fef2f2;
	}
	.custom-row.active .del {
		color: rgba(255, 255, 255, 0.8);
		opacity: 1;
	}
	.empty {
		font-size: 12px;
		color: #cbd5e1;
		padding: 6px 10px;
	}
</style>
