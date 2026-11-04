// Borderless audit. Run it in the page (browser console or a browser tool).
// It returns { counts, items }: every visible element that draws a line, a
// ring, a glow, a bevel or a stacked shadow, so you can sort each one with
// the test in SKILL.md section 1. Run it before and after a change.
//
// Mark an element data-keep="reason" when its line does a job; the audit
// lists it under kept instead of outlines.

(() => {
  const items = [];
  const describe = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? `#${el.id}` : "") +
    (typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "") +
    (el.innerText ? ` "${el.innerText.trim().replace(/\s+/g, " ").slice(0, 28)}"` : "");

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0;
  };

  // Split a box-shadow list on the commas between shadows, not inside rgb().
  const shadows = (value) => {
    if (!value || value === "none") return [];
    const out = [];
    let depth = 0, cur = "";
    for (const ch of value) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };

  const parse = (sh) => {
    const color = (sh.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i) || ["transparent"])[0];
    const nums = sh.replace(color, "").match(/-?[\d.]+px/g) || [];
    const [x = 0, y = 0, blur = 0, spread = 0] = nums.map(parseFloat);
    return { inset: /inset/.test(sh), x, y, blur, spread, color };
  };

  // A colour is "coloured" when its channels differ: grey and black shadows
  // are depth, anything else is a glow.
  const chroma = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return 0;
    const [r, g, b] = m.map(Number);
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  const alpha = (c) => {
    const m = c.match(/rgba\([^)]*,\s*([\d.]+)\)/);
    return m ? +m[1] : 1;
  };

  // Check an element and its ::before and ::after (switch knobs, focus
  // rings and decorative edges often live there).
  const check = (el, s, found) => {

    // A border the same colour as the fill is part of the fill.
    const sides = ["Top", "Right", "Bottom", "Left"].filter(
      (side) =>
        parseFloat(s[`border${side}Width`]) > 0 &&
        s[`border${side}Style`] !== "none" &&
        alpha(s[`border${side}Color`]) > 0 &&
        s[`border${side}Color`] !== s.backgroundColor,
    );
    if (sides.length === 4) found.push("outline");
    else if (sides.length) found.push(`rule (${sides.join(", ").toLowerCase()})`);

    if (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 && el !== document.activeElement)
      found.push("focus-style outline");

    const list = shadows(s.boxShadow).map(parse).filter((p) => alpha(p.color) > 0);
    // A ring is a 0-blur spread of 1px or more. A sub-pixel one sitting
    // under a real drop shadow is a hairline of that shadow, not a ring.
    const hasDrop = list.some((p) => !p.inset && p.blur > 4);
    const rings = list.filter(
      (p) => !p.inset && p.blur === 0 && p.spread > 0 && !p.x && !p.y && !(hasDrop && p.spread < 1),
    );
    const glows = list.filter((p) => !p.inset && p.blur > 0 && chroma(p.color) > 40);
    const bevels = list.filter((p) => p.inset);
    const drops = list.filter((p) => !p.inset && p.blur > 1 && chroma(p.color) <= 40);
    if (rings.length) found.push("ring");
    if (glows.length) found.push("glow");
    if (bevels.length) found.push("bevel / inset");
    if (drops.length > 2) found.push(`stacked shadow (${drops.length})`);
    else if (drops.length) found.push("shadow");
    if (/gradient/.test(s.backgroundImage) && el.matches("button, a, [role=button]"))
      found.push("gradient button");
  };

  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const found = [];
    check(el, getComputedStyle(el), found);
    for (const pseudo of ["::before", "::after"]) {
      const ps = getComputedStyle(el, pseudo);
      if (ps.content === "none" || ps.content === "normal" || ps.display === "none") continue;
      const own = [];
      check(el, ps, own);
      found.push(...own.map((f) => `${f} (${pseudo})`));
    }

    // SVG outlines: a stroked rect or path around a box.
    const es = getComputedStyle(el);
    if (el instanceof SVGGeometryElement && es.stroke !== "none" && parseFloat(es.strokeWidth) > 0) {
      const svg = el.ownerSVGElement;
      const box = svg && svg.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (box && r.width > box.width * 0.9 && r.height > box.height * 0.9) found.push("svg-stroke box");
    }

    if (!found.length) continue;
    const keep = el.closest("[data-keep]");
    items.push({
      el: describe(el),
      found: found.join(", "),
      kept: keep ? keep.getAttribute("data-keep") : "",
    });
  }

  // Each label is counted once, on whole words, so "stacked shadow" is not
  // also a "shadow" and a focus outline is not also an "outline".
  const has = (item, re) => item.found.split(", ").some((f) => re.test(f));
  const count = (re) => items.filter((i) => !i.kept && has(i, re)).length;
  const counts = {
    outlines: count(/^outline\b/),
    focusOutlines: count(/^focus-style outline/),
    svgStrokeBoxes: count(/^svg-stroke box/),
    rules: count(/^rule\b/),
    rings: count(/^ring\b/),
    glows: count(/^glow\b/),
    bevels: count(/^bevel/),
    stackedShadows: count(/^stacked shadow/),
    shadows: count(/^shadow\b/),
    gradientButtons: count(/^gradient button/),
    kept: items.filter((i) => i.kept).length,
  };
  return {
    counts,
    target: "outlines and rings only where section 1 says keep (mark them data-keep), glows 0, bevels 0, stackedShadows 0, gradientButtons 0, shadows only on floating things",
    items,
  };
})();
