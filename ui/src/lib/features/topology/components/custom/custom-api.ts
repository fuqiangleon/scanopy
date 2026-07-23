// 自定义拓扑视图 前端 API 服务。
// 后端 /api/v1/topology/custom 为手写 axum 路由（未进 OpenAPI schema），
// 故此处用原生 fetch（带 session cookie），返回 ApiResponse.data。

import { API_BASE_PATH, getServerUrl } from '$lib/api/client';
import type { CustomGraphPayload } from './types';

export interface CustomTopology {
	id: string;
	created_at: string;
	updated_at: string;
	network_id: string;
	name: string;
	graph: CustomGraphPayload;
}

// n9e 嵌入时 API 要带 apiBase 前缀(/topo-studio/scanopy-api),否则裸 /api/v1 会落到
// n9e SPA 兜底(返回 index.html)。复用 apiClient 同一套前缀(getServerUrl + API_BASE_PATH)。
const BASE = `${getServerUrl()}${API_BASE_PATH}/api/v1/topology/custom`;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, {
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		...init
	});
	const body = (await res.json()) as { success: boolean; data?: T; error?: string };
	if (!res.ok || !body.success) {
		throw new Error(body.error ?? `请求失败(${res.status})`);
	}
	return body.data as T;
}

export const customTopologyApi = {
	/** 列出当前网络下的自定义视图。 */
	list(): Promise<CustomTopology[]> {
		return request<CustomTopology[]>(BASE);
	},

	/** 新建空白自定义视图。 */
	create(networkId: string, name: string): Promise<CustomTopology> {
		return request<CustomTopology>(BASE, {
			method: 'POST',
			body: JSON.stringify({ network_id: networkId, name, graph: { nodes: [], edges: [] } })
		});
	},

	/** 读取单个自定义视图。 */
	get(id: string): Promise<CustomTopology> {
		return request<CustomTopology>(`${BASE}/${id}`);
	},

	/** 整图保存（节点/边/图标/位置 + 名称）。 */
	save(topology: CustomTopology): Promise<CustomTopology> {
		return request<CustomTopology>(`${BASE}/${topology.id}`, {
			method: 'PUT',
			body: JSON.stringify(topology)
		});
	},

	/** 删除自定义视图。 */
	remove(id: string): Promise<void> {
		return request<void>(`${BASE}/${id}`, { method: 'DELETE' });
	}
};
