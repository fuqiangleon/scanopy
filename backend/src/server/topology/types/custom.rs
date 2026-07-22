//! 自定义拓扑视图（Custom Topology）。
//!
//! 与自动拓扑（`base::Topology`，图按需从实体重建、不持久化）不同：
//! 自定义视图是**用户手绘的独立画布**，其图（节点/边）**必须整体持久化**，
//! 但节点可通过 `host_id` **引用真实设备**，渲染时叠加实时状态（在线/名称）。
//! 因此单独建实体，避免触碰自动拓扑脆弱的重建逻辑。

use crate::server::shared::storage::traits::{SqlValue, Storable};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use sqlx::postgres::PgRow;
use std::fmt::Display;
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

/// 自定义拓扑视图（持久化实体，一条 = 一张手绘画布）。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, ToSchema, Validate)]
pub struct CustomTopology {
    #[serde(default)]
    #[schema(read_only, required)]
    pub id: Uuid,
    #[serde(default)]
    #[schema(read_only, required)]
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    #[schema(read_only, required)]
    pub updated_at: DateTime<Utc>,
    #[serde(flatten)]
    #[validate(nested)]
    pub base: CustomTopologyBase,
}

/// 自定义视图可变部分（创建/更新时提交）。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, ToSchema, Validate)]
pub struct CustomTopologyBase {
    pub network_id: Uuid,
    #[validate(length(min = 1, max = 200))]
    pub name: String,
    #[serde(default)]
    #[validate(nested)]
    pub graph: CustomGraph,
}

/// 手绘图内容。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, ToSchema, Validate)]
pub struct CustomGraph {
    #[serde(default)]
    #[validate(nested)]
    pub nodes: Vec<CustomNode>,
    #[serde(default)]
    #[validate(nested)]
    pub edges: Vec<CustomEdge>,
}

/// 节点类型：空白图标 或 引用真实设备。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CustomNodeKind {
    /// 纯手绘图标（逻辑/装饰/暂无数据的对象），无状态。
    #[default]
    Blank,
    /// 引用真实设备（`host_id`），渲染时叠加实时状态。
    DeviceRef,
}

/// 自定义节点。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, ToSchema, Validate)]
pub struct CustomNode {
    #[validate(length(min = 1, max = 100))]
    pub id: String,
    #[serde(default)]
    pub kind: CustomNodeKind,
    /// `DeviceRef` 时引用的真实设备 host id；`Blank` 时为 None。
    #[serde(default)]
    pub host_id: Option<Uuid>,
    /// 图标库 key（如 switch/server/firewall/db/cloud…）。
    #[serde(default)]
    #[validate(length(max = 100))]
    pub icon: String,
    #[serde(default)]
    #[validate(length(max = 200))]
    pub label: String,
    pub x: f64,
    pub y: f64,
}

/// 边类型：引用真实链路 或 手绘逻辑关系。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum CustomEdgeKind {
    /// 实线：引用真实链路 / 连接两个真实设备。
    Real,
    /// 虚线：手绘逻辑关系（可命名）。
    #[default]
    Draw,
}

/// 自定义边。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, ToSchema, Validate)]
pub struct CustomEdge {
    #[validate(length(min = 1, max = 100))]
    pub id: String,
    /// 起点节点 id（对应 `CustomNode.id`）。
    #[validate(length(min = 1, max = 100))]
    pub source: String,
    /// 终点节点 id。
    #[validate(length(min = 1, max = 100))]
    pub target: String,
    #[serde(default)]
    pub kind: CustomEdgeKind,
    #[serde(default)]
    #[validate(length(max = 200))]
    pub label: Option<String>,
}

// ---- 持久化(只实现 Storable + Display,复用 GenericPostgresStorage;不接入 Entity 系统)----

impl Storable for CustomTopology {
    type BaseData = CustomTopologyBase;

    fn table_name() -> &'static str {
        "custom_topologies"
    }

    fn new(base: Self::BaseData) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            created_at: now,
            updated_at: now,
            base,
        }
    }

    fn get_base(&self) -> Self::BaseData {
        self.base.clone()
    }

    fn to_params(&self) -> Result<(Vec<&'static str>, Vec<SqlValue>), anyhow::Error> {
        let Self {
            id,
            created_at,
            updated_at,
            base:
                CustomTopologyBase {
                    network_id,
                    name,
                    graph,
                },
        } = self.clone();

        Ok((
            vec![
                "id",
                "created_at",
                "updated_at",
                "network_id",
                "name",
                "graph",
            ],
            vec![
                SqlValue::Uuid(id),
                SqlValue::Timestamp(created_at),
                SqlValue::Timestamp(updated_at),
                SqlValue::Uuid(network_id),
                SqlValue::String(name),
                SqlValue::CustomGraph(graph),
            ],
        ))
    }

    fn from_row(row: &PgRow) -> Result<Self, anyhow::Error> {
        let graph: CustomGraph =
            serde_json::from_value(row.get::<serde_json::Value, _>("graph"))
                .map_err(|e| anyhow::anyhow!("Failed to deserialize custom graph: {}", e))?;

        Ok(CustomTopology {
            id: row.get("id"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
            base: CustomTopologyBase {
                network_id: row.get("network_id"),
                name: row.get("name"),
                graph,
            },
        })
    }
}

impl Display for CustomTopology {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "CustomTopology {{ id: {} }}", self.id)
    }
}
