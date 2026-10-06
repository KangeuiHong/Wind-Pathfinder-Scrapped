'use strict';
// Deliberately small DOM/Canvas command model. This is not a browser, CSS,
// native input, SVG hit-testing, pixel, animation smoothness, or visual QA test.
// All initial elements and scripts come from the actual NATIONAL_COMPARE.html;
// missing queried nodes return null rather than being silently manufactured.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ROOT=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(ROOT,'NATIONAL_COMPARE.html'),'utf8');
const history=JSON.parse(fs.readFileSync(path.join(ROOT,'national/data/history-20261003.json'),'utf8'));
const plain=x=>JSON.parse(JSON.stringify(x));
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos);/g,c=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"}[c]));
class Node{
 constructor(tag,doc){this.tagName=tag.toLowerCase();this.ownerDocument=doc;this.children=[];this.parentNode=null;this.style={};this.events={};this.attributes={};this.dataset={};this._text='';this.value='';this.hidden=false;this.disabled=false;this.checked=false;this.focused=false;
 this.classList={contains:c=>this.className.split(/\s+/).includes(c),add:(...cs)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...cs])].join(' ');},remove:(...cs)=>{this.className=this.className.split(/\s+/).filter(c=>!cs.includes(c)).join(' ');},toggle:(c,on)=>{const next=on??!this.classList.contains(c);this.classList[next?'add':'remove'](c);return next;}};}
 get className(){return this.attributes.class||'';}set className(v){this.attributes.class=String(v);}
 setAttribute(k,v){this.attributes[k]=String(v);if(k==='id')this.ownerDocument.ids[String(v)]=this;if(k==='value')this.value=String(v);if(['hidden','checked','disabled'].includes(k))this[k]=true;if(k==='tabindex')this.tabIndex=Number(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
 getAttribute(k){return this.attributes[k]??null;}
 append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}
 replaceChildren(...nodes){for(const n of this.children)n.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 set textContent(v){this.replaceChildren();this._text=String(v);}get textContent(){return this._text+this.children.map(n=>n.textContent||'').join('');}
 addEventListener(type,cb){(this.events[type]||=[]).push(cb);}
 emit(type,args={}){const e={target:this,currentTarget:this,type,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopPropagation(){},...args};for(const cb of this.events[type]||[])cb(e);return e;}
 click(){if(this.disabled)return;return this.emit('click');}focus(){this.focused=true;this.ownerDocument.activeElement=this;return this.emit('focus');}
 matches(s){if(s.startsWith('#'))return this.getAttribute('id')===s.slice(1);if(s.startsWith('.'))return this.classList.contains(s.slice(1));const a=/^\[([^=\]]+)(?:="([^"]+)")?\]$/.exec(s);return a?this.getAttribute(a[1])!==null&&(a[2]===undefined||this.getAttribute(a[1])===a[2]):this.tagName===s;}
 querySelectorAll(s){const out=[];for(const n of this.children){if(n.matches(s))out.push(n);out.push(...n.querySelectorAll(s));}return out;}querySelector(s){return this.querySelectorAll(s)[0]||null;}
 getBoundingClientRect(){return this.box||{left:0,top:0,width:1000,height:760};}
 setPointerCapture(id){this.capturedPointer=id;}releasePointerCapture(id){if(this.capturedPointer===id)this.capturedPointer=null;}
}
function parse(doc){const root=new Node('root',doc),stack=[root];for(const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/[^>]+>|<[A-Za-z][^>]*>|[^<]+/g)){const t=match[0];if(t.startsWith('<!'))continue;if(t.startsWith('</')){if(stack.length>1)stack.pop();continue;}if(t.startsWith('<')){const tag=/^<([\w-]+)/.exec(t)[1],node=new Node(tag,doc);for(const a of t.slice(tag.length+1).matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)){if(a[1]!=='/')node.setAttribute(a[1],decode(a[2]??a[3]??a[4]??''));}stack.at(-1).append(node);if(!t.endsWith('/>')&&!['input','meta','link','br','img','hr'].includes(tag))stack.push(node);}else stack.at(-1)._text+=decode(t);}return root;}
function canvasMock(){return{frame:[],clears:0,globalAlpha:1,lineCap:'butt',lineJoin:'miter',transform:[1,0,0,1,0,0],saved:[],setTransform(...v){this.transform=v;},clearRect(){this.frame=[];this.clears++;},save(){this.saved.push({transform:this.transform.slice(),globalAlpha:this.globalAlpha,lineCap:this.lineCap,lineJoin:this.lineJoin,strokeStyle:this.strokeStyle,fillStyle:this.fillStyle,lineWidth:this.lineWidth});},restore(){Object.assign(this,this.saved.pop()||{});},translate(x,y){const[a,b,c,d,e,f]=this.transform;this.transform=[a,b,c,d,e+a*x+c*y,f+b*x+d*y];},beginPath(){this.path=[];},moveTo(x,y){this.path.push(['M',x,y]);},lineTo(x,y){this.path.push(['L',x,y]);},rect(x,y,w,h){this.path.push(['R',x,y,w,h]);},closePath(){this.path.push(['Z']);},clip(){},stroke(){this.frame.push({type:'stroke',path:this.path.map(x=>x.slice()),color:this.strokeStyle,width:this.lineWidth,alpha:this.globalAlpha,lineCap:this.lineCap,transform:this.transform.slice()});},fill(){this.frame.push({type:'fill',path:this.path.map(x=>x.slice()),color:this.fillStyle,alpha:this.globalAlpha,transform:this.transform.slice()});},createLinearGradient(){return{stops:[],addColorStop(p,c){this.stops.push([p,c]);}};}};}
function load({width=1000,height=760,pixelRatio=1,canvasAvailable=true,reducedMotion=false}={}){
 const doc={ids:{},hidden:false,events:{},getElementById(id){return this.ids[id]||null;},createElement(tag){return new Node(tag,this);},createElementNS(_ns,tag){return this.createElement(tag);},createTextNode(text){const n=new Node('text',this);n.textContent=text;return n;},addEventListener(t,cb){(this.events[t]||=[]).push(cb);},emit(t){for(const cb of this.events[t]||[])cb({type:t});}};
 const root=parse(doc);doc.body=root.querySelector('body');doc.querySelector=s=>root.querySelector(s);doc.querySelectorAll=s=>root.querySelectorAll(s);const nodes=doc.ids,canvases={};
 for(const id of ['map','observation-map','particle-canvas','direction-canvas','flow-canvas'])nodes[id].box={left:0,top:0,width,height};
 for(const node of doc.querySelectorAll('canvas')){const ctx=canvasMock();canvases[node.getAttribute('id')]=ctx;node.getContext=()=>canvasAvailable?ctx:null;}
 let now=0,next=0;const raf=new Map(),resizers=[];const media={matches:reducedMotion,listeners:[],addEventListener(_t,cb){this.listeners.push(cb);}};
 const window={document:doc,performance:{now:()=>now},Intl,Date,Map,Set,Math,Number,Error,Array,Object,String,JSON,console,devicePixelRatio:pixelRatio,requestAnimationFrame(cb){const id=++next;raf.set(id,cb);return id;},cancelAnimationFrame(id){raf.delete(id);},matchMedia:()=>media,ResizeObserver:class{constructor(cb){resizers.push(cb);}observe(){}disconnect(){}}};window.window=window;doc.defaultView=window;vm.createContext(window);
 const scripts=[...html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/g)].map(m=>m[1]);for(const f of scripts)vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),window,{filename:f});
 return{ROOT,html,scripts,window,doc,nodes,canvases,history,state:window.windPrototypeState,datasetState:window.windPrototypeDatasetState,layoutState:window.windPrototypeLayoutState,renderState:window.windPrototypeRenderState,inspect:window.inspectStationParticle,
 tick(t){now=t;const cbs=[...raf.values()];raf.clear();for(const cb of cbs)cb(t);},setNow(t){now=t;},click:id=>nodes[id].click(),input(id,v){nodes[id].value=String(v);return nodes[id].emit('input');},change(id,v){nodes[id].value=String(v);return nodes[id].emit('change');},checked(id,v){nodes[id].checked=v;return nodes[id].emit('change');},marker(id){return nodes.stations.children.find(n=>n.getAttribute('data-station-id')===String(id));},resize(w,h){for(const id of ['map','observation-map','particle-canvas','direction-canvas','flow-canvas'])nodes[id].box={left:0,top:0,width:w,height:h};for(const cb of resizers)cb();},setReducedMotion(v){media.matches=v;for(const cb of media.listeners)cb({matches:v});}};
}
module.exports={ROOT,html,history,plain,load,canvasMock};
