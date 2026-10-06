/* Shared deterministic SVG renderer: browser charts and exported comparison graphic. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.WindComparisonCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.WindComparisonRender=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
'use strict';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const n=v=>Number(v.toFixed(3));
const text=(x,y,s,attrs='')=>`<text x="${x}" y="${y}" ${attrs}>${esc(s)}</text>`;
const line=(x1,y1,x2,y2,attrs='')=>`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${attrs}/>`;
const title=s=>`<title>${esc(s)}</title>`;
function path(entry){const d=C.build(entry),W=1160,H=430,left=70,right=28,top=34,step=18,bottom=top+step*16,x=m=>left+m/1439*(W-left-right),y=l=>top+(l+.5)*step;let s='';
 s+=`<rect x="${left}" y="${top}" width="${W-left-right}" height="${16*step}" rx="4" fill="#f6f8f6"/>`;
 for(let i=0;i<16;i++){s+=line(left,y(i),W-right,y(i),'stroke="#e3e9e5" stroke-width="1"');s+=text(left-14,y(i)+4,C.LANES[i],'text-anchor="end" font-size="11" fill="#60746c"');}
 for(const m of [0,180,360,540,720,900,1080,1260,1439]){s+=line(x(m),top,x(m),bottom,'stroke="#dbe3de" stroke-width="1"');s+=text(x(m),bottom+20,C.clock(m),`text-anchor="${m===0?'start':m===1439?'end':'middle'}" font-size="11" fill="#60746c"`);}
 s+=text(12,20,'TO 방향','font-size="11" fill="#60746c"');
 for(const seg of d.segments){s+=line(x(seg.x1),y(seg.y1),x(seg.x2),y(seg.y2),`stroke="${C.speedColor(seg.speed)}" stroke-width="1.2" data-from-minute="${seg.fromMinute}" data-to-minute="${seg.toMinute}" data-wrap="${seg.wrap}"`);}
 for(const p of d.path){s+=`<circle class="plot-point" data-minute="${p.minute}" cx="${n(x(p.minute))}" cy="${n(y(p.lane))}" r="1.65" fill="${C.speedColor(p.speed)}">${title(C.describe(entry.slots[p.minute]))}</circle>`;}
 const rows=[['calm','무풍 ○',bottom+48,'#758982'],['missing','결측 ×',bottom+69,'#b37250'],['unavailable','미확보 ·',bottom+90,'#b8c0bf']];
 for(const [status,label,yy,color]of rows){s+=text(left-12,yy+4,label,'text-anchor="end" font-size="10" fill="#60746c"');s+=line(left,yy,W-right,yy,'stroke="#ebefec"');for(const slot of entry.slots.filter(s=>s.status===status)){s+=`<rect class="state-point" data-minute="${slot.minute}" x="${n(x(slot.minute)-.6)}" y="${yy-4}" width="1.5" height="8" fill="${color}">${title(C.describe(slot))}</rect>`;}}
 s+=`<g id="path-selection" pointer-events="none"></g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(entry.station.name)} Wind Path. 가로는 실제 분, 세로는 16개 TO 방향. 하단 세 행은 무풍, 결측, 미확보"><g font-family="Arial, sans-serif">${s}</g></svg>`;
}
function polar(entry){const d=C.build(entry),W=590,H=550,cx=295,cy=262,R=198,k=R/C.MAX_SPEED;let s='';
 s+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="#f7f9f7"/>`;
 for(let r=1;r<=4;r++){s+=`<circle cx="${cx}" cy="${cy}" r="${r*k}" fill="none" stroke="#dbe4de"/>`;s+=text(cx+5,cy-r*k+14,`${r} m/s`,'font-size="10" fill="#778a81"');}
 for(let a=0;a<8;a++){const angle=a*Math.PI/4;s+=line(cx,cy,cx+Math.sin(angle)*R,cy-Math.cos(angle)*R,'stroke="#e2e9e4"');s+=text(n(cx+Math.sin(angle)*(R+22)),n(cy-Math.cos(angle)*(R+22)+4),['N','NE','E','SE','S','SW','W','NW'][a],'text-anchor="middle" font-size="12" fill="#556f62"');}
 for(const seg of d.polarSegments)s+=line(cx+seg.a.x*k,cy+seg.a.y*k,cx+seg.b.x*k,cy+seg.b.y*k,`stroke="${C.timeColor(seg.b.minute)}" stroke-width=".8" stroke-opacity=".4" data-from-minute="${seg.a.minute}" data-to-minute="${seg.b.minute}"`);
 // Retain every acquired minute as an invisible hit target. Render these before
 // the hour markers so overlapping minute targets never cover an hour marker.
 for(const p of d.polar){s+=`<circle class="plot-point minute-hit-area" data-minute="${p.minute}" cx="${n(cx+p.x*k)}" cy="${n(cy+p.y*k)}" r="3" fill="#000" fill-opacity="0" stroke="none" pointer-events="all">${title(C.describe(entry.slots[p.minute]))}</circle>`;}
 for(const p of d.hourly){const major=p.minute%360===0;s+=`<circle class="hour-point" data-minute="${p.minute}" data-major-hour="${major}" cx="${n(cx+p.x*k)}" cy="${n(cy+p.y*k)}" r="${major?4.9:4.1}" fill="${p.status==='calm'?'#ffffff':C.timeColor(p.minute)}" stroke="${p.status==='calm'?C.timeColor(p.minute):'#fff'}" stroke-width="${major?1.6:1.3}">${title(C.describe(entry.slots[p.minute])+' · 실제 정시 관측')}</circle>`;}
 const occupied=[];
 for(const p of d.labels){let px=cx+p.x*k,py=cy+p.y*k,tx=px+(px>=cx?14:-14),ty=py-13;let attempts=0;while(occupied.some(q=>Math.abs(q.x-tx)<50&&Math.abs(q.y-ty)<18)&&attempts++<20)ty+=19;ty=Math.max(26,Math.min(H-70,ty));occupied.push({x:tx,y:ty});s+=line(px,py,tx,ty-4,`stroke="${C.timeColor(p.minute)}" stroke-width=".8" pointer-events="none"`);s+=text(n(tx),n(ty),C.clock(p.minute).slice(0,2),`class="hour-label" data-hour="${Math.floor(p.minute/60)}" text-anchor="${px>=cx?'start':'end'}" font-size="11" font-weight="600" fill="#324e40" stroke="#fff" stroke-width="3" paint-order="stroke" pointer-events="none"`);}
 s+=text(cx,H-39,'각도 TO · 반지름 풍속 m/s','text-anchor="middle" font-size="12" fill="#456451"');s+=text(cx,H-20,'관측값의 연결이며 실제 이동 경로·지리 공간이 아닙니다','text-anchor="middle" font-size="11" fill="#738479"');
 s+=`<g id="polar-selection" pointer-events="none"></g>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(entry.station.name)} Polar Wind Path. TO 각도, 풍속 반지름, 연속 시간 색상. 실제 공기 경로 아님"><g font-family="Arial, sans-serif">${s}</g></svg>`;
}
return {esc,path,polar};
});
