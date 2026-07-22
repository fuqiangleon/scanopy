// 自定义拓扑：可搜索的真实设备条目（由父组件从 hosts/topology 数据映射而来）。
export interface DeviceItem {
	/** 真实设备 host id（DeviceRef 节点的 host_id）。 */
	id: string;
	/** 设备名称。 */
	name: string;
	/** 类型/副标题（如 交换机 / 人大金仓）。 */
	type?: string;
	/** IP（用于搜索匹配）。 */
	ip?: string;
	/** 图标 key（icons.ts 中的键）。 */
	icon?: string;
	/** 在线状态：true=在线(绿) false=离线(红)。 */
	up?: boolean;
}

// 与后端 CustomGraph(topology/types/custom.rs)对齐的持久化载荷。
export interface CustomGraphNode {
	id: string;
	kind: 'blank' | 'device_ref';
	host_id?: string | null;
	icon: string;
	label: string;
	x: number;
	y: number;
}
export interface CustomGraphEdge {
	id: string;
	source: string;
	target: string;
	kind: 'real' | 'draw';
	label?: string | null;
}
export interface CustomGraphPayload {
	nodes: CustomGraphNode[];
	edges: CustomGraphEdge[];
}
