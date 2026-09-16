// Shared deterministic circuit geometry for client rendering and server rules.
// Stylized outlines inspired by the supplied circuit chart, not surveyed replicas.
(function(root){
 const outlines=[
 ['Spielberg',[[8,92],[34,18],[58,5],[88,8],[73,67],[50,80],[26,79]]],
 ['Barcelona',[[8,86],[25,55],[31,38],[48,35],[67,8],[87,13],[92,25],[67,48],[62,64],[42,83],[25,96]]],
 ['Budapest',[[16,10],[37,17],[55,10],[66,27],[86,30],[88,58],[72,66],[78,89],[56,90],[47, 72],[25,80],[17,56]]],
 ['Monaco',[[10,89],[12,52],[35,47],[63,40],[73,14],[88,7],[86,26],[94,35],[77,51],[47,57],[31,70],[26,91]]],
 ['Monza',[[10,94],[19,72],[23,45],[41,16],[58,8],[87,19],[88,34],[64,42],[49, 42],[33,72],[22,96]]],
 ['Nürburg',[[11,90],[25,64],[21,51],[42,41],[29,29],[39,10],[66,7],[82,18],[68,35],[56,32],[50,57],[34,76],[31,94]]],
 ['Silverstone',[[11,54],[25, 30],[37,8],[55,23],[75,25],[84,43],[76,52],[91,67],[77,90],[52,83],[40, 60],[23,68]]],
 ['Spa',[[12,91],[19,56],[37,12],[66,6],[56,30],[77,34],[87,49],[80,63],[58,61],[43,76],[34,96]]],
 ['Melbourne',[[15,66],[32,59],[41,34],[58,20],[70,5],[83,20],[80,45],[88,72],[72,89],[42,84],[29,95],[14,85]]],
 ['Austin',[[11,94],[33,45],[36,15],[49,8],[62,24],[58,40],[77,48],[88,67],[75,82],[57,70],[44,83],[30,91]]],
 ['As-Sachir',[[9,80],[24,12],[43,25],[49,39],[65,42],[87,59],[89, 73],[51,77],[37,69],[27,90]]],
 ['Greater Noida',[[8,18],[30,29],[50,14],[63,33],[91,50],[84,79],[64, 80],[51,65],[29,79],[13,68]]],
 ['Montreal',[[9,95],[23,64],[41,49],[53,31],[77,8],[87,11],[75,37],[59,50],[47,73],[28,85]]],
 ['São Paulo',[[14,85],[23,39],[43,15],[67,8],[90,23],[83,42],[66,45],[50, 30],[35,46],[42,67],[65,72],[77,87],[ 50,95]]],
 ['Yeongam',[[8,90],[12,20],[29,25],[46,10],[57,28],[73, 20],[91,45],[83,69],[67, 60],[54,79],[34, 70]]],
 ['Singapore',[[10,75],[15,49],[29,45],[31,18],[51,8],[63,27],[82,21],[93,49],[78,58],[80,80],[58,87],[45, 70],[ 30,90]]],
 ['Sepang',[[10,16],[39,21],[49,6],[57,19],[43,46],[29,76],[43,84],[59,63],[77,43],[91, 50],[80,68],[55,91],[18,93]]],
 ['Shanghai',[[9,84],[34,68],[64,32],[58,13],[77,7],[93,28],[82,44],[65, 50],[ 50,73],[27, 90]]],
 ['Suzuka',[[9,94],[20,66],[36,51],[46,30],[61,16],[76,9],[88,29],[78, 40],[68,33],[61, 50],[51,74],[31,83]]],
 ['Abu Dhabi',[[10, 20],[37,12],[86,6],[92,21],[66,40],[64, 60],[79, 70],[67,91],[48,86],[37,66],[23,56]]]
 ].map(([name,p])=>({name,points:p}));
 const items=['turbo','shield','storm','oil','rocket','star','repair'];
 function smooth(points){let p=points;for(let k=0;k<3;k++){const out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];out.push([a[0]*.8+b[0]*.2,a[1]*.8+b[1]*.2],[a[0]*.2+b[0]*.8,a[1]*.2+b[1]*.8]);}p=out;}return p;}
 function build(config){
  const def=outlines[((config.trackId||0)%outlines.length+outlines.length)%outlines.length];
  const shape=smooth(def.points),scale=config.scale||48,angle=config.rotation||0,c=Math.cos(angle),s=Math.sin(angle);
  const p=shape.map(([x,y])=>({x:((x-50)*c-(y-50)*s)*scale,y:((x-50)*s+(y-50)*c)*scale}));
  const cumulative=[0];for(let i=0;i<p.length;i++)cumulative.push(cumulative.at(-1)+Math.hypot(p[(i+1)%p.length].x-p[i].x,p[(i+1)%p.length].y-p[i].y));
  const length=cumulative.at(-1),out=[];let j=0;
  for(let i=0;i<960;i++){const d=i/960*length;while(j<p.length-1&&cumulative[j+1]<d)j++;const u=(d-cumulative[j])/(cumulative[j+1]-cumulative[j]);const a=p[j],b=p[(j+1)%p.length];out.push({x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u});}
  // Expand tight outlines until the wide road can turn without folding its inner edge.
  let radius=Infinity;for(let i=0;i<960;i++){const a=out[(i+954)%960],b=out[i],c=out[(i+6)%960],cross=Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x));if(cross>1e-6)radius=Math.min(radius,Math.hypot(a.x-b.x,a.y-b.y)*Math.hypot(c.x-b.x,c.y-b.y)*Math.hypot(c.x-a.x,c.y-a.y)/(2*cross));}
  const expansion=Math.max(1,145/radius);for(const q of out){q.x*=expansion;q.y*=expansion;}
  return {name:def.name,points:out,length:length*expansion};
 }
 function point(track,t,lane=0){const f=((t%1)+1)%1*track.length,i=Math.floor(f),a=track[i],b=track[(i+1)%track.length],u=f-i,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;return{x:a.x+dx*u-dy/d*lane,y:a.y+dy*u+dx/d*lane,angle:Math.atan2(dy,dx)};}
 function height(t,config){const a=t*Math.PI*2,phase=config.phase||0;return 160+110*Math.sin(a+phase)+48*Math.sin(2*a-phase);}
 function contactPair(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(d>=44)return null;
  const nx=d>.01?dx/d:1,ny=d>.01?dy/d:0,overlap=44-d;
  const relative=(Math.cos(a.angle)*a.speed-Math.cos(b.angle)*b.speed)*nx+(Math.sin(a.angle)*a.speed-Math.sin(b.angle)*b.speed)*ny;
  const impulse=Math.min(135,Math.max(20,relative*.6));
  return{nx,ny,overlap,impulse};
 }


 const lapsForLength=length=>length>18000?2:3;
 function drafting(r,others){return r.speed>110&&others.some(o=>{if(o===r||o.finished||o.done)return false;const dx=o.x-r.x,dy=o.y-r.y,a=dx*Math.cos(r.angle)+dy*Math.sin(r.angle),side=Math.abs(-dx*Math.sin(r.angle)+dy*Math.cos(r.angle));return a>45&&a<260&&side<34&&Math.cos(o.angle-r.angle)>.85;});}
 function crossing(track,config,seconds,index){const t=[.21,.57,.86][index],cycle=Math.floor((seconds+index*4)/15),phase=((seconds+index*4)%15+15)%15,p=point(track,t),travel=(phase-3)/2;return{...p,t,cycle,warning:phase<3,active:phase>=3&&phase<5,x:p.x-Math.sin(p.angle)*(-190+380*travel),y:p.y+Math.cos(p.angle)*(-190+380*travel),height:height(t,config)+22+Math.sin(Math.max(0,Math.min(1,travel))*Math.PI)*26};}
 function shortcuts(track,config){return [.10,.60].map(t=>{const a=point(track,t),b=point(track,t+.075),d=Math.hypot(b.x-a.x,b.y-a.y);return {a,b,t,end:t+.075,d,angle:Math.atan2(b.y-a.y,b.x-a.x),h1:height(t,config)+2,h2:height(t+.075,config)+2};}).filter(v=>v.d>100);}
 function onShortcut(routes,x,y){for(const s of routes){const u=Math.max(0,Math.min(1,((x-s.a.x)*(s.b.x-s.a.x)+(y-s.a.y)*(s.b.y-s.a.y))/(s.d*s.d)));if(Math.hypot(x-s.a.x-(s.b.x-s.a.x)*u,y-s.a.y-(s.b.y-s.a.y)*u)<30)return {height:s.h1+(s.h2-s.h1)*u,t:s.t+(s.end-s.t)*u};}return null;}

 function roadClearance(track,x,y){let d=Infinity;for(const p of track)d=Math.min(d,Math.hypot(x-p.x,y-p.y));return d;}
 function canFore(track,r,shots,seconds,length){if(r.speed<120||r.spin>0||roadClearance(track,r.x,r.y)>104)return false;const t=((r.t+r.speed*1.45/length)%1+1)%1,a=point(track,t),b=point(track,t+.004);if(t<.025||t>.975||Math.cos(a.angle-b.angle)<.75)return false;return shots.filter(s=>seconds-s.start<4).length<6&&!shots.some(s=>seconds-s.start<4&&Math.hypot(point(track,s.t).x-a.x,point(track,s.t).y-a.y)<400);}
 function foreShot(track,config,r,seconds,length,id){const t=((r.t+Math.max(160,r.speed*1.45)/length)%1+1)%1,p=point(track,t),dx=r.x-point(track,r.t).x,dy=r.y-point(track,r.t).y,lane=Math.max(-60,Math.min(60,-dx*Math.sin(r.angle)+dy*Math.cos(r.angle)));return {id,t,lane,start:seconds,owner:r.index,results:[]};}
 function forePose(track,config,shot,seconds){const age=seconds-shot.start,p=point(track,shot.t,shot.lane),warning=age<1.4,active=age>=1.4&&age<3.2,roll=Math.max(0,age-1.4)*-90;return {warning,active,age,angle:p.angle,x:p.x+Math.cos(p.angle)*roll,y:p.y+Math.sin(p.angle)*roll,height:height(shot.t,config)+32+(warning?Math.max(0,(1.4-age))*240:Math.abs(Math.sin((age-1.4)*5))*9),targetX:p.x,targetY:p.y,ground:height(shot.t,config)};}
 function foreContact(pose,r){if(!pose.active||r.finished||r.done)return '';const d=Math.hypot(r.x-pose.x,r.y-pose.y);return d<53?'hit':d<102&&r.speed>100&&((r.x-pose.x)*(Math.cos(r.angle)*r.speed+Math.cos(pose.angle)*90)+(r.y-pose.y)*(Math.sin(r.angle)*r.speed+Math.sin(pose.angle)*90))>0?'dodge':'';}

 function flowAction(r,type,seconds){if(seconds-(r.flowAt??-100)>12)r.flowTypes=[];r.flowTypes=r.flowTypes||[];if(r.flowTypes.includes(type))return false;r.flowTypes.push(type);r.flowAt=seconds;if(r.flowTypes.length>=3){r.flowTypes=[];r.flowBursts=(r.flowBursts||0)+1;return true;}return false;}
 function rushGate(track,config,seconds,i){const t=.08+i/8,p=point(track,t,(i%2?1:-1)*48),cycle=Math.floor((seconds+i*3)/24),phase=((seconds+i*3)%24+24)%24;return {...p,t,cycle,active:phase<18&&Math.cos(p.angle-point(track,t+.002).angle)>.8,left:Math.max(0,18-phase)};}

 function jumpZones(track,length){const candidates=[];for(let i=12;i<85;i++){const t=i/100,a=point(track,t),b=point(track,t+240/length),c=point(track,t+650/length),score=Math.cos(a.angle-b.angle)+Math.cos(b.angle-c.angle);if(score>1.93)candidates.push({t,end:t+240/length,score,lane:-48});}candidates.sort((a,b)=>b.score-a.score);const zones=[];for(const c of candidates){if(zones.every(z=>Math.abs(z.t-c.t)>.22))zones.push(c);if(zones.length===2)break;}return zones;}
 function rampState(track,zones,r){for(let i=0;i<zones.length;i++){const z=zones[i],u=(r.t-z.t)/(z.end-z.t);if(u<0||u>1.06)continue;const p=point(track,r.t,z.lane);if(Math.hypot(r.x-p.x,r.y-p.y)<36)return {i,u:Math.min(1,u),lift:60*Math.min(1,u)**2,launch:u>.92&&r.speed>150};}return null;}
 function airLift(remaining){const u=Math.max(0,Math.min(1,1-remaining/2));return remaining>0?60*(1-u)+Math.sin(u*Math.PI)*160:0;}
 const api={outlines,items,build,point,height,contactPair,lapsForLength,drafting,crossing,shortcuts,onShortcut,roadClearance,canFore,foreShot,forePose,foreContact,flowAction,rushGate,jumpZones,rampState,airLift};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KartTracks=api;
})(typeof window!=='undefined'?window:globalThis);
