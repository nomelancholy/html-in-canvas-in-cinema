const LETTER = [
  "이 글을 본 자여, 이미 네 이름은 적혔느니라.",
  "초하루 달이 뜨기 전까지 이 종이를 불사르지 말라.",
  "자정이 지나 문밖에서 방울 소리가 세 번 울려도 내다보지 말라.",
  "죽은 자가 네 이름을 불러도 결코 대답하지 말라.",
  "부디 명심하라. 이 글은 저주를 내리는 글이 아니라, 이미 내린 저주를 알리는 글이니라.",
] as const;

const letterMarkup = (): string => LETTER.map((line, index) => `
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
        <span class="screen-frame" aria-hidden="true"><span class="screen-static"></span></span>
        <span class="box-seal" aria-hidden="true"></span>
      </button>
      <button class="relic-box" type="button" data-box="1" disabled aria-label="두 번째 봉인된 화면">
        <span class="screen-frame" aria-hidden="true"><span class="screen-static"></span></span>
        <span class="box-seal" aria-hidden="true"></span>
      </button>
    </div>
  </div>
`;

export const mountCurseLetter = (root: HTMLElement): (() => void) => {
  let revealed = 0;
  let strikeTimer = 0;
  const releaseTimers: number[] = [];
  root.classList.add("curse-surface");
  root.innerHTML = surfaceMarkup();

  const form = root.querySelector<HTMLFormElement>(".writing-form");
  const input = root.querySelector<HTMLInputElement>("#sentence-input");
  const boxes = Array.from(root.querySelectorAll<HTMLButtonElement>(".relic-box"));
  if (!form || !input) throw new Error("저주의 편지 입력 UI를 만들지 못했습니다.");

  const requestPaint = (): void => {
    const canvas = root.parentElement;
    if (canvas instanceof HTMLCanvasElement && typeof canvas.requestPaint === "function") canvas.requestPaint();
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

  const releaseSeals = (): void => {
    boxes.forEach((box, boxIndex) => {
      const seal = box.querySelector<HTMLElement>(".box-seal");
      if (!seal) return;
      const start = 450 + boxIndex * 900;
      for (let step = 1; step <= 4; step += 1) {
        releaseTimers.push(window.setTimeout(() => {
          seal.className = `box-seal seal-step-${step}`;
          root.dispatchEvent(new CustomEvent("canvas:disturb"));
          requestPaint();
        }, start + step * 130));
      }
      releaseTimers.push(window.setTimeout(() => {
        seal.className = "box-seal is-gone";
        requestPaint();
      }, start + 650));
    });
    releaseTimers.push(window.setTimeout(() => {
      root.classList.add("boxes-unlocked");
      boxes.forEach((box) => { box.disabled = false; });
      requestPaint();
    }, 2150));
  };

  const handleBoxClick = (event: MouseEvent): void => {
    const box = (event.target as Element).closest<HTMLButtonElement>(".relic-box");
    if (!box || box.disabled || !root.classList.contains("boxes-unlocked")) return;
    box.classList.add("is-opening");
    const bounds = box.getBoundingClientRect();
    window.dispatchEvent(new CustomEvent("portal:open", {
      detail: {
        channel: Number(box.dataset.box ?? 0),
        rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      },
    }));
    root.dispatchEvent(new CustomEvent("canvas:disturb"));
    requestPaint();
  };

  const handleSubmit = (event: SubmitEvent): void => {
    event.preventDefault();
    const written = input.value.trim();
    if (!written || revealed >= LETTER.length) {
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

    if (revealed === LETTER.length) {
      root.classList.add("is-complete");
      input.disabled = true;
      releaseSeals();
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
    releaseTimers.forEach(clearTimeout);
    input.removeEventListener("input", handleInput);
    input.removeEventListener("focus", handleFocus);
    input.removeEventListener("blur", handleBlur);
    input.removeEventListener("keydown", handleKeyDown);
    form.removeEventListener("submit", handleSubmit);
    root.removeEventListener("click", handleBoxClick);
  };
};
