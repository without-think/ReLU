#!/bin/bash
# VM 초기 설정 스크립트
# SSH 접속 후 실행: bash setup-vm.sh

set -e

echo "=== Docker 설치 ==="
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 현재 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER

echo "=== Git 설치 ==="
sudo apt-get install -y git

echo "=== 완료 ==="
echo "로그아웃 후 다시 SSH 접속하세요 (docker 그룹 적용)"
echo ""
echo "이후 실행할 명령어:"
echo "  git clone YOUR_REPO_URL"
echo "  cd RELU"
echo "  cp .env.example .env"
echo "  nano .env  # 환경변수 수정"
echo "  docker compose up -d --build"
