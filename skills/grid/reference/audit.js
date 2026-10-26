// Page audit for DESIGN.md section 8. Run it in the page (browser console or
// the browser tool); it returns a list of problems, empty when the page passes.
//
// Mono is allowed only on <code>, <pre>, <kbd> and anything inside an element
// marked data-code (model ids, endpoint paths). Full-width blocks that may
// cross the rails are marked data-bleed; labels and text inside them (.tag,
// .viz-legend) must still stay inside the rails.

(() => {
  const problems = [];
  const add = (rule, el, detail) =>
    problems.push({ rule, el: el ? describe(el) : "", detail });
  const describe = (el) =>
    el.tagName.toLowerCase() +
    (el.id ? `#${el.id}` : "") +
    (el.classList.length ? "." + [...el.classList].join(".") : "") +
    (el.innerText ? ` "${el.innerText.trim().slice(0, 30)}"` : "");
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0;
  };
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

  // 1. Horizontal overflow.
  const sw = document.documentElement.scrollWidth;
  if (sw > innerWidth + 1) add("overflow", null, `scrollWidth ${sw} > ${innerWidth}`);

  // 2. Nothing crosses a rail.
  // The guides are invisible markers that sit exactly where the rails are.
  const railFrame = document.querySelector(".guides .frame");
  if (railFrame) {
    const rails = railFrame.getBoundingClientRect();
    for (const el of document.querySelectorAll("main *")) {
      const isLabel = el.matches(".tag, .tag *, .viz-legend, .viz-legend *, .fact, .fact *");
      // A full-width section box is fine; what sits inside it is checked.
      if (el.tagName === "SECTION" || el.matches(".grid-frame")) continue;
      if (!visible(el) || el.closest(".switcher, .seam") || (el.closest("[data-bleed]") && !isLabel)) continue;
      const r = el.getBoundingClientRect();
      if (r.left < rails.left - 1 || r.right > rails.right + 1) {
        add("crosses rail", el, `${Math.round(r.left)}..${Math.round(r.right)} vs rails ${Math.round(rails.left)}..${Math.round(rails.right)}`);
      }
    }
  }

  // 2b. Hero art stays inside the hero: never over the nav, never into the next section.
  const hero = document.querySelector(".hero");
  for (const art of document.querySelectorAll(".hero canvas")) {
    if (!visible(art) || !hero) continue;
    const a = art.getBoundingClientRect();
    const h = hero.getBoundingClientRect();
    if (a.top < h.top - 1 || a.bottom > h.bottom + 1) {
      add("art leaves the hero", art, `${Math.round(a.top)}..${Math.round(a.bottom)} vs hero ${Math.round(h.top)}..${Math.round(h.bottom)}`);
    }
  }

  // 2c. The gutters stay calm. Full-width lines belong only to section tops,
  // and sections are whole (a heading and its content together), so the
  // strip outside each rail is cut into a few tall, empty bands, never a
  // stack of small boxes. Any other line must stop at the rails.
  const full = [];
  for (const el of document.querySelectorAll("main *, footer")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth - 2) continue;
    for (const side of ["Top", "Bottom"]) {
      if (parseFloat(s["border" + side + "Width"]) >= 1 && s["border" + side + "Style"] !== "none") {
        full.push({ el, y: (side === "Top" ? r.top : r.bottom) + scrollY });
        if (el.tagName !== "SECTION" && el.tagName !== "FOOTER" && !el.closest(".seam")) add("full-width line inside a section", el, side.toLowerCase());
      }
    }
  }
  full.sort((a, b) => a.y - b.y);
  for (let i = 1; i < full.length; i++) {
    const gap = full[i].y - full[i - 1].y;
    // a seam's own lines (top, centre, bottom) sit 16px apart on purpose
    if (full[i].el.closest(".seam") || full[i - 1].el.closest(".seam")) continue;
    // a band shorter than a quarter of the screen (at most 240px) reads as a box
    if (gap > 1 && gap < Math.min(240, innerHeight * 0.25)) add("gutter cut into boxes", full[i].el, `${Math.round(gap)}px since the last full-width line; merge the sections`);
  }

  // 2d. One level of cells: a cell grid inside another doubles lines.
  for (const el of document.querySelectorAll("main *")) {
    const s = getComputedStyle(el);
    if (s.display !== "grid" || s.rowGap !== "1px" && s.columnGap !== "1px") continue;
    let p = el.parentElement;
    while (p && p.tagName !== "MAIN") {
      const ps = getComputedStyle(p);
      if (ps.display === "grid" && (ps.rowGap === "1px" || ps.columnGap === "1px")) {
        add("nested cells", el, "a 1px-gap grid inside another: lines double and T shapes appear");
        break;
      }
      p = p.parentElement;
    }
  }

  // 3. Labels in the visual overlap each other or are clipped by it.
  const viz = document.querySelector(".viz");
  if (viz) {
    const box = viz.getBoundingClientRect();
    const tags = [...viz.querySelectorAll(".tag, .viz-legend")].filter(visible);
    for (const t of tags) {
      const r = t.getBoundingClientRect();
      if (r.left < box.left - 1 || r.right > box.right + 1 || r.top < box.top - 1 || r.bottom > box.bottom + 1) {
        add("label clipped", t, `outside the visual by ${Math.round(Math.max(box.left - r.left, r.right - box.right, box.top - r.top, r.bottom - box.bottom))}px`);
      }
    }
    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const a = tags[i].getBoundingClientRect();
        const b = tags[j].getBoundingClientRect();
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) {
          add("labels overlap", tags[i], `with ${describe(tags[j])}`);
        }
      }
    }
  }

  // 4. Type rules: no text under 12px, no uppercase, mono only for code.
  // These belong to a page built from scratch; in a retrofit the site's own
  // type rules win, so they run only when asked: window.__auditType = true.
  if (window.__auditType !== false) for (const el of document.querySelectorAll("body *")) {
    if (!visible(el) || !ownText(el) || el.closest(".switcher")) continue;
    const s = getComputedStyle(el);
    if (parseFloat(s.fontSize) < 12) add("text under 12px", el, s.fontSize);
    if (s.textTransform === "uppercase") add("uppercase", el, "");
    const mono = /mono/i.test(s.fontFamily.split(",")[0]);
    const codeOk = el.closest("code, pre, kbd, [data-code]");
    if (mono && !codeOk) add("mono outside code", el, s.fontFamily.split(",")[0]);
  }

  return problems;
})();
