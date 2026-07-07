#!/usr/bin/env bash
# 构建并推送 fork 版 scanopy 镜像(server + daemon)到 Docker Hub。
#
# 两个镜像都是自包含多阶段构建(镜像内编译),宿主只需 docker,不需要 Rust/Node。
#   - server:backend/Dockerfile(Rust 编 server + Node 编 UI + debian-slim 运行时)
#   - daemon:backend/Dockerfile.daemon(Rust 编 daemon + debian-slim 运行时)
# context 均为仓库根。
#
# 用法:
#   ./build-images.sh                       # 构建 + 推送 :latest
#   SCANOPY_TAG=v0.17.2-o9e.1 ./build-images.sh   # 指定 tag(钉版本)
#   SKIP_PUSH=1 ./build-images.sh           # 只本地构建,不推送
#   SCANOPY_REGISTRY=myuser ./build-images.sh     # 换仓库前缀(默认 fuqiangleon)
#
# 前置:docker login(推送时)。amd64 目标;在 arm64 宿主(Mac)上会用 QEMU 模拟,较慢。
set -euo pipefail

TAG="${SCANOPY_TAG:-latest}"
REGISTRY="${SCANOPY_REGISTRY:-fuqiangleon}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$ROOT"

SERVER_IMG="${REGISTRY}/scanopy-server:${TAG}"
DAEMON_IMG="${REGISTRY}/scanopy-daemon:${TAG}"

log() { printf '\n[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

log "构建 server 镜像 -> ${SERVER_IMG}"
docker build --platform linux/amd64 -f backend/Dockerfile -t "${SERVER_IMG}" .

log "构建 daemon 镜像 -> ${DAEMON_IMG}"
docker build --platform linux/amd64 -f backend/Dockerfile.daemon -t "${DAEMON_IMG}" .

if [[ "${SKIP_PUSH:-}" == "1" ]]; then
  log "SKIP_PUSH=1,跳过推送。镜像已在本地:${SERVER_IMG} + ${DAEMON_IMG}"
  exit 0
fi

log "推送 ${SERVER_IMG}"
docker push "${SERVER_IMG}"
log "推送 ${DAEMON_IMG}"
docker push "${DAEMON_IMG}"

log "完成。部署侧:docker compose pull scanopy scanopy-daemon && docker compose up -d scanopy scanopy-daemon"
