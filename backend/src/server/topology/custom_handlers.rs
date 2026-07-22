//! 自定义拓扑视图 CRUD handlers。
//!
//! 手写、直连 `GenericPostgresStorage<CustomTopology>`，**不接入 Entity/泛型 CRUD**
//! （避开 `EntityDiscriminants`/`EntityEnum` 的大范围耦合）。按 network 归属做访问控制。

use crate::server::{
    auth::middleware::permissions::{Authorized, Member},
    config::AppState,
    shared::{
        storage::{
            filter::StorableFilter,
            generic::GenericPostgresStorage,
            traits::{Storable, Storage},
        },
        types::api::{ApiError, ApiResponse, ApiResult},
    },
    topology::types::custom::{CustomTopology, CustomTopologyBase},
};
use axum::{
    Json,
    extract::{Path, State},
};
use std::sync::Arc;
use uuid::Uuid;

fn store(state: &Arc<AppState>) -> GenericPostgresStorage<CustomTopology> {
    GenericPostgresStorage::<CustomTopology>::new(state.pool.clone())
}

/// GET /api/v1/topology/custom — 列出当前用户可见网络下的自定义视图。
pub async fn list_custom(
    State(state): State<Arc<AppState>>,
    auth: Authorized<Member>,
) -> ApiResult<Json<ApiResponse<Vec<CustomTopology>>>> {
    let network_ids = auth.network_ids();
    let filter = StorableFilter::<CustomTopology>::new_from_network_ids(&network_ids);
    let list = store(&state).get_all(filter).await.map_err(ApiError::from)?;
    Ok(Json(ApiResponse::success(list)))
}

/// POST /api/v1/topology/custom — 新建自定义视图。
pub async fn create_custom(
    State(state): State<Arc<AppState>>,
    auth: Authorized<Member>,
    Json(base): Json<CustomTopologyBase>,
) -> ApiResult<Json<ApiResponse<CustomTopology>>> {
    let network_ids = auth.network_ids();
    if !network_ids.contains(&base.network_id) {
        return Err(ApiError::forbidden("No access to this network"));
    }
    let entity = <CustomTopology as Storable>::new(base);
    let created = store(&state).create(&entity).await.map_err(ApiError::from)?;
    Ok(Json(ApiResponse::success(created)))
}

/// GET /api/v1/topology/custom/{id} — 读取单个自定义视图。
pub async fn get_custom(
    State(state): State<Arc<AppState>>,
    auth: Authorized<Member>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<ApiResponse<CustomTopology>>> {
    let network_ids = auth.network_ids();
    let item = store(&state)
        .get_by_id(&id)
        .await
        .map_err(ApiError::from)?
        .filter(|t| network_ids.contains(&t.base.network_id))
        .ok_or_else(|| ApiError::not_found("Custom topology not found".to_string()))?;
    Ok(Json(ApiResponse::success(item)))
}

/// PUT /api/v1/topology/custom/{id} — 整图保存（节点/边/图标/位置）。
pub async fn update_custom(
    State(state): State<Arc<AppState>>,
    auth: Authorized<Member>,
    Path(id): Path<Uuid>,
    Json(mut body): Json<CustomTopology>,
) -> ApiResult<Json<ApiResponse<CustomTopology>>> {
    let network_ids = auth.network_ids();
    let s = store(&state);
    let existing = s
        .get_by_id(&id)
        .await
        .map_err(ApiError::from)?
        .filter(|t| network_ids.contains(&t.base.network_id))
        .ok_or_else(|| ApiError::not_found("Custom topology not found".to_string()))?;
    // id / created_at / network_id 不可变，从既有行恢复；其余（name/graph）接受更新。
    body.id = existing.id;
    body.created_at = existing.created_at;
    body.updated_at = chrono::Utc::now();
    body.base.network_id = existing.base.network_id;
    let updated = s.update(&mut body).await.map_err(ApiError::from)?;
    Ok(Json(ApiResponse::success(updated)))
}

/// DELETE /api/v1/topology/custom/{id} — 删除自定义视图。
pub async fn delete_custom(
    State(state): State<Arc<AppState>>,
    auth: Authorized<Member>,
    Path(id): Path<Uuid>,
) -> ApiResult<Json<ApiResponse<()>>> {
    let network_ids = auth.network_ids();
    let s = store(&state);
    let exists = s
        .get_by_id(&id)
        .await
        .map_err(ApiError::from)?
        .filter(|t| network_ids.contains(&t.base.network_id))
        .is_some();
    if !exists {
        return Err(ApiError::not_found("Custom topology not found".to_string()));
    }
    s.delete(&id).await.map_err(ApiError::from)?;
    Ok(Json(ApiResponse::success(())))
}
