-- 自定义拓扑视图:用户手绘的独立画布，整图(节点/边)持久化为 JSONB。
-- 节点可通过 graph 内的 host_id 引用真实设备，但本表不与自动拓扑(topologies)共享结构。
CREATE TABLE custom_topologies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    graph JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_topologies_network ON custom_topologies(network_id);
