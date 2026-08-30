export type Frame = {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  delta: number;
  elapsed: number;
};

export type Scene = {
  render(frame: Frame): void;
  resize?(width: number, height: number): void;
  destroy?(): void;
};

export class CanvasStage {
  readonly canvas: HTMLCanvasElement;
  readonly context: CanvasRenderingContext2D;

  #scene: Scene;
  #frameId = 0;
  #lastTime = 0;
  #startedAt = 0;
  #resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, scene: Scene) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D context를 생성하지 못했습니다.");

    this.canvas = canvas;
    this.context = context;
    this.#scene = scene;
    this.#resizeObserver = new ResizeObserver(() => this.#resize());
    this.#resizeObserver.observe(canvas);
    this.#resize();
  }

  start(): void {
    if (this.#frameId) return;
    this.#startedAt = performance.now();
    this.#lastTime = this.#startedAt;
    this.#frameId = requestAnimationFrame(this.#tick);
  }

  stop(): void {
    cancelAnimationFrame(this.#frameId);
    this.#frameId = 0;
  }

  setScene(scene: Scene): void {
    this.#scene.destroy?.();
    this.#scene = scene;
    scene.resize?.(this.canvas.clientWidth, this.canvas.clientHeight);
  }

  destroy(): void {
    this.stop();
    this.#resizeObserver.disconnect();
    this.#scene.destroy?.();
  }

  #resize(): void {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const density = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.round(width * density);
    const nextHeight = Math.round(height * density);

    if (this.canvas.width !== nextWidth || this.canvas.height !== nextHeight) {
      this.canvas.width = nextWidth;
      this.canvas.height = nextHeight;
      this.context.setTransform(density, 0, 0, density, 0, 0);
      this.#scene.resize?.(width, height);
    }
  }

  #tick = (time: number): void => {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const delta = Math.min((time - this.#lastTime) / 1000, 0.1);

    this.#lastTime = time;
    this.#scene.render({
      context: this.context,
      width,
      height,
      delta,
      elapsed: (time - this.#startedAt) / 1000,
    });

    this.#frameId = requestAnimationFrame(this.#tick);
  };
}
