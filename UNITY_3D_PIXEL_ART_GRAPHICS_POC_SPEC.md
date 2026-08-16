# Unity URP 3D Pixel-Art Graphics PoC 작업 명세서

## 1. Project Goal

Unity URP에서 레퍼런스 이미지와 유사한 실시간 3D pixel-art 화면을 구현하고 검증한다.

핵심 검증 대상:

- 3D 형태와 깊이감 유지
- 낮은 내부 해상도에서 선명한 pixel edge 생성
- Point/Nearest 확대 시 픽셀 그리드 안정성 유지
- 제한된 색 단계와 읽기 쉬운 명암 구현
- 조명, 그림자, 주사위 회전 중 스타일 유지
- 목표 기기에서 실시간 실행 가능 여부 확인
- 결과를 근거로 Unity 마이그레이션 타당성 판단

PoC는 완성 게임이 아니다. 최소 장면으로 그래픽 파이프라인의 가능성과 비용을 판단한다.

## 2. Non-Goals

이번 작업에서 제외한다.

- 기존 Phaser/Tauri 프로젝트 마이그레이션
- 게임 규칙, 턴, 점수, 저장, 네트워크 구현
- 완성형 UI/UX
- 전체 보드와 모든 게임 에셋 제작
- 모바일/콘솔 배포 자동화
- 범용 렌더링 프레임워크 제작
- 레퍼런스에 없는 시각 기능 추가
- HDRP 또는 Unreal 비교 구현

## 3. Visual Target

레퍼런스 이미지를 시각적 정답으로 사용한다. 작업 시작 전 원본 파일을 `Assets/Art/Reference/`에 넣고 문서 또는 작업 로그에 파일명을 기록한다.

레퍼런스가 없으면 임의로 스타일을 확정하지 않는다. 기본 장면까지만 만들고 원본 이미지 제공을 요청한다.

평가 축:

1. **Silhouette**: 둥근 주사위 모서리가 의도된 픽셀 계단으로 보인다.
2. **Value**: 물체, 바닥, 그림자가 작은 화면에서도 분리된다.
3. **Color**: 부드러운 PBR 그라데이션보다 통제된 색 단계가 보인다.
4. **Lighting**: 하이라이트와 음영 방향이 레퍼런스와 유사하다.
5. **Shadow**: 접지감이 있고, 과도하게 부드럽거나 노이즈가 없다.
6. **Pixel Stability**: 정지 화면과 움직임에서 픽셀 크기가 일관된다.
7. **Motion**: 주사위 회전 중 깜빡임, shimmering, 색 단계 폭주가 허용 범위 안이다.

최종 판단은 수치 하나가 아닌 동일 구도의 비교 캡처와 체크리스트로 수행한다.

## 4. Technical Direction

### 4.1 기본 구성

- Engine: Unity LTS 또는 프로젝트에서 승인된 안정 버전
- Render Pipeline: Universal Render Pipeline, URP
- Scene: 주사위 1~2개, 보드 또는 평면, 카메라, 주광원
- Internal Render: 저해상도 `RenderTexture`
- Upscale: Point/Nearest, bilinear/trilinear 금지
- Color Space: Linear 우선
- Anti-aliasing: 초기값 Off
- Post-processing: 초기값 Off, 필요 기능만 단계적으로 추가

### 4.2 렌더 흐름

```text
3D Scene
  -> URP Camera
  -> Low-resolution RenderTexture
  -> Optional Color Quantization
  -> Optional Dithering/Post-process
  -> Point/Nearest Upscale
  -> Final Game View
```

### 4.3 시작 해상도

다음 두 프리셋부터 비교한다.

- 320 x 180
- 426 x 240

출력 해상도는 가능하면 내부 해상도의 정수배를 사용한다. 창 크기가 정수배가 아니면 letterbox 또는 고정 viewport를 사용해 비균일 픽셀과 흔들림을 막는다.

### 4.4 구현 원칙

- 첫 성공 경로는 Unity/URP 기본 기능과 작은 커스텀 셰이더로 만든다.
- 새 패키지는 필수일 때만 추가한다.
- 각 효과는 독립적으로 켜고 끌 수 있어야 한다.
- 이전 단계가 통과하기 전 다음 효과를 쌓지 않는다.
- 스타일 문제를 모델, 조명, 해상도, 셰이더 문제로 분리해 확인한다.

## 5. Constraints

- PoC 범위 유지. 게임 로직 금지.
- 한 개 테스트 Scene으로 핵심 결과 재현 가능해야 한다.
- 모든 시각 설정은 Inspector 또는 명확한 설정 asset에서 조정 가능해야 한다.
- 기준값과 실험값을 구분한다.
- 원본 에셋은 보존하고 파생 에셋만 수정한다.
- Point/Nearest 설정이 import, RenderTexture, 최종 표시 단계에서 유지돼야 한다.
- 플랫폼별 비결정적 기능에 과도하게 의존하지 않는다.
- 콘솔 error 0개를 유지한다.
- 컴파일 경고는 작업 결과와 함께 기록하고, 새 경고를 만들지 않는다.
- 최종 실행은 개발용 에디터 화면뿐 아니라 standalone build에서도 검증한다.

## 6. 단계별 Tasks와 Acceptance Criteria

### Phase 0. 기준 고정과 측정 준비

Tasks:

- 레퍼런스 원본을 `Assets/Art/Reference/`에 저장한다.
- 레퍼런스의 구도, 카메라 각도, 주조색, 광원 방향, 그림자 경도를 기록한다.
- 목표 출력 해상도, 화면비, 목표 플랫폼, FPS 목표를 기록한다.
- 동일 구도 캡처용 카메라 Transform을 고정한다.
- `Baseline`, `LowRes`, `Quantized`, `Final`, `Motion` 캡처 이름 규칙을 정한다.

Acceptance Criteria:

- 레퍼런스 파일과 목표 환경이 README 또는 작업 로그에 명시된다.
- 동일 구도를 반복 캡처할 수 있다.
- 성공/실패 판단 항목이 체크리스트에 연결된다.

### Phase 1. Blender 에셋 준비

Tasks:

- 기존 STL 또는 원본 모델을 복제해 작업한다.
- 실제 크기와 축을 정리한다.
- 불필요한 geometry를 제거한다.
- face normal과 smoothing을 확인한다.
- 주사위 모서리에 2~4 segment bevel부터 시험한다.
- 주사위 몸체와 눈을 별도 material slot으로 분리한다.
- FBX 또는 프로젝트 표준 포맷으로 export한다.
- 바닥/보드는 Unity primitive로 시작해도 된다.

Acceptance Criteria:

- Unity import 후 scale과 orientation이 정상이다.
- 깨진 normal, 뒤집힌 face, z-fighting이 없다.
- 몸체와 눈의 색을 독립 조정할 수 있다.
- 낮은 내부 해상도에서도 눈과 실루엣을 식별할 수 있다.

### Phase 2. Unity URP 기본 장면

Tasks:

- URP 프로젝트 또는 전용 PoC Scene을 만든다.
- 카메라, 주사위 1~2개, 바닥, Directional Light를 배치한다.
- 레퍼런스와 비슷한 perspective와 framing을 맞춘다.
- 기본 URP Lit material로 정상적인 3D baseline을 만든다.
- pixel 효과와 post-processing은 끈다.
- baseline 캡처와 설정값을 저장한다.

Acceptance Criteria:

- Scene을 열고 Play하면 추가 조작 없이 기준 구도가 보인다.
- mesh, material, light, shadow가 정상 작동한다.
- Game View와 standalone build의 구도가 일치한다.
- 콘솔 error가 없다.

### Phase 3. 저해상도 RenderTexture 렌더링

Tasks:

- 320 x 180과 426 x 240 `RenderTexture`를 만든다.
- 3D 카메라가 선택된 `RenderTexture`로 렌더하도록 구성한다.
- 최종 화면은 전용 표시 Camera와 full-screen 출력으로 구성한다.
- 화면비가 다를 때 viewport 또는 letterbox를 적용한다.
- 내부 해상도 프리셋을 실행 중 또는 Inspector에서 선택 가능하게 한다.

Acceptance Criteria:

- 3D Scene이 실제 저해상도 target에 먼저 렌더된다.
- 출력 크기를 바꿔도 내부 픽셀 수가 임의로 변하지 않는다.
- 종횡비 왜곡과 비균일 픽셀이 없다.
- 각 프리셋의 캡처가 저장된다.

### Phase 4. Point/Nearest 업스케일

Tasks:

- `RenderTexture.filterMode`를 Point로 설정한다.
- 최종 표시 material과 texture import 설정에 bilinear/trilinear가 없는지 확인한다.
- 가능한 출력 크기에서 정수배 scaling을 적용한다.
- pixel-perfect하지 않은 창 크기에 대한 정책을 구현한다.

Acceptance Criteria:

- 확대된 픽셀 경계가 선명하다.
- blur, interpolation halo, 비균일 픽셀이 없다.
- 창 크기 변경 시 정의된 scaling 정책이 유지된다.
- 320 x 180과 426 x 240을 즉시 비교할 수 있다.

### Phase 5. 조명과 그림자 스타일링

Tasks:

- Directional Light 각도와 강도를 레퍼런스에 맞춘다.
- ambient/environment lighting을 최소 범위에서 조절한다.
- material Metallic은 0부터 시작한다.
- Smoothness는 낮은 값부터 비교한다.
- shadow resolution, bias, normal bias, cascade를 최소 구성으로 조정한다.
- 필요하면 contact shadow 대안을 시험하되 URP 기본 기능을 우선한다.
- 조명 설정 프리셋을 2개 이하로 유지한다.

Acceptance Criteria:

- 주사위가 바닥에 붙어 보인다.
- shadow acne, peter-panning, 심한 누락이 없다.
- 하이라이트가 픽셀 스타일을 지우는 넓은 PBR gradient를 만들지 않는다.
- 정지와 회전 상태 모두에서 주요 면이 읽힌다.

### Phase 6. Color Quantization

Tasks:

- full-screen URP renderer feature 또는 호환 가능한 작은 셰이더 경로를 사용한다.
- RGB 채널 단순 절삭 또는 luminance 기반 단계화를 먼저 시험한다.
- 단계 수를 Inspector에서 조절 가능하게 한다.
- quantization On/Off 비교 기능을 제공한다.
- gamma/linear 변환 위치를 확인해 색이 예상대로 단계화되는지 검증한다.
- banding이 실루엣과 눈 가독성을 해치면 단계 수 또는 방식만 조정한다.

권장 시작값:

- 채널당 4~8 단계 비교
- 또는 luminance 4~6 단계 비교

Acceptance Criteria:

- 색 단계 수 변경 결과가 즉시 보인다.
- 레퍼런스와 유사한 제한된 명암이 생성된다.
- 검정 뭉침, 하이라이트 clipping, 색상 오염이 통제된다.
- quantization을 껐을 때 baseline으로 정확히 돌아간다.

### Phase 7. Pixel Texture

Tasks:

- 주사위와 보드용 작은 texture 또는 제한된 palette texture를 만든다.
- texture Filter Mode는 Point로 설정한다.
- Mip Maps는 카메라 거리와 shimmering 결과를 보고 결정한다.
- Compression이 palette와 경계를 망가뜨리면 끈다.
- UV seam과 texel density를 확인한다.
- geometry detail보다 색 면과 큰 형태를 우선한다.

Acceptance Criteria:

- texture pixel과 화면 pixel이 충돌해 심한 moiré를 만들지 않는다.
- 주사위 눈이 모든 테스트 각도에서 식별된다.
- texture import 설정이 재import 후에도 유지된다.
- 레퍼런스에 없는 미세 디테일이 화면을 복잡하게 만들지 않는다.

### Phase 8. 선택적 Dithering과 후처리

Tasks:

- quantization만으로 목표에 부족할 때만 dithering을 추가한다.
- ordered dithering부터 시험한다.
- pattern scale을 내부 pixel grid에 고정한다.
- dithering On/Off와 강도를 제공한다.
- bloom, vignette, color grading은 레퍼런스 근거가 있을 때만 사용한다.
- TAA, motion blur, depth of field는 기본적으로 끈다.

Acceptance Criteria:

- dithering이 정지/회전 중 화면 공간에서 불필요하게 헤엄치지 않는다.
- 작은 주사위 눈과 그림자 경계가 보존된다.
- 효과가 없는 편이 낫다면 제거된다.
- 모든 선택 효과를 끈 최소 경로가 계속 작동한다.

### Phase 9. 주사위 회전과 motion 검증

Tasks:

- 게임 물리 대신 반복 가능한 scripted rotation을 만든다.
- 느림, 보통, 빠름 속도 프리셋을 둔다.
- 동일 시작 pose와 duration으로 반복 재생한다.
- 필요하면 90도 단위 snap 또는 낮은 animation sample rate를 별도 실험한다.
- 실시간 회전과 stylized stepped rotation을 비교한다.

Acceptance Criteria:

- 회전 중 silhouette, 눈, shading을 식별할 수 있다.
- 심한 temporal flicker, pixel crawl, shadow jumping이 없다.
- 선택한 motion 방식과 이유가 결과 문서에 기록된다.
- 회전 테스트를 한 번의 Play 실행으로 재현할 수 있다.

### Phase 10. 카메라, UI, 화면 크기 검증

Tasks:

- 기준 카메라는 고정한다.
- 선택적으로 작은 pan/zoom 테스트만 추가한다.
- UI는 해상도, 효과 On/Off, FPS, 현재 프리셋 표시만 만든다.
- UI를 저해상도 target 내부에 넣을지 최종 해상도 overlay로 둘지 명시한다.
- 16:9 기준과 최소 한 개 비표준 창 크기를 시험한다.

Acceptance Criteria:

- 카메라 이동 시 pixel jitter 정책이 일관된다.
- 디버그 UI가 시각 비교를 가리지 않는다.
- UI scale과 텍스트가 읽을 수 있다.
- 화면비 변경 시 장면이 늘어나지 않는다.

### Phase 11. 성능과 build 검증

Tasks:

- Editor와 standalone development build에서 측정한다.
- 평균 FPS, frame time, CPU/GPU 병목, 메모리를 기록한다.
- 목표 플랫폼에서 대표 출력 해상도로 최소 60초 실행한다.
- 각 후처리 효과 On/Off 비용을 비교한다.
- GC allocation과 반복적인 RenderTexture 생성 여부를 확인한다.

기본 목표값은 작업 시작 시 확정한다. 별도 요구가 없으면 desktop 기준 1920 x 1080 출력, 60 FPS를 임시 기준으로 사용한다.

Acceptance Criteria:

- 목표 기기와 build 설정이 기록된다.
- 60초 동안 crash, error, 심한 hitch가 없다.
- 매 프레임 `RenderTexture` 또는 material을 새로 만들지 않는다.
- 측정 결과가 수치와 캡처로 남는다.

### Phase 12. 엔진 마이그레이션 판단

Tasks:

- 레퍼런스, baseline, low-res, quantized, final 결과를 같은 크기로 비교한다.
- 시각 품질, 구현 복잡도, 성능, 에셋 작업량, 유지보수 위험을 평가한다.
- `Go`, `Conditional Go`, `No-Go` 중 하나를 선택한다.
- 남은 차이와 실제 게임 통합 전 필요한 실험을 기록한다.

Acceptance Criteria:

- 판단이 취향 표현만이 아니라 캡처와 측정값에 근거한다.
- Unity 마이그레이션 범위와 비용을 이번 PoC에 섞지 않는다.
- 다음 단계가 한 문단으로 명확히 제시된다.

## 7. Deliverables

필수 산출물:

1. 실행 가능한 Unity URP PoC 프로젝트
2. `GraphicsPoC` 테스트 Scene
3. 준비된 주사위 에셋과 material
4. 저해상도 `RenderTexture` 프리셋 2개
5. Point/Nearest upscale 경로
6. 조명과 그림자 설정
7. 조절 가능한 color quantization 효과
8. 선택 효과가 채택된 경우 dithering/post-process 구현
9. 반복 가능한 주사위 회전 테스트
10. 효과 On/Off와 해상도 선택용 최소 debug UI
11. baseline 및 단계별 비교 캡처
12. 성능 측정 기록
13. 마이그레이션 판단 보고서

권장 문서:

- `README.md`: 실행법, Unity 버전, Scene, 조작법
- `Docs/VisualComparison.md`: 단계별 캡처와 차이
- `Docs/Performance.md`: 기기, build, 설정, FPS/frame time
- `Docs/Decision.md`: Go/Conditional Go/No-Go와 근거

## 8. 권장 프로젝트 구조

```text
Assets/
  Art/
    Reference/
    Models/
      Source/
      Imported/
    Materials/
    Textures/
  Rendering/
    RenderTextures/
    RendererFeatures/
    Shaders/
    Settings/
  Scenes/
    GraphicsPoC.unity
  Scripts/
    Camera/
    Rendering/
    Tests/
    UI/
  UI/
  Tests/
    EditMode/
    PlayMode/
  Docs/
    Captures/
    VisualComparison.md
    Performance.md
    Decision.md
  README.md
```

구조 원칙:

- 원본과 Unity import용 파생 에셋 분리
- runtime 코드와 테스트 제어 코드 분리
- 실험 셰이더를 무명 파일로 쌓지 않기
- 한 기능당 설정 위치 하나 유지
- 버려진 variant는 삭제하거나 문서에서 명확히 폐기 표시

## 9. 구현 우선순위

### P0: 반드시 완료

- 기준 장면
- 저해상도 RenderTexture
- Point/Nearest upscale
- 조명과 그림자
- color quantization
- 동일 구도 캡처
- 회전 및 성능 검증
- 엔진 판단 문서

### P1: 목표에 필요할 때 완료

- custom pixel texture
- ordered dithering
- camera pan/zoom 검증
- stepped rotation 비교
- debug UI 개선

### P2: 이번 PoC에서 보통 제외

- 복잡한 palette lookup 시스템
- 여러 후처리 stack
- procedural texture pipeline
- 전체 보드 아트
- production asset pipeline 자동화

## 10. 테스트 체크리스트

### Setup

- [ ] 승인된 Unity 버전과 URP 버전 기록
- [ ] 레퍼런스 파일 존재
- [ ] 기준 Scene 한 번에 실행 가능
- [ ] 콘솔 error 0개

### Rendering

- [ ] 실제 내부 해상도 320 x 180 확인
- [ ] 실제 내부 해상도 426 x 240 확인
- [ ] Point/Nearest 적용 확인
- [ ] bilinear/trilinear blur 없음
- [ ] 정수배 또는 letterbox 정책 확인
- [ ] anti-aliasing 초기값 Off

### Visual

- [ ] 주사위 silhouette 읽힘
- [ ] 눈 식별 가능
- [ ] 바닥 접지감 있음
- [ ] 명암 단계가 통제됨
- [ ] highlight clipping 없음
- [ ] shadow acne/peter-panning 없음
- [ ] texture moiré 허용 범위
- [ ] dithering 이동 노이즈 허용 범위

### Motion

- [ ] 느린 회전 통과
- [ ] 보통 회전 통과
- [ ] 빠른 회전 통과
- [ ] temporal flicker 허용 범위
- [ ] 카메라 이동 시 pixel jitter 정책 유지

### Build and Performance

- [ ] standalone build 실행
- [ ] 목표 해상도 확인
- [ ] 60초 안정 실행
- [ ] FPS/frame time 기록
- [ ] 메모리 기록
- [ ] 반복 GC allocation 없음
- [ ] 효과별 비용 비교

### Decision

- [ ] 동일 구도 단계별 캡처 완료
- [ ] 레퍼런스 대비 남은 차이 기록
- [ ] 구현 복잡도 기록
- [ ] Go/Conditional Go/No-Go 선택
- [ ] 다음 단계 제안

## 11. AI 작업 규칙

코딩 AI/에이전트는 다음을 지킨다.

1. 작업 전 기존 프로젝트 구조, Unity 버전, URP asset, renderer 설정을 먼저 확인한다.
2. 레퍼런스가 없거나 목표 플랫폼이 불명확하면 추정값을 작업 로그에 표시한다.
3. 기존 코드와 Unity 기본 기능을 재사용한다. 새 dependency는 필요성과 대안을 먼저 기록한다.
4. 한 번에 한 Phase만 구현한다. 각 Phase 후 Play/Build 확인과 캡처를 남긴다.
5. 이전 Phase의 정상 동작을 깨지 않는다. 효과마다 On/Off 비교 경로를 유지한다.
6. 게임 로직, 저장, 네트워크, Phaser/Tauri 이전 작업을 추가하지 않는다.
7. 범용화, framework화, 불필요한 abstraction을 만들지 않는다.
8. public field 남발보다 `[SerializeField] private`와 명확한 설정 asset을 우선한다.
9. 매 프레임 object, material, texture, `RenderTexture`를 생성하지 않는다.
10. shader와 C# 코드에 필요한 범위의 짧은 주석만 쓴다.
11. 실패한 실험은 숨기지 않는다. 설정, 증상, 폐기 이유를 기록한다.
12. 시각 품질 주장은 같은 구도의 캡처로 증명한다.
13. 성능 주장은 Editor 감상이 아닌 development build 측정값으로 증명한다.
14. 사용자 에셋과 기존 변경을 덮어쓰지 않는다.
15. 각 작업 종료 시 변경 파일, 검증 결과, 남은 문제, 다음 Phase를 보고한다.

### AI 작업 단위 출력 형식

각 Phase 완료 후 다음 형식으로 보고한다.

```text
Phase:
Status: Pass | Partial | Fail

Changed:
- 파일 또는 asset

Verified:
- 실행한 확인
- 결과

Evidence:
- 캡처 경로
- 측정값

Open Issues:
- 남은 문제와 영향

Next:
- 다음 한 단계
```

### 중단하고 질문해야 하는 조건

- 레퍼런스 원본이 없고 시각 결정이 필요한 경우
- Unity/URP 버전 변경이 필요한 경우
- 새 유료 asset 또는 외부 dependency가 필요한 경우
- 원본 모델을 파괴적으로 수정해야 하는 경우
- PoC 범위를 넘어 게임 구조 변경이 필요한 경우
- 목표 성능과 시각 품질 사이에 선택이 필요한 경우

## 12. Definition of Done

다음을 모두 만족하면 PoC 완료다.

- 프로젝트를 열어 `GraphicsPoC` Scene을 실행할 수 있다.
- 3D Scene이 낮은 내부 해상도에 렌더되고 Point/Nearest로 확대된다.
- 조명, 그림자, quantization, 채택된 선택 효과가 재현 가능하다.
- 주사위 회전과 화면 크기 변경 중 스타일이 허용 범위에서 유지된다.
- standalone build에서 목표 성능을 측정했다.
- 레퍼런스와 단계별 결과를 동일 구도로 비교할 수 있다.
- 남은 시각 차이와 기술 위험이 문서화됐다.
- Unity 엔진 마이그레이션에 대한 Go, Conditional Go, No-Go 판단이 작성됐다.
- 게임 로직과 Phaser/Tauri 마이그레이션은 포함되지 않았다.

## 13. 권장 최초 실행 순서

AI 에이전트의 첫 작업은 아래 순서만 수행한다.

1. 프로젝트와 레퍼런스 상태 조사
2. `GraphicsPoC` 기본 Scene 생성 또는 확인
3. pixel 효과 없는 baseline 완성
4. 320 x 180 RenderTexture와 Point upscale 구현
5. baseline/low-res 비교 캡처
6. 결과 보고 후 다음 Phase 진행

첫 회차에 quantization, dithering, UI까지 동시에 구현하지 않는다.
