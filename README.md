# HTML in Canvas in Cinema

사용자가 한 문장을 적을 때마다 낡은 한지 위의 금기문이 붉게 드러나는 한국 괴담풍 HTML-in-Canvas 실험입니다. 열 문장이 완성되면 두 나무궤의 부적이 차례로 떨어지고, 봉인이 모두 풀린 뒤에만 궤를 열 수 있습니다. 실제 입력과 버튼 DOM을 WebGL 텍스처로 올려 종이의 움직임, 먹 번짐, 필름 떨림을 표현하며 웹과 Electron 데스크톱 앱 두 경로를 함께 제공합니다.

## 시작하기

```bash
npm install
npm run dev:web
```

Chrome Canary 149 이상에서 `chrome://flags/#canvas-draw-element`를 열고 **HTML-in-Canvas** 항목을 활성화하면 네이티브 API를 사용합니다. 화면 우측 상단의 `?` 버튼에서도 같은 설정 순서와 현재 지원 상태를 확인할 수 있습니다.

일반 브라우저에서는 HTML DOM을 스냅샷 텍스처로 변환해 동일한 WebGL 메시·셰이더 연출을 보여줍니다. 따라서 공개 웹 버전도 바로 체험할 수 있고, 실험 기능을 켠 브라우저에서는 별도 스냅샷 없이 실제 DOM을 `texElementImage2D()`로 직접 올립니다.

## Electron으로 실행

```bash
npm run dev:desktop
```

빌드 결과만 독립 창으로 실행하려면:

```bash
npm run desktop
```

Electron은 시작할 때 `--enable-features=CanvasDrawElement`를 자동 전달하므로 사용자가 별도로 `chrome://flags`를 변경할 필요가 없습니다. 단, 포함된 Chromium 버전에 해당 기능 구현이 있어야 합니다.

키오스크 전체화면은 다음과 같이 실행할 수 있습니다.

```bash
HIC_KIOSK=1 npm run desktop
```

프로덕션 빌드와 타입 검사는 다음 명령으로 확인합니다.

```bash
npm run build
npm run typecheck
```

## 구조

```text
src/
├── canvas/
│   ├── native-html-canvas.ts # texElementImage2D 기반 WebGL 3D 렌더러
│   └── stage.ts          # 반응형 크기, DPR, 애니메이션 루프 관리
├── scenes/
│   └── cinema-scene.ts       # WebGL 미지원 환경의 배경 장면
├── curse-letter.ts           # 입력과 열 개의 금기문 공개 상태
├── main.ts                   # 앱 진입점
└── styles.css                # 한지·먹·주사 기반 화면과 UI
```

새 실험은 `Scene` 인터페이스를 구현해 `src/scenes`에 추가하고, `main.ts`에서 `CanvasStage`에 전달하면 됩니다.

## 알아둘 점

- 지원 환경에서는 `layoutsubtree`, `texElementImage2D()`, `getElementTransform()`을 사용합니다.
- 네이티브 API 미지원 환경에서도 WebGL 2가 있으면 HTML 스냅샷 텍스처 모드로 같은 연출을 유지합니다.
- WebGL 2까지 없는 환경에서만 동일한 편지 DOM을 Canvas 위의 오버레이로 표시합니다.
- 외부 이미지나 폰트를 섞으면 브라우저의 CORS 정책으로 Canvas 픽셀 읽기나 내보내기가 제한될 수 있습니다.
- Canvas의 실제 픽셀 크기는 최대 2배 DPR로 자동 조정되어 고해상도 화면에서도 선명하게 표시됩니다.
- HTML-in-Canvas API는 아직 제안 단계이므로 이름과 동작이 변경될 수 있습니다.
