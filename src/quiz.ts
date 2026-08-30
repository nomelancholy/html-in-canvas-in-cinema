const firstScene = (): string => `
  <div class="scene-content">
    <div class="scene-meta">
      <p class="eyebrow">SCENE 01 / 02</p>
      <span class="question-type">SINGLE CHOICE</span>
    </div>
    <h1 class="quiz-title">HTML을 Canvas에<br/>직접 그리는 API는?</h1>
    <div class="answers" role="group" aria-label="정답 선택">
      <button type="button" data-answer="fillText"><span>A</span>fillText()</button>
      <button type="button" data-answer="drawElementImage"><span>B</span>drawElementImage()</button>
      <button type="button" data-answer="toDataURL"><span>C</span>toDataURL()</button>
    </div>
    <p class="quiz-feedback" aria-live="polite">하나를 선택하세요.</p>
  </div>
`;

const secondScene = (): string => `
  <div class="scene-content scene-complete">
    <p class="eyebrow">SCENE 02 / 02</p>
    <div class="complete-mark" aria-hidden="true">✓</div>
    <h1 class="quiz-title">다음 장면이<br/>열렸습니다.</h1>
    <p class="complete-copy">정답입니다. 이 자리에 영상, 애니메이션 또는 다음 퀴즈를 연결할 수 있습니다.</p>
    <span class="complete-chip">STAGE COMPLETE</span>
  </div>
`;

export const mountQuiz = (root: HTMLElement): (() => void) => {
  let transitionTimer = 0;
  root.dataset.scene = "1";
  root.innerHTML = firstScene();

  const handleClick = (event: MouseEvent): void => {
    const target = (event.target as Element).closest<HTMLButtonElement>("[data-answer]");
    if (!target || root.dataset.scene !== "1" || root.dataset.locked === "true") return;

    const feedback = root.querySelector<HTMLElement>(".quiz-feedback");
    if (!feedback) return;

    if (target.dataset.answer !== "drawElementImage") {
      root.querySelectorAll("[data-answer]").forEach((button) => button.classList.remove("is-wrong"));
      target.classList.add("is-wrong");
      feedback.textContent = "아쉽지만 다시 골라보세요.";
      return;
    }

    root.dataset.locked = "true";
    root.dispatchEvent(new CustomEvent("quiz:transition"));
    target.classList.add("is-correct");
    root.querySelectorAll<HTMLButtonElement>("[data-answer]").forEach((button) => {
      button.disabled = true;
    });
    feedback.textContent = "정답입니다. 다음 장면을 여는 중…";
    root.classList.add("is-leaving");

    transitionTimer = window.setTimeout(() => {
      root.dataset.scene = "2";
      root.innerHTML = secondScene();
      root.classList.remove("is-leaving");
      root.classList.add("is-entering");
      requestAnimationFrame(() => root.classList.remove("is-entering"));
      const canvas = root.parentElement;
      if (canvas instanceof HTMLCanvasElement && typeof canvas.requestPaint === "function") {
        canvas.requestPaint();
      }
    }, 650);
  };

  root.addEventListener("click", handleClick);

  return () => {
    clearTimeout(transitionTimer);
    root.removeEventListener("click", handleClick);
  };
};
