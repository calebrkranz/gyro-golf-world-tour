(function(root){'use strict';
 const C={width:1662.5,length:2450,corner:262.5,wall:150,ceiling:340,ballRadius:27,goalZ:1050,goalRadius:68,target:3};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function contain(body,radius=0,bounce=0){
  const ix=C.width/2-C.corner,iz=C.length/2-C.corner,qx=clamp(body.x,-ix,ix),qz=clamp(body.z,-iz,iz),dx=body.x-qx,dz=body.z-qz,d=Math.hypot(dx,dz),limit=C.corner-radius;
  if(d>limit){const nx=dx/d,nz=dz/d;body.x=qx+nx*limit;body.z=qz+nz*limit;const outward=(body.vx||0)*nx+(body.vz||0)*nz;if(outward>0){body.vx-=(1+bounce)*outward*nx;body.vz-=(1+bounce)*outward*nz;}}return body;
 }
 function perimeter(){const points=[];for(const [sx,sz,start] of [[1,1,0],[-1,1,Math.PI/2],[-1,-1,Math.PI],[1,-1,Math.PI*1.5]])for(let i=0;i<=20;i++){const a=start+i*Math.PI/40;points.push({x:sx*(C.width/2-C.corner)+Math.cos(a)*C.corner,z:sz*(C.length/2-C.corner)+Math.sin(a)*C.corner});}return points;}
 function surface(x,z){const ix=C.width/2-C.corner,iz=C.length/2-C.corner,dx=x-clamp(x,-ix,ix),dz=z-clamp(z,-iz,iz),d=Math.hypot(dx,dz),edge=C.corner-d,u=clamp((140-edge)/140,0,1);return {y:90*u*u,nx:d?dx/d:0,nz:d?dz/d:0,slope:180*u/140};}
 function practice(){const s=create([{name:'Practice'} ,{name:'Dummy'}]);s.cars.splice(1);s.practice=true;s.wait=0;return s;}
 function resetBall(s){s.ball={x:0,y:55,z:0,vx:0,vy:0,vz:0};s.lastTouch=-1;}
 function kickoff(s){s.ball={x:0,y:55,z:0,vx:0,vy:0,vz:0};s.cars.forEach((c,i)=>Object.assign(c,{x:s.cars.length>2?(i<2?-240.625:240.625):0,z:c.team===0?678.125:-678.125,y:0,vy:0,vx:0,vz:0,angle:c.team===0?-Math.PI/2:Math.PI/2,boost:65,autoBoost:0,jumpHeld:false,jumps:0,pitch:0,roll:0,dodge:0,dodgeAge:0}));s.pads.forEach(p=>p.ready=0);s.wait=3.48;}
 function create(players){if(![2,4].includes(players.length))throw new Error('Stadium requires 2 or 4 players');const s={time:0,score:[0,0],winner:-1,goalId:0,lastTeam:-1,hitId:0,cars:players.map((p,i)=>({index:i,name:p.name||'Player '+(i+1),team:i%2,look:p.appearance||p.look||{}})),pads:[],ball:{}};for(const x of [-270,-135,135,270])for(const z of [-350,-170,0,170,350])s.pads.push({x:x*2.1875,z:z*2.1875,ready:0});kickoff(s);return s;}
 function step(s,inputs,dt){dt=clamp(dt,0,1/30);if(s.winner>=0)return;s.time+=dt;if(s.wait>0){s.wait=Math.max(0,s.wait-dt);return;}for(const p of s.pads)p.ready=Math.max(0,p.ready-dt);
  for(const c of s.cars){const k=inputs[c.index]||{},forward=(k.up?1:0)-(k.down?1:0),steer=(k.right?1:0)-(k.left?1:0);const ground=surface(c.x,c.z),grounded=c.y<=ground.y+.5&&c.vy<=1;
   if(grounded){c.jumps=0;c.pitch=0;c.roll=0;}c.dodge=Math.max(0,(c.dodge||0)-dt);c.dodgeAge=(c.dodgeAge||0)+dt;
   const boost=(k.boost&&c.boost>0)||c.autoBoost>0;c.boost=s.practice?100:clamp(c.boost+(k.boost&&c.boost>0?-34:5)*dt,0,100);c.boosting=!!boost;c.autoBoost=Math.max(0,c.autoBoost-dt);
   if(grounded){const roadSpeed=Math.hypot(c.vx,c.vz);c.angle+=steer*(2.6-.7*Math.min(1,roadSpeed/480))*dt*(forward<0?-1:1);const fx=Math.cos(c.angle),fz=Math.sin(c.angle);let longitudinal=c.vx*fx+c.vz*fz,lateral=-c.vx*fz+c.vz*fx;const throttle=forward||(boost?1:0),target=throttle*(boost?480:330),braking=throttle&&longitudinal*throttle<0,accel=braking?1300:throttle?(boost?1250:1050):140;longitudinal+=clamp(target-longitudinal,-accel*dt,accel*dt);lateral*=Math.exp(-7*dt);c.vx=fx*longitudinal-fz*lateral;c.vz=fz*longitudinal+fx*lateral;}
   else{const ease=1-Math.exp(-5*dt);c.angle+=steer*.85*dt;c.pitch+=(forward*.5-(c.pitch||0))*ease;c.roll+=(steer*.22-(c.roll||0))*ease;if(boost){c.vx+=Math.cos(c.angle)*Math.cos(c.pitch)*320*dt;c.vz+=Math.sin(c.angle)*Math.cos(c.pitch)*320*dt;c.vy+=Math.sin(c.pitch)*360*dt;}}
   const jumpPressed=k.jump&&!c.jumpHeld;
   if(jumpPressed&&(grounded||c.jumps<2)){c.jumps++;if(c.jumps===1){c.vy=340; c.y=ground.y+1;}else{if(forward||steer){c.vy=0;const a=c.angle+Math.atan2(steer,forward),dodgeSpeed=clamp(Math.hypot(c.vx,c.vz)*.8+180,340,540);c.vx=Math.cos(a)*dodgeSpeed;c.vz=Math.sin(a)*dodgeSpeed;c.dodge=.55;c.dodgeAge=0;c.dodgeForward=forward;c.dodgeSide=steer;}else{c.vy=Math.max(c.vy,160);}}}
   c.jumpHeld=!!k.jump;c.vy-=460*dt;c.x+=c.vx*dt;c.z+=c.vz*dt;c.y+=c.vy*dt;
   contain(c,24,0);const floor=surface(c.x,c.z);if((grounded&&!jumpPressed)||c.y<floor.y){c.y=floor.y;c.vy=0;if(!k.up&&!k.down){c.vx-=floor.nx*floor.slope*300*dt;c.vz-=floor.nz*floor.slope*300*dt;}}
   if(c.y>C.ceiling-55){c.y=C.ceiling-55;c.vy=Math.min(0,c.vy);}const kartSpeed=Math.hypot(c.vx,c.vz);if(kartSpeed>620){c.vx*=620/kartSpeed;c.vz*=620/kartSpeed;}
   contain(c,24,0);
   for(const p of s.pads)if(!p.ready&&c.y<15&&Math.hypot(c.x-p.x,c.z-p.z)<34){p.ready=5;c.boost=Math.min(100,c.boost+40);c.autoBoost=1;c.pickupId=(c.pickupId||0)+1;}
  }
  for(let i=0;i<s.cars.length;i++)for(let j=i+1;j<s.cars.length;j++){const a=s.cars[i],b=s.cars[j],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);if(d<43&&Math.abs(a.y-b.y)<32){const nx=d>0?dx/d:1,nz=d>0?dz/d:0,over=(43-d)/2;a.x-=nx*over;a.z-=nz*over;b.x+=nx*over;b.z+=nz*over;const impulse=Math.max(0,(a.vx-b.vx)*nx+(a.vz-b.vz)*nz)*.65;a.vx-=nx*impulse;a.vz-=nz*impulse;b.vx+=nx*impulse;b.vz+=nz*impulse;}}
  for(const c of s.cars){contain(c,24,0);const f=surface(c.x,c.z);if(c.y<f.y){c.y=f.y;c.vy=Math.max(0,c.vy);}}
  const b=s.ball;b.vy-=285*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;const drag=Math.exp(-.19*dt);b.vx*=drag;b.vz*=drag;
  for(const c of s.cars){const dx=b.x-c.x,dy=b.y-(c.y+20),dz=b.z-c.z,d=Math.hypot(dx,dy,dz),radius=51;if(d<radius){const nx=d>0?dx/d:Math.cos(c.angle),ny=d>0?dy/d:0,nz=d>0?dz/d:Math.sin(c.angle);b.x=c.x+nx*radius;b.y=c.y+20+ny*radius;b.z=c.z+nz*radius;const carNormal=c.vx*nx+c.vy*ny+c.vz*nz,ballNormal=b.vx*nx+b.vy*ny+b.vz*nz,closing=carNormal-ballNormal;if(closing>0){const outgoing=Math.max(0,carNormal)*1.65+Math.max(0,-ballNormal)*.55+25+(c.dodge>0?145:0),impulse=Math.max(0,outgoing-ballNormal);b.vx+=nx*impulse;b.vy+=ny*impulse;b.vz+=nz*impulse;s.hitId++;s.lastTouch=c.index;s.hitPoint={x:b.x,y:b.y,z:b.z};}}}

  contain(b,C.ballRadius,.82);
  if(b.y>C.ceiling-C.ballRadius){b.y=C.ceiling-C.ballRadius;b.vy=-Math.abs(b.vy)*.6;}
  for(let defending=0;defending<2;defending++){const z=defending===0?C.goalZ:-C.goalZ;if(Math.hypot(b.x,b.z-z)<C.goalRadius-C.ballRadius*.55&&b.y<44){const scorer=1-defending;s.score[scorer]++;s.lastTeam=scorer;s.scorer=s.cars[s.lastTouch]?.name||'Unassisted';s.goalPoint={x:b.x,y:b.y,z:b.z};s.goalId++;if(s.practice){resetBall(s);return;}if(s.score[scorer]>=C.target){s.winner=scorer;s.wait=0;}else kickoff(s);return;}}
  const floor=surface(b.x,b.z);if(b.y<floor.y+C.ballRadius){b.y=floor.y+C.ballRadius;const len=Math.hypot(floor.slope,1),nx=-floor.nx*floor.slope/len,ny=1/len,nz=-floor.nz*floor.slope/len,inward=b.vx*nx+b.vy*ny+b.vz*nz;if(inward<0){const impulse=-(1+(inward< -30?.68:0))*inward;b.vx+=nx*impulse;b.vy+=ny*impulse;b.vz+=nz*impulse;}const friction=Math.exp(-.6*dt);b.vx*=friction;b.vz*=friction;}
  const ballSpeed=Math.hypot(b.vx,b.vy,b.vz);if(ballSpeed>720){const limited=Math.min(950,720+(ballSpeed-720)*Math.exp(-.65*dt)),scale=limited/ballSpeed;b.vx*=scale;b.vy*=scale;b.vz*=scale;}

 }
 function ai(s,index){const c=s.cars[index],b=s.ball,d=Math.hypot(b.x-c.x,b.z-c.z),targetZ=c.team===0?-C.goalZ:C.goalZ,behind=(b.z-targetZ)>0?1:-1,tx=d>95?b.x:b.x,tz=d>95?b.z+behind*55:b.z;let turn=Math.atan2(tz-c.z,tx-c.x)-c.angle;turn=Math.atan2(Math.sin(turn),Math.cos(turn));return{up:Math.abs(turn)<1.4,left:turn<-.12,right:turn>.12,boost:Math.abs(turn)<.15&&d>150,jump:b.y>55&&d<95};}
 const api={surface,practice,resetBall,contain,perimeter,C,create,kickoff,step,ai};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GolfStadium=api;
})(typeof window!=='undefined'?window:globalThis);
