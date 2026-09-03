const CHAPTERS = [
  [
    "이 글을 본 자여, 이미 네 이름은 적혔느니라.",
    "초하루 달이 뜨기 전까지 이 종이를 불사르지 말라.",
    "산 자의 불에 태우면 그 화가 네 집으로 돌아오리라.",
    "자정이 지나 문밖에서 방울 소리가 세 번 울려도 내다보지 말라.",
    "죽은 자가 네 이름을 불러도 결코 대답하지 말라.",
  ],
  [
    "닭이 울기 전 붉은 실이 끊어지면 네 그림자를 돌아보지 말라.",
    "그림자가 너보다 먼저 움직이는 날, 네 액이 시작되리라.",
    "한 사람의 원한으로 맺은 것이니 한 사람의 목숨으로는 풀리지 아니한다.",
    "칠 일 안에 주인을 찾아 돌려놓지 못하면 피붙이에게까지 화가 미치리라.",
    "부디 명심하라. 이 글은 저주를 내리는 글이 아니라, 이미 내린 저주를 알리는 글이니라.",
  ],
] as const;

const letterMarkup = (): string => CHAPTERS[0].map((line, index) => `
  <li style="--line:${index}" data-letter-line="${index}">
    <p>${line}</p>
  </li>
`).join("");

const surfaceMarkup = (): string => `
  <div class="curse-content">
    <section class="paper-sheet">
      <div class="letter-field" aria-live="polite" aria-label="드러난 편지 내용">
        <ol>${letterMarkup()}</ol>
      </div>
      <form class="writing-form" autocomplete="off">
        <div class="entry-shell">
          <input id="sentence-input" name="sentence" type="text" maxlength="100"
            spellcheck="false" aria-label="문장 입력" />
        </div>
      </form>
      <div class="blood-seal" aria-hidden="true"><b>封</b><i></i><i></i><i></i></div>
      <div class="red-thread" aria-hidden="true"></div>
      <div class="scan-tear" aria-hidden="true"></div>
    </section>
    <div class="relic-boxes" aria-label="부적으로 봉인된 화면 두 개">
      <button class="relic-box" type="button" data-box="0" disabled aria-label="첫 번째 봉인된 화면">
        <span class="screen-frame" aria-hidden="true">
          <span class="screen-static"></span>
          <span class="case-hinges"><i></i><i></i></span>
          <span class="case-lid">
            <span class="case-lid-face"></span>
            <span class="case-lid-back"></span>
            <span class="case-lid-edge"></span>
          </span>
          <span class="case-latch"></span>
          <span class="case-dust"><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </span>
        <span class="box-seal" aria-hidden="true"></span>
      </button>
      <button class="relic-box" type="button" data-box="1" disabled aria-label="두 번째 봉인된 화면">
        <span class="screen-frame" aria-hidden="true">
          <span class="screen-static"></span>
          <span class="case-hinges"><i></i><i></i></span>
          <span class="case-lid">
            <span class="case-lid-face"></span>
            <span class="case-lid-back"></span>
            <span class="case-lid-edge"></span>
          </span>
          <span class="case-latch"></span>
          <span class="case-dust"><i></i><i></i><i></i><i></i><i></i><i></i></span>
        </span>
        <span class="box-seal" aria-hidden="true"></span>
      </button>
    </div>
  </div>
`;

export const mountCurseLetter = (root: HTMLElement): (() => void) => {
  let chapter = 0;
  let revealed = 0;
  let strikeTimer = 0;
  let paintFrame = 0;
  const releaseTimers: number[] = [];
  root.classList.add("curse-surface");
  root.dataset.chapter = "1";
  root.innerHTML = surfaceMarkup();

  const form = root.querySelector<HTMLFormElement>(".writing-form");
  const input = root.querySelector<HTMLInputElement>("#sentence-input");
  const boxes = Array.from(root.querySelectorAll<HTMLButtonElement>(".relic-box"));
  if (!form || !input) throw new Error("저주의 편지 입력 UI를 만들지 못했습니다.");

  const requestPaint = (): void => {
    const canvas = root.parentElement;
    if (canvas instanceof HTMLCanvasElement && typeof canvas.requestPaint === "function") {
      canvas.requestPaint();
      return;
    }
    root.dispatchEvent(new CustomEvent("canvas:paint-frame"));
  };

  const animateCase = (box: HTMLButtonElement, onComplete: () => void): void => {
    window.cancelAnimationFrame(paintFrame);
    const frame = box.querySelector<HTMLElement>(".screen-frame");
    const screen = box.querySelector<HTMLElement>(".screen-static");
    const lid = box.querySelector<HTMLElement>(".case-lid");
    const lidBack = box.querySelector<HTMLElement>(".case-lid-back");
    const latch = box.querySelector<HTMLElement>(".case-latch");
    const dust = Array.from(box.querySelectorAll<HTMLElement>(".case-dust i"));
    if (!frame || !screen || !lid || !latch) {
      onComplete();
      return;
    }

    const duration = 1560;
    const dustDrift = [-8, 7, -4, 8, -11, 5];
    const startedAt = performance.now();
    const paintFrameByFrame = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const liftProgress = Math.min(1, Math.max(0, (progress - .22) / .78));
      const eased = liftProgress < .5
        ? 4 * liftProgress ** 3
        : 1 - ((-2 * liftProgress + 2) ** 3) / 2;
      const settle = Math.sin(Math.max(0, liftProgress - .72) * Math.PI * 7) * (1 - liftProgress) * .8;
      const latchProgress = Math.min(1, Math.max(0, (progress - .025) / .25));

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
      if (progress < 1) {
        paintFrame = window.requestAnimationFrame(paintFrameByFrame);
        return;
      }
      box.dataset.opened = "true";
      onComplete();
    };
    paintFrame = window.requestAnimationFrame(paintFrameByFrame);
  };

  const handleInput = (): void => {
    input.setAttribute("value", input.value);
    root.classList.toggle("has-writing", input.value.trim().length > 0);
    requestPaint();
  };

  const handleFocus = (): void => {
    root.classList.add("is-focused");
    requestPaint();
  };

  const handleBlur = (): void => {
    root.classList.remove("is-focused");
    requestPaint();
  };

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== "Enter" || event.isComposing) return;
    event.preventDefault();
    form.requestSubmit();
  };

  const refillPaper = (): void => {
    root.classList.add("is-refilling");
    requestPaint();
    releaseTimers.push(window.setTimeout(() => {
      chapter = 1;
      revealed = 0;
      root.dataset.chapter = "2";
      root.dataset.revealed = "0";
      root.classList.remove("has-revealed", "is-complete");
      root.querySelectorAll<HTMLElement>("[data-letter-line]").forEach((line, index) => {
        line.classList.remove("is-revealed", "is-current");
        const copy = line.querySelector("p");
        if (copy) copy.textContent = CHAPTERS[1][index];
      });
      requestPaint();
    }, 330));
    releaseTimers.push(window.setTimeout(() => {
      root.classList.remove("is-refilling");
      input.disabled = false;
      input.focus();
      requestPaint();
    }, 760));
  };

  const releaseSeal = (boxIndex: number): void => {
    const box = boxes[boxIndex];
    const seal = box?.querySelector<HTMLElement>(".box-seal");
    if (!box || !seal) return;
    const start = 280;
    releaseTimers.push(window.setTimeout(() => {
      seal.classList.add("is-dissolving");
      root.dispatchEvent(new CustomEvent("canvas:disturb"));
      requestPaint();
    }, start));
    for (let step = 1; step <= 7; step += 1) {
      releaseTimers.push(window.setTimeout(() => {
        root.dispatchEvent(new CustomEvent("canvas:disturb"));
        requestPaint();
      }, start + step * 140));
    }
    releaseTimers.push(window.setTimeout(() => {
      seal.classList.add("is-gone");
      box.disabled = false;
      box.classList.add("is-unlocked");
      if (boxIndex === 0) refillPaper();
      else root.classList.add("all-chapters-complete");
      requestPaint();
    }, start + 1050));
  };

  const handleBoxClick = (event: MouseEvent): void => {
    const box = (event.target as Element).closest<HTMLButtonElement>(".relic-box");
    if (!box || box.disabled) return;
    const bounds = box.getBoundingClientRect();
    const openPortal = (): void => {
      window.dispatchEvent(new CustomEvent("portal:open", {
        detail: {
          channel: Number(box.dataset.box ?? 0),
          rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
        },
      }));
    };

    if (box.classList.contains("is-opening")) {
      if (box.dataset.opened === "true") openPortal();
      return;
    }

    box.classList.add("is-opening");
    animateCase(box, openPortal);
  };

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const written = input.value.trim();
    if (!written || revealed >= CHAPTERS[chapter].length) {
      root.classList.add("needs-writing");
      window.setTimeout(() => root.classList.remove("needs-writing"), 320);
      return;
    }

    root.querySelector("[data-letter-line].is-current")?.classList.remove("is-current");
    const line = root.querySelector<HTMLElement>(`[data-letter-line="${revealed}"]`);
    line?.classList.add("is-revealed", "is-current");
    revealed += 1;
    root.dataset.revealed = String(revealed);
    root.classList.add("has-revealed");
    input.value = "";
    input.setAttribute("value", "");
    root.classList.remove("has-writing");
    root.classList.add("is-struck");
    root.dispatchEvent(new CustomEvent("canvas:disturb"));
    clearTimeout(strikeTimer);
    strikeTimer = window.setTimeout(() => {
      root.classList.remove("is-struck");
      requestPaint();
    }, 520);

    if (revealed === CHAPTERS[chapter].length) {
      root.classList.add("is-complete");
      input.disabled = true;
      releaseSeal(chapter);
    }
    requestPaint();
  };

  input.addEventListener("input", handleInput);
  input.addEventListener("focus", handleFocus);
  input.addEventListener("blur", handleBlur);
  input.addEventListener("keydown", handleKeyDown);
  form.addEventListener("submit", handleSubmit);
  root.addEventListener("click", handleBoxClick);

  return () => {
    clearTimeout(strikeTimer);
    window.cancelAnimationFrame(paintFrame);
    releaseTimers.forEach(clearTimeout);
    input.removeEventListener("input", handleInput);
    input.removeEventListener("focus", handleFocus);
    input.removeEventListener("blur", handleBlur);
    input.removeEventListener("keydown", handleKeyDown);
    form.removeEventListener("submit", handleSubmit);
    root.removeEventListener("click", handleBoxClick);
  };
};
