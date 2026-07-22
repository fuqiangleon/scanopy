// 自定义拓扑图标库(Iconify)。
// 设计:graph 里持久化的是稳定语义 key（'switch'/'server'…），与图标集解耦;
// 这里把 key 映射到 Iconify 图标名,由 @iconify/svelte <Icon> 渲染。
// 换图标只改这张表,不动数据。图标名均已通过 Iconify API 核实存在。

// 离线注册:所有图标消费方(BlankNode/DeviceRefNode/Canvas)都从本模块导入,
// 故在此注册离线数据,保证渲染前完成,且不触发运行时公网请求(内网可用)。
import { registerCustomTopoIcons } from './icon-data';
registerCustomTopoIcons();

// 语义 key → Iconify 图标名。
// 单色图标(material-symbols/mdi/tabler/carbon)走 currentColor,可被 .icon 的 color 主题化;
// 彩色品牌 logo(logos:*)自带填充色,不受 color 影响。
export const ICON_NAMES: Record<string, string> = {
	// 网络
	switch: 'material-symbols:lan',
	router: 'material-symbols:router',
	firewall: 'mdi:firewall',
	lb: 'tabler:load-balancer',
	gateway: 'material-symbols:hub',
	ap: 'material-symbols:wifi',
	dns: 'material-symbols:dns',
	// 计算
	server: 'mdi:server',
	baremetal: 'carbon:bare-metal-server',
	vm: 'carbon:virtual-machine',
	host: 'material-symbols:computer',
	k8s: 'logos:kubernetes',
	// 存储
	storage: 'material-symbols:storage',
	nas: 'mdi:nas',
	// 数据库(通用 + 品牌彩色 logo)
	db: 'material-symbols:database',
	postgresql: 'logos:postgresql',
	mysql: 'logos:mysql',
	mongodb: 'logos:mongodb',
	redis: 'logos:redis',
	es: 'logos:elasticsearch',
	// 机房动环
	ups: 'material-symbols:battery-charging-full',
	aircon: 'mdi:air-conditioner',
	temp: 'mdi:thermometer',
	camera: 'mdi:cctv',
	water: 'mdi:water-alert',
	power: 'mdi:transmission-tower',
	fire: 'mdi:fire-alert',
	// 中间件(彩色 logo)
	nginx: 'logos:nginx',
	kafka: 'logos:kafka',
	rabbitmq: 'logos:rabbitmq',
	// 其他
	cloud: 'material-symbols:cloud',
	internet: 'material-symbols:public',
	api: 'material-symbols:api'
};

export interface IconMeta {
	key: string;
	name: string;
	group: string;
}

// 图标库面板展示顺序(按类别分组)。
export const ICON_LIST: IconMeta[] = [
	{ key: 'switch', name: '交换机', group: '网络' },
	{ key: 'router', name: '路由器', group: '网络' },
	{ key: 'firewall', name: '防火墙', group: '网络' },
	{ key: 'lb', name: '负载均衡', group: '网络' },
	{ key: 'gateway', name: '网关/汇聚', group: '网络' },
	{ key: 'ap', name: '无线AP', group: '网络' },
	{ key: 'dns', name: 'DNS', group: '网络' },
	{ key: 'server', name: '服务器', group: '计算' },
	{ key: 'baremetal', name: '物理机', group: '计算' },
	{ key: 'vm', name: '虚拟机', group: '计算' },
	{ key: 'host', name: '主机/终端', group: '计算' },
	{ key: 'k8s', name: '容器/K8s', group: '计算' },
	{ key: 'storage', name: '存储', group: '存储' },
	{ key: 'nas', name: 'NAS', group: '存储' },
	{ key: 'db', name: '数据库', group: '数据库' },
	{ key: 'postgresql', name: 'PostgreSQL', group: '数据库' },
	{ key: 'mysql', name: 'MySQL', group: '数据库' },
	{ key: 'mongodb', name: 'MongoDB', group: '数据库' },
	{ key: 'redis', name: 'Redis', group: '数据库' },
	{ key: 'es', name: 'Elasticsearch', group: '数据库' },
	{ key: 'ups', name: 'UPS', group: '机房动环' },
	{ key: 'aircon', name: '空调', group: '机房动环' },
	{ key: 'temp', name: '温湿度', group: '机房动环' },
	{ key: 'camera', name: '摄像头', group: '机房动环' },
	{ key: 'water', name: '漏水', group: '机房动环' },
	{ key: 'power', name: '配电', group: '机房动环' },
	{ key: 'fire', name: '消防/烟感', group: '机房动环' },
	{ key: 'nginx', name: 'Nginx', group: '中间件' },
	{ key: 'kafka', name: 'Kafka', group: '中间件' },
	{ key: 'rabbitmq', name: 'RabbitMQ', group: '中间件' },
	{ key: 'cloud', name: '云/外部', group: '其他' },
	{ key: 'internet', name: '互联网', group: '其他' },
	{ key: 'api', name: 'API', group: '其他' }
];

// 按 group 聚合(供图标库面板分类渲染)。保持 ICON_LIST 顺序。
export interface IconGroup {
	name: string;
	items: IconMeta[];
}
export const ICON_GROUPS: IconGroup[] = ICON_LIST.reduce((acc: IconGroup[], item) => {
	let g = acc.find((x) => x.name === item.group);
	if (!g) {
		g = { name: item.group, items: [] };
		acc.push(g);
	}
	g.items.push(item);
	return acc;
}, []);

/** 语义 key → Iconify 图标名(未知 key 回退到 server)。 */
export function iconName(key: string): string {
	return ICON_NAMES[key] ?? ICON_NAMES.server;
}
