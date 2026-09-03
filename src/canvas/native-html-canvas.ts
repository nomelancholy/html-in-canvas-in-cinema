import { mat4 } from "gl-matrix";
import { toCanvas } from "html-to-image";

export type HtmlTextureMode = "native" | "snapshot";

type ProgramLocations = {
  program: WebGLProgram;
  position: number;
  uv: number;
  modelViewProjection: WebGLUniformLocation;
  time: WebGLUniformLocation;
  pointer: WebGLUniformLocation;
  transition: WebGLUniformLocation;
  opacity: WebGLUniformLocation;
  texture: WebGLUniformLocation;
};

const vertexSource = `#version 300 es
  precision highp float;
  in vec3 aPosition;
  in vec2 aUv;
  uniform mat4 uMvp;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uTransition;
  out vec2 vUv;
  out float vDepth;

  void main() {
    vec3 point = aPosition;
    float pointerDistance = distance(aUv, uPointer);
    float pulse = sin(pointerDistance * 25.0 - uTime * 4.0) * exp(-pointerDistance * 5.2);
    float paperWave = sin(aUv.y * 8.0 + uTime * 0.72) * 0.009;
    point.z += paperWave + pulse * (0.018 + uTransition * 0.18);
    point.x += sin(aUv.y * 18.0 + uTime) * 0.018 * uTransition;
    vUv = aUv;
    vDepth = point.z;
    gl_Position = uMvp * vec4(point, 1.0);
  }
`;

const fragmentSource = `#version 300 es
  precision highp float;
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uTransition;
  uniform float uOpacity;
  in vec2 vUv;
  in float vDepth;
  out vec4 outColor;

  float hash(vec2 value) {
    return fract(sin(dot(value, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main() {
    vec2 center = vUv - 0.5;
    float radius = length(center);
    vec2 direction = radius > 0.001 ? center / radius : vec2(0.0);
    float timeSlice = floor(uTime * 8.0);
    float filmJitter = (hash(vec2(timeSlice, 17.0)) - 0.5) * 0.0018;
    float shockwave = sin(radius * 48.0 - uTime * 7.0) * 0.01 * uTransition;
    vec2 warpedUv = clamp(vUv + direction * shockwave + vec2(filmJitter, 0.0), 0.002, 0.998);
    vec4 base = texture(uTexture, warpedUv);
    float grain = hash(floor(vUv * vec2(360.0, 240.0)) + timeSlice);
    float flicker = 0.955 + hash(vec2(timeSlice, 9.0)) * 0.045;
    float inkBloom = smoothstep(0.22, 0.0, abs(radius - fract(uTime * 0.08))) * uTransition;
    float edge = smoothstep(0.0, 0.035, vUv.x) * smoothstep(0.0, 0.035, vUv.y)
      * smoothstep(0.0, 0.035, 1.0 - vUv.x) * smoothstep(0.0, 0.035, 1.0 - vUv.y);
    vec3 moonTint = vec3(0.93, 0.95, 0.9);
    vec3 vermilion = vec3(0.24, 0.008, 0.004) * (inkBloom * 0.7 + max(vDepth, 0.0) * 0.25);
    vec3 cursed = base.rgb * moonTint * (flicker + (grain - 0.5) * 0.045) + vermilion;
    outColor = vec4(cursed * edge, base.a * edge * uOpacity);
  }
`;

export const supportsNativeHtmlInCanvas = (canvas: HTMLCanvasElement): boolean =>
  typeof canvas.requestPaint === "function" &&
  typeof canvas.getElementTransform === "function" &&
  typeof WebGL2RenderingContext !== "undefined" &&
  typeof WebGL2RenderingContext.prototype.texElementImage2D === "function";

export const supportsWebGlSnapshot = (): boolean =>
  typeof WebGL2RenderingContext !== "undefined";

export class NativeHtmlCanvas {
  #canvas: HTMLCanvasElement;
  #element: HTMLElement;
  #gl: WebGL2RenderingContext;
  #locations: ProgramLocations;
  #texture: WebGLTexture;
  #vertexArray: WebGLVertexArrayObject;
  #indexCount: number;
  #frameId = 0;
  #startedAt = performance.now();
  #transitionStartedAt = -Infinity;
  #pointer = { x: 0.5, y: 0.5 };
  #pointerTarget = { x: 0.5, y: 0.5 };
  #resizeObserver: ResizeObserver;
  #mode: HtmlTextureMode;
  #snapshotSource: HTMLElement | null = null;
  #snapshotHost: HTMLElement | null = null;
  #mutationObserver: MutationObserver | null = null;
  #snapshotPending = false;
  #snapshotQueued = false;

  constructor(canvas: HTMLCanvasElement, element: HTMLElement, mode: HtmlTextureMode = "native") {
    const gl = canvas.getContext("webgl2", { alpha: true, antialias: true, premultipliedAlpha: true });
    if (!gl) throw new Error("WebGL 2 context를 생성하지 못했습니다.");
    this.#canvas = canvas;
    this.#element = element;
    this.#mode = mode;
    this.#gl = gl;
    this.#locations = this.#createProgram();
    const mesh = this.#createMesh(42, 24);
    this.#vertexArray = mesh.vertexArray;
    this.#indexCount = mesh.indexCount;
    this.#texture = this.#createTexture();
    this.#resizeObserver = new ResizeObserver(this.#resize);
    this.#resizeObserver.observe(canvas);
    if (mode === "native") this.#canvas.addEventListener("paint", this.#handlePaint);
    this.#canvas.addEventListener("pointermove", this.#handlePointerMove);
    this.#element.addEventListener("pointermove", this.#handlePointerMove);
    this.#canvas.addEventListener("pointerleave", this.#handlePointerLeave);
    this.#element.addEventListener("pointerleave", this.#handlePointerLeave);
    this.#element.addEventListener("canvas:disturb", this.#handleTransition);
    this.#resize();
    if (mode === "native") {
      this.#canvas.requestPaint();
    } else {
      this.#setupSnapshotSource();
      void document.fonts.ready.then(this.#queueSnapshot);
    }
    this.#frameId = requestAnimationFrame(this.#tick);
  }

  destroy(): void {
    cancelAnimationFrame(this.#frameId);
    this.#resizeObserver.disconnect();
    this.#canvas.removeEventListener("paint", this.#handlePaint);
    this.#canvas.removeEventListener("pointermove", this.#handlePointerMove);
    this.#element.removeEventListener("pointermove", this.#handlePointerMove);
    this.#canvas.removeEventListener("pointerleave", this.#handlePointerLeave);
    this.#element.removeEventListener("pointerleave", this.#handlePointerLeave);
    this.#element.removeEventListener("canvas:disturb", this.#handleTransition);
    this.#mutationObserver?.disconnect();
    this.#snapshotHost?.remove();
    if (this.#mode === "snapshot") this.#element.style.opacity = "";
  }

  #createProgram(): ProgramLocations {
    const gl = this.#gl;
    const vertex = this.#compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.#compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) throw new Error("WebGL program을 생성하지 못했습니다.");
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`WebGL program 연결 실패: ${gl.getProgramInfoLog(program)}`);
    const uniform = (name: string): WebGLUniformLocation => {
      const location = gl.getUniformLocation(program, name);
      if (!location) throw new Error(`${name} uniform을 찾지 못했습니다.`);
      return location;
    };
    return {
      program,
      position: gl.getAttribLocation(program, "aPosition"),
      uv: gl.getAttribLocation(program, "aUv"),
      modelViewProjection: uniform("uMvp"),
      time: uniform("uTime"),
      pointer: uniform("uPointer"),
      transition: uniform("uTransition"),
      opacity: uniform("uOpacity"),
      texture: uniform("uTexture"),
    };
  }

  #compileShader(type: number, source: string): WebGLShader {
    const shader = this.#gl.createShader(type);
    if (!shader) throw new Error("WebGL shader를 생성하지 못했습니다.");
    this.#gl.shaderSource(shader, source);
    this.#gl.compileShader(shader);
    if (!this.#gl.getShaderParameter(shader, this.#gl.COMPILE_STATUS)) throw new Error(`WebGL shader 컴파일 실패: ${this.#gl.getShaderInfoLog(shader)}`);
    return shader;
  }

  #createMesh(columns: number, rows: number): { vertexArray: WebGLVertexArrayObject; indexCount: number } {
    const gl = this.#gl;
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= columns; column += 1) {
        const u = column / columns;
        const v = row / rows;
        vertices.push(u * 2 - 1, 1 - v * 2, 0, u, v);
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const start = row * (columns + 1) + column;
        indices.push(start, start + columns + 1, start + 1, start + 1, start + columns + 1, start + columns + 2);
      }
    }
    const vertexArray = gl.createVertexArray();
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    if (!vertexArray || !vertexBuffer || !indexBuffer) throw new Error("WebGL mesh 생성에 실패했습니다.");
    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(this.#locations.position);
    gl.vertexAttribPointer(this.#locations.position, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(this.#locations.uv);
    gl.vertexAttribPointer(this.#locations.uv, 2, gl.FLOAT, false, 20, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vertexArray, indexCount: indices.length };
  }

  #createTexture(): WebGLTexture {
    const gl = this.#gl;
    const texture = gl.createTexture();
    if (!texture) throw new Error("WebGL texture를 생성하지 못했습니다.");
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    return texture;
  }

  #resize = (): void => {
    const density = Math.min(window.devicePixelRatio || 1, 2);
    this.#canvas.width = Math.max(1, Math.round(this.#canvas.clientWidth * density));
    this.#canvas.height = Math.max(1, Math.round(this.#canvas.clientHeight * density));
    this.#gl.viewport(0, 0, this.#canvas.width, this.#canvas.height);
    if (this.#mode === "native") this.#canvas.requestPaint();
  };

  #handlePaint = (): void => {
    try {
      this.#uploadHtmlTexture();
      delete this.#canvas.dataset.webglError;
    } catch (error) {
      this.#canvas.dataset.webglError = error instanceof Error ? error.message : String(error);
    }
  };
  #handleTransition = (): void => { this.#transitionStartedAt = performance.now(); };
  #handlePointerMove = (event: PointerEvent): void => {
    const bounds = this.#canvas.getBoundingClientRect();
    this.#pointerTarget.x = (event.clientX - bounds.left) / bounds.width;
    this.#pointerTarget.y = (event.clientY - bounds.top) / bounds.height;
  };
  #handlePointerLeave = (): void => { this.#pointerTarget = { x: 0.5, y: 0.5 }; };

  #tick = (time: number): void => {
    this.#pointer.x += (this.#pointerTarget.x - this.#pointer.x) * 0.065;
    this.#pointer.y += (this.#pointerTarget.y - this.#pointer.y) * 0.065;
    try {
      this.#render(time);
    } catch (error) {
      this.#canvas.dataset.webglError = error instanceof Error ? error.message : String(error);
    }
    this.#frameId = requestAnimationFrame(this.#tick);
  };

  #uploadHtmlTexture(): void {
    const gl = this.#gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (gl.texElementImage2D.length === 3) {
      gl.texElementImage2D(gl.TEXTURE_2D, gl.RGBA8, this.#element);
    } else {
      gl.texElementImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.#element);
    }
  }

  #setupSnapshotSource(): void {
    const host = document.createElement("div");
    host.setAttribute("aria-hidden", "true");
    host.inert = true;
    host.style.position = "fixed";
    host.style.left = "-10000px";
    host.style.top = "0";
    host.style.width = "720px";
    host.style.height = "420px";
    host.style.overflow = "hidden";
    host.style.pointerEvents = "none";
    host.style.zIndex = "-1";
    const source = this.#element.cloneNode(true) as HTMLElement;
    source.removeAttribute("id");
    source.removeAttribute("hidden");
    source.setAttribute("aria-hidden", "true");
    source.inert = true;
    source.style.position = "relative";
    source.style.left = "0";
    source.style.top = "0";
    source.style.width = "720px";
    source.style.height = "420px";
    source.style.transform = "none";
    source.style.opacity = "1";
    source.style.pointerEvents = "none";
    source.style.zIndex = "0";
    host.append(source);
    document.body.append(host);
    this.#snapshotHost = host;
    this.#snapshotSource = source;
    this.#element.style.opacity = "0";
    this.#mutationObserver = new MutationObserver(this.#queueSnapshot);
    this.#mutationObserver.observe(this.#element, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["class", "disabled", "value", "placeholder", "data-revealed"],
    });
    this.#queueSnapshot();
  }

  #queueSnapshot = (): void => {
    if (!this.#snapshotSource) return;
    if (this.#snapshotPending) {
      this.#snapshotQueued = true;
      return;
    }
    this.#snapshotPending = true;
    this.#snapshotSource.className = this.#element.className;
    this.#snapshotSource.innerHTML = this.#element.innerHTML;
    void toCanvas(this.#snapshotSource, {
      width: 720,
      height: 420,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      cacheBust: false,
    }).then((snapshot) => {
      const gl = this.#gl;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.#texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot);
      delete this.#canvas.dataset.webglError;
    }).catch((error: unknown) => {
      this.#canvas.dataset.webglError = error instanceof Error ? error.message : String(error);
    }).finally(() => {
      this.#snapshotPending = false;
      if (this.#snapshotQueued) {
        this.#snapshotQueued = false;
        this.#queueSnapshot();
      }
    });
  };

  #render(time: number): void {
    const gl = this.#gl;
    const elapsed = (time - this.#startedAt) / 1000;
    const transitionAge = (time - this.#transitionStartedAt) / 1000;
    const transition = transitionAge >= 0 && transitionAge < 1.35 ? Math.sin((transitionAge / 1.35) * Math.PI) : 0;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(this.#locations.program);
    gl.bindVertexArray(this.#vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.#texture);
    gl.uniform1i(this.#locations.texture, 0);
    gl.uniform1f(this.#locations.time, elapsed);
    gl.uniform2f(this.#locations.pointer, this.#pointer.x, this.#pointer.y);
    gl.uniform1f(this.#locations.transition, transition);

    const projection = mat4.create();
    const view = mat4.create();
    const model = mat4.create();
    mat4.perspective(projection, Math.PI / 4, this.#canvas.width / this.#canvas.height, 0.1, 100);
    mat4.lookAt(view, [0, 0, 5], [0, 0, 0], [0, 1, 0]);
    mat4.translate(model, model, [0, Math.sin(elapsed * 0.75) * 0.055, 0]);
    mat4.rotateX(model, model, (0.5 - this.#pointer.y) * 0.24 - 0.04);
    mat4.rotateY(model, model, (this.#pointer.x - 0.5) * 0.42);
    mat4.rotateZ(model, model, (this.#pointer.x - 0.5) * 0.035);
    mat4.scale(model, model, [1.72, 1, 1]);

    const reflectionModel = mat4.clone(model);
    mat4.translate(reflectionModel, reflectionModel, [0, -2.18, -0.2]);
    mat4.scale(reflectionModel, reflectionModel, [1, -1, 1]);
    gl.uniform1f(this.#locations.opacity, 0.1);
    this.#drawPlane(projection, view, reflectionModel);
    gl.uniform1f(this.#locations.opacity, 1);
    this.#drawPlane(projection, view, model);
    this.#syncHitTesting(projection, view, model);

  }

  #drawPlane(projection: mat4, view: mat4, model: mat4): void {
    const mvp = mat4.create();
    mat4.multiply(mvp, projection, view);
    mat4.multiply(mvp, mvp, model);
    this.#gl.uniformMatrix4fv(this.#locations.modelViewProjection, false, mvp);
    this.#gl.drawElements(this.#gl.TRIANGLES, this.#indexCount, this.#gl.UNSIGNED_SHORT, 0);
  }

  #syncHitTesting(projection: mat4, view: mat4, model: mat4): void {
    const width = this.#element.offsetWidth;
    const height = this.#element.offsetHeight;
    if (!width || !height) return;
    const local = mat4.create();
    mat4.translate(local, local, [-1, 1, 0]);
    mat4.scale(local, local, [2 / width, -2 / height, 1]);
    const viewport = mat4.fromValues(
      this.#canvas.width / 2, 0, 0, 0,
      0, -this.#canvas.height / 2, 0, 0,
      0, 0, 1, 0,
      this.#canvas.width / 2, this.#canvas.height / 2, 0, 1,
    );
    const screen = mat4.create();
    mat4.multiply(screen, projection, view);
    mat4.multiply(screen, screen, model);
    mat4.multiply(screen, screen, local);
    mat4.multiply(screen, viewport, screen);
    const density = Math.min(window.devicePixelRatio || 1, 2);
    mat4.scale(screen, screen, [1 / density, 1 / density, 1]);
    let transform = new DOMMatrix(Array.from(screen));
    if (this.#mode === "native") {
      transform = this.#canvas.getElementTransform(this.#element, transform);
      if (transform.is2D) transform = DOMMatrix.fromFloat64Array(transform.toFloat64Array());
    }
    this.#element.style.position = "absolute";
    this.#element.style.left = "0";
    this.#element.style.top = "0";
    this.#element.style.transformOrigin = "0 0";
    this.#element.style.transform = transform.toString();
  }
}
