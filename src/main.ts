import "./styles.css";
import { CanvasStage } from "./canvas/stage";
import {
  NativeHtmlCanvas,
  supportsNativeHtmlInCanvas,
  supportsWebGlSnapshot,
} from "./canvas/native-html-canvas";
import { CinemaScene } from "./scenes/cinema-scene";
import { mountCurseLetter } from "./curse-letter";
import { mountVideoPortal } from "./video-portal";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <main class="shell">
    <section class="stage-wrap">
      <canvas id="stage" layoutsubtree aria-label="HTML 요소가 그려진 애니메이션 Canvas">
        <article id="html-source" class="html-card"></article>
      </canvas>
      <article id="fallback-source" class="html-card fallback-html-card" hidden></article>
      <section id="video-portal" class="video-portal" hidden aria-label="열린 영상 화면">
        <div class="portal-frame">
          <video autoplay playsinline></video>
          <span class="portal-glass" aria-hidden="true"></span>
          <span class="portal-signal" aria-hidden="true"></span>
          <button class="portal-close" type="button" aria-label="영상 닫기"><span aria-hidden="true">×</span></button>
        </div>
      </section>
      <button class="guide-trigger" type="button" aria-label="HTML-in-Canvas 설정 가이드 열기">?</button>
      <p id="runtime-status" class="runtime-status" hidden>API 확인 중</p>
    </section>
    <dialog id="setup-guide" class="setup-guide" aria-labelledby="guide-title">
      <div class="guide-head">
        <div>
          <p class="guide-kicker">EXPERIMENTAL API GUIDE</p>
          <h2 id="guide-title">진짜 HTML-in-Canvas로 보기</h2>
        </div>
        <button class="guide-close" type="button" aria-label="가이드 닫기">×</button>
      </div>
      <p class="support-check"><span></span><strong>확인 중…</strong></p>
      <ol class="guide-steps">
        <li><span>01</span><div><strong>Chrome Canary 149 이상을 실행</strong><p>현재 실험 API는 일반 Chrome보다 Canary에서 먼저 제공됩니다.</p></div></li>
        <li><span>02</span><div><strong>아래 설정 주소를 주소창에 붙여넣기</strong><code>chrome://flags/#canvas-draw-element</code></div></li>
        <li><span>03</span><div><strong>HTML-in-Canvas를 Enabled로 변경</strong><p>화면 아래의 Relaunch 버튼으로 Chrome을 다시 시작하세요.</p></div></li>
        <li><span>04</span><div><strong>이 페이지를 다시 열기</strong><p>좌측 상태가 NATIVE로 바뀌면 실제 DOM이 WebGL 텍스처로 들어간 상태입니다.</p></div></li>
      </ol>
      <div class="guide-actions">
        <button class="copy-flag" type="button">설정 주소 복사</button>
        <button class="reload-page" type="button">다시 확인</button>
      </div>
      <p class="guide-note">Chrome 148–150 Origin Trial 기간의 실험 기능입니다. 브라우저 버전에 따라 플래그가 보이지 않거나 API가 변경될 수 있습니다.</p>
      <a class="guide-docs" href="https://developer.chrome.com/blog/html-in-canvas-origin-trial" target="_blank" rel="noreferrer">Chrome 공식 안내 보기 ↗</a>
    </dialog>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#stage");
const htmlSource = document.querySelector<HTMLElement>("#html-source");
const fallbackSource = document.querySelector<HTMLElement>("#fallback-source");
const runtimeStatus = document.querySelector<HTMLElement>("#runtime-status");
const guide = document.querySelector<HTMLDialogElement>("#setup-guide");
const videoPortal = document.querySelector<HTMLElement>("#video-portal");
if (!canvas) throw new Error("#stage Canvas를 찾지 못했습니다.");
if (!htmlSource) throw new Error("#html-source 요소를 찾지 못했습니다.");
if (!fallbackSource) throw new Error("#fallback-source 요소를 찾지 못했습니다.");
if (!runtimeStatus) throw new Error("#runtime-status 요소를 찾지 못했습니다.");
if (!guide) throw new Error("#setup-guide 요소를 찾지 못했습니다.");
if (!videoPortal) throw new Error("#video-portal 요소를 찾지 못했습니다.");

const destroyVideoPortal = mountVideoPortal(videoPortal);

const nativeSupported = supportsNativeHtmlInCanvas(canvas);
let renderer: NativeHtmlCanvas | CanvasStage;

if (nativeSupported) {
  document.documentElement.dataset.htmlInCanvas = "native";
  runtimeStatus.textContent = "실제 HTML을 비추는 중 · NATIVE";
  mountCurseLetter(htmlSource);
  try {
    renderer = new NativeHtmlCanvas(canvas, htmlSource);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    runtimeStatus.textContent = `WEBGL ERROR · ${message}`;
    throw error;
  }
} else {
  fallbackSource.hidden = false;
  mountCurseLetter(fallbackSource);
  if (supportsWebGlSnapshot()) {
    document.documentElement.dataset.htmlInCanvas = "snapshot";
    runtimeStatus.textContent = "한지에 비추는 중 · WEBGL";
    renderer = new NativeHtmlCanvas(canvas, fallbackSource, "snapshot");
  } else {
    document.documentElement.dataset.htmlInCanvas = "fallback";
    runtimeStatus.textContent = "먹글씨를 펼치는 중 · DOM";
    renderer = new CanvasStage(canvas, new CinemaScene());
    renderer.start();
  }
}

const supportCheck = guide.querySelector<HTMLElement>(".support-check");
if (supportCheck) {
  supportCheck.classList.add(nativeSupported ? "is-supported" : "is-off");
  supportCheck.querySelector("strong")!.textContent = nativeSupported
    ? "이 브라우저는 네이티브 HTML-in-Canvas가 켜져 있습니다."
    : "현재는 호환 WebGL 모드입니다. 플래그를 켜면 네이티브 모드로 전환됩니다.";
}

document.querySelector<HTMLButtonElement>(".guide-trigger")?.addEventListener("click", () => guide.showModal());
guide.querySelector<HTMLButtonElement>(".guide-close")?.addEventListener("click", () => guide.close());
guide.addEventListener("click", (event) => {
  if (event.target === guide) guide.close();
});
guide.querySelector<HTMLButtonElement>(".copy-flag")?.addEventListener("click", async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  await navigator.clipboard.writeText("chrome://flags/#canvas-draw-element");
  button.textContent = "복사했습니다 ✓";
  window.setTimeout(() => { button.textContent = "설정 주소 복사"; }, 1600);
});
guide.querySelector<HTMLButtonElement>(".reload-page")?.addEventListener("click", () => location.reload());

if (import.meta.hot) import.meta.hot.dispose(() => {
  renderer.destroy();
  destroyVideoPortal();
});
