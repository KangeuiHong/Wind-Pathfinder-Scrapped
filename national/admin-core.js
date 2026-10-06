/* Administrative boundary lookup only; no weather interpolation or nearest-place guessing. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AdminCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Return -1 outside, 0 exactly on an edge, 1 inside. Coordinates are lon/lat.
  function pointInRing(point,ring){
    let inside=false;const[x,y]=point;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++){
      const[xi,yi]=ring[i],[xj,yj]=ring[j],dx=xj-xi,dy=yj-yi;
      const cross=(x-xi)*dy-(y-yi)*dx;
      if(Math.abs(cross)<1e-10&&x>=Math.min(xi,xj)-1e-10&&x<=Math.max(xi,xj)+1e-10&&y>=Math.min(yi,yj)-1e-10&&y<=Math.max(yi,yj)+1e-10)return 0;
      if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
    }
    return inside?1:-1;
  }
  function pointInPolygon(point,rings){
    if(!rings.length)return-1;
    const outer=pointInRing(point,rings[0]);if(outer!==1)return outer;
    for(const hole of rings.slice(1)){const result=pointInRing(point,hole);if(result===0)return 0;if(result===1)return-1;}
    return 1;
  }
  function pointInGeometry(point,geometry){
    if(!geometry)return-1;const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:geometry.type==='Polygon'?[geometry.coordinates]:[];let edge=false;
    for(const polygon of polygons){const result=pointInPolygon(point,polygon);if(result===1)return 1;if(result===0)edge=true;}
    return edge?0:-1;
  }
  function locate(lon,lat,collection){
    return collection.features.filter(f=>!f.bbox||(lon>=f.bbox[0]&&lon<=f.bbox[2]&&lat>=f.bbox[1]&&lat<=f.bbox[3])).map(feature=>({feature,relation:pointInGeometry([lon,lat],feature.geometry)})).filter(result=>result.relation>=0);
  }
  // Local equirectangular approximation used only for a conservative 100 m review warning.
  // This is not a surveyed boundary-distance result or a jurisdiction decision.
  function boundaryDistanceM(lon,lat,geometry){
    const k=Math.PI/180*6371008.8,kx=k*Math.cos(lat*Math.PI/180);
    const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];let minimum=Infinity;
    for(const polygon of polygons)for(const ring of polygon)for(let i=1;i<ring.length;i++){
      const ax=(ring[i-1][0]-lon)*kx,ay=(ring[i-1][1]-lat)*k,bx=(ring[i][0]-lon)*kx,by=(ring[i][1]-lat)*k;
      const dx=bx-ax,dy=by-ay,denom=dx*dx+dy*dy;
      const t=denom?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/denom)):0;
      minimum=Math.min(minimum,Math.hypot(ax+t*dx,ay+t*dy));
    }
    return minimum;
  }
  return {pointInRing,pointInPolygon,pointInGeometry,locate,boundaryDistanceM};
});
