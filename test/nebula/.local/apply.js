(() => {
  // ../.hermes/hermes-agent/apps/shared/src/color.ts
  var HEX6_RE = /^#?([0-9a-f]{6})$/i;
  var HEX3_RE = /^#?([0-9a-f]{3})$/i;
  var RGB_FN_RE = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i;
  var clampChannel = (v) => Math.max(0, Math.min(255, Math.round(v)));
  function parseColor(input) {
    const value = input.trim();
    let m = HEX6_RE.exec(value);
    if (m) {
      const n = parseInt(m[1], 16);
      return [n >> 16 & 255, n >> 8 & 255, n & 255];
    }
    m = HEX3_RE.exec(value);
    if (m) {
      const [r, g, b] = m[1];
      return [parseInt(r + r, 16), parseInt(g + g, 16), parseInt(b + b, 16)];
    }
    m = RGB_FN_RE.exec(value);
    if (m) {
      return [clampChannel(Number(m[1])), clampChannel(Number(m[2])), clampChannel(Number(m[3]))];
    }
    return null;
  }
  var toHex = (rgb) => "#" + rgb.map((c) => clampChannel(c).toString(16).padStart(2, "0")).join("");
  function mix(a, b, t) {
    const pa = parseColor(a);
    const pb = parseColor(b);
    if (!pa || !pb) {
      return a;
    }
    return toHex([pa[0] + (pb[0] - pa[0]) * t, pa[1] + (pb[1] - pa[1]) * t, pa[2] + (pb[2] - pa[2]) * t]);
  }
  function channelLuminance(value) {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }
  function relativeLuminance(color) {
    const rgb = parseColor(color);
    return rgb ? 0.2126 * channelLuminance(rgb[0]) + 0.7152 * channelLuminance(rgb[1]) + 0.0722 * channelLuminance(rgb[2]) : null;
  }
  function contrastRatio(a, b) {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    if (la === null || lb === null) {
      return null;
    }
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
  }
  var DEFAULT_INKS = ["#000000", "#ffffff"];
  function readableOn(bg, inks = DEFAULT_INKS) {
    let best = inks[inks.length - 1];
    let bestRatio = -1;
    for (const ink of inks) {
      const ratio = contrastRatio(bg, ink);
      if (ratio !== null && ratio >= bestRatio) {
        best = ink;
        bestRatio = ratio;
      }
    }
    return best;
  }
  function ensureContrast(color, bg, min, step = 0.2) {
    const bgLuminance = relativeLuminance(bg);
    if (bgLuminance === null || parseColor(color) === null) {
      return color;
    }
    const ratio = contrastRatio(color, bg);
    if (ratio === null || ratio >= min) {
      return color;
    }
    const pole = bgLuminance < 0.5 ? "#ffffff" : "#000000";
    let best = color;
    for (let amount = step; amount <= 1.0001; amount += step) {
      best = mix(color, pole, Math.min(amount, 1));
      const stepRatio = contrastRatio(best, bg);
      if (stepRatio !== null && stepRatio >= min) {
        return best;
      }
    }
    return best;
  }

  // ../.hermes/hermes-agent/apps/desktop/src/themes/color.ts
  var DESKTOP_INKS = ["#161616", "#ffffff"];
  var readableInk = (bg) => readableOn(bg, DESKTOP_INKS);
  var linearize01 = (c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  var delinearize01 = (c) => c <= 31308e-7 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  function hexToOklch(hex) {
    const rgb = parseColor(hex);
    if (!rgb) {
      return null;
    }
    const [okL, okA, okB] = rgbToOklab(rgb);
    return {
      l: okL,
      c: Math.hypot(okA, okB),
      h: (Math.atan2(okB, okA) * 180 / Math.PI + 360) % 360
    };
  }
  function rgbToOklab([r255, g255, b255]) {
    const [r, g, b] = [r255, g255, b255].map((v) => linearize01(v / 255));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
    ];
  }
  function oklchToRgbRaw({ l: okL, c, h }) {
    const rad = h * Math.PI / 180;
    const okA = c * Math.cos(rad);
    const okB = c * Math.sin(rad);
    const l = (okL + 0.3963377774 * okA + 0.2158037573 * okB) ** 3;
    const m = (okL - 0.1055613458 * okA - 0.0638541728 * okB) ** 3;
    const s = (okL - 0.0894841775 * okA - 1.291485548 * okB) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
    ];
  }
  var inSrgbGamut = (rgb) => rgb.every((c) => c >= -1e-3 && c <= 1.001);
  function oklchToHex(color) {
    if (inSrgbGamut(oklchToRgbRaw(color))) {
      return toHex(oklchToRgbRaw(color).map((c) => delinearize01(c) * 255));
    }
    let lo = 0;
    let hi = color.c;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (inSrgbGamut(oklchToRgbRaw({ ...color, c: mid }))) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return toHex(oklchToRgbRaw({ ...color, c: lo }).map((c) => delinearize01(c) * 255));
  }
  function maxChroma(l, h) {
    let lo = 0;
    let hi = 0.4;
    for (let i = 0; i < 20; i += 1) {
      const mid = (lo + hi) / 2;
      if (inSrgbGamut(oklchToRgbRaw({ l, c: mid, h }))) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return lo;
  }
  function hueDelta(from, to) {
    return (to - from + 540) % 360 - 180;
  }
  function harmonize(hex, accent, strength) {
    const base = hexToOklch(hex);
    const target = hexToOklch(accent);
    if (!base || !target) {
      return hex;
    }
    const h = (base.h + hueDelta(base.h, target.h) * Math.min(1, Math.max(0, strength)) + 360) % 360;
    return oklchToHex({ ...base, c: Math.min(Math.max(base.c, target.c * 0.85), maxChroma(base.l, h)), h });
  }

  // <stdin>
  var DEFAULT_TYPOGRAPHY = { fontSans: "sans-serif", fontMono: "monospace" };
  var nousTheme = {};
  var $chatFontFamily = { get: () => null };
  var resolveChatFontFamily = (v, f) => v || f;
  var setAppearance = () => {
  };
  var INJECTED_FONT_URLS = /* @__PURE__ */ new Set();
  function renderedModeFor(colors, mode) {
    const rgb = parseColor(colors.background);
    if (!rgb) {
      return mode;
    }
    const [r, g, b] = rgb.map((v) => v / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.5 ? "light" : "dark";
  }
  var NEUTRAL_CHROME = { light: "#f3f3f3", dark: "#0d0d0e" };
  var PRIMARY_SOLID_FOREGROUND = "#fcfcfc";
  var chromeBackground = (background, isDark) => mix(background, NEUTRAL_CHROME[isDark ? "dark" : "light"], isDark ? 0.26 : 0.08);
  var mixesFor = (isDark) => ({
    "--theme-mix-chrome": isDark ? "74%" : "92%",
    "--theme-mix-sidebar": "100%",
    "--theme-mix-card": isDark ? "38%" : "22%",
    "--theme-mix-elevated": isDark ? "46%" : "28%",
    "--theme-mix-bubble": isDark ? "46%" : "0%"
  });
  function applyTheme(theme, mode, chatFontFamily = $chatFontFamily.get()) {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    const c = theme.colors;
    const typo = { ...DEFAULT_TYPOGRAPHY, ...nousTheme.typography, ...theme.typography };
    const rendered = renderedModeFor(c, mode);
    const isDark = rendered === "dark";
    const midground = c.midground ?? c.ring;
    const skinName = theme.name.endsWith(`-${mode}`) ? theme.name.slice(0, -mode.length - 1) : theme.name;
    root.style.setProperty("color-scheme", rendered);
    root.dataset.hermesTheme = skinName;
    root.dataset.hermesMode = rendered;
    root.classList.toggle("dark", isDark);
    setAppearance(rendered);
    const seeds = {
      "--theme-foreground": c.foreground,
      "--theme-primary": c.primary,
      "--theme-secondary": c.secondary,
      "--theme-accent-soft": c.accent,
      "--theme-midground": midground,
      "--theme-warm": c.primary,
      "--theme-background-seed": c.background,
      "--theme-sidebar-seed": c.sidebarBackground ?? c.background,
      "--theme-card-seed": c.card,
      "--theme-elevated-seed": c.popover,
      "--theme-bubble-seed": c.userBubble ?? c.popover
    };
    const palette = {
      "--dt-primary-foreground": c.primaryForeground,
      "--dt-secondary-foreground": c.secondaryForeground,
      "--dt-accent-foreground": c.accentForeground,
      "--dt-border": c.border,
      "--dt-input": c.input,
      "--dt-ring": c.ring,
      "--dt-muted": c.muted,
      "--dt-midground-foreground": c.midgroundForeground ?? readableInk(midground),
      // A LOUD fill of the brand colour, for the rare surface that has to read as
      // the app speaking rather than as chrome. `primary` alone can't do that job:
      // a pale accent (imported VS Code themes love a pastel pink) is a perfectly
      // valid primary, and the honest `primaryForeground` for it is near-black —
      // so the "loud" surface comes out a pastel card with dark text on it,
      // whispering. Deepening the hue until the LIGHT foreground clears AA keeps
      // one look across every theme: no-ops on an accent that is already deep,
      // and only ever darkens, so the hue survives.
      "--dt-primary-solid": ensureContrast(c.primary, PRIMARY_SOLID_FOREGROUND, 4.5),
      "--dt-primary-solid-foreground": PRIMARY_SOLID_FOREGROUND,
      "--dt-composer-ring": c.composerRing ?? midground,
      "--dt-destructive": c.destructive,
      "--dt-destructive-foreground": c.destructiveForeground,
      "--dt-sidebar-border": c.sidebarBorder ?? c.border,
      "--dt-user-bubble-border": c.userBubbleBorder ?? c.border,
      // Semantic success, bent toward the accent so it settles into the palette
      // instead of clashing with it. A green accent barely moves it (see
      // `harmonize`); a blue one turns the sidebar's finished dots teal rather
      // than leaving eight emerald spots fighting the theme.
      "--ui-success": harmonize("#10b981", midground, 0.25),
      "--dt-font-sans": resolveChatFontFamily(chatFontFamily, typo.fontSans),
      "--dt-font-mono": typo.fontMono,
      "--noise-opacity-mul": isDark ? "calc(0.04 / 0.21)" : "calc(0.34 / 0.21)"
    };
    for (const [k, v] of Object.entries({ ...seeds, ...mixesFor(isDark), ...palette })) {
      root.style.setProperty(k, v);
    }
    const chromeBg = chromeBackground(c.background, isDark);
    window.hermesDesktop?.setTitleBarTheme?.({
      background: chromeBg,
      foreground: c.foreground
    });
    try {
      window.localStorage.setItem("hermes-boot-background", chromeBg);
      window.localStorage.setItem("hermes-boot-color-scheme", rendered);
    } catch {
    }
    if (typo.fontUrl && !INJECTED_FONT_URLS.has(typo.fontUrl)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = typo.fontUrl;
      link.dataset.hermesThemeFont = "true";
      document.head.appendChild(link);
      INJECTED_FONT_URLS.add(typo.fontUrl);
    }
  }
  window.paint = (theme, mode) => applyTheme({ ...theme, name: theme.name + "-" + mode, colors: mode === "dark" ? theme.darkColors : theme.colors }, mode, "sans-serif");
})();
