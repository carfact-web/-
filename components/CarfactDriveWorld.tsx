"use client";

import { useEffect, useRef } from "react";

const vertexShaderSource = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform vec2 resolution;
uniform float time;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float line(float value, float width) {
  return 1.0 - smoothstep(width, width + 0.008, abs(value));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;

  vec3 color = vec3(0.006, 0.009, 0.014);
  float horizon = 0.53;
  float depth = max(0.0, horizon - uv.y);
  float below = step(uv.y, horizon);

  float perspective = depth > 0.0 ? 0.12 / (depth + 0.035) : 0.0;
  float roadHalf = mix(0.08, 0.96, pow(depth / horizon, 0.72));
  float road = below * (1.0 - smoothstep(roadHalf, roadHalf + 0.025, abs(p.x)));
  color += road * vec3(0.018, 0.025, 0.033);

  float centerGlow = road * exp(-abs(p.x) * 2.8) * 0.055;
  color += vec3(0.45, 0.04, 0.065) * centerGlow;

  float travel = fract(perspective - time * 2.1);
  float roadGrid = line(fract(perspective * 0.55 - time * 0.75) - 0.5, 0.018);
  color += road * roadGrid * vec3(0.09, 0.13, 0.16) * depth * 1.6;

  float laneWidth = mix(0.012, 0.027, depth / horizon);
  float leftLane = line(p.x + roadHalf * 0.36, laneWidth);
  float rightLane = line(p.x - roadHalf * 0.36, laneWidth);
  float dash = step(0.48, travel);
  color += road * (leftLane + rightLane) * dash * vec3(0.78, 0.9, 0.96);

  float edgeWidth = mix(0.009, 0.025, depth / horizon);
  float edges = line(abs(p.x) - roadHalf, edgeWidth);
  color += below * edges * vec3(1.0, 0.035, 0.07) * (0.45 + 0.55 * sin(time * 5.0) * sin(time * 5.0));

  float scanY = fract(time * 0.46);
  float scan = exp(-abs(uv.y - mix(0.48, 0.04, scanY)) * 95.0);
  float scanHalf = mix(0.1, 0.94, scanY);
  scan *= 1.0 - smoothstep(scanHalf, scanHalf + 0.06, abs(p.x));
  color += vec3(0.08, 0.64, 0.84) * scan * 0.25;

  vec2 starGrid = floor((p + vec2(time * 0.02, time * 0.15)) * vec2(70.0, 52.0));
  vec2 starCell = fract((p + vec2(time * 0.02, time * 0.15)) * vec2(70.0, 52.0)) - 0.5;
  float rnd = hash(starGrid);
  float stars = smoothstep(0.065, 0.0, length(starCell)) * step(0.93, rnd);
  stars *= smoothstep(0.18, 0.72, uv.y);
  color += stars * mix(vec3(0.18, 0.72, 0.92), vec3(1.0, 0.12, 0.18), step(0.985, rnd));

  float portal = exp(-abs(length(vec2(p.x * 0.75, (uv.y - 0.51) * 5.0)) - 0.34) * 22.0);
  portal *= smoothstep(0.0, 0.7, sin(time * 2.4) * 0.5 + 0.5);
  color += vec3(0.75, 0.025, 0.055) * portal * 0.28;

  float vignette = smoothstep(1.35, 0.28, length(p * vec2(0.62, 0.9)));
  color *= vignette;
  gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function CarfactDriveWorld() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const position = gl.getAttribLocation(program, "position");
    const resolution = gl.getUniformLocation(program, "resolution");
    const time = gl.getUniformLocation(program, "time");

    gl.useProgram(program);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    let frame = 0;
    const startedAt = performance.now();

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
      const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }
    };

    const render = (now: number) => {
      resize();
      gl.uniform2f(resolution, canvas.width, canvas.height);
      gl.uniform1f(time, (now - startedAt) / 1000);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(frame);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}
