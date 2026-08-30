interface CanvasRenderingContext2D {
  drawElementImage(
    element: Element,
    dx: number,
    dy: number,
    dwidth?: number,
    dheight?: number,
  ): DOMMatrix;
}

interface HTMLCanvasElement {
  layoutSubtree: boolean;
  requestPaint(): void;
  getElementTransform(element: Element, drawTransform: DOMMatrix): DOMMatrix;
}

interface WebGL2RenderingContext {
  texElementImage2D(target: number, internalformat: number, element: Element): void;
  texElementImage2D(
    target: number,
    level: number,
    internalformat: number,
    format: number,
    type: number,
    element: Element,
  ): void;
}
