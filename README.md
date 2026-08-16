# 🎲 Tessera (테세라)

<div align="center">

![Unity Version](https://img.shields.io/badge/Unity-6000.3.21f1%20(Unity%206)-blue?logo=unity&style=flat-square)
![Render Pipeline](https://img.shields.io/badge/Render%20Pipeline-URP-informational?style=flat-square)
![Language](https://img.shields.io/badge/Language-C%23-green?logo=csharp&style=flat-square)
![Git LFS](https://img.shields.io/badge/Git-LFS%20Enabled-orange?logo=gitlfs&style=flat-square)
![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)

**따뜻한 벽난로가 있는 중세 판타지 여관, 원목 테이블 위에서 펼쳐지는 주사위 보드게임 컬렉션**

[게임 소개](#-게임-소개) • [주요 특징](#-주요-특징) • [아트 & 분위기](#-아트--분위기-art-direction) • [아키텍처](#-프로젝트-아키텍처) • [로드맵](#-개발-로드맵) • [시작하기](#-시작하기-getting-started)

</div>

---

## 📖 프로젝트 개요

**Tessera**는 3D 스타일라이즈드 테이블탑 환경에서 즐기는 주사위 기반 보드게임 플랫폼입니다.

---

## 🎮 게임 소개

### 1. 🎲 증강 요트 다이스 (Augmented Dice)
* **장르**: 2인 대전 전략 주사위 보드게임 (핫시트 로컬 2P / 온라인 멀티플레이)
* **설명**: 전통적인 요트 다이스(Yacht Dice)의 족보 완성 규칙에 **다양한 전략적 특수 능력(증강 / Augments)**을 결합한 대전 게임입니다.
* **마이그레이션 현황**: 기존 웹 프로토타입([dpcks9677/augmented-dice](https://github.com/dpcks9677/augmented-dice))의 검증된 룰 엔진 및 증강 시스템을 **Unity 6 URP 기반 3D 환경으로 이식 및 고도화** 진행 중입니다.

### 2. 🗡️ 다이스 어드벤처 (Dice Adventure - 가제)
* **장르**: 주사위 빌딩 싱글 플레이 로그라이트 / 어드벤처
---

## 🏗️ 프로젝트 아키텍처

확장성 높은 도메인 주도 모듈 설계를 채택하여, 신규 게임 모드 추가 및 네트워크 기능 확장을 독립적으로 지원합니다:

```
Assets/Scripts/
├── Core/               # 공통 보드 메트릭 및 시스템 유틸리티 (Tessera.Core)
├── Dice/               # 3D 주사위 물리/롤 컨트롤러, 팩토리, 프리셋 (Tessera.Dice)
├── Tabletop/           # 테이블탑 소품 (잉크통/깃펜, 문진 등) (Tessera.Tabletop)
├── Rendering/          # URP 픽셀 프레젠테이션 & 셰이더 제어 (Tessera.Rendering)
├── Games/
│   └── AugmentedYacht/ # 증강 요트 다이스 전용 게임 루프 & 족보 (Tessera.Games.AugmentedYacht)
└── Network/            # 온라인 멀티플레이어 통신 계층 (Tessera.Network)
```

---

## 🗺️ 개발 로드맵 (Roadmap)

- [ ] **Phase 1: 증강 요트 다이스 시스템 마이그레이션**
  - 웹 버전([augmented-dice](https://github.com/dpcks9677/augmented-dice)) 게임의 룰과 시스템 이식
  - 3 슬롯 증강(Augment) 카드 및 턴/핫시트(Local 2P) 플레이 루프 구현
- [ ] **Phase 2: 게임 로비 및 인프라 구축**
  - 도전과제, 게임 설정, 도감, 플레이 통계 시스템 구축
- [ ] **Phase 3: 온라인 플레이 시스템 구축 (EOS 기반)**
  - Epic Online Services (EOS) 기반 매치메이킹, 로비 및 네트워크 턴 동기화
- [ ] **Phase 4: 신규 싱글 모드 'Dice Adventure' (가제) 추가**
  - 주사위 빌딩 기반 싱글 플레이 모드 개발

---

## 🚀 시작하기 (Getting Started)

### 요구 사항
* **Unity**: `6000.3.21f1 (Unity 6)` 이상
* **Render Pipeline**: Universal Render Pipeline (URP)
* **Git LFS**: 대용량 에셋(텍스처, 사운드, 3D 모델) 관리를 위해 Git LFS 설치 필수

### 설치 및 실행
1. 저장소를 클론합니다 (Git LFS 활성화 필수):
   ```bash
   git clone https://github.com/dpcks9677/Teserra.git
   cd Teserra
   git lfs pull
   ```
2. **Unity Hub**에서 프로젝트 폴더를 열고 `6000.3.21f1` 버전으로 프로젝트를 로드합니다.
3. 메인 씬을 열어 실행합니다:
   * 씬 경로: `Assets/Scenes/Augmented Dice.unity`
