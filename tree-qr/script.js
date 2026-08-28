(() => {
  "use strict";

  const QUIET = 4; // modules of quiet zone on each side, required for reliable scanning
  const DURATION = 650; // ms, flatten/grow animation

  // 4 concentric zones by distance-from-center ratio (0 = center, 1 = corner):
  // rim = low & fairly flat, mid = higher & rugged, core = citadel-tall spikes,
  // peak = tiny cluster right at the center, shooting up even sharper/taller
  const MID_RATIO = 0.66; // ratio below this enters the mid zone
  const CORE_RATIO = 0.33; // ratio below this enters the core zone
  const PEAK_RATIO = 0.12; // ratio below this enters the peak zone
  const RIM_MIN = 0.35;
  const RIM_MAX = 0.75;
  const MID_MIN = 1.8;
  const MID_MAX = 4.5;
  const CORE_MIN = 5.5;
  const CORE_MAX = 12;
  const PEAK_MIN = 13.5;
  const PEAK_MAX = 20;
  const MAX_HEIGHT = PEAK_MAX; // used for layout bounds

  const form = document.getElementById("form");
  const input = document.getElementById("url-input");
  const errorEl = document.getElementById("error");
  const tapHint = document.getElementById("tap-hint");
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  const state = {
    matrix: null,
    heights: null,
    colors: null,
    moduleCount: 0,
    cell: 10,
    flatCell: 10,
    isoHW: 10,
    isoHH: 5,
    heightUnit: 9,
    flatOffsetX: 0,
    flatOffsetY: 0,
    isoOffsetX: 0,
    isoOffsetY: 0,
    contentW: 0,
    contentH: 0,
    t: 0, // 0 = full tree, 1 = full flattened QR
    target: 0,
    animating: false,
    raf: 0,
  };

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
  }

  function hideError() {
    errorEl.hidden = true;
  }

  function pseudoRandom(row, col) {
    const v = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
    return v - Math.floor(v);
  }

  // true for modules inside one of the 3 finder-pattern eyes (always solid,
  // high-contrast color so a scanner can still locate the code)
  function isFinderZone(row, col, n) {
    return (row < 7 && col < 7) || (row < 7 && col >= n - 7) || (row >= n - 7 && col < 7);
  }

  // "finder" and "rim" are both the low outer ring (finder eyes just happen to sit
  // out there); "mid" is the rugged middle band; "core"/"peak" are the 2 tall
  // center zones — shared by computeHeights (height range) and computeColors (color family)
  function classifyZone(row, col, n, center, maxDist) {
    if (isFinderZone(row, col, n)) return "finder";
    const dist = Math.hypot(row - center, col - center);
    const ratio = dist / maxDist;
    if (ratio > MID_RATIO) return "rim";
    if (ratio > CORE_RATIO) return "mid";
    if (ratio > PEAK_RATIO) return "core";
    return "peak";
  }

  function computeHeights(matrix, n) {
    const center = (n - 1) / 2;
    const maxDist = Math.hypot(center, center);
    const heights = [];
    for (let row = 0; row < n; row++) {
      heights.push(new Array(n).fill(0));
      for (let col = 0; col < n; col++) {
        if (!matrix[row][col]) continue;
        const zone = classifyZone(row, col, n, center, maxDist);
        const jitter = pseudoRandom(row, col);
        let h;
        if (zone === "peak") {
          h = PEAK_MIN + jitter * (PEAK_MAX - PEAK_MIN);
        } else if (zone === "core") {
          h = CORE_MIN + jitter * (CORE_MAX - CORE_MIN);
        } else if (zone === "mid") {
          h = MID_MIN + jitter * (MID_MAX - MID_MIN);
        } else {
          h = RIM_MIN + jitter * (RIM_MAX - RIM_MIN); // "rim" or "finder"
        }
        heights[row][col] = Math.min(h, MAX_HEIGHT);
      }
    }
    return heights;
  }

  function computeColors(matrix, heights, n) {
    const center = (n - 1) / 2;
    const maxDist = Math.hypot(center, center);
    const colors = [];
    for (let row = 0; row < n; row++) {
      colors.push(new Array(n).fill(null));
      for (let col = 0; col < n; col++) {
        if (!matrix[row][col]) continue;
        const zone = classifyZone(row, col, n, center, maxDist);
        if (zone === "finder") {
          colors[row][col] = FINDER_COLOR;
          continue;
        }
        let hue, sat, lightMin, lightMax, heightMin, heightMax;
        if (zone === "rim") {
          hue = SEA_HUE;
          sat = SEA_SAT;
          lightMin = SEA_LIGHT_MIN;
          lightMax = SEA_LIGHT_MAX;
          heightMin = RIM_MIN;
          heightMax = RIM_MAX;
        } else if (zone === "mid") {
          hue = EARTH_HUE;
          sat = EARTH_SAT;
          lightMin = EARTH_LIGHT_MIN;
          lightMax = EARTH_LIGHT_MAX;
          heightMin = MID_MIN;
          heightMax = MID_MAX;
        } else {
          // core + peak share one color family, graded across their combined height range
          hue = CEMENT_HUE;
          sat = CEMENT_SAT;
          lightMin = CEMENT_LIGHT_MIN;
          lightMax = CEMENT_LIGHT_MAX;
          heightMin = CORE_MIN;
          heightMax = PEAK_MAX;
        }
        const heightRatio = Math.min(1, Math.max(0, (heights[row][col] - heightMin) / (heightMax - heightMin)));
        const lightness = lightMin + (lightMax - lightMin) * heightRatio;
        colors[row][col] = hslToRgb(hue, sat, lightness);
      }
    }
    return colors;
  }

  function computeLayout(n) {
    const targetFlatWidth = 300;
    const cell = Math.min(14, Math.max(6, targetFlatWidth / (n + QUIET * 2)));
    const isoHW = cell;
    const isoHH = cell / 2;
    const heightUnit = cell * 0.9;

    const isoMinX = -n * isoHW;
    const isoMaxX = n * isoHW;
    const isoMinY = -MAX_HEIGHT * heightUnit;
    const isoMaxY = n * cell; // 2n*isoHH
    const isoW = isoMaxX - isoMinX;
    const isoH = isoMaxY - isoMinY;

    // the iso diamond's on-screen width is wider than a plain (n+quiet) grid at the
    // same cell size (isometric projection stretches it), so give the flat QR its
    // own, bigger per-module cell so its total width matches the iso footprint —
    // otherwise the flatten animation visibly shrinks the whole shape
    const flatCell = isoW / (n + QUIET * 2);
    const flatW = (n + QUIET * 2) * flatCell;
    const flatH = flatW;

    const contentW = Math.max(flatW, isoW);
    const contentH = Math.max(flatH, isoH);
    const pad = 16;
    const canvasW = contentW + pad * 2;
    const canvasH = contentH + pad * 2;

    const flatOffsetX = pad + (contentW - flatW) / 2;
    // bottom-align with the tree's ground level (not vertically centered in the
    // whole canvas) — otherwise flattening visually yanks the base upward since
    // the canvas is much taller than the flat QR once the peak height grows large
    const flatOffsetY = contentH + pad - flatH;
    const isoOffsetX = pad + (contentW - isoW) / 2 - isoMinX;
    const isoOffsetY = pad + (contentH - isoH) / 2 - isoMinY;

    Object.assign(state, {
      cell,
      flatCell,
      isoHW,
      isoHH,
      heightUnit,
      flatOffsetX,
      flatOffsetY,
      isoOffsetX,
      isoOffsetY,
      contentW: canvasW,
      contentH: canvasH,
    });

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    canvas.style.width = canvasW + "px";
    canvas.style.height = canvasH + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function isoProject(col, row, height) {
    return {
      x: state.isoOffsetX + (col - row) * state.isoHW,
      y: state.isoOffsetY + (col + row) * state.isoHH - height * state.heightUnit,
    };
  }

  function flatProject(col, row) {
    return {
      x: state.flatOffsetX + (col + QUIET) * state.flatCell,
      y: state.flatOffsetY + (row + QUIET) * state.flatCell,
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpPoint(a, b, t) {
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
  }

  function toRgba(c, alpha) {
    return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})`;
  }

  function shade(c, factor) {
    return [Math.round(c[0] * factor), Math.round(c[1] * factor), Math.round(c[2] * factor)];
  }

  // hsl values in [0,1] (h in degrees), returns [r,g,b] 0-255
  function hslToRgb(h, s, l) {
    h = h / 360;
    const hue2rgb = (p, q, tt) => {
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    ];
  }

  // solid, always-dark sea blue — finder-pattern eyes need reliable contrast to be detected at all
  const FINDER_COLOR = hslToRgb(205, 0.6, 0.22);

  // rim (outer ring, same family as the finder eyes): sea blue
  const SEA_HUE = 205;
  const SEA_SAT = 0.55;
  const SEA_LIGHT_MIN = 0.22;
  const SEA_LIGHT_MAX = 0.38;

  // mid band: earthy brown
  const EARTH_HUE = 28;
  const EARTH_SAT = 0.42;
  const EARTH_LIGHT_MIN = 0.24;
  const EARTH_LIGHT_MAX = 0.4;

  // core + peak (the 2 tall center zones): cement gray, lightness still capped so it
  // stays readable against the cream page background once flattened
  const CEMENT_HUE = 210;
  const CEMENT_SAT = 0.06;
  const CEMENT_LIGHT_MIN = 0.42;
  const CEMENT_LIGHT_MAX = 0.6;

  function fillQuad(points, style) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = style;
    ctx.fill();
  }

  function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function render(t) {
    const { contentW, contentH, moduleCount: n } = state;
    ctx.clearRect(0, 0, contentW, contentH);

    const order = [];
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        if (state.matrix[row][col]) order.push([row, col]);
      }
    }
    order.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));

    for (const [row, col] of order) {
      const h = state.heights[row][col] * (1 - t);
      const baseColor = state.colors[row][col];

      const topA = lerpPoint(isoProject(col, row, h), flatProject(col, row), t);
      const topB = lerpPoint(isoProject(col + 1, row, h), flatProject(col + 1, row), t);
      const topC = lerpPoint(isoProject(col + 1, row + 1, h), flatProject(col + 1, row + 1), t);
      const topD = lerpPoint(isoProject(col, row + 1, h), flatProject(col, row + 1), t);

      if (h > 0.001) {
        const baseB = isoProject(col + 1, row, 0);
        const baseC = isoProject(col + 1, row + 1, 0);
        const baseD = isoProject(col, row + 1, 0);
        const isoTopB = isoProject(col + 1, row, h);
        const isoTopC = isoProject(col + 1, row + 1, h);
        const isoTopD = isoProject(col, row + 1, h);
        const alpha = 1 - t;

        fillQuad([isoTopB, isoTopC, baseC, baseB], toRgba(shade(baseColor, 0.7), alpha));
        fillQuad([isoTopC, isoTopD, baseD, baseC], toRgba(shade(baseColor, 0.5), alpha));
      }

      fillQuad([topA, topB, topC, topD], toRgba(baseColor, 1));
    }
  }

  function animate(target) {
    if (state.animating) cancelAnimationFrame(state.raf);
    const start = state.t;
    const startTime = performance.now();
    state.animating = true;

    function step(now) {
      const p = Math.min((now - startTime) / DURATION, 1);
      const eased = easeInOutCubic(p);
      state.t = start + (target - start) * eased;
      render(state.t);
      if (p < 1) {
        state.raf = requestAnimationFrame(step);
      } else {
        state.t = target;
        render(state.t);
        state.animating = false;
      }
    }
    state.raf = requestAnimationFrame(step);
  }

  function onGenerate(e) {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) {
      showError("Nhập link trước đã");
      return;
    }
    hideError();

    let qr;
    try {
      qr = qrcode(0, "M");
      qr.addData(text);
      qr.make();
    } catch (err) {
      showError("Link quá dài, thử link ngắn hơn");
      return;
    }

    const n = qr.getModuleCount();
    const matrix = [];
    for (let row = 0; row < n; row++) {
      const line = [];
      for (let col = 0; col < n; col++) line.push(qr.isDark(row, col));
      matrix.push(line);
    }

    if (state.animating) {
      cancelAnimationFrame(state.raf);
      state.animating = false;
    }

    state.matrix = matrix;
    state.moduleCount = n;
    computeLayout(n);
    state.heights = computeHeights(matrix, n);
    state.colors = computeColors(matrix, state.heights, n);
    state.t = 0;
    state.target = 0;

    canvas.hidden = false;
    tapHint.hidden = false;
    render(0);
  }

  function onTap() {
    if (!state.matrix) return;
    state.target = state.target === 0 ? 1 : 0;
    animate(state.target);
  }

  form.addEventListener("submit", onGenerate);
  canvas.addEventListener("click", onTap);
})();
