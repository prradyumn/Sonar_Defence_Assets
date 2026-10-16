/* water: the story's underwater backdrop as one WebGL canvas.
   The background image is refracted by slow ripples, lit by moving caustics and soft god rays, and softly
   Gaussian-blurred towards the bottom and the edges for depth. One full-screen pass on the GPU (no CSS filters),
   so it stays smooth. Falls back to the plain CSS background when WebGL is missing. */
(function () {
  const VS = `attribute vec2 p; varying vec2 uv; void main(){ uv = p * .5 + .5; uv.y = 1. - uv.y; gl_Position = vec4(p, 0., 1.); }`;
  const FS = `precision mediump float;
  varying vec2 uv; uniform sampler2D tex; uniform float t; uniform float glow; uniform vec3 tint;
  float caustic(vec2 uv2){                     // a classic tileable water-caustic pattern (needs the big offset coordinates)
    vec2 p = mod(uv2 * 6.28318, 6.28318) - 250.; vec2 i = p; float c = 1.; float inten = .005;
    for (int n = 0; n < 4; n++) { float tt = t * .32 * (1. - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1. / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten))); }
    c /= 4.; c = 1.17 - pow(c, 1.4); return clamp(pow(abs(c), 8.), 0., 1.); }
  void main(){
    vec2 q = uv;
    q += vec2(sin(q.y * 22. + t * 1.2), cos(q.x * 17. + t * .9)) * .0022;           // refraction ripple
    float blur = smoothstep(.5, 1., q.y) * .0045 + smoothstep(.38, .75, length(q - vec2(.5, .45))) * .003;   // depth of field
    vec3 col = texture2D(tex, q).rgb * .2;
    col += (texture2D(tex, q + vec2(blur, 0.)).rgb + texture2D(tex, q - vec2(blur, 0.)).rgb + texture2D(tex, q + vec2(0., blur)).rgb + texture2D(tex, q - vec2(0., blur)).rgb) * .12;
    col += (texture2D(tex, q + vec2(blur, blur) * .7).rgb + texture2D(tex, q - vec2(blur, blur) * .7).rgb + texture2D(tex, q + vec2(blur, -blur) * .7).rgb + texture2D(tex, q + vec2(-blur, blur) * .7).rgb) * .08;
    float top = 1. - q.y;
    col += vec3(.75, .95, 1.) * caustic(q * vec2(1.6, .9) + vec2(t * .01, 0.)) * .3 * pow(top, 1.4);   // caustic light, strongest near the surface
    float ray = pow(max(0., sin((q.x - q.y * .42) * 15. + sin(t * .25) * 1.8)), 7.) * .5 + pow(max(0., sin((q.x - q.y * .5) * 7. - t * .12)), 9.) * .5;
    col += vec3(.7, .95, 1.) * ray * .16 * pow(top, 1.2);                                  // god rays
    col = mix(col, col * tint, .55) + glow * vec3(.25, .35, .3) * top;                     // tint (red alert) · brighter at the end
    gl_FragColor = vec4(clamp(col, 0., 1.), 1.);
  }`;
  function Water(canvas) {
    if (location.protocol === 'file:') return null;   // WebGL may not read images opened from a file: the plain background is used
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = n => gl.getUniformLocation(pr, n), uT = U('t'), uG = U('glow'), uTint = U('tint');
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const S = { glow: 0, r: 1, g: 1, b: 1 }; let ready = false, on = false, t0 = 0;
    const draw = (t) => { if (!on || !ready || SD.paused) return; gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uT, t - t0); gl.uniform1f(uG, S.glow); gl.uniform3f(uTint, S.r, S.g, S.b); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); };
    return {
      state: S,
      load(src) { return new Promise(res => { const im = new Image(); im.onload = () => { try { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); ready = true; } catch (e) { ready = false; } res(ready); }; im.onerror = () => res(false); im.src = src; }); },
      start() { if (on) return; on = true; t0 = gsap.ticker.time; gsap.ticker.add(draw); },
      stop() { on = false; gsap.ticker.remove(draw); },
    };
  }
  window.Water = Water;
})();
