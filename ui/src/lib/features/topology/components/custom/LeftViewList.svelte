<script lang="ts">
	// 拓扑页左侧视图分类列表：默认视图(L2/L3/设备互联图) + 自定义视图(可增删)。
	// 替换原顶部 RichSelect 切换器。选中项由父组件(TopologyTab)驱动渲染。
	import { Plus, Trash2, Waypoints } from 'lucide-svelte';
	import type { IconComponent } from '$lib/shared/utils/types';

	export interface BuiltinView {
		value: string;
		label: string;
		icon?: IconComponent;
		iconColor?: string;
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
	<div class="group-title">系统拓扑</div>
	<ul>
		{#each builtinViews as v (v.value)}
			<li>
				<button
					class="item"
					class:active={isBuiltinActive(v.value)}
					type="button"
					onclick={() => onSelectBuiltin(v.value)}
				>
					{#if v.icon}
						{@const Icon = v.icon}
						<Icon
							class="view-icon"
							style={!isBuiltinActive(v.value) && v.iconColor ? `color:${v.iconColor}` : undefined}
						/>
					{/if}
					<span class="item-label">{v.label}</span>
				</button>
			</li>
		{/each}
	</ul>

	<div class="group-title with-action">
		<span>自定义拓扑</span>
		<button class="add" type="button" title="新建自定义视图" onclick={onCreate}>
			<Plus size={14} />
		</button>
	</div>
	<ul>
		{#each customViews as c (c.id)}
			<li class="custom-row" class:active={isCustomActive(c.id)}>
				<button class="item" type="button" onclick={() => onSelectCustom(c.id)}>
					<Waypoints class="view-icon" />
					<span class="item-label">{c.name}</span>
				</button>
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
		background: var(--color-bg-surface);
		border-right: 1px solid var(--color-border);
		padding: 12px 8px;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.group-title {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.03em;
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
		background: var(--color-bg-surface-hover);
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
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		text-align: left;
		border: 1px solid transparent; /* 与选中态蓝边等宽,避免选中时布局跳动 */
		background: transparent;
		padding: 6px 10px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		color: var(--color-text-tertiary);
		cursor: pointer;
		transition: background-color 0.12s, color 0.12s;
	}
	/* 视图类型图标:显示拓扑层级/类型,尺寸统一,颜色随文字或视图色 */
	.item :global(.view-icon) {
		width: 15px;
		height: 15px;
		flex-shrink: 0;
	}
	.item-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item:hover {
		background: var(--color-bg-surface-hover);
		color: var(--color-text-secondary);
	}
	/* 选中态对齐 scanopy Sidebar:淡蓝底 + 主色文字 + 细蓝边(暗色加深) */
	.item.active,
	.custom-row.active .item {
		background: #dbeafe;
		border-color: rgba(59, 130, 246, 0.3);
		color: var(--color-text-primary);
	}
	:global(.dark) .item.active,
	:global(.dark) .custom-row.active .item {
		background: #1d4ed8;
		border-color: #2563eb;
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
		color: var(--color-text-muted);
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
		background: var(--color-bg-surface-hover);
	}
	.custom-row.active .del {
		color: var(--color-text-tertiary);
		opacity: 1;
	}
	.empty {
		font-size: 12px;
		color: var(--color-text-disabled);
		padding: 6px 10px;
	}
</style>
