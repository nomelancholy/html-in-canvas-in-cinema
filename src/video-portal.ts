type PortalOrigin = { x: number; y: number; width: number; height: number };
type PortalOpenDetail = { channel: number; rect?: PortalOrigin };

type PortalApi = {
  open: (channel?: number) => void;
  close: () => void;
  setRemoteStream: (channel: number, stream: MediaStream) => void;
};

declare global {
  interface Window { hicVideoPortal?: PortalApi }
}

const createDemoStream = (channel: number): { stream: MediaStream; stop: () => void } => {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 270;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("임시 영상 Canvas를 만들지 못했습니다.");
  let tick = 0;

  const draw = (): void => {
    tick += 1;
    const pulse = Math.sin(tick * 0.055);
    context.fillStyle = channel === 0 ? "#111613" : "#151310";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const glow = context.createRadialGradient(242, 108, 10, 242, 120, 235);
    glow.addColorStop(0, channel === 0 ? "rgba(151,164,145,.2)" : "rgba(164,151,125,.18)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (channel === 0) {
      context.fillStyle = "rgba(7,8,7,.9)";
      context.fillRect(174, 28, 144, 242);
      context.strokeStyle = "rgba(130,137,124,.18)";
      context.lineWidth = 5;
      context.strokeRect(168, 22, 156, 248);
      const shadowX = 244 + Math.sin(tick * 0.018) * 7;
      context.fillStyle = "rgba(0,0,0,.7)";
      context.beginPath();
      context.ellipse(shadowX, 112, 18, 31, 0, 0, Math.PI * 2);
      context.fill();
      context.fillRect(shadowX - 14, 138, 28, 100);
    } else {
      context.fillStyle = "rgba(4,5,5,.82)";
      context.fillRect(50, 42, 170, 143);
      context.strokeStyle = "rgba(154,145,122,.18)";
      context.lineWidth = 6;
      context.strokeRect(45, 37, 180, 153);
      context.beginPath();
      context.moveTo(135, 40);
      context.lineTo(135, 188);
      context.moveTo(48, 112);
      context.lineTo(222, 112);
      context.stroke();
      context.fillStyle = `rgba(8,7,6,${0.58 + pulse * 0.05})`;
      context.beginPath();
      context.ellipse(337, 116, 24, 38, -.08, 0, Math.PI * 2);
      context.fill();
      context.fillRect(315, 148, 46, 122);
    }

    context.globalAlpha = 0.12;
    for (let index = 0; index < 180; index += 1) {
      const shade = Math.floor(Math.random() * 190);
      context.fillStyle = `rgb(${shade} ${shade} ${shade})`;
      context.fillRect(Math.random() * 480, Math.random() * 270, Math.random() * 8 + 1, 1);
    }
    context.globalAlpha = 1;
    context.fillStyle = `rgba(235,238,224,${0.025 + Math.random() * 0.025})`;
    for (let y = 0; y < 270; y += 4) context.fillRect(0, y, 480, 1);
  };

  draw();
  const timer = window.setInterval(draw, 70);
  const stream = canvas.captureStream(18);
  return {
    stream,
    stop: () => {
      clearInterval(timer);
      stream.getTracks().forEach((track) => track.stop());
    },
  };
};

export const mountVideoPortal = (root: HTMLElement): (() => void) => {
  const video = root.querySelector<HTMLVideoElement>("video");
  const closeButton = root.querySelector<HTMLButtonElement>(".portal-close");
  if (!video || !closeButton) throw new Error("영상 화면을 만들지 못했습니다.");
  const remoteStreams = new Map<number, MediaStream>();
  let activeChannel = 0;
  let demo: ReturnType<typeof createDemoStream> | null = null;

  const attach = (channel: number): void => {
    demo?.stop();
    demo = null;
    const remote = remoteStreams.get(channel);
    if (remote) {
      video.srcObject = remote;
      video.muted = false;
    } else {
      demo = createDemoStream(channel);
      video.srcObject = demo.stream;
      video.muted = true;
    }
    void video.play();
  };

  const open = (channel = 0, origin?: PortalOrigin): void => {
    activeChannel = channel;
    const viewport = root.getBoundingClientRect();
    if (origin) {
      root.style.setProperty("--portal-from-x", `${origin.x + origin.width / 2 - viewport.width / 2}px`);
      root.style.setProperty("--portal-from-y", `${origin.y + origin.height / 2 - viewport.height / 2}px`);
      root.style.setProperty("--portal-from-scale", String(Math.max(.12, Math.min(.32, origin.width / 760))));
    }
    root.hidden = false;
    root.classList.remove("is-open");
    attach(channel);
    requestAnimationFrame(() => root.classList.add("is-open"));
  };

  const close = (): void => {
    root.classList.remove("is-open");
    window.setTimeout(() => {
      root.hidden = true;
      demo?.stop();
      demo = null;
      video.pause();
      video.srcObject = null;
    }, 430);
  };

  const setRemoteStream = (channel: number, stream: MediaStream): void => {
    remoteStreams.set(channel, stream);
    if (!root.hidden && activeChannel === channel) attach(channel);
  };

  const handleOpen = (event: Event): void => {
    const detail = (event as CustomEvent<PortalOpenDetail>).detail;
    open(detail.channel, detail.rect);
  };
  const handleBackdropClick = (event: MouseEvent): void => {
    if (event.target === root) close();
  };
  closeButton.addEventListener("click", close);
  root.addEventListener("click", handleBackdropClick);
  window.addEventListener("portal:open", handleOpen);
  window.hicVideoPortal = { open, close, setRemoteStream };

  return () => {
    demo?.stop();
    closeButton.removeEventListener("click", close);
    root.removeEventListener("click", handleBackdropClick);
    window.removeEventListener("portal:open", handleOpen);
    delete window.hicVideoPortal;
  };
};
