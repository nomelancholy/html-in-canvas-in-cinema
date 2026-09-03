const LETTER = [
  "이 글을 본 자여, 이미 네 이름은 적혔느니라.",
  "초하루 달이 뜨기 전까지 이 종이를 불사르지 말라.",
  "산 자의 불에 태우면 그 화가 네 집으로 돌아오리라.",
  "자정이 지나 문밖에서 방울 소리가 세 번 울려도 내다보지 말라.",
  "죽은 자가 네 이름을 불러도 결코 대답하지 말라.",
  "닭이 울기 전 붉은 실이 끊어지면 네 그림자를 돌아보지 말라.",
  "그림자가 너보다 먼저 움직이는 날, 네 액이 시작되리라.",
  "한 사람의 원한으로 맺은 것이니 한 사람의 목숨으로는 풀리지 아니한다.",
  "칠 일 안에 주인을 찾아 돌려놓지 못하면 피붙이에게까지 화가 미치리라.",
  "부디 명심하라. 이 글은 저주를 내리는 글이 아니라, 이미 내린 저주를 알리는 글이니라.",
] as const;

const letterMarkup = (): string => LETTER.map((line, index) => `
  <li style="--line:${index}" data-letter-line="${index}">
    <span>${String(index + 1).padStart(2, "0")}</span>
    <p>${line}</p>
  </li>
`).join("");

const surfaceMarkup = (): string => `
  <div class="curse-content">
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
  </div>
`;

export const mountCurseLetter = (root: HTMLElement): (() => void) => {
  let revealed = 0;
  let strikeTimer = 0;
  root.classList.add("curse-surface");
  root.innerHTML = surfaceMarkup();

  const form = root.querySelector<HTMLFormElement>(".writing-form");
  const input = root.querySelector<HTMLInputElement>("#sentence-input");
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
    }
    requestPaint();
  };

  input.addEventListener("input", handleInput);
  input.addEventListener("focus", handleFocus);
  input.addEventListener("blur", handleBlur);
  input.addEventListener("keydown", handleKeyDown);
  form.addEventListener("submit", handleSubmit);

  return () => {
    clearTimeout(strikeTimer);
    input.removeEventListener("input", handleInput);
    input.removeEventListener("focus", handleFocus);
    input.removeEventListener("blur", handleBlur);
    input.removeEventListener("keydown", handleKeyDown);
    form.removeEventListener("submit", handleSubmit);
  };
};
