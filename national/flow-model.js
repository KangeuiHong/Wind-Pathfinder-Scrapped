/* Station-local symbolic wind. No observation, direction, or weather-time interpolation. */
(function(root){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function seed(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0)/4294967296;}
  function velocity(speed){return speed>0?3.5+5.5*Math.sqrt(speed):0;}
  function strengthWidth(speed){return speed>0?.9+.36*Math.min(speed,6):0;}
  function cometMetrics(nearest,zoom=1,scale=1){const normal=Math.min(20,14+2*Math.log2(Math.max(1,zoom))),base=Math.max(14,Math.min(24,Math.max(normal,24-(Math.max(1,zoom)-1)*3.5)*scale)),room=Number.isFinite(nearest)?nearest*.8:36,length=Math.max(base,Math.min(36,room*scale)),start=-length/2,end=length/2,reach=end+2.4;return{reach,start,end,length,tail:Math.min(12,Math.min(8,6+.18*(base-14))+.28*(length-base)),packets:1,directionTip:end+2.1,directionLength:3.6,directionWidth:3.4};}
  // Fixed map-coordinate cells: independent of wind, clock, pan, viewport size and row order.
  function overviewStations(entries,zoom=1,forced=[],cell=28){
    const all=zoom>=4,winners=new Map();
    for(const p of entries){const gx=Math.floor(p.x/cell),gy=Math.floor(p.y/cell),key=gx+':'+gy,d=(p.x-(gx+.5)*cell)**2+(p.y-(gy+.5)*cell)**2,prior=winners.get(key);if(!prior||d<prior.d||(d===prior.d&&String(p.id)<String(prior.id)))winners.set(key,{id:p.id,d});}
    const byId=new Map(entries.map(p=>[p.id,p])),spaced=[];for(const candidate of [...winners.values()].sort((a,b)=>a.d-b.d||String(a.id).localeCompare(String(b.id),'en'))){const p=byId.get(candidate.id);if(spaced.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>=24))spaced.push(p);}const ids=new Set(all?entries.map(p=>p.id):spaced.map(p=>p.id)),known=new Set(entries.map(p=>p.id));for(const id of forced)if(known.has(id))ids.add(id);
    return{ids:[...ids].sort(),all,threshold:4,cell,baseCount:all?entries.length:spaced.length,minimumSpacing:24,total:entries.length,rule:'fixed-geographic-cell-nearest-center-then-spacing'};
  }
  function symbolGrowth(nearest,zoom=1,scale=1){const base=Math.max(14,Math.min(24,Math.min(20,14+2*Math.log2(Math.max(1,zoom)))*scale));return cometMetrics(nearest,zoom,scale).length/base;}
  function vector(from){const a=(from+180)*Math.PI/180;return{x:Math.sin(a),y:-Math.cos(a)};}
  function clip(poly,nx,ny,c){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a.x*nx+a.y*ny-c,db=b.x*nx+b.y*ny-c;if(da<=1e-8)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push({x:a.x+t*(b.x-a.x),y:a.y+t*(b.y-a.y)});}}return out;}
  function area(poly){let a=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];a+=p.x*q.y-q.x*p.y;}return Math.abs(a)/2;}
  function supports(entries,radius){return entries.map(p=>{const r=typeof radius==='function'?radius(p):radius;let poly=Array.from({length:20},(_,i)=>({x:Math.cos(i*Math.PI/10)*r,y:Math.sin(i*Math.PI/10)*r}));let nearest=Infinity,coincident=0;for(const q of entries){if(q===p)continue;const dx=q.x-p.x,dy=q.y-p.y,d=Math.hypot(dx,dy);nearest=Math.min(nearest,d);if(d<1e-6){coincident++;continue;}if(d>r*2+1)continue;const half=(d/2-Math.min(.6,d*.09))*d;poly=clip(poly,dx,dy,half);if(!poly.length)break;}if(coincident)poly=Array.from({length:12},(_,i)=>({x:Math.cos(i*Math.PI/6)*2.5,y:Math.sin(i*Math.PI/6)*2.5}));return{...p,polygon:poly,area:area(poly),radius:coincident?2.5:r,nearest,coincident};});}
  function lane(p,from,y=0){const v=vector(from),n={x:-v.y,y:v.x};let lo=-p.radius,hi=p.radius;for(let i=0;i<p.polygon.length;i++){const a=p.polygon[i],b=p.polygon[(i+1)%p.polygon.length],nx=b.y-a.y,ny=a.x-b.x,c=nx*a.x+ny*a.y,den=nx*v.x+ny*v.y,offset=(nx*n.x+ny*n.y)*y;if(Math.abs(den)<1e-9){if(offset>c+1e-7)return null;continue;}const t=(c-offset)/den;if(den>0)hi=Math.min(hi,t);else lo=Math.max(lo,t);}return hi-lo>.25?{lo,hi,y,length:hi-lo,v,n}:null;}
  function localToScreen(l,x,y=l.y){return{x:l.v.x*x+l.n.x*y,y:l.v.y*x+l.n.y*y};}
  function wrap(x,m){return((x%m)+m)%m;}
  function packet(l,distance,phase,tail){const travel=l.length+tail,head=l.lo+wrap(distance+phase*travel,travel),start=Math.max(l.lo,head-tail),end=Math.min(l.hi,head);return{start,end,head,y:l.y,visible:end>start,alpha:clamp(Math.min((end-l.lo)/2,(l.hi-start)/2),0,1)};}
  const api={symbolGrowth,overviewStations,clamp,seed,velocity,strengthWidth,cometMetrics,vector,clip,area,supports,lane,localToScreen,packet};root.FlowModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
