import type {
  CustomLayerInterface,
  CustomRenderMethodInput,
  Map as MapLibreMap,
} from 'maplibre-gl';

import { INSTANCE_STRIDE, type TrackBuffers } from '@/lib/trackBuffers';

export const MAX_SATELLITES = 16;

export interface TrackLayerState {
  /** Visible time window, in seconds relative to `TrackBuffers.epoch0`. */
  from: number;
  to: number;
  /** Bit i set => satellite i visible. */
  mask: number;
  opacity: number;
  /** Line width in CSS pixels. */
  width: number;
  /** [r, g, b] per satellite index, 0..1. */
  colors: Float32Array;
}

const VERTEX_BODY = /* glsl */ `
layout(location = 0) in vec2 a_start;   // mercator [0,1]²
layout(location = 1) in vec2 a_end;
layout(location = 2) in vec2 a_meta;    // x: time (s, relative), y: satellite index

uniform vec2  u_viewport;               // drawing-buffer size in px
uniform float u_width;                  // device px
uniform float u_from;
uniform float u_to;
uniform int   u_mask;
uniform float u_world;                  // world-copy offset (mercator x)
uniform float u_opacity;
uniform vec3  u_colors[${MAX_SATELLITES}];

out vec3  v_color;
out float v_side;                       // signed distance from the line centre, px
out float v_core;                       // half line width, px

void main() {
  int sat = int(a_meta.y + 0.5);
  bool visible = ((u_mask >> sat) & 1) == 1 && a_meta.x >= u_from && a_meta.x <= u_to;
  if (!visible) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // outside the clip volume: culled for free
    v_color = vec3(0.0); v_side = 0.0; v_core = 0.0;
    return;
  }

  vec4 p0 = projectTile(a_start + vec2(u_world, 0.0));
  vec4 p1 = projectTile(a_end   + vec2(u_world, 0.0));

  vec2 d = (p1.xy / p1.w - p0.xy / p0.w) * u_viewport;
  float len = length(d);
  vec2 dir = len > 1e-4 ? d / len : vec2(1.0, 0.0);
  vec2 normalPx = vec2(-dir.y, dir.x);

  // Triangle-strip quad: 0=(start,-), 1=(end,-), 2=(start,+), 3=(end,+)
  float along = float(gl_VertexID & 1);
  float side  = float((gl_VertexID >> 1) * 2 - 1);

  float core = u_width * 0.5;
  float halfW = core + 1.0;                   // 1 px of padding for anti-aliasing
  vec4 p = mix(p0, p1, along);
  vec2 offsetNdc = normalPx * side * halfW * 2.0 / u_viewport;
  gl_Position = vec4(p.xy + offsetNdc * p.w, p.z, p.w);

  v_color = u_colors[sat];
  v_side = side * halfW;
  v_core = core;
}
`;

const FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
uniform float u_opacity;
in vec3  v_color;
in float v_side;
in float v_core;
out vec4 outColor;

void main() {
  float a = clamp(v_core - abs(v_side) + 0.5, 0.0, 1.0) * u_opacity;
  outColor = vec4(v_color * a, a);            // premultiplied alpha (MapLibre's blend mode)
}
`;

interface Program {
  handle: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const UNIFORMS = [
  'u_projection_matrix',
  'u_projection_tile_mercator_coords',
  'u_projection_clipping_plane',
  'u_projection_transition',
  'u_projection_fallback_matrix',
  'u_viewport',
  'u_width',
  'u_from',
  'u_to',
  'u_mask',
  'u_world',
  'u_opacity',
  'u_colors',
] as const;

/**
 * MapLibre custom layer that draws every satellite track edge as an instanced, anti-aliased quad.
 *
 * Why not a GeoJSON/vector layer? Changing a MapLibre layer filter re-parses every tile in a worker
 * (cost ∝ feature count, ~seconds for 100 k features). Here the data is uploaded once and the
 * time-range / satellite filters are shader uniforms: a slider drag is one `uniform` write plus a
 * repaint (sub-millisecond CPU), with the GPU culling invisible edges.
 *
 * Projection goes through MapLibre's own `projectTile`, so globe and mercator both work and the
 * back side of the globe is clipped by the same plane MapLibre uses for its tiles.
 */
export class TrackLayer implements CustomLayerInterface {
  readonly id = 'satellite-tracks';
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;

  private map: MapLibreMap | null = null;
  private data: TrackBuffers | null = null;
  private uploaded = false;
  private buffer: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private count = 0;
  private readonly programs = new Map<string, Program>();

  private state: TrackLayerState = {
    from: -Infinity,
    to: Infinity,
    mask: 0xffff,
    opacity: 0.8,
    width: 1.2,
    colors: new Float32Array(MAX_SATELLITES * 3),
  };

  onAdd(map: MapLibreMap): void {
    this.map = map;
  }

  onRemove(_map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    if (gl instanceof WebGL2RenderingContext) {
      if (this.buffer) gl.deleteBuffer(this.buffer);
      if (this.vao) gl.deleteVertexArray(this.vao);
      for (const p of this.programs.values()) gl.deleteProgram(p.handle);
    }
    this.programs.clear();
    this.buffer = null;
    this.vao = null;
    this.map = null;
  }

  /** Replaces the dataset; uploaded lazily on the next frame (needs the GL context). */
  setData(data: TrackBuffers | null): void {
    this.data = data;
    this.uploaded = false;
    this.map?.triggerRepaint();
  }

  /** Cheap: merges into the uniform state and schedules a repaint. */
  setState(patch: Partial<TrackLayerState>): void {
    this.state = { ...this.state, ...patch };
    this.map?.triggerRepaint();
  }

  render(
    gl: WebGLRenderingContext | WebGL2RenderingContext,
    options: CustomRenderMethodInput,
  ): void {
    if (!(gl instanceof WebGL2RenderingContext) || !this.data || this.data.count === 0) return;

    this.upload(gl, this.data);
    const program = this.programFor(gl, options);
    if (!program || !this.vao) return;

    const u = program.uniforms;
    const pd = options.defaultProjectionData;
    const dpr = this.map?.getPixelRatio() ?? 1;

    gl.useProgram(program.handle);
    gl.uniformMatrix4fv(u.u_projection_matrix ?? null, false, pd.mainMatrix);
    gl.uniform4f(u.u_projection_tile_mercator_coords ?? null, ...pd.tileMercatorCoords);
    gl.uniform4f(u.u_projection_clipping_plane ?? null, ...pd.clippingPlane);
    gl.uniform1f(u.u_projection_transition ?? null, pd.projectionTransition);
    gl.uniformMatrix4fv(u.u_projection_fallback_matrix ?? null, false, pd.fallbackMatrix);

    gl.uniform2f(u.u_viewport ?? null, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform1f(u.u_width ?? null, this.state.width * dpr);
    gl.uniform1f(u.u_from ?? null, this.state.from);
    gl.uniform1f(u.u_to ?? null, this.state.to);
    gl.uniform1i(u.u_mask ?? null, this.state.mask);
    gl.uniform1f(u.u_opacity ?? null, this.state.opacity);
    gl.uniform3fv(u.u_colors ?? null, this.state.colors);

    // Globe wraps by itself; flat maps repeat the world horizontally, so draw the neighbours too.
    const copies = pd.projectionTransition >= 0.999 ? [0] : [-1, 0, 1];

    gl.bindVertexArray(this.vao);
    for (const offset of copies) {
      gl.uniform1f(u.u_world ?? null, offset);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
    }
    gl.bindVertexArray(null);
  }

  /* ---------------------------------------------------------------- */

  private upload(gl: WebGL2RenderingContext, data: TrackBuffers): void {
    if (this.uploaded) return;
    this.buffer ??= gl.createBuffer();
    this.vao ??= gl.createVertexArray();

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.instances, gl.STATIC_DRAW);

    const stride = INSTANCE_STRIDE * 4;
    const attrib = (location: number, size: number, offsetFloats: number) => {
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offsetFloats * 4);
      gl.vertexAttribDivisor(location, 1);
    };
    attrib(0, 2, 0); // a_start
    attrib(1, 2, 2); // a_end
    attrib(2, 2, 4); // a_meta

    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.count = data.count;
    this.uploaded = true;
  }

  /** One compiled program per MapLibre projection variant (mercator / globe). */
  private programFor(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): Program | null {
    const { variantName, vertexShaderPrelude, define } = options.shaderData;
    const cached = this.programs.get(variantName);
    if (cached) return cached;

    const vs = compile(
      gl,
      gl.VERTEX_SHADER,
      `#version 300 es\n${vertexShaderPrelude}\n${define}\n${VERTEX_BODY}`,
    );
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vs || !fs) return null;

    const handle = gl.createProgram();
    gl.attachShader(handle, vs);
    gl.attachShader(handle, fs);
    gl.linkProgram(handle);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
      console.error('TrackLayer: program link failed', gl.getProgramInfoLog(handle));
      gl.deleteProgram(handle);
      return null;
    }

    const uniforms = Object.fromEntries(
      UNIFORMS.map((name) => [name, gl.getUniformLocation(handle, name)]),
    );
    const program = { handle, uniforms };
    this.programs.set(variantName, program);
    return program;
  }
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('TrackLayer: shader compile failed', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** #rrggbb palette -> flat Float32Array(16 * 3) in satellite-index order. */
export function colorsToUniform(
  satellites: readonly string[],
  colors: Record<string, string>,
): Float32Array {
  const out = new Float32Array(MAX_SATELLITES * 3);
  satellites.slice(0, MAX_SATELLITES).forEach((name, i) => {
    const hex = (colors[name] ?? '#888888').replace('#', '');
    out[3 * i] = parseInt(hex.slice(0, 2), 16) / 255;
    out[3 * i + 1] = parseInt(hex.slice(2, 4), 16) / 255;
    out[3 * i + 2] = parseInt(hex.slice(4, 6), 16) / 255;
  });
  return out;
}
