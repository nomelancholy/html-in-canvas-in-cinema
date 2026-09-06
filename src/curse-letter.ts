const PROLOGUE = "삼도삼백혼을 제물삼아 삼천세계로 나아가리라.";

const PASS_PHRASES = [
  "지어진 것은", "잊혀졌고", "잊혀진 것은", "깨어난다", "이야기는 멈췄고", "나도 멈춘다",
  "공허를 응시한다", "아무도 없는 곳에서", "삼년간", "삼천세계를", "잃어버린다", "삼도삼백혼을",
  "제물삼아", "문을 열것이다", "이름을 빼앗고", "이름을 얻을 것이다", "내게 오라", "나를 채워라",
  "나를 보라", "잊지 못할 이야기를", "너희에게 주리라", "너희를 저주한다", "너희를 가질 것이다",
  "너희를 빼앗기지 않을 것이다", "나는 어둠속에서", "빛날것이다", "내 속에서", "영원히 살아가라",
  "내 이야기를", "완성할 것이다",
] as const;

const normalizeAnswer = (value: string): string =>
  value.normalize("NFC").replace(/[\s.,!?…·。]/g, "").toLocaleLowerCase("ko-KR");

const letterMarkup = (): string => PASS_PHRASES.map((line, index) => `
  <li style="--line:${index}" data-letter-line="${index}"><p>${line}</p></li>
`).join("");

const surfaceMarkup = (): string => `
  <div class="curse-content">
    <section class="paper-sheet">
      <p class="curse-prologue">${PROLOGUE}</p>
      <div class="letter-field" aria-live="polite" aria-label="해금된 주문"><ol>${letterMarkup()}</ol></div>
      <form class="writing-form" autocomplete="off">
        <div class="entry-shell"><input id="sentence-input" name="sentence" type="text" maxlength="50"
          spellcheck="false" aria-label="다음 문구 입력" /></div>
      </form>
      <div class="blood-seal" aria-hidden="true"><b>封</b><i></i><i></i><i></i></div>
      <div class="red-thread" aria-hidden="true"></div>
      <div class="scan-tear" aria-hidden="true"></div>
    </section>
    <div class="relic-boxes" aria-label="부적으로 봉인된 두 개의 함">
      <div class="relic-box" data-box="0" aria-label="숫자 암호로 봉인된 첫 번째 함">
        <span class="screen-frame" aria-hidden="true">
          <span class="screen-static"></span><span class="case-hinges"><i></i><i></i></span>
          <span class="case-lid"><span class="case-lid-face"></span><span class="case-lid-back"></span><span class="case-lid-edge"></span></span>
          <span class="case-latch"></span><span class="case-dust"><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </span>
        <span class="box-seal" aria-hidden="true"></span>
        <span class="seal-fire" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      </div>
      <div class="relic-box" data-box="1" aria-label="문장 암호로 봉인된 두 번째 함">
        <span class="screen-frame" aria-hidden="true">
          <span class="screen-static"></span><span class="case-hinges"><i></i><i></i></span>
          <span class="case-lid"><span class="case-lid-face"></span><span class="case-lid-back"></span><span class="case-lid-edge"></span></span>
          <span class="case-latch"></span><span class="case-dust"><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </span>
        <span class="box-seal" aria-hidden="true"></span>
        <span class="seal-fire" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>
      </div>
    </div>
    <div class="floating-field" aria-hidden="true"></div>
    <p class="answer-apparition" aria-hidden="true"></p>
  </div>
`;

export const mountCurseLetter = (root: HTMLElement): (() => void) => {
  let phase: "pin" | "phrases" | "complete" = "pin";
  let revealed = 0;
  let strikeTimer = 0;
  let wrongTimer = 0;
  let paintFrame = 0;
  let burnFrame = 0;
  let driftFrame = 0;
  let answerFrame = 0;
  let lastDriftPaint = 0;
  root.classList.add("curse-surface");
  root.dataset.phase = phase;
  root.dataset.revealed = "0";
  root.innerHTML = surfaceMarkup();

  const form = root.querySelector<HTMLFormElement>(".writing-form");
  const input = root.querySelector<HTMLInputElement>("#sentence-input");
  const boxes = Array.from(root.querySelectorAll<HTMLElement>(".relic-box"));
  const apparition = root.querySelector<HTMLElement>(".answer-apparition");
  const floatingField = root.querySelector<HTMLElement>(".floating-field");
  if (!form || !input || boxes.length !== 2 || !apparition || !floatingField) {
    throw new Error("저주의 편지 입력 UI를 만들지 못했습니다.");
  }
  input.inputMode = "numeric";
  input.maxLength = 4;
  input.setAttribute("aria-label", "숫자 암호 입력");

  const requestPaint = (): void => {
    const canvas = root.parentElement;
    if (canvas instanceof HTMLCanvasElement && typeof canvas.requestPaint === "function") canvas.requestPaint();
    else root.dispatchEvent(new CustomEvent("canvas:paint-frame"));
  };

  const openPortal = (box: HTMLElement, channel: number): void => {
    const bounds = box.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent("portal:open", { detail: {
      channel, rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    } }));
  };

  const animateCase = (box: HTMLElement, onComplete: () => void): void => {
    window.cancelAnimationFrame(paintFrame);
    const frame = box.querySelector<HTMLElement>(".screen-frame");
    const screen = box.querySelector<HTMLElement>(".screen-static");
    const lid = box.querySelector<HTMLElement>(".case-lid");
    const lidBack = box.querySelector<HTMLElement>(".case-lid-back");
    const latch = box.querySelector<HTMLElement>(".case-latch");
    const dust = Array.from(box.querySelectorAll<HTMLElement>(".case-dust i"));
    if (!frame || !screen || !lid || !latch) { onComplete(); return; }
    const duration = 1560;
    const dustDrift = [-8, 7, -4, 8, -11, 5];
    const startedAt = performance.now();
    const paintFrameByFrame = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const liftProgress = Math.min(1, Math.max(0, (progress - .18) / .82));
      const eased = liftProgress < .5 ? 4 * liftProgress ** 3 : 1 - ((-2 * liftProgress + 2) ** 3) / 2;
      const settle = Math.sin(Math.max(0, liftProgress - .72) * Math.PI * 7) * (1 - liftProgress) * .8;
      const latchProgress = Math.min(1, Math.max(0, (progress - .025) / .22));
      lid.style.transform = `translateY(${-8 * eased}px) translateZ(${Math.sin(eased * Math.PI) * 15}px) rotateX(${104 * eased}deg)`;
      lid.style.filter = `brightness(${1 - eased * .34})`;
      if (lidBack) lidBack.style.opacity = String(Math.min(1, Math.max(0, (eased - .72) / .2)));
      screen.style.opacity = String(.14 + eased * .68);
      screen.style.filter = `brightness(${.38 + eased * .62}) blur(${2.5 * (1 - eased)}px)`;
      screen.style.transform = `scale(${.982 + eased * .018})`;
      latch.style.opacity = String(1 - latchProgress);
      latch.style.transform = `translateY(${17 * latchProgress}px) rotate(${13 * latchProgress}deg)`;
      frame.style.transform = `translateY(${settle}px) scale(${1 + Math.sin(progress * Math.PI) * .003})`;
      dust.forEach((particle, index) => {
        const particleProgress = Math.min(1, Math.max(0, (liftProgress - index * .055) / .62));
        particle.style.opacity = String(Math.sin(particleProgress * Math.PI) * .42);
        particle.style.transform = `translate(${dustDrift[index] * particleProgress}px, ${-42 * particleProgress}px) scale(${.5 + particleProgress * .75})`;
      });
      requestPaint();
      if (progress < 1) paintFrame = window.requestAnimationFrame(paintFrameByFrame);
      else { box.dataset.opened = "true"; onComplete(); }
    };
    paintFrame = window.requestAnimationFrame(paintFrameByFrame);
  };

  const startDrifting = (): void => {
    if (driftFrame) return;
    const driftInterval = root.parentElement instanceof HTMLCanvasElement ? 50 : 180;
    const renderDrift = (now: number): void => {
      if (now - lastDriftPaint > driftInterval) {
        Array.from(floatingField.querySelectorAll<HTMLElement>(".floating-phrase")).forEach((word, index) => {
          const seed = Number(word.dataset.seed ?? index);
          const t = now / 1000;
          const x = Math.sin(t * .18 + seed * 1.7) * 3.5;
          const y = Math.cos(t * .12 + seed * .83) * 7;
          const rotation = Math.sin(t * .1 + seed) * .45;
          word.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
        });
        requestPaint();
        lastDriftPaint = now;
      }
      driftFrame = window.requestAnimationFrame(renderDrift);
    };
    driftFrame = window.requestAnimationFrame(renderDrift);
  };

  const showCorrectEffect = (phrase: string, index: number): void => {
    root.querySelector("[data-letter-line].is-current")?.classList.remove("is-current");
    root.querySelector<HTMLElement>(`[data-letter-line="${index}"]`)?.classList.add("is-revealed", "is-current");
    const floating = document.createElement("span");
    floating.className = "floating-phrase";
    floating.textContent = phrase;
    floating.dataset.seed = String(index + 1);
    const slot = index % 10;
    floating.style.setProperty("--float-x", `${slot % 2 === 0 ? 3 : 76}%`);
    floating.style.setProperty("--float-y", `${9 + Math.floor(slot / 2) * 18}%`);
    floating.style.setProperty("--float-size", `${11 + (index % 3)}px`);
    floatingField.append(floating);
    while (floatingField.children.length > 10) floatingField.firstElementChild?.remove();
    startDrifting();
    apparition.textContent = phrase;
    apparition.dataset.text = phrase;
    apparition.style.setProperty("--apparition-tilt", `${((index % 5) - 2) * .5}deg`);
    window.cancelAnimationFrame(answerFrame);
    const startedAt = performance.now();
    const paintAnswer = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / 1280);
      const entrance = Math.min(1, progress / .3);
      const eased = 1 - (1 - entrance) ** 3;
      const fade = progress < .64 ? Math.min(1, progress / .12) : Math.max(0, (1 - progress) / .36);
      const scale = .58 + eased * .47 + Math.max(0, progress - .64) * .36;
      apparition.style.opacity = String(fade);
      apparition.style.transform = `translateY(${34 - eased * 43 - Math.max(0, progress - .64) * 56}px) scale(${scale}) rotate(var(--apparition-tilt))`;
      apparition.style.filter = `blur(${(1 - eased) * 8 + Math.max(0, progress - .72) * 8}px)`;
      requestPaint();
      if (progress < 1) answerFrame = window.requestAnimationFrame(paintAnswer);
    };
    answerFrame = window.requestAnimationFrame(paintAnswer);
    root.classList.remove("is-answering");
    void root.offsetWidth;
    root.classList.add("is-answering", "is-struck");
    root.dispatchEvent(new CustomEvent("canvas:disturb"));
    clearTimeout(strikeTimer);
    strikeTimer = window.setTimeout(() => { root.classList.remove("is-answering", "is-struck"); requestPaint(); }, 1280);
  };

  const enterPhrasePhase = (): void => {
    phase = "phrases";
    root.dataset.phase = phase;
    root.classList.remove("is-complete", "is-burning", "is-wrong", "is-pin-opening");
    input.disabled = false;
    input.inputMode = "text";
    input.maxLength = 50;
    input.value = "";
    input.setAttribute("value", "");
    input.setAttribute("aria-label", "다음 문구 입력");
    requestPaint();
  };

  const burnSealAndOpen = (boxIndex: number, onOpened: () => void): void => {
    const box = boxes[boxIndex];
    const seal = box?.querySelector<HTMLElement>(".box-seal");
    const fire = box?.querySelector<HTMLElement>(".seal-fire");
    if (!box || !seal || !fire) return;
    root.classList.add("is-complete", "is-burning");
    box.classList.add("is-unlocked");
    let caseStarted = false;
    const duration = 2100;
    const startedAt = performance.now();
    const burn = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const edge = Math.min(100, progress * 112);
      seal.style.clipPath = `inset(${edge}% 0 0 0)`;
      seal.style.filter = `saturate(${1 + progress * 1.6}) brightness(${1.08 + Math.sin(progress * Math.PI) * .9}) contrast(${1 + progress * .45}) drop-shadow(0 0 ${4 + progress * 11}px rgba(190,42,9,.85))`;
      fire.style.top = `${-11 + Math.min(100, edge) * 2.2}px`;
      fire.style.opacity = String(progress < .92 ? Math.min(1, progress * 6) : (1 - progress) * 12.5);
      fire.querySelectorAll<HTMLElement>("i").forEach((flame, index) => {
        const flutter = Math.sin(now * .015 + index * 1.8);
        flame.style.transform = `translateX(${flutter * (3 + index)}px) scaleY(${.74 + (flutter + 1) * .22}) rotate(${flutter * 7}deg)`;
      });
      if (!caseStarted && progress >= .54) {
        caseStarted = true;
        box.classList.add("is-opening");
        animateCase(box, onOpened);
      }
      requestPaint();
      if (progress < 1) burnFrame = window.requestAnimationFrame(burn);
      else { seal.classList.add("is-gone"); root.classList.remove("is-burning"); requestPaint(); }
    };
    burnFrame = window.requestAnimationFrame(burn);
  };

  const handleInput = (): void => {
    input.setAttribute("value", input.value);
    input.removeAttribute("aria-invalid");
    root.classList.toggle("has-writing", input.value.trim().length > 0);
    requestPaint();
  };
  const handleFocus = (): void => { root.classList.add("is-focused"); requestPaint(); };
  const handleBlur = (): void => { root.classList.remove("is-focused"); requestPaint(); };
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault(); form.requestSubmit();
  };
  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const written = input.value.trim();
    if (phase === "pin") {
      if (normalizeAnswer(written) !== "1208") {
        input.setAttribute("aria-invalid", "true");
        root.classList.remove("is-wrong"); void root.offsetWidth; root.classList.add("is-wrong");
        root.dispatchEvent(new CustomEvent("canvas:disturb"));
        clearTimeout(wrongTimer);
        wrongTimer = window.setTimeout(() => { root.classList.remove("is-wrong"); requestPaint(); }, 520);
        input.select(); requestPaint(); return;
      }
      input.disabled = true;
      input.value = "";
      input.setAttribute("value", "");
      apparition.textContent = "一二〇八";
      apparition.dataset.text = "一二〇八";
      root.classList.add("is-pin-opening");
      burnSealAndOpen(0, () => {
        enterPhrasePhase();
        openPortal(boxes[0], 0);
      });
      requestPaint();
      return;
    }
    if (phase !== "phrases") return;
    const expected = PASS_PHRASES[revealed];
    if (!written || !expected || normalizeAnswer(written) !== normalizeAnswer(expected)) {
      input.setAttribute("aria-invalid", "true");
      root.classList.remove("is-wrong"); void root.offsetWidth; root.classList.add("is-wrong");
      root.dispatchEvent(new CustomEvent("canvas:disturb"));
      clearTimeout(wrongTimer);
      wrongTimer = window.setTimeout(() => { root.classList.remove("is-wrong"); requestPaint(); }, 520);
      input.select(); requestPaint(); return;
    }
    showCorrectEffect(expected, revealed);
    revealed += 1;
    root.dataset.revealed = String(revealed);
    root.classList.add("has-revealed");
    input.value = ""; input.setAttribute("value", ""); input.removeAttribute("aria-invalid"); root.classList.remove("has-writing");
    if (revealed === PASS_PHRASES.length) {
      phase = "complete";
      root.dataset.phase = phase;
      input.disabled = true;
      burnSealAndOpen(1, () => openPortal(boxes[1], 1));
    }
    requestPaint();
  };

  input.addEventListener("input", handleInput);
  input.addEventListener("focus", handleFocus);
  input.addEventListener("blur", handleBlur);
  input.addEventListener("keydown", handleKeyDown);
  form.addEventListener("submit", handleSubmit);
  return () => {
    clearTimeout(strikeTimer); clearTimeout(wrongTimer);
    window.cancelAnimationFrame(paintFrame); window.cancelAnimationFrame(burnFrame);
    window.cancelAnimationFrame(driftFrame); window.cancelAnimationFrame(answerFrame);
    input.removeEventListener("input", handleInput); input.removeEventListener("focus", handleFocus);
    input.removeEventListener("blur", handleBlur); input.removeEventListener("keydown", handleKeyDown);
    form.removeEventListener("submit", handleSubmit);
  };
};
