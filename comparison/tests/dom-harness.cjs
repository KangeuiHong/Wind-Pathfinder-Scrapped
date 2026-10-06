'use strict';
// A deliberately small DOM model, not a browser. No layout, CSS rendering,
// native input behavior, SVG paint/hit testing, or real navigation is certified.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '../..');
const M = require('../../matrix/core.js');
const C = require('../core.js');
const R = require('../render.js');
const decode = s => s.replace(/&(?:amp|lt|gt|quot|apos);/g, x => ({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[x]));

class Element {
  constructor(tag, document) {
    this.tagName = tag.toLowerCase(); this.ownerDocument = document;
    this.children = []; this.parentNode = null; this.style = {}; this.events = {};
    this.attrs = {}; this.dataset = {}; this._text = ''; this._html = '';
    this.value = ''; this.hidden = false; this.tabIndex = -1;
    this.classList = {
      contains: c => this.className.split(/\s+/).includes(c),
      add: c => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), c])].join(' '); },
      remove: c => { this.className = this.className.split(/\s+/).filter(x => x !== c).join(' '); },
      toggle: (c, on) => { const next = on ?? !this.classList.contains(c); this.classList[next ? 'add' : 'remove'](c); return next; }
    };
  }
  get className() { return this.attrs.class || ''; }
  set className(v) { this.attrs.class = String(v); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.ownerDocument.ids[v] = this; if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase())] = String(v); if (k === 'hidden') this.hidden = true; if (k === 'value') this.value = String(v); if (k === 'tabindex') this.tabIndex = Number(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  appendChild(n) { n.parentNode = this; this.children.push(n); return n; }
  append(...ns) { ns.forEach(n => this.appendChild(n)); }
  replaceChildren(...ns) { for (const n of this.children) { n.unregister(); n.parentNode = null; } this.children = []; this._text = ''; this._html = ''; this.append(...ns); }
  unregister() { if (this.attrs.id && this.ownerDocument.ids[this.attrs.id] === this) delete this.ownerDocument.ids[this.attrs.id]; this.children.forEach(n => n.unregister()); }
  set textContent(s) { this.replaceChildren(); this._text = String(s); }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(''); }
  set innerHTML(s) { this.replaceChildren(); this._html = String(s); parseInto(this, this._html); }
  get innerHTML() { return this._html; }
  addEventListener(type, cb) { (this.events[type] ||= []).push(cb); }
  emit(type, args = {}) { const event = {type, target: this, currentTarget: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...args}; for (const cb of this.events[type] || []) cb(event); return event; }
  click() { const event = this.emit('click'); if (!event.defaultPrevented && this.tagName === 'a' && this.getAttribute('href')) this.ownerDocument.defaultView.location.href = this.getAttribute('href'); return event; }
  focus() { this.ownerDocument.activeElement = this; return this.emit('focus'); }
  matches(selector) { if (selector.includes(',')) return selector.split(',').some(s => this.matches(s.trim())); if (selector.startsWith('#')) return this.attrs.id === selector.slice(1); if (selector.startsWith('.')) return this.classList.contains(selector.slice(1)); const a = /^\[([^=\]]+)(?:="([^"]+)")?\]$/.exec(selector); return a ? this.getAttribute(a[1]) !== null && (a[2] === undefined || this.getAttribute(a[1]) === a[2]) : this.tagName === selector; }
  closest(selector) { for (let n = this; n; n = n.parentNode) if (n.matches(selector)) return n; return null; }
  querySelectorAll(selector) { const out = []; for (const n of this.children) { if (n.matches(selector)) out.push(n); out.push(...n.querySelectorAll(selector)); } return out; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { const v = (this.attrs.viewBox || '0 0 1160 430').split(' ').map(Number); return this.box || {left: 0, top: 0, width: v[2], height: v[3]}; }
  getScreenCTM() { const b = this.getBoundingClientRect(), v = (this.attrs.viewBox || '0 0 1160 430').split(' ').map(Number); const scale = Math.min(b.width/v[2], b.height/v[3]); const matrix = {a: scale, b: 0, c: 0, d: scale, e: b.left+(b.width-v[2]*scale)/2, f: b.top+(b.height-v[3]*scale)/2}; matrix.inverse = () => ({a: 1/scale, b: 0, c: 0, d: 1/scale, e: -matrix.e/scale, f: -matrix.f/scale}); return matrix; }
  createSVGPoint() { return {x: 0, y: 0, matrixTransform(m) { return {x: this.x*m.a+this.y*m.c+m.e, y: this.x*m.b+this.y*m.d+m.f}; }}; }
}

function parseInto(parent, html) {
  const stack = [parent];
  for (const token of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/[^>]+>|<[A-Za-z][^>]*>|[^<]+/g)) {
    const t = token[0]; if (t.startsWith('<!')) continue;
    if (t.startsWith('</')) { if (stack.length > 1) stack.pop(); continue; }
    if (t.startsWith('<')) { const tag = /^<([\w-]+)/.exec(t)[1]; const el = new Element(tag, parent.ownerDocument); for (const a of t.slice(tag.length+1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) { if (a[1] === '/') continue; el.setAttribute(a[1], decode(a[2] ?? a[3] ?? a[4] ?? '')); } stack.at(-1).appendChild(el); if (!t.endsWith('/>') && !['input','meta','link','br','img','hr'].includes(tag)) stack.push(el); }
    else stack.at(-1)._text += decode(t);
  }
}

function loadObserved() { const context = {window: {WindMatrixCore: M}}; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'matrix/data/observed-data.js'), 'utf8'), context); return context.window.WIND_MATRIX_DATA; }

function createApp(hash = '', page = 'VECTOR_COMPARE.html', options = {}) {
  const document = {ids: {}, activeElement: null, getElementById(id) { return this.ids[id] || null; }, createElement(tag) { return new Element(tag, this); }, createElementNS(ns, tag) { return this.createElement(tag); }};
  document.body = new Element('body', document);
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  parseInto(document.body, html);
  const table = document.ids['wind-matrix'];
  if (table) { table.tHead = table.querySelector('thead'); table.tBodies = table.querySelectorAll('tbody'); }
  if (document.ids['event-plot']) document.ids['event-plot'].box = {left:0,top:0,width:options.eventWidth ?? 590,height:550};
  const listeners = {}, queue = [], history = [hash], resizeCallbacks = [];
  const window = {addEventListener(type, cb) {(listeners[type] ||= []).push(cb);}, ResizeObserver: class {constructor(callback) { resizeCallbacks.push(callback); } observe() {} disconnect() {}}};
  document.defaultView = window;
  let cursor = 0;
  const normalize = value => value && !value.startsWith('#') ? '#'+value : value;
  const change = value => { value = normalize(value); if (history[cursor] === value) return; history.splice(cursor+1); history.push(value); cursor++; queue.push('hashchange'); };
  window.location = {href: page + hash, get hash() {return history[cursor];}, set hash(v) {change(v);}};
  const flush = () => { while(queue.length) for(const cb of listeners[queue.shift()] || []) cb({type:'hashchange'}); };
  window.history = {back() {if(cursor>0) {cursor--; queue.push('hashchange');}}, forward() {if(cursor<history.length-1) {cursor++; queue.push('hashchange');}}};
  Object.assign(window, {window, document, console, URLSearchParams, Map, Set, JSON, Object, Array, Number, String, Math, Date});
  vm.createContext(window);
  const scripts = Array.from(html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g), m => m[1]);
  for(const file of scripts) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), window, {filename:file});
    if (file === 'matrix/data/observed-data.js' && options.data) window.WIND_MATRIX_DATA = options.data;
  }
  return {app: window.WindStationComparison, window, document, nodes: document.ids, flush, scripts,
    resize: () => resizeCallbacks.forEach(fn => fn()),
    cells: () => table ? table.tBodies[0].children.flatMap(row=>row.children.slice(1).map(td=>td.children[0])) : []};
}
module.exports = {ROOT, M, C, R, loadObserved, createApp, Element};
