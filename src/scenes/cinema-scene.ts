import type { Frame, Scene } from "../canvas/stage";

export class CinemaScene implements Scene {
  render({ context, width, height, elapsed }: Frame): void {
    const gradient = context.createRadialGradient(
      width * 0.5,
      height * 0.42,
      0,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.65,
    );
    gradient.addColorStop(0, "#202740");
    gradient.addColorStop(0.45, "#0d1220");
    gradient.addColorStop(1, "#050609");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    this.#drawGrain(context, width, height, elapsed);
  }

  #drawGrain(context: CanvasRenderingContext2D, width: number, height: number, elapsed: number): void {
    context.save();
    context.globalAlpha = 0.14;
    context.fillStyle = "#ffffff";
    const seed = Math.floor(elapsed * 12);
    for (let index = 0; index < 90; index += 1) {
      const x = ((index * 7919 + seed * 104729) % 1000) / 1000 * width;
      const y = ((index * 6271 + seed * 15485863) % 1000) / 1000 * height;
      context.fillRect(x, y, 1, 1);
    }
    context.restore();
  }
}
