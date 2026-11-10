/* ========== ミチクサ: 歩けるマップ ========== */
const TS=16,VW=15,OWSCALE=4;
/* 色: 朝昼は昼の色、夕方は夕焼けの色、夜は街灯と窓の明かり */
const OW_DAY={grass:'#7cc860',grass2:'#62b04e',grass3:'#a8dc80',forest:'#5aa84a',forest2:'#4a9040',tall:'#3e9a44',tall2:'#2c7a36',path:'#ead8a0',path2:'#d4bc80',
  tree:'#2e8a3e',tree2:'#1e6a30',tree3:'#5ab45a',trunk:'#7a5030',water:'#4aa0e8',water2:'#8ad0f8',paddy:'#8ac8a8',paddy2:'#5aa048',
  rail:'#8a8a92',sleeper:'#7a5a3a',gravel:'#b8b0a0',plat:'#d8d4cc',plat2:'#f2c43a',wall:'#f2ece0',wall2:'#d8cfc0',roofr:'#d84a3a',roofr2:'#a83226',
  roofb:'#3a7ad8',roofb2:'#2a58a8',roofg:'#5a5a6a',roofg2:'#40404c',win:'#8ad0f0',win2:'#5aa8d8',door:'#7a5030',band:'#3ab07a',band2:'#e8402c',
  flower1:'#f2604a',flower2:'#f2e04a',outline:'#283040',sign:'#a87a48',lampp:'#5a5a62',lampl:'#e8e8d0',torii:'#d8402c',torii2:'#a82a20',stone:'#a8a8b0',stone2:'#7a7a84',
  skin:'#f2c8a0',cap:'#d84a3a',jacket:'#3a6ad8',pants:'#3a3a4a',hair2:'#3aa8d8',shirt2:'#f2f2f2',hair3:'#d8d8d8',kimono:'#8a5ab8',ball:'#f2604a'};
const owMix=(a,b,t)=>{const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),A=p(a),B=p(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');};
const OW_LIT=['win','win2','lampl'];
const OW_PALS=[OW_DAY,OW_DAY,
  Object.fromEntries(Object.entries(OW_DAY).map(([k,v])=>[k,OW_LIT.includes(k)?{win:'#ffd36a',win2:'#f2a03a',lampl:'#fff2b0'}[k]:owMix(owMix(v,'#f08a4a',.16),'#1a1020',.14)])),
  Object.fromEntries(Object.entries(OW_DAY).map(([k,v])=>[k,OW_LIT.includes(k)?{win:'#ffd36a',win2:'#f2a03a',lampl:'#fff2b0'}[k]:owMix(v,'#0e1630',.58)]))];

/* マップ: t木 G草地 g森の地面 P道 T草むら(出会う) W水 R田んぼ =線路 -ホーム *花 .建物の下(草) */
const MAPS={
  komorebi:{town:'komorebi',name:'こもれび町',field:'aze',ground:'grass',rows:[
    "ttttttttttttttt",
    "===============",
    "---------------",
    "tGGGG.....GGGGt",
    "tGG**.....**GGt",
    "tPPPPPPPPPPPPPt",
    "..............t",
    "..............t",
    "..............t",
    "tPPPPPPPPPPPPPt",
    "tRRRRRGPGWWWWWt",
    "tRRRRRGPGWWWWWt",
    "tRRRRRGPGWWWWWt",
    "tTTTTTGPGTTTTTt",
    "tTTTTTGPGTTTTTt",
    "tTTTTTGPGTTTTTt",
    "ttttttGPGtttttt"],
    objs:[['station',5,3,5,2],['lab',0,6,4,3],['house',8,6,3,3],['konbini',11,6,4,3],['sign',8,13],['lamp',4,5],['lamp',10,5],['lamp',6,9]],
    doors:{'7,4':'station','1,8':'lab','9,8':'home','12,8':'konbini'},
    signs:{'8,13':[['','↓ 鎮守の森・裏山 ／ 草むらには魔生物がひそんでいます']]},
    warps:{'7,16':{to:'urayama',x:9,y:19,dir:'up'}},
    npcs:[{id:'aoi',x:10,y:9,dir:'down',look:'aoi'},{id:'obaa',x:6,y:11,dir:'left',look:'obaa'}],
    spawn:{x:9,y:9,dir:'down'},station:{x:7,y:5,dir:'down'}},
  urayama:{town:'komorebi',name:'鎮守の森・裏山',field:'urayama',ground:'forest',rows:[
    "tttttttttttttttt",
    "ttttt.....tttttt",
    "ttttGGGPGGGGtttt",
    "tttGGGGPGGGGGttt",
    "ttGGTTGPGTTGGGtt",
    "ttGTTTGPGTTTGGtt",
    "ttGTTTPPGTTTTGtt",
    "ttGGGPPGGGTTTGtt",
    "tttGGPGGWWWGGGtt",
    "ttTTGPGWWWWWGGtt",
    "ttTTGPGWWWWWGTtt",
    "ttTTGPPGWWWGTTtt",
    "ttTTGGPGGGGTTTtt",
    "tttGGGPPPGGTTTtt",
    "ttGGTTGGPGGGGGtt",
    "ttGTTTTGPGGTTGtt",
    "ttGTTTTGPPGTTTtt",
    "ttGGTTGGGPGTTTtt",
    "tttGGGGGGPGGGttt",
    "ttttGGGGGPGGtttt",
    "tttttttttPtttttt"],
    objs:[['hokora',5,1,5,1],['torii',6,5,3,1],['sign',11,18]],
    signs:{'11,18':[['','↑ 鎮守の祠 ／ 森の奥には「ぬし」が棲むという']],'7,1':[['','古い祠だ。ぬしをまつっているらしい。']]},
    warps:{'9,20':{to:'komorebi',x:7,y:15,dir:'up'}},
    npcs:[{id:'nushi',x:7,y:3,dir:'down',look:'boss'}],
    items:{'13,4':'onigiri','3,9':'tane'},
    spawn:{x:9,y:19,dir:'up'}},
};
const NPC_TALK={
  aoi:()=>{if(!state.rival.komorebi&&RIVALS.komorebi){H.rival();return null;}return [['アオイ','次に会うときは、もっと強くなってるから！'],['アオイ','田んぼのあぜ道の草むらは、昼と夜で出てくる魔生物がちがうんだよ。']];},
  obaa:()=>state.time===3?[['おばあちゃん','ほれ、田んぼを見てごらん。ホタルが飛んどるじゃろう。'],['おばあちゃん','夜の草むらには、光る魔生物が出るんじゃよ。']]:[['おばあちゃん','こんにちは。この町は田んぼと森しかないけれど、いいところでしょう。'],['おばあちゃん','夜になったら、また来てごらん。田んぼがきれいなんじゃよ。']],
  nushi:()=>{if(state.boss.komorebi)return null;const alive=state.party.some(m=>m.hp>0);if(!alive)return [['','なかまが戦える状態ではない……']];talk([['','胸の月が光る大グマが、こちらをにらんでいる！']],()=>H.boss());return null;},
};
const OW_DOOR={
  station:()=>{ui.station=true;sfx('sel');render();},
  lab:()=>talk([['ハザマ所長','おお、来たか。配合台はいつでも使ってよいぞ。']],()=>{ui.tab='breed';render();}),
  home:()=>{healAll();sfx('heal');talk([['','家のふとんでひと休みした。'],['','なかま全員が元気になった！']]);save();},
  konbini:()=>talk([['店員','いらっしゃいませー！']],()=>{ui.tab='shop';render();}),
};

/* ---- 描画 ---- */
const OWC={bg:{},img:{},raf:0,cv:null,ctx:null,held:null,dash:false,mv:null,anim:0,vh:11};
function owMap(){return MAPS[state.ow&&state.ow.map];}
function owNpcs(m){return m.npcs.filter(n=>!(n.id==='nushi'&&state.boss.komorebi));}
function owPaint(m,ti){
  const P=OW_PALS[ti],W=m.rows[0].length,Hh=m.rows.length,cv=document.createElement('canvas');cv.width=W*TS;cv.height=Hh*TS;const x0=cv.getContext('2d');
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;},rr=n=>Math.floor(rnd()*n);
  const R=(x,y,w,h,c)=>{x0.fillStyle=P[c]||c;x0.fillRect(x,y,w,h);},px=(x,y,c)=>R(x,y,1,1,c);
  const E=(cx,cy,rx,ry,c)=>{for(let y=-ry;y<ry;y++){const w=Math.round(rx*Math.sqrt(1-((y+.5)/ry)**2));R(cx-w,cy+y,w*2,1,c);}};
  const at=(i,j)=>(m.rows[j]||'')[i]||'t';
  const gk=m.ground==='forest'?['forest','forest2']:['grass','grass2'];
  const ground=(x,y)=>{R(x,y,TS,TS,gk[0]);for(let k=0;k<3;k++){const a=1+rr(13),b=1+rr(13);px(x+a,y+b,gk[1]);px(x+a+1,y+b-1,gk[1]);}if(rnd()<.25)px(x+2+rr(11),y+2+rr(11),'grass3');};
  for(let j=0;j<Hh;j++)for(let i=0;i<W;i++){const ch=at(i,j),x=i*TS,y=j*TS;
    if('Gg.t*'.includes(ch))ground(x,y);
    if(ch==='*')[[3,4,'flower1'],[10,3,'flower2'],[6,10,'flower2'],[12,11,'flower1']].forEach(([a,b,c])=>{R(x+a,y+b,2,2,c);px(x+a,y+b+2,gk[1]);});
    if(ch==='P'){R(x,y,TS,TS,'path');for(let k=0;k<4;k++)px(x+rr(16),y+rr(16),'path2');if(j>0&&!'P.'.includes(at(i,j-1)))R(x,y,TS,1,'path2');}
    if(ch==='T'){R(x,y,TS,TS,'tall');[[1,3],[9,3],[5,10],[13,10]].forEach(([a,b])=>{for(let k=0;k<3;k++){for(let s=0;s<6;s++)px(x+a+k*2+(s<3?0:1),y+b+5-s,'tall2');px(x+a+k*2+1,y+b,'grass3');}});}
    if(ch==='W'){R(x,y,TS,TS,'water');[[2,4],[9,10]].forEach(([a,b])=>{R(x+a,y+b,4,1,'water2');R(x+a+4,y+b-1,2,1,'water2');});
      if(at(i-1,j)!=='W')R(x,y,2,TS,gk[1]);if(at(i+1,j)!=='W')R(x+TS-2,y,2,TS,gk[1]);if(at(i,j-1)!=='W')R(x,y,TS,2,gk[1]);if(at(i,j+1)!=='W')R(x,y+TS-2,TS,2,gk[1]);}
    if(ch==='R'){R(x,y,TS,TS,'paddy');[3,8,13].forEach(b=>[2,7,12].forEach(a=>{R(x+a,y+b-2,1,3,'paddy2');px(x+a+1,y+b-2,'paddy2');}));if(at(i,j-1)!=='R')R(x,y,TS,2,'sleeper');}
    if(ch==='='){R(x,y,TS,TS,'gravel');[1,6,11].forEach(a=>R(x+a,y+2,3,12,'sleeper'));R(x,y+4,TS,2,'rail');R(x,y+10,TS,2,'rail');}
    if(ch==='-'){R(x,y,TS,TS,'plat');R(x,y+12,TS,2,'plat2');for(let a=0;a<16;a+=4)px(x+a+1,y+13,'plat');R(x,y+TS-1,TS,1,'outline');}
  }
  for(let j=0;j<Hh;j++)for(let i=0;i<W;i++)if(at(i,j)==='t'){const x=i*TS,y=j*TS;R(x+6,y+10,4,6,'trunk');E(x+8,y+7,8,8,'tree2');E(x+8,y+6,7,6,'tree');E(x+6,y+4,3,2,'tree3');}
  const shadow=(X,Y,WW)=>{x0.fillStyle='rgba(0,0,0,.16)';x0.fillRect(X+1,Y,WW,2);};
  const building=(x,y,w,h,roof,roof2,dx)=>{const X=x*TS,Y=y*TS,WW=w*TS,HH=h*TS,rh=HH/2+2;shadow(X,Y+HH,WW);
    R(X,Y+rh,WW,HH-rh,'wall');R(X,Y+HH-3,WW,3,'wall2');R(X-1,Y,WW+2,rh,roof);for(let k=Y+3;k<Y+rh;k+=4)R(X-1,k,WW+2,1,roof2);R(X-1,Y+rh-2,WW+2,2,roof2);
    R((x+dx)*TS+4,Y+HH-11,8,11,'door');px((x+dx)*TS+10,Y+HH-6,'plat2');return [X,Y,WW,HH,rh];};
  for(const [k,x,y,w,h] of m.objs){const X=x*TS,Y=y*TS;
    if(k==='station'){const WW=w*TS,HH=h*TS;R(X,Y,WW,HH,'wall');R(X,Y,WW,6,'roofg');R(X,Y+6,WW,1,'roofg2');[X+6,X+WW-18].forEach(wx=>{R(wx,Y+11,12,8,'win');R(wx,Y+11,12,2,'win2');});
      R(X+2*TS+3,Y+HH-14,10,14,'win2');R(X+2*TS+4,Y+HH-13,8,12,'win');R(X+WW/2-14,Y+1,28,4,'plat');R(X+WW/2-14,Y+4,28,1,'plat2');R(X,Y+HH-2,WW,2,'wall2');}
    if(k==='lab'){const [X2,Y2,WW,HH,rh]=building(x,y,w,h,'roofb','roofb2',1);[X2+4,X2+40,X2+52].forEach(wx=>{R(wx,Y2+rh+5,9,7,'win');R(wx,Y2+rh+5,9,2,'win2');});R(X2+WW-14,Y2+rh-12,10,8,'plat');R(X2+WW-12,Y2+rh-10,6,1,'roofb2');R(X2+WW-12,Y2+rh-8,6,1,'roofb2');}
    if(k==='house'){const [X2,Y2,WW,HH,rh]=building(x,y,w,h,'roofr','roofr2',1);[X2+3,X2+35].forEach(wx=>{R(wx,Y2+rh+5,9,7,'win');R(wx,Y2+rh+5,9,2,'win2');});}
    if(k==='konbini'){const WW=w*TS,HH=h*TS;shadow(X,Y+HH,WW);R(X,Y+8,WW,HH-8,'wall');R(X-1,Y+4,WW+2,6,'roofg');R(X-1,Y+10,WW+2,4,'band');R(X-1,Y+14,WW+2,2,'band2');R(X+3,Y+20,WW-6,22,'win');R(X+3,Y+20,WW-6,3,'win2');for(let a=X+3;a<X+WW-3;a+=14)R(a,Y+20,1,22,'wall2');R(X+TS+4,Y+HH-14,10,14,'win2');}
    if(k==='sign'){R(X+7,Y+8,2,8,'trunk');R(X+2,Y+2,12,8,'sign');R(X+3,Y+3,10,6,'path');R(X+5,Y+5,6,1,'sign');R(X+5,Y+7,4,1,'sign');}
    if(k==='lamp'){R(X+7,Y+2,2,13,'lampp');R(X+5,Y,6,3,'lampp');R(X+6,Y+3,4,2,'lampl');}
    if(k==='hokora'){const WW=w*TS;R(X,Y+12,WW,4,'stone2');R(X+WW/2-14,Y-2,28,8,'roofr2');R(X+WW/2-16,Y-4,32,4,'roofr');R(X+WW/2-12,Y+6,24,8,'sign');R(X+WW/2-4,Y+7,8,7,'door');R(X+4,Y+4,4,10,'stone');R(X+WW-8,Y+4,4,10,'stone');}
    if(k==='torii'){R(X+3,Y-6,3,20,'torii');R(X+3*TS-6,Y-6,3,20,'torii');R(X-1,Y-10,3*TS+2,3,'torii');R(X+1,Y-7,3*TS-2,1,'torii2');R(X+2,Y-4,3*TS-4,2,'torii');}
  }
  if(ti>=2){const lamps=m.objs.filter(o=>o[0]==='lamp');x0.globalCompositeOperation='lighter';
    for(const [,x,y] of lamps){const cx=x*TS+8,cy=y*TS+12;[[26,.10],[16,.14],[8,.2]].forEach(([r,a])=>{x0.fillStyle=`rgba(255,200,110,${ti===3?a:a*.5})`;x0.beginPath();x0.arc(cx,cy,r,0,7);x0.fill();});}
    x0.globalCompositeOperation='source-over';}
  return cv;
}
function owBg(m,ti){const k=state.ow.map+ti;return OWC.bg[k]||(OWC.bg[k]=owPaint(m,ti));}
function owPerson(c,X,Y,look,dir,frame){
  const P=OW_PALS[state.time],R=(x,y,w,h,col)=>{c.fillStyle=P[col]||col;c.fillRect(X+x,Y+y,w,h);};
  const L={me:['cap','jacket','pants'],aoi:['hair2','shirt2','pants'],obaa:['hair3','kimono','kimono']}[look]||['cap','jacket','pants'];
  c.fillStyle='rgba(0,0,0,.25)';c.fillRect(X+3,Y+14,10,2);
  const step=frame%2===1;
  if(dir==='left'||dir==='right'){R(6,11,3,4,L[2]);if(step)R(4,11,3,3,L[2]);else R(8,11,3,3,L[2]);}
  else{R(5,11,2,step&&dir==='down'?3:4,L[2]);R(9,11,2,step&&dir==='up'?3:4,L[2]);}
  R(4,7,8,5,L[1]);
  if(dir==='left')R(5,8,2,3,'skin');else if(dir==='right')R(9,8,2,3,'skin');else{R(3,8,1,3,'skin');R(12,8,1,3,'skin');}
  R(4,2,8,6,'skin');R(4,1,8,3,L[0]);
  if(dir==='up')R(4,1,8,6,L[0]);
  else if(dir==='down'){R(3,2,1,4,L[0]);R(12,2,1,4,L[0]);R(6,5,1,1,'outline');R(9,5,1,1,'outline');}
  else if(dir==='left'){R(9,2,4,4,L[0]);R(5,5,1,1,'outline');}
  else{R(3,2,4,4,L[0]);R(10,5,1,1,'outline');}
  if(look==='me'){if(dir==='left')R(2,3,4,1,'cap');else if(dir==='right')R(10,3,4,1,'cap');else if(dir==='down')R(3,3,10,1,'cap');}
}
function owSpriteImg(id){if(!OWC.img[id]){const im=new Image();im.src=sprite(id,false);OWC.img[id]=im;}return OWC.img[id];}
function owDraw(){
  const m=owMap(),c=OWC.ctx;if(!m||!c)return;
  const bg=owBg(m,state.time),o=state.ow,mv=OWC.mv;
  let px=o.x*TS,py=o.y*TS;if(mv){const t=mv.t;px=(mv.fx+(o.x-mv.fx)*t)*TS;py=(mv.fy+(o.y-mv.fy)*t)*TS;}
  const MW=bg.width,MH=bg.height,VH=OWC.vh;
  let cx=Math.round(px+8-VW*TS/2),cy=Math.round(py+8-VH*TS/2);
  cx=MW<=VW*TS?Math.round((MW-VW*TS)/2):Math.max(0,Math.min(MW-VW*TS,cx));cy=MH<=VH*TS?Math.round((MH-VH*TS)/2):Math.max(0,Math.min(MH-VH*TS,cy));
  c.setTransform(OWSCALE,0,0,OWSCALE,0,0);c.imageSmoothingEnabled=false;
  c.fillStyle='#0c1120';c.fillRect(0,0,VW*TS,VH*TS);c.drawImage(bg,-cx,-cy);
  const items=m.items||{};for(const k in items){if(state.owItems&&state.owItems[state.ow.map+k])continue;const [ix,iy]=k.split(',').map(Number);const X=ix*TS-cx,Y=iy*TS-cy;c.fillStyle='#f2604a';c.fillRect(X+5,Y+6,6,3);c.fillStyle='#f2f2f2';c.fillRect(X+5,Y+9,6,3);c.fillStyle='#283040';c.fillRect(X+5,Y+9,6,1);c.fillRect(X+7,Y+8,2,2);}
  const ents=owNpcs(m).map(n=>({y:n.y*TS,draw:()=>{const X=n.x*TS-cx,Y=n.y*TS-cy;if(n.look==='boss'){const im=owSpriteImg('tsukinowa');c.fillStyle='rgba(0,0,0,.25)';c.fillRect(X-2,Y+13,20,3);if(im.complete)c.drawImage(im,X-6,Y-12,28,28);}else owPerson(c,X,Y,n.look,n.dir,0);}}));
  ents.push({y:py,draw:()=>owPerson(c,Math.round(px-cx),Math.round(py-cy)-1,'me',o.dir,mv?Math.floor(OWC.anim/6)%4===1||Math.floor(OWC.anim/6)%4===3?1:0:0)});
  ents.sort((a,b)=>a.y-b.y).forEach(e=>e.draw());
  /* 草むらの中では足元が草にかくれる */
  if(m.rows[o.y]&&m.rows[o.y][o.x]==='T'&&!mv){const P=OW_PALS[state.time],X=o.x*TS-cx,Y=o.y*TS-cy;c.fillStyle=P.tall;c.fillRect(X+2,Y+12,12,4);c.fillStyle=P.tall2;for(let k=0;k<4;k++)c.fillRect(X+3+k*3,Y+11,1,4);}
  if(state.time===3){const P=OW_PALS[3];for(let i=0;i<10;i++){const t=(Date.now()/900+i*1.7);const fx=((i*53)%(m.rows[0].length*TS))-cx+Math.sin(t)*4,fy=((i*97)%(m.rows.length*TS))-cy+Math.cos(t*1.3)*3;if(m.rows[Math.floor((fy+cy)/TS)]&&'RTW'.includes(m.rows[Math.floor((fy+cy)/TS)][Math.floor((fx+cx)/TS)])){c.fillStyle=(i+Math.floor(t))%3?'#e8ff8a':'rgba(232,255,138,.4)';c.fillRect(Math.round(fx),Math.round(fy),1,1);}}}
}
/* ---- 移動 ---- */
const OWD={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
function owSolid(m,x,y){
  const ch=(m.rows[y]||'')[x];if(ch===undefined||'tWR=-'.includes(ch))return true;
  for(const [k,ox,oy,w=1,h=1] of m.objs){if(k==='torii'){if(y===oy&&(x===ox||x===ox+w-1))return true;continue;}if(x>=ox&&x<ox+w&&y>=oy&&y<oy+h)return true;}
  if(owNpcs(m).some(n=>n.x===x&&n.y===y))return true;
  if(m.items&&m.items[x+','+y]&&!(state.owItems&&state.owItems[state.ow.map+x+','+y]))return true;
  return false;
}
function owTryMove(dir){
  const m=owMap(),o=state.ow;o.dir=dir;const [dx,dy]=OWD[dir],nx=o.x+dx,ny=o.y+dy;
  const door=m.doors&&m.doors[nx+','+ny];if(door){OWC.held=null;OW_DOOR[door]();return;}
  if(owSolid(m,nx,ny))return;
  OWC.mv={fx:o.x,fy:o.y,t:0};o.x=nx;o.y=ny;
}
function owArrive(){
  const m=owMap(),o=state.ow,w=m.warps&&m.warps[o.x+','+o.y];
  state.owSteps=(state.owSteps||0)+1;if(state.owSteps>=120){state.owSteps=0;advanceTime();ui.toast=`${TIMES[state.time].n}になった。`;save();render();return;}
  if(w){state.ow={map:w.to,x:w.x,y:w.y,dir:w.dir};OWC.mv=null;OWC.held=null;ui.toast=MAPS[w.to].name;save();render();return;}
  if(m.rows[o.y][o.x]==='T'&&state.party.some(x=>x.hp>0)){
    const rate=(state.lure>0?.2:.11);
    if(Math.random()<rate){OWC.held=null;OWC.mv=null;save();owEncounter(m.field);return;}
  }
  if(state.owSteps%10===0)save();
}
function owEncounter(fid){
  const t=TOWN[state.town],f=t.fields.find(x=>x.id===fid);if(!f)return;
  const n=Math.min(f.max,wpick([{w:6,v:1},{w:3,v:2},{w:1,v:3}]).v);
  const tb=f.table.filter(([,,tm])=>timeOK(tm,state.time)).map(([s,w])=>({w,s}));
  const foes=[];for(let i=0;i<n;i++)foes.push([wpick(tb).s,ri(f.lv[0],f.lv[1])]);
  const mrate=.035*((state.lure||0)>0?4:1);if(state.lure>0)state.lure--;
  if(Math.random()<mrate)foes[0]=[pick(['haganetsubu','koganetsubu','koganetsubu']),ri(f.lv[0],f.lv[1])];
  ui.toast='';startBattle(foes,{field:`${t.name}・${f.name}`,scene:f.scene});
}
function owA(){
  if(ui.dlg){H.dlgNext();return;}
  const m=owMap(),o=state.ow;if(!m||OWC.mv)return;const [dx,dy]=OWD[o.dir],x=o.x+dx,y=o.y+dy,k=x+','+y;
  const n=owNpcs(m).find(n=>n.x===x&&n.y===y);
  if(n){n.dir={up:'down',down:'up',left:'right',right:'left'}[o.dir];const lines=NPC_TALK[n.id]&&NPC_TALK[n.id]();if(lines)talk(lines);else owDraw();return;}
  if(m.signs&&m.signs[k]){talk(m.signs[k]);return;}
  if(m.items&&m.items[k]){state.owItems=state.owItems||{};const id=state.ow.map+k;if(!state.owItems[id]){state.owItems[id]=true;const it=m.items[k];state.items[it]=(state.items[it]||0)+1;sfx('shiny');save();talk([['',`${ITEMS[it].n}を拾った！`]]);}return;}
  if(m.doors&&m.doors[k]){OW_DOOR[m.doors[k]]();}
}
function owLoop(ts){
  OWC.raf=requestAnimationFrame(owLoop);
  const cv=document.getElementById('owc');if(!cv){return;}
  if(cv!==OWC.cv){OWC.cv=cv;OWC.ctx=cv.getContext('2d');}
  if(B||ui.dlg||ui.result||ui.gacha||!owMap()){OWC.held=null;owDraw();return;}
  const sp=OWC.dash?.17:.09;
  if(OWC.mv){OWC.mv.t+=sp;OWC.anim++;if(OWC.mv.t>=1){OWC.mv=null;owArrive();if(OWC.held&&!B&&!ui.dlg)owTryMove(OWC.held);}}
  else if(OWC.held)owTryMove(OWC.held);
  owDraw();
}
/* 端末の画面に合わせて、見える範囲(縦のマス数)と大きさを決める */
function owResize(){
  const cv=document.getElementById('owc'),box=cv&&cv.parentElement.parentElement,m=owMap();if(!cv||!box||!m)return;
  const W=box.clientWidth,Hh=box.clientHeight;if(!W||!Hh)return;
  let s=W/VW,rows=Math.floor(Hh/s);
  if(rows<9){rows=9;s=Hh/9;}
  rows=Math.min(rows,m.rows.length);
  if(OWC.vh!==rows||cv.height!==rows*TS*OWSCALE){OWC.vh=rows;cv.height=rows*TS*OWSCALE;cv.width=VW*TS*OWSCALE;OWC.cv=null;}
  cv.style.width=Math.floor(VW*s)+'px';cv.style.height=Math.floor(rows*s)+'px';
  owDraw();
}
window.addEventListener('resize',()=>owResize());
if(window.visualViewport)window.visualViewport.addEventListener('resize',()=>owResize());
document.addEventListener('contextmenu',e=>{if(!/INPUT|TEXTAREA/.test(e.target.tagName))e.preventDefault();});
function owEnsureLoop(){if(!OWC.raf)OWC.raf=requestAnimationFrame(owLoop);}
function owActive(){return state&&state.started&&!B&&ui.tab==='map'&&!ui.station&&MAPS[state.town]&&state.ow&&MAPS[state.ow.map]&&MAPS[state.ow.map].town===state.town;}
function owEnsureState(){if(MAPS[state.town]&&(!state.ow||!MAPS[state.ow.map]||MAPS[state.ow.map].town!==state.town)){const s=MAPS[state.town].spawn;state.ow={map:state.town,x:s.x,y:s.y,dir:s.dir};}}
function renderOverworld(){
  const m=owMap(),tm=TIMES[state.time];
  return `<section class="ow" aria-label="${m.name}のマップ">
    <div class="ow-screen"><div class="ow-cv"><canvas id="owc" width="${VW*TS*OWSCALE}" height="${OWC.vh*TS*OWSCALE}" aria-label="${m.name}を見下ろしたマップ。主人公が立っている"></canvas>
      <div class="ow-name"><span>${m.name}</span><span class="ow-time" style="--tc:${tm.c}">● ${tm.n}</span></div>${ui.toast?`<div class="ow-toast" role="status">${esc(ui.toast)}</div>`:''}</div></div>
    <div class="ow-pad">
      <div class="dpad">${['up','left','right','down'].map(d=>`<button class="dp dp-${d}" data-owdir="${d}" aria-label="${{up:'上',down:'下',left:'左',right:'右'}[d]}">${{up:'▲',down:'▼',left:'◀',right:'▶'}[d]}</button>`).join('')}<span class="dp-c"></span></div>
      <div class="abtn"><button class="ob ob-b" data-owb="1" aria-label="Bボタン(押しているあいだ走る)">B</button><button class="ob ob-a" data-act="owA" aria-label="Aボタン(調べる・話す)">A</button></div>
    </div>
    <p class="small muted ow-help">十字キーで歩く ・ Aで話す・調べる ・ Bを押しながら走る(キーボード: 矢印 / Z / X)</p>
  </section>`;
}
function renderStationIn(){
  const h=renderMap(),cut=h.indexOf('<section class="town-grid">');const t=TOWN[state.town];
  return `${h.slice(0,cut)}<div class="panel stack"><h3>${t.name}駅</h3><p class="small muted">電車でほかの駅へ移動できる。歩いて探索できるのは、いまはこもれび町だけ(試作)。</p><div class="row"><button class="btn primary" data-act="owExit">駅を出る</button><button class="btn" data-act="sento" ${state.yen>=t.sentoP?'':'disabled'}>${t.sento}(${t.sentoP}円)で回復</button></div></div>`;
}
/* 入力 */
(function(){
  const keyDir={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right',W:'up',S:'down',A:'left',D:'right'};
  document.addEventListener('keydown',e=>{if(!owActive()||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(keyDir[e.key]){e.preventDefault();if(!ui.dlg)OWC.held=keyDir[e.key];}
    else if(e.key==='z'||e.key==='Z'||e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)owA();}
    else if(e.key==='x'||e.key==='X'||e.key==='Shift')OWC.dash=true;});
  document.addEventListener('keyup',e=>{if(keyDir[e.key]&&OWC.held===keyDir[e.key])OWC.held=null;if(e.key==='x'||e.key==='X'||e.key==='Shift')OWC.dash=false;});
  const down=e=>{const b=e.target.closest&&e.target.closest('[data-owdir],[data-owb]');if(!b)return;e.preventDefault();if(b.dataset.owdir){if(!ui.dlg)OWC.held=b.dataset.owdir;}else OWC.dash=true;};
  const up=e=>{const b=e.target.closest&&e.target.closest('[data-owdir],[data-owb]');if(b&&b.dataset.owb)OWC.dash=false;else OWC.held=null;};
  document.addEventListener('pointerdown',down);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',()=>{OWC.held=null;OWC.dash=false;});
  document.addEventListener('pointerout',e=>{if(e.target.closest&&e.target.closest('[data-owdir]'))OWC.held=null;});
  window.addEventListener('blur',()=>{OWC.held=null;OWC.dash=false;});
})();

