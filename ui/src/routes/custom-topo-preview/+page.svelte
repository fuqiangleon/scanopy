<script lang="ts">
	// 临时预览页（本地验证用，合并前可删）：直接渲染自定义拓扑画布 + mock 设备。
	// 访问 http://localhost:5173/custom-topo-preview
	import CustomTopologyCanvas from '$lib/features/topology/components/custom/CustomTopologyCanvas.svelte';
	import type { DeviceItem } from '$lib/features/topology/components/custom/types';

	const mockDevices: DeviceItem[] = [
		{ id: 'h1', name: 'YJ-KA-HJ', type: '核心交换机', icon: 'switch', up: true, ip: '10.185.233.202' },
		{ id: 'h2', name: 'YJ-KA-1', type: '接入交换机', icon: 'switch', up: true, ip: '10.185.233.101' },
		{ id: 'h3', name: 'KingBase-01', type: '人大金仓', icon: 'db', up: true, ip: '10.186.12.31' },
		{ id: 'h4', name: 'Nginx-web-1', type: 'Nginx', icon: 'server', up: true, ip: '10.186.12.40' },
		{ id: 'h5', name: 'Nginx-web-2', type: 'Nginx', icon: 'server', up: false, ip: '10.186.12.41' },
		{ id: 'h6', name: 'SG-6000-FW', type: '防火墙', icon: 'firewall', up: true, ip: '10.185.3.100' },
		{ id: 'h7', name: 'UPS-201', type: 'UPS·电量100%', icon: 'ups', up: true, ip: '10.185.232.201' },
		{ id: 'h8', name: 'OceanBase-c1', type: 'OceanBase', icon: 'db', up: false, ip: '10.187.20.5' }
	];

	function handleSave(graph: unknown): void {
		// 预览页仅打印，不落后端
		console.log('自定义拓扑保存载荷：', graph);
	}
</script>

<div class="preview-shell">
	<CustomTopologyCanvas devices={mockDevices} name="预览 · 自定义拓扑" onsave={handleSave} />
</div>

<style>
	.preview-shell {
		position: fixed;
		inset: 0;
		height: 100vh;
		width: 100vw;
		background: #f4f6fa;
	}
</style>
