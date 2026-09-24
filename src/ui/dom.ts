type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & { class?: string; style?: string | Partial<CSSStyleDeclaration> };

/** Tiny hyperscript helper: h('button', { class: 'tag', onclick }, 'Buy'). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = String(v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'html') el.innerHTML = String(v);
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el: HTMLElement) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

/** QRBucks coin as inline pixel SVG. */
export function coinIcon(size = 16) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 10 10');
  s.setAttribute('width', String(size));
  s.setAttribute('height', String(size));
  s.setAttribute('shape-rendering', 'crispEdges');
  s.classList.add('coin');
  s.innerHTML =
    '<path d="M3 0h4v1h2v2h1v4H9v2H7v1H3V9H1V7H0V3h1V1h2z" fill="#1d1b26"/><path d="M3 1h4v1h1v1h1v4H8v1H7v1H3V8H2V7H1V3h1V2h1z" fill="#ffd23f"/><path d="M4 3h2v1h1v2H6v1H4V6H3V4h1z" fill="#f2a900"/><path d="M3 2h2v1H3z" fill="#fff7c2"/>';
  return s;
}

export function formatBucks(n: number) {
  return n.toLocaleString('en-US');
}
