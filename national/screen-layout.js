/* Screen-space annotation layout only. Does not read or alter wind measurements. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ScreenLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const FONT_PX=11;
  function metrics(width,height,view){const scale=Math.max(.000001,Math.min(width/view.w,height/view.h));return{width,height,scale,inverse:1/scale,offsetX:(width-view.w*scale)/2,offsetY:(height-view.h*scale)/2};}
  function intersects(a,b,pad=2){return a.left<b.right+pad&&a.right+pad>b.left&&a.top<b.bottom+pad&&a.bottom+pad>b.top;}
  function textFor(name){const chars=Array.from(name);return chars.length>15?chars.slice(0,14).join('')+'…':name;}
  function textWidth(text){return Math.max(12,Array.from(text).reduce((sum,ch)=>sum+(ch.charCodeAt(0)<128?(/[MWm@%#]/.test(ch)?12:9):12),0));}
  function placeLabels(stations,options){
    const{view,width,height,zoom,selected,hovered}=options,labelMode=options.labelMode||'sparse',m=metrics(width,height,view),left=m.offsetX+5,right=width-m.offsetX-5,top=m.offsetY+5,bottom=height-m.offsetY-5;
    const visible=stations.map(st=>({...st,x:m.offsetX+(st.point.x-view.x)*m.scale,y:m.offsetY+(st.point.y-view.y)*m.scale})).filter(st=>st.x>=m.offsetX-4&&st.x<=width-m.offsetX+4&&st.y>=m.offsetY-4&&st.y<=height-m.offsetY+4);
    const priority=id=>id===selected?0:id===hovered?1:2;
    visible.sort((a,b)=>priority(a.id)-priority(b.id)||((a.x-width/2)**2+(a.y-height/2)**2)-((b.x-width/2)**2+(b.y-height/2)**2));
    const markerGrid=new Map(),cell=32;
    for(const st of visible){const key=Math.floor(st.x/cell)+':'+Math.floor(st.y/cell);if(!markerGrid.has(key))markerGrid.set(key,[]);markerGrid.get(key).push(st);}
    const placed=[],boxes=[],budget=labelMode==='all'?visible.length:Math.max(4,Math.min(14,Math.floor(width*height/45000)));
    if(labelMode==='off')return{metrics:m,labels:[],budget:0,visibleStationCount:visible.length,labelMode};
    // Leave a small, stable breathing space around the station ring.
    function hitsMarker(box,id){for(let gx=Math.floor((box.left-12)/cell);gx<=Math.floor((box.right+12)/cell);gx++)for(let gy=Math.floor((box.top-12)/cell);gy<=Math.floor((box.bottom+12)/cell);gy++)for(const st of markerGrid.get(gx+':'+gy)||[])if(st.id!==id&&intersects(box,{left:st.x-12,right:st.x+12,top:st.y-12,bottom:st.y+12},0))return true;return false;}
    for(const st of visible){
      const important=priority(st.id)<2;if(!important&&labelMode!=='all'&&(zoom<3||placed.length>=budget))continue;
      const text=textFor(st.name),w=textWidth(text),h=FONT_PX+5;
      const candidates=[[14,-10,'start'],[-14,-10,'end'],[14,22,'start'],[-14,22,'end'],[0,-17,'middle'],[0,29,'middle']];let chosen=null;
      for(const[dx,dy,anchor]of candidates){const x=st.x+dx-(anchor==='end'?w:anchor==='middle'?w/2:0),baseline=st.y+dy,box={left:x-2,right:x+w+2,top:baseline-FONT_PX-2,bottom:baseline+3};
        if(box.left<left||box.right>right||box.top<top||box.bottom>bottom)continue;
        if(labelMode!=='all'&&boxes.some(b=>intersects(box,b,important?2:20)))continue;
        // Leave header controls and the low map legend clear for nonessential names.
        if(labelMode!=='all'&&!important&&(box.top<185||box.bottom>height-100||hitsMarker(box,st.id)))continue;
        chosen={id:st.id,text,dx,dy,anchor,box,fontPx:FONT_PX};break;
      }
      if(!chosen&&(st.id===selected||labelMode==='all')){const x=Math.max(left+2,Math.min(right-w-2,st.x+14)),baseline=Math.max(top+FONT_PX+2,Math.min(bottom-3,st.y-10));chosen={id:st.id,text,dx:x-st.x,dy:baseline-st.y,anchor:'start',box:{left:x-2,right:x+w+2,top:baseline-FONT_PX-2,bottom:baseline+3},fontPx:FONT_PX};}
      if(chosen){placed.push(chosen);boxes.push(chosen.box);}
    }
    return{metrics:m,labels:placed,budget,visibleStationCount:visible.length,labelMode};
  }
  function pan(view,dxPixels,dyPixels,scale){return{...view,x:Math.max(0,Math.min(1000-view.w,view.x-dxPixels/scale)),y:Math.max(0,Math.min(760-view.h,view.y-dyPixels/scale))};}
  function zoomViewport(view,width,height,nextZoom,focus=null){
    const m=metrics(width,height,view),center=focus||{x:view.x+(width/2-m.offsetX)/m.scale,y:view.y+(height/2-m.offsetY)/m.scale},z=Math.max(1,Math.min(12,nextZoom)),w=1000/z,h=760/z;
    return{x:Math.max(0,Math.min(1000-w,center.x-w/2)),y:Math.max(0,Math.min(760-h,center.y-h/2)),w,h};
  }
  return{FONT_PX,metrics,intersects,textFor,textWidth,placeLabels,pan,zoomViewport};
});
