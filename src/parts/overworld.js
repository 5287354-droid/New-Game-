/* ========== ミチクサ: 歩けるマップ ========== */
/* 歩いて出会う回数が多いぶん、野生(1.25倍)とぬし・ライバル(1.2倍、裏のぬしは1.15倍)を強めにする */
const OW_LV=(v,f)=>Math.max(v+1,Math.round(v*f));
TOWNS.forEach(t=>{t.fields.forEach(f=>{f.lv=[OW_LV(f.lv[0],1.25),OW_LV(f.lv[1],1.25)];});if(t.boss)t.boss.foes.forEach(x=>x[1]=OW_LV(x[1],1.2));if(t.ura)t.ura.foes.forEach(x=>x[1]=OW_LV(x[1],1.15));});
Object.values(RIVALS).forEach(r=>r.team.forEach(x=>x[1]=OW_LV(x[1],1.2)));
const TS=16,VW=15,OWSCALE=4;
/* 色: 朝昼は昼の色、夕方は夕焼けの色、夜は街灯と窓の明かり */
const OW_DAY={grass:'#7cc860',grass2:'#62b04e',grass3:'#a8dc80',forest:'#5aa84a',forest2:'#4a9040',tall:'#3e9a44',tall2:'#2c7a36',path:'#ead8a0',path2:'#d4bc80',
  tree:'#2e8a3e',tree2:'#1e6a30',tree3:'#5ab45a',trunk:'#7a5030',water:'#4aa0e8',water2:'#8ad0f8',paddy:'#8ac8a8',paddy2:'#5aa048',
  rail:'#8a8a92',sleeper:'#7a5a3a',gravel:'#b8b0a0',plat:'#d8d4cc',plat2:'#f2c43a',wall:'#f2ece0',wall2:'#d8cfc0',roofr:'#d84a3a',roofr2:'#a83226',
  roofb:'#3a7ad8',roofb2:'#2a58a8',roofg:'#5a5a6a',roofg2:'#40404c',win:'#8ad0f0',win2:'#5aa8d8',door:'#7a5030',band:'#3ab07a',band2:'#e8402c',
  flower1:'#f2604a',flower2:'#f2e04a',outline:'#283040',sign:'#a87a48',lampp:'#5a5a62',lampl:'#e8e8d0',torii:'#d8402c',torii2:'#a82a20',stone:'#a8a8b0',stone2:'#7a7a84',
  side:'#c8c4bc',side2:'#b0aca4',asph:'#4a4c54',asph2:'#3e4048',zebra:'#e8e8e8',hedge:'#3a8a44',hedge2:'#2c6a34',
  b1:'#8a94a8',b1d:'#6a7488',b2:'#a8988a',b2d:'#887868',b3:'#7a8a7a',b3d:'#5a6a5a',b4:'#9a8aa0',b4d:'#7a6a80',bwall:'#5a5e6a',
  alley:'#6a6660',alley2:'#5a5650',stain:'#4e4a46',twall:'#3a3632',twall2:'#2e2a28',track:'#4a4440',tile:'#b8b4a8',tile2:'#a09c90',web:'#e8eef6',hole:'#14141a',
  dome:'#e8e8ee',dome2:'#c8c8d4',sauna:'#c87a4a',sauna2:'#a85a30',vend:'#e8402c',sand:'#ecd9a6',sand2:'#d8c08a',wet:'#c8b48a',wet2:'#b09c74',sea:'#2a7ac8',sea2:'#5aa8e8',foam:'#e8f6fa',rock:'#7a7470',rock2:'#5e5854',shore:'#8a8278',moss:'#6a8a5a',pier:'#9a7048',pier2:'#7a5434',river:'#3a8ac8',river2:'#8ac8f0',bridge:'#a87a48',bridge2:'#7a5434',rope:'#d8c8a0',pebble:'#b8b0a0',pebble2:'#9a9288',step:'#b0aca4',step2:'#8a8680',lantern:'#8a8a92',fire:'#ff9a3a',fire2:'#ffe08a',bib:'#e8402c',thatch:'#b8944a',thatch2:'#8a6a30',bamboo:'#6aa84a',bamboo2:'#4a8a3a',bamboo3:'#9ad07a',tatami:'#c8c88a',tatami2:'#a8a868',shoji:'#f2eee0',shoji2:'#8a6a48',cloud:'#e8eef6',cloud2:'#c8d4e6',mirror:'#b8c8e8',cwall:'#4a4048',cwall2:'#3a3038',cfloor:'#6a6070',cfloor2:'#5a5060',
  skin:'#f2c8a0',cap:'#d84a3a',jacket:'#3a6ad8',pants:'#3a3a4a',hair2:'#3aa8d8',shirt2:'#f2f2f2',hair3:'#d8d8d8',kimono:'#8a5ab8',suit:'#3a3e4a',hair4:'#3a2a20',apron:'#e8a83a',ball:'#f2604a',
  snow:'#eef3f8',snow2:'#d6e0ec',snow3:'#b8c8dc',deep:'#f8fbfe',deep2:'#cfdbe8',ice:'#bfe4f4',ice2:'#eefaff',ice3:'#8cc4e0',thin:'#a4d4ea',thin2:'#e2f4fb',crack:'#26405a',
  pine:'#2a6a4a',pine2:'#1c4a36',sasa:'#4a8a52',sasa2:'#2e5e3a',isea:'#1e5a8c',isea2:'#4a86b8',floe:'#eaf3fa',floe2:'#b0c8dc',parka:'#d8402c',fur:'#8a6a48'};
const owMix=(a,b,t)=>{const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),A=p(a),B=p(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');};
const OW_LIT=['win','win2','lampl'];
const OW_PALS=[OW_DAY,OW_DAY,
  Object.fromEntries(Object.entries(OW_DAY).map(([k,v])=>[k,OW_LIT.includes(k)?{win:'#ffd36a',win2:'#f2a03a',lampl:'#fff2b0'}[k]:owMix(owMix(v,'#f08a4a',.16),'#1a1020',.14)])),
  Object.fromEntries(Object.entries(OW_DAY).map(([k,v])=>[k,OW_LIT.includes(k)?{win:'#ffd36a',win2:'#f2a03a',lampl:'#fff2b0'}[k]:owMix(v,'#0e1630',.58)]))];

/* タイル
   t木 G草地 P道 T草むら W水 R田んぼ =線路 -ホーム *花 .建物の下
   S歩道 A車道 Z横断歩道 h植えこみ Bビル D路地(出会う) Xトンネルの壁 Y線路跡(出会う) F床 Q蜘蛛の巣 O穴
   N砂浜 U干潟(満潮で海) ~海 E磯 r岩 K桟橋 V洞窟の壁 C洞窟の床
   w川 H吊り橋 b河原 o飛び石 L石段・石だたみ
   q竹 M畳 Jふすま・障子の壁 k雲海
   (雪のマップ) y深い雪(遅い・出会う) iすべる氷 u薄氷(同じ所を2度ふむと割れる) a朝昼だけの流氷 v夕夜だけの流氷・オーロラの橋 l氷の穴(釣り) */
const OW_SOLID='tWR=-BAhXO~rVwqJkl';
/* 流氷: aは朝・昼、vは夕方・夜だけ(オーロラの橋もv) */
const owFloeOn=ch=>ch==='a'?state.time<2:ch==='v'?state.time>=2:true;
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
    objs:[['station',5,3,5,2],['lab',0,6,4,3],['house',8,6,3,3],['konbini',11,6,4,3],['sign',8,13],['lamp',4,4],['lamp',10,4],['lamp',6,9]],
    doors:{'7,4':'station','1,8':'lab','9,8':'home','12,8':'konbini'},
    signs:{'8,13':[['','↓ 鎮守の森・裏山 ／ 草むらには魔生物がひそんでいます']]},
    warps:{'7,16':{to:'urayama',x:9,y:19,dir:'up'}},
    npcs:[{id:'aoi',x:8,y:10,dir:'left',look:'aoi'},{id:'obaa',x:6,y:11,dir:'left',look:'obaa'}],
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
    npcs:[{id:'nushi',x:7,y:3,dir:'down',look:'boss',sp:'tsukinowa',text:'胸の月が光る大グマが、こちらをにらんでいる！'}],
    items:{'13,4':'onigiri','3,9':'tane'},
    spawn:{x:9,y:19,dir:'up'}},

  /* ---- 霞ヶ丘 ---- */
  kasumi:{town:'kasumi',name:'霞ヶ丘',ground:'city',rows:[
    "BBBBBBBBBBBBBBBBBBBB",
    "====================",
    "--------------------",
    "hSSSSS........SSSSSh",
    "hSSSSS........SSSSSh",
    "SSSSSSSSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSS",
    "AAAAAAAAZZZAAAAAAAAA",
    "AAAAAAAAZZZAAAAAAAAA",
    "SSSSSSSSSSSSSSSSSSSS",
    "......SSSS....S....S",
    "......SSSS....S....S",
    "......SSSS....S....S",
    "......SSSSSSSSSSSSSS",
    "SSSSSSSSSSSSSSSSSSSS",
    "SSSShhSSSSSSShhSSSSS",
    "SSSSSSSSSSSSSSSSSSSS",
    "BBBBBBBBBBBBBBBBBBBS"],
    objs:[['station',6,3,8,2],['board',2,4],['vend',16,4],['light',7,6],['light',11,9],['dome',0,10,6,4],['sauna',10,10,4,3],['konbini',15,10,4,3],['manhole',3,16],['lamp',5,5],['lamp',14,5],['lamp',8,14],['lamp',17,14]],
    doors:{'10,4':'station','3,13':'dome','11,12':'sauna','16,12':'konbini','2,4':'board','16,4':'vend'},
    signs:{'19,16':[['','→ 雑居ビルの路地裏']],'7,6':[['','歩行者用の信号だ。青になったら渡ろう。']],'11,9':[['','歩行者用の信号だ。青になったら渡ろう。']]},
    warps:{'3,16':{to:'chika',x:2,y:2,dir:'down',msg:'マンホールのはしごを降りた……'},'19,17':{to:'roji',x:0,y:9,dir:'right'}},
    cars:{lanes:[{y:7,dir:1},{y:8,dir:-1}],cross:[8,10]},
    npcs:[{id:'aoi',x:13,y:14,dir:'down',look:'aoi'},{id:'salary',x:17,y:6,dir:'left',look:'salary',lines:[['会社員','この信号、待ち時間が長いんだよな……。'],['会社員','赤信号で渡ろうとすると、車にクラクションを鳴らされるぞ。']]},
      {id:'clerk',x:7,y:14,dir:'up',look:'clerk',lines:[['ドームの係員','霞ヶ丘ドームでは、配合杯をひらいています。'],['係員','腕に自信があるなら、ぜひ出場してください！']]},
      {id:'kid',x:2,y:16,dir:'right',look:'kid',lines:[['少年','このマンホール、地下鉄の古いトンネルにつながってるんだって！'],['少年','まっ暗で、何も見えないらしいよ。']]}],
    spawn:{x:10,y:5,dir:'down'},station:{x:10,y:5,dir:'down'}},
  roji:{town:'kasumi',name:'雑居ビルの路地裏',field:'biru',ground:'alley',enc:'D',rate:.1,rows:[
    "BBBBBBBBBBBBBBBBBB",
    "BBBBBBBBSSBBBBBBBB",
    "BBBDDDDDSSDDDDDBBB",
    "BBBDBBBBSSBBBBDBBB",
    "BDDDBBBBSSBBBBDDDB",
    "BDBBBDDDDDDDDBBBDB",
    "BDBBBDBBBBBBDBBBDB",
    "BDDDDDBBBBBBDDDDDB",
    "BBBBBDBBBBBBDBBBBB",
    "SSSSSDDDDSDDDDBBBB",
    "BBBBBBBBBSBBBDBBBB",
    "BBDDDDDDDSDDDDDDBB",
    "BBDBBBBBBSBBBBBDBB",
    "BBDBBBBBBSBBBBBDBB",
    "BBDDDDDBBSBBDDDDBB",
    "BBBBBBDBBSBBDBBBBB",
    "BBBBBBDDDSDDDBBBBB",
    "BBBBBBBBBBBBBBBBBB"],
    objs:[['shutter',8,1,2,1,'power'],['trash',3,2],['trash',3,3],['trash',16,4],['trash',2,14],['trash',3,14],['trash',15,14],['unit',4,5],['unit',8,10],['lamp',9,8]],
    signs:{'7,9':[['','落書き「廃ビルのシャッターは、地下の配電盤で動くらしい」']]},
    warps:{'0,9':{to:'kasumi',x:18,y:16,dir:'left'},'8,1':{to:'haibiru',x:7,y:11,dir:'up',need:'power'},'9,1':{to:'haibiru',x:7,y:11,dir:'up',need:'power'}},
    npcs:[{id:'cat',x:16,y:6,dir:'up',look:'cat',lines:[['ノラネコ','ニャア。'],['','ネコはゴミ箱のほうをじっと見ている。なにか入っているのかもしれない。']]}],
    spawn:{x:1,y:9,dir:'right'}},
  chika:{town:'kasumi',name:'旧地下鉄のトンネル',field:'chika',ground:'floor',enc:'Y',rate:.09,dark:'power',rows:[
    "XXXXXXXXXXXXXXXXXXXX",
    "XFFFXXXXXXXXXXXXXXXX",
    "XFFFYYYYYYYYYYYYYYYX",
    "XFFFYYYYYYYYYYYYYYYX",
    "XXXXXXXXXXXXXXXYYXXX",
    "XXXXXXXXXXXXXXXYYXXX",
    "XYYYYYYYYYYYYYYYYXXX",
    "XYYYYYYYYYYYYYYYYXXX",
    "XYYXXXXXXXXXXXXXXXXX",
    "XYYXXXXXXXXXXXXXXXXX",
    "XYYYYYYYYYYYYYFFFFFX",
    "XYYYYYYYYYYYYYFFFFFX",
    "XXXXXXXXXXXXXXFFFFFX",
    "XXXXXXXXXXXXXXXXXXXX"],
    objs:[['ladder',1,1],['lever',18,2,1,1,'lever1'],['shutter',9,6,1,2,'lever1'],['panel',17,10,1,1,'power'],['train',14,12,4,1]],
    signs:{'17,10':[['','配電盤だ。']]},
    warps:{'1,1':{to:'kasumi',x:3,y:15,dir:'up',msg:'はしごを登って、地上に出た。'}},
    spawn:{x:2,y:2,dir:'down'}},
  haibiru:{town:'kasumi',name:'廃ビル 最上階',field:'biru',ground:'floor',enc:'Q',rate:.25,rows:[
    "XXXXXXXXXXXXXXX",
    "XXXXXXFFFXXXXXX",
    "XXXXXFFFFFXXXXX",
    "XFFFFFQQQFFFFFX",
    "XFQQFFFQFFFQQFX",
    "XFQFFOOFOOFFQFX",
    "XFFFFOOFOOFFFFX",
    "XFQQFFFQFFFQQFX",
    "XFFFQFFFFFQFFFX",
    "XFQFFFFQFFFFQFX",
    "XFFFFFQFQFFFFFX",
    "XXXXXXFFFXXXXXX",
    "XXXXXXXFXXXXXXX"],
    objs:[],
    warps:{'7,12':{to:'roji',x:8,y:2,dir:'down'}},
    npcs:[{id:'nushi',x:7,y:2,dir:'down',look:'boss',sp:'jorou',text:'吹き抜けに張られた金色の巣。その中心で、大蜘蛛が八つの目を光らせた！'}],
    items:{'1,3':'makimono','13,10':'drink'},
    spawn:{x:7,y:11,dir:'up'}},
  /* ---- 潮見浜 ---- */
  shiomi:{town:'shiomi',name:'潮見浜',ground:'city',fish:{lv:[17,22],table:[['nyaame',3],['kurageru',3],['iroumiushi',2],['fukuredoku',2]]},rows:[
    "tttttttttttttttttt",
    "==================",
    "------------------",
    "tSSSSS.......SSSSt",
    "tSSSSS.......SSSSt",
    "tSSSSSSSSSSSSSSSSt",
    "t.....SSSS....SSSt",
    "t.....SSSS....SSSt",
    "t.....SSSS....SSSt",
    "SSSSSSSSSSSSSSSSSS",
    "tSSSSSSSSSSSSSSSSt",
    "tNNNNNNNNNNNNNNNNt",
    "tNNNNNNNNNNNNNNNNt",
    "~~~~~~~~~~~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~"],
    objs:[['station',6,3,7,2],['bath',1,6,5,3],['house',10,6,4,3],['bench',4,10],['board',12,10],['lighthouse',16,11],['lamp',5,4],['lamp',13,4],['lamp',8,10],['parasol',3,12]],
    doors:{'9,4':'station','2,8':'sauna','11,8':[['灯台守のシオリ','いらっしゃい。ここは灯台守の家よ。'],['シオリ','朝と夕方は潮が満ちて、昼と夜は引くの。引き潮のときは、砂浜の先の小島まで歩いて渡れるわ。']],'12,10':'board'},
    signs:{'17,10':[['','→ 夜の漁港']],'0,10':[['','← 砂浜と磯']]},
    warps:{'0,9':{to:'hama',x:18,y:4,dir:'left'},'17,9':{to:'gyokou',x:1,y:4,dir:'right'}},
    npcs:[{id:'aoi',x:9,y:10,dir:'down',look:'aoi'},{id:'keeper',x:6,y:11,dir:'down',look:'clerk',lines:[['水族館の飼育員','海の魔生物は、雷の技に弱いものが多いんです。'],['飼育員','砂浜からでも釣りはできますよ。釣りざおがあれば、ですけど。']]},
      {id:'kid',x:13,y:12,dir:'up',look:'kid',lines:[['少年','夜になると、灯台の光がぐるぐる回るんだ！'],['少年','あの光で、大潮の夜に上がってくる大蟹を見張ってるんだって。']]}],
    spawn:{x:9,y:5,dir:'down'},station:{x:9,y:5,dir:'down'}},
  hama:{town:'shiomi',name:'砂浜と磯',field:'hama',ground:'sand',enc:'EU',rate:.1,tideSafe:{x:9,y:4,dir:'up'},fish:{lv:[17,22],table:[['nyaame',3],['kurageru',3],['iroumiushi',2],['fukuredoku',2]]},rows:[
    "tttttttttttttttttttt",
    "tNNNNNNNNNNNNNNNNNNt",
    "tNEEENNNNNNNEEENNNNt",
    "tNEEEENNNNNEEEEENNNt",
    "tNNNNNNNNNNNNNNNNNNN",
    "tNNEErrNNNNNrrEENNNt",
    "~~NNUUUUUUUUUUUUNN~~",
    "~~~UUUUUUUUUUUUUU~~~",
    "~~~UUU~~~~~~~UUUU~~~",
    "~~~UUU~~~~~~~~UUU~~~",
    "~~~UUUUU~~~~~UUUU~~~",
    "~~~~~~UU~~~~UUU~~~~~",
    "~~~~~rNNr~~~UU~~~~~~",
    "~~~~~rNNr~~rNNNNr~~~",
    "~~~~~rrrr~~rNNNNr~~~",
    "~~~~~~~~~~~rrNrrr~~~"],
    objs:[['pool',3,2],['pool',13,3],['pool',15,2],['sign',18,5],['cave',13,15],['shell',6,13]],
    signs:{'18,5':[['','潮見浜の干潟 ／ 朝と夕方は潮が満ちます。沖の小島へは、引き潮(昼・夜)のときに']]},
    warps:{'19,4':{to:'shiomi',x:1,y:9,dir:'right'},'13,15':{to:'doukutsu',x:7,y:12,dir:'up',need:'boss:shiomi',lock:'洞窟の入口は、大きな波にあらわれていて近づけない。漁港の大蟹が鎮まれば……'}},
    items:{'7,12':'kai','15,14':'tsuki'},
    spawn:{x:18,y:4,dir:'left'}},
  gyokou:{town:'shiomi',name:'夜の漁港',field:'gyokou',ground:'city',enc:'K',rate:.06,fish:{lv:[20,26],table:[['utsuboyami',3],['chouchin',2,'n'],['happoudako',1.5],['kurageru',2],['fukuredoku',2],['rurione',.3,'n']]},rows:[
    "tttttttttttttttttt",
    "t....SSSS....SSSSt",
    "t....SSSS....SSSSt",
    "t....SSSSSSSSSSSSt",
    "SSSSSSSSSSSSSSSSSt",
    "tSSSSSSSSSSSSSSSSt",
    "tKKKKKKKKKKKKKKKKt",
    "~~KK~~~~KK~~~~KK~~",
    "~~KK~~~~KK~~~~KK~~",
    "~~KK~~~~KK~~~~KK~~",
    "~~KK~~~~KK~~~~KK~~",
    "~~KKKK~~KK~~~~KK~~",
    "~~~~~~~~KK~~~~~~~~",
    "~~~~~~~~~~~~~~~~~~"],
    objs:[['soko',1,1,4,3],['stall',9,1,4,2],['crate',3,5],['crate',14,5],['crate',15,5],['boat',5,8,2,1],['boat',11,9,2,1],['lamp',6,5],['lamp',12,5],['lamp',9,12]],
    signs:{'0,5':[['','← 潮見浜']]},
    doors:{'10,2':[['魚屋','へいらっしゃい！ 今朝あがったばかりの魚だよ！'],['魚屋','……え、魔生物はいないのかって？ 夜の桟橋のほうが、よく釣れるって話だ。']]},
    warps:{'0,4':{to:'shiomi',x:16,y:9,dir:'left'}},
    npcs:[{id:'kenji',x:7,y:5,dir:'down',look:'salary'},{id:'gen',x:13,y:4,dir:'down',look:'kid',lines:[['漁師のゲン','大潮の夜にはな、桟橋の先に、とんでもなくでかい蟹が上がってくるんだ。'],['ゲン','昼間に行っても、影もかたちもないぞ。']]},
      {id:'nushi',x:8,y:12,dir:'up',look:'boss',sp:'takaashi',night:true,text:'満月の大潮。桟橋の灯りの下に、脚を広げた巨大な影が上がってきた！'}],
    spawn:{x:1,y:4,dir:'right'}},
  doukutsu:{town:'shiomi',name:'灯台下の海蝕洞',field:'doukutsu',ground:'cave',enc:'C',rate:.08,dark:'never',dim:true,rows:[
    "VVVVVVVVVVVVVVVV",
    "VVVVVVCCCCVVVVVV",
    "VVVVVVCCCCVVVVVV",
    "VVVVVVVVOVVVVVVV",
    "VVVVVVVVOVVVVVVV",
    "VVCCCCCCCCCCCCVV",
    "VVCC~~CCCCC~~CVV",
    "VVCC~~CCCCCCCCVV",
    "VVCCCCCCCCCCCCVV",
    "VVCCCCCCCCCCCCVV",
    "VVCCC~~CCCC~~CVV",
    "VVCCCCCCCCCCCCVV",
    "VVVVVVVCCVVVVVVV",
    "VVVVVVVCCVVVVVVV"],
    objs:[['chest',7,1,1,1,'chest1'],['stele',9,1]],
    rocks:[[8,7],[8,9],[11,9],[4,8]],
    signs:{'9,1':[['','古い石碑だ。「深き海より来たるものは、灯台の光を目じるしに帰る」と刻まれている。']],'7,5':[['','足もとに大きな穴がある。岩で埋めれば通れそうだ。']]},
    warps:{'7,13':{to:'hama',x:13,y:14,dir:'up'},'8,13':{to:'hama',x:13,y:14,dir:'up'}},
    spawn:{x:7,y:12,dir:'up'}},
  /* ---- 天狗岳 ---- */
  tengu:{town:'tengu',name:'天狗岳 門前町',ground:'grass',rows:[
    "tttttttttttttttttt",
    "==================",
    "------------------",
    "tPPPPP.......PPPPt",
    "tPPPPP.......PPPPt",
    "tPPPPPPPPPPPPPPPPt",
    "t.....PPPP....PPPt",
    "t.....PPPP....PPPt",
    "t.....PPPP....PPPt",
    "tPPPPPPPPPPPPPPPPt",
    "tGG**GGGPPGGG**GGt",
    "tGGGGGGGPPGGGGGGGt",
    "tttttttGPPGttttttt",
    "ttttttttPPtttttttt"],
    objs:[['station',6,3,7,2],['shukubo',1,6,5,3],['chaya',10,6,4,3],['board',4,10],['torii',7,12,4,1],['lamp',5,4],['lamp',13,4],['lamp',7,9]],
    doors:{'9,4':'station','2,8':'sauna','11,8':[['茶屋のおかみ','いらっしゃい。お山にのぼる前に、お団子はいかが？'],['おかみ','参道は霧が深いからね。迷ったら、お地蔵さまの見ているほうへ進むんだよ。'],['おかみ','吊り橋は、木の葉が舞いはじめたら風が来る合図。渡るのは、風がやんでからにおし。']],'4,10':'board'},
    signs:{'9,11':[['','↓ 杉林の参道 ／ 天狗岳 奥宮']]},
    warps:{'8,13':{to:'sando',x:8,y:22,dir:'up'},'9,13':{to:'sando',x:8,y:22,dir:'up'}},
    npcs:[{id:'aoi',x:12,y:9,dir:'down',look:'aoi'},{id:'yamabushi',x:15,y:5,dir:'left',look:'salary',lines:[['山伏ゲンカイ','喝！ この山は、心の迷いがそのまま霧になるという。'],['ゲンカイ','奥宮の灯籠は、石碑にきざまれた順に灯せ。順をまちがえれば、狐に笑われるぞ。']]},
      {id:'photo',x:6,y:11,dir:'right',look:'kid',lines:[['山岳写真家','霧の朝の参道は最高の被写体だよ。何も見えないけどね！'],['写真家','渓流の中州には、だれかの落とし物があったな。飛び石を伝えば行けるよ。']]}],
    spawn:{x:9,y:5,dir:'down'},station:{x:9,y:5,dir:'down'}},
  sando:{town:'tengu',name:'杉林の参道',field:'sando',ground:'forest',enc:'T',rate:.09,fog:true,rows:[
    "tttPtttttttttttt",
    "tttPttttPtttPttt",
    "tttPttttPtttPttt",
    "tttPttttPtttPttt",
    "ttTPTtttPtttPTtt",
    "ttTPTTTTPTTTPTtt",
    "ttGGGGGGGGGGGGtt",
    "ttGGGGGGGGGGGGtt",
    "ttGGGGGGGGGGGGtt",
    "ttttttttttttPttt",
    "tttPttttPtttPttt",
    "tttPttttPtttPttt",
    "ttTPTtttPtttPTtt",
    "ttTPTTTTPTTTPTtt",
    "ttTPTTTTPTTTPTtt",
    "ttGGGGGGGGGGGGtt",
    "ttGGGGGGGGGGGGtt",
    "ttGGGGGGGGGGGGtt",
    "ttTTTTTTPTTTTTtt",
    "ttTTTTTTPTTTTTtt",
    "ttttttTTPTTttttt",
    "ttttttTTPTTttttt",
    "ttttttttPttttttt",
    "ttttttttPttttttt"],
    objs:[['jizo',7,7,1,1,'left'],['jizo',9,16,1,1,'right'],['sign',9,21]],
    signs:{'9,21':[['','杉林の参道 ／ 霧の深い日は、お地蔵さまの見つめる方へ進むべし']]},
    warps:{'8,23':{to:'tengu',x:8,y:12,dir:'up'},'3,0':{to:'keiryu',x:9,y:14,dir:'up'},
      '3,10':{to:'sando',x:8,y:18,dir:'up',msg:'霧の中を歩いていたら、もとの場所にもどってきてしまった……'},'8,10':{to:'sando',x:8,y:18,dir:'up',msg:'霧の中を歩いていたら、もとの場所にもどってきてしまった……'},
      '8,1':{to:'sando',x:12,y:9,dir:'up',msg:'霧の中を歩いていたら、もとの場所にもどってきてしまった……'},'12,1':{to:'sando',x:12,y:9,dir:'up',msg:'霧の中を歩いていたら、もとの場所にもどってきてしまった……'}},
    items:{'2,7':'tea','13,16':'drink'},
    spawn:{x:8,y:22,dir:'up'}},
  keiryu:{town:'tengu',name:'渓流の吊り橋',field:'keiryu',ground:'grass',enc:'T',rate:.1,wind:true,rows:[
    "tttttttttPtttttttt",
    "tttTTTTGGPGGTTTTtt",
    "ttTTTTGGGPGGGTTTTt",
    "ttTTGGGGGPGGGGGTTt",
    "tGGGGGGGGPGGGGGGGt",
    "tbbbbbbbbPbbbbbbbt",
    "wwwwwwwwwHwwwwwoww",
    "wwwwwwwwwHwwwwbbbw",
    "wwwwwwwwwHwwwwbbbw",
    "wwwwwwwwwHwwwwwoww",
    "tbbbbbbbbPbbbbbbbt",
    "tGGGGGGGGPGGGGGGGt",
    "ttTTTGGGGPGGGGTTTt",
    "ttTTTTGGGPGGGTTTTt",
    "tttTTTTGGPGGTTTTtt",
    "tttttttttPtttttttt"],
    objs:[['fall',1,6,2,4],['sign',10,11]],
    signs:{'10,11':[['','渓流の吊り橋 ／ 強風注意。木の葉が舞いはじめたら、渡るのをひかえること']]},
    warps:{'9,15':{to:'sando',x:3,y:1,dir:'down'},'9,0':{to:'okumiya',x:7,y:13,dir:'up'}},
    items:{'16,8':'makimono'},
    npcs:[{id:'kappa',x:14,y:8,dir:'right',look:'kid',lines:[['釣り人','やあ、飛び石を渡ってきたのかい。'],['釣り人','この川の吊り橋は、風がやむまで待てば、なんてことないさ。']]}],
    spawn:{x:9,y:14,dir:'up'}},
  okumiya:{town:'tengu',name:'奥宮への石段',field:'okumiya',ground:'grass',enc:'T',rate:.1,rows:[
    "ttttt.....ttttt",
    "ttttt.....ttttt",
    "tttttGGGGGttttt",
    "ttttttGLGtttttt",
    "ttTTTTGLGTTTTtt",
    "ttTGGGGLGGGGTtt",
    "ttTGGLLLLLGGTtt",
    "ttTGGLLLLLGGTtt",
    "ttTGGLLLLLGGTtt",
    "ttTGGLLLLLGGTtt",
    "ttTGGLLLLLGGTtt",
    "ttTTTGGLGGTTTtt",
    "ttTTTTGLGTTTTtt",
    "tttTTTGLGTTTttt",
    "tttttttLttttttt"],
    objs:[['honden',5,0,5,2],['barrier',6,3,3,1,'kitsune'],['toro',7,6,1,1,'N'],['toro',7,10,1,1,'S'],['toro',5,8,1,1,'W'],['toro',9,8,1,1,'E'],['stele',11,9]],
    signs:{'11,9':[['','古い石碑だ。'],['','「狐火は 日ののぼる方より しずむ方へ。ふもとを照らし、いただきに至る」']]},
    warps:{'7,14':{to:'keiryu',x:9,y:1,dir:'down'}},
    npcs:[{id:'nushi',x:7,y:2,dir:'down',look:'boss',sp:'kokonobi',text:'奥宮の鳥居の向こうで、九本の尾に狐火が灯った！'}],
    spawn:{x:7,y:13,dir:'up'}},
  /* ---- マヨイガ ---- */
  mayoiga:{town:'mayoiga',name:'迷い家の里',ground:'grass',rows:[
    "tttttttttttttttttt",
    "==================",
    "------------------",
    "tPPPPP.......PPPPt",
    "tPPPPP.......PPPPt",
    "PPPPPPPPPPPPPPPPPP",
    "t.....GPPG.....GGt",
    "t.....GPPG.....GGt",
    "t.....GPPG.....GGt",
    "tPPPPPPPPPPPPPPPPt",
    "tGG**GGGPPGGG**GGt",
    "tGGGGGGGPPGGGGGGGt",
    "tttttttGPPGttttttt",
    "ttttttttPPtttttttt"],
    objs:[['station',6,3,7,2],['bath',1,6,5,3],['kominka',10,6,5,3],['board',15,10],['torii',7,12,4,1],['lamp',5,4],['lamp',13,4],['lamp',7,9],['lamp',11,9]],
    doors:{'9,4':'station','2,8':'sauna','12,8':'yashiki','15,10':'board'},
    signs:{'0,6':[['','← 霧の竹林']],'9,11':[['','↓ 千本鳥居 ／ 鳥居をくぐるあいだ、けっして後ろをふり返ってはならない']]},
    warps:{'0,5':{to:'chikurin',x:16,y:12,dir:'left'},'17,5':{to:'kagami',x:1,y:10,dir:'right'},'8,13':{to:'senbon',x:5,y:1,dir:'down'},'9,13':{to:'senbon',x:5,y:1,dir:'down'}},
    npcs:[{id:'aoi',x:13,y:9,dir:'down',look:'aoi'},{id:'fox',x:5,y:10,dir:'right',look:'fox',lines:[['狐の面の子','……人の子？ めずらしいね。'],['狐の面の子','竹林の輪っかは、ぼくらの通り道。輪から輪へ、ひとっとびさ。'],['狐の面の子','夜になると、竹林の奥で一本だけ光る竹があるよ。']]},
      {id:'oldman',x:16,y:7,dir:'left',look:'obaa',lines:[['里の古老','この里の屋敷は、ふすまを開けるたびに、ちがう部屋が現れる。'],['古老','座敷わらしに会えたら、運がいいぞ。']]}],
    spawn:{x:9,y:5,dir:'down'},station:{x:9,y:5,dir:'down'}},
  yashiki:{town:'mayoiga',name:'迷い家の屋敷',ground:'floor',rows:[
    "JJJJJJJJJJJJJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JJJJJJMJJJJJJ"],
    objs:[['irori',5,3,3,2],['tokonoma',1,1,2,1],['fusuma',6,0]],
    doors:{'6,0':'fusuma'},
    signs:{'1,1':[['','床の間に、季節はずれの花が生けてある。']]},
    warps:{'6,7':{to:'mayoiga',x:12,y:9,dir:'down'}},
    spawn:{x:6,y:6,dir:'up'}},
  okunoma:{town:'mayoiga',name:'奥の間',ground:'floor',rows:[
    "JJJJJJJJJJJJJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JMMMMMMMMMMMJ",
    "JJJJJJMJJJJJJ"],
    objs:[['fusuma',6,0],['zen',6,3,1,1,'zen',,'feast'],['kakejiku',3,0,1,1,'',,'scroll'],['tokonoma',9,1,2,1]],
    doors:{'6,0':'fusuma'},
    warps:{'6,8':{to:'yashiki',x:6,y:1,dir:'down'}},
    npcs:[{id:'warashi',x:6,y:3,dir:'down',look:'warashi',room:'zashiki'}],
    spawn:{x:6,y:7,dir:'up'}},
  chikurin:{town:'mayoiga',name:'霧の竹林',field:'chikurin',ground:'forest',enc:'T',rate:.1,rows:[
    "qqqqqqqqqqqqqqqqqq",
    "qTTTTqqqqqqqTTTTTq",
    "qTggTqqqqqqqTgggTq",
    "qTggTqqqqqqqTgggTq",
    "qTTTTqqqqqqqTgggTq",
    "qqqqqqqqqqqqTTTTTq",
    "qqqqqqgggggqqqqqqq",
    "qqqqqqgTTTgqqqqqqq",
    "qqqqqqgTTTgqqqqqqq",
    "qqqqqqgggggqqqqqqq",
    "qqqqqqqqqqqqgggggq",
    "qqqqqqqqqqqqgTTTgq",
    "qqqqqqqqqqqqgTTTgg",
    "qqqqqqqqqqqqgggggq",
    "qqqqqqqqqqqqqqqqqq"],
    objs:[['ring',13,10],['ring',8,6],['ring',6,9],['ring',13,1],['ring',16,5],['ring',2,2],['ring',16,1],['ring',12,13],['kaguya',3,3,1,1,'kaguya'],['sign',16,10]],
    rings:[[13,10,8,6],[6,9,13,1],[16,5,2,2],[16,1,12,13]],
    signs:{'16,10':[['','竹林の狐の輪 ／ 輪から輪へ、狐が道をつないでいる']]},
    warps:{'17,12':{to:'mayoiga',x:1,y:5,dir:'right'}},
    items:{'14,3':'tane','9,8':'tea'},
    spawn:{x:16,y:12,dir:'left'}},
  kagami:{town:'mayoiga',name:'鏡の湖',field:'kagami',ground:'grass',enc:'T',rate:.1,rows:[
    "tttttttttttttttt",
    "tGGGGTTTTTTGGGGt",
    "tGTTGWWWWWWGTTGt",
    "tGTTWWWWWWWWTTGt",
    "tGGWWWWWWWWWWGGt",
    "tGGWWWWGGWWWWGGt",
    "tGTWWWWGGWWWWTGt",
    "tGTTWWWWWWWWTTGt",
    "tGGGTWWWWWWTGGGt",
    "tGGGGGGGGGGGGGGt",
    "PGGGGGGGGGGGGGGt",
    "tTTTTGGGGGGTTTTt",
    "tTTTTGGGGGGTTTTt",
    "tttttttttttttttt"],
    objs:[['mirror',7,9]],
    doors:{'7,9':'mirror'},
    warps:{'0,10':{to:'mayoiga',x:16,y:5,dir:'left'}},
    npcs:[{id:'kappa2',x:3,y:9,dir:'right',look:'kid',lines:[['河童の子','湖のまん中の島に、なにか光ってるだろ。'],['河童の子','こっちの湖からは渡れないけど……鏡の中の湖なら、どうかな？']]}],
    spawn:{x:1,y:10,dir:'right'}},
  senbon:{town:'mayoiga',name:'千本鳥居',field:'senbon',ground:'forest',enc:'T',rate:.1,noLook:[3,17],rows:[
    "tttttPttttt",
    "ttttGPGtttt",
    "ttttGPGtttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "tttttLttttt",
    "ttttLLLtttt",
    "tttGLLLGttt",
    "tttttLttttt",
    "tTTGGLGGTTt",
    "tTTTGLGTTTt",
    "tTTTGLGTTTt",
    "tTTGGLGGTTt",
    "tGGGGLGGGGt",
    "kkkkkkkkkkk"],
    objs:[['torii',4,4,3,1],['torii',4,6,3,1],['torii',4,8,3,1],['torii',4,10,3,1],['torii',4,12,3,1],['torii',4,14,3,1],['torii',4,16,3,1]],
    warps:{'5,0':{to:'mayoiga',x:8,y:12,dir:'up'}},
    npcs:[{id:'nushi',x:5,y:19,dir:'up',look:'boss',sp:'nue',text:'千本鳥居の奥。虎の手足と蛇の尾をもつ影が、トラツグミの声で鳴いた！'},
      {id:'ura',x:5,y:24,dir:'up',look:'boss',sp:'sorakujira',ura:true,text:'雲の海を、山より大きな影がゆっくりと泳いでいく……！'}],
    spawn:{x:5,y:1,dir:'down'}},
  /* ---- 流氷岬 ---- */
  ryuhyo:{town:'ryuhyo',name:'流氷岬',ground:'snow',fish:{lv:[56,62],table:[['wakasagin',3],['hoyaboya',2],['gomafu',1.5],['kooriyuurei',1,'n'],['rurione',.4]]},rows:[
    "tttttttttttttttttttttt",
    "======================",
    "----------------------",
    "tPPPPPP.......PPPPPPPt",
    "tPPPPPP.......PPPPPPPt",
    "PPPPPPPPPPPPPPPPPPPPPP",
    "t.....GPPG.....GGGGGGt",
    "t.....GPPG.....GiiiiGt",
    "t.....GPPG.....GilliGt",
    "tPPPPPPPPPPPPPPGiiiiGt",
    "tGGGGGGGPPGGGGGGiiiiGt",
    "tGGGGGGGPPGGGGGGGGGGGt",
    "ttttGGGGPPGGGGGGrrrrrt",
    "~~~~~~GGPPGG~~~~~rr~~~",
    "~~~~~~~~~~~~~~~~~~~~~~"],
    objs:[['station',7,3,7,2],['bath',1,6,5,3],['banya',10,6,5,3],['board',14,10],['lighthouse',18,12],['bench',10,13],['lamp',5,4],['lamp',15,4],['lamp',6,11],['lamp',11,11]],
    doors:{'10,4':'station','2,8':'sauna','12,8':[['番屋の親方','よう、寒かったべ。まあ、あたっていけ。'],['親方','原生林は焚き火から焚き火へ渡っていくんだ。体が冷えきったら、最後にあたった焚き火の前で目をさますことになる。'],['親方','雪玉は、クレバスにころがし落とせば橋になる。ただ、かべにくっつけたら二度と動かねえ。そのときは森を出なおすことだ。']],'14,10':'board'},
    signs:{'0,6':[['','← 雪の原生林 ／ 猛吹雪に注意']],'21,6':[['','→ 流氷の海 ／ 流氷は朝昼と夕夜で、流れつく場所が変わる']]},
    warps:{'0,5':{to:'genseirin',x:28,y:23,dir:'left'},'21,5':{to:'hyoukai',x:1,y:2,dir:'right'}},
    npcs:[{id:'aoi',x:12,y:10,dir:'down',look:'aoi'},{id:'turibito',x:20,y:9,dir:'left',look:'parka',lines:[['穴釣りの男','池の氷はつるっつるだ。いっぺんすべり出したら、何かにぶつかるまで止まらねえよ。'],['穴釣りの男','穴の前でうまく止まれたら、Aで糸をたらしてみな。ワカサギンがよく釣れる。']]},
      {id:'azarashi',x:18,y:3,dir:'down',look:'parka',lines:[['アザラシ保護センターの職員','流氷の海へ行くなら、朝昼と夕夜で道がちがうことを覚えておいて。'],['職員','岸から沖へ流れてくる流氷は、朝と昼。沖の王者のいる氷原へつながるのは、夕方と夜よ。'],['職員','岸のベンチで海をながめていると、時間がたつのを忘れちゃうわ。']]},
      {id:'kid2',x:3,y:11,dir:'right',look:'kid',lines:[['雪国の子','ふかい雪の中は、歩くのがおそくなるし、すぐ体が冷えちゃうんだ。'],['雪国の子','ときどき、まっ白な地吹雪がくるよ。何も見えなくなるから気をつけて！']]}],
    spawn:{x:10,y:5,dir:'down'},station:{x:10,y:5,dir:'down'}},
  genseirin:{town:'ryuhyo',name:'雪の原生林',field:'genseirin',ground:'snow',enc:'Ty',rate:.09,cold:70,blizzard:true,rows:[
    "tttttttttttttPPttttttttttttttt",
    "tttttttttttttPPttttttttttttttt",
    "ttttttttttttGPPGtttttttttttttt",
    "tttTTTTtttGGGPPGGGtttttyyyyttt",
    "ttTTGGTTttGGGGGGGGGtttyyyyyytt",
    "ttTGGGGTTTGGtttGGGGGyyyGGyyytt",
    "ttTTGGGGGGGGtttGGGGyyyGGGGyytt",
    "tttTTTTtttttttttGGyyytttGGyytt",
    "tttttttttttttttttGGyttttttyytt",
    "tttyyyyyyyyyyyyyyGGyyyttttyytt",
    "ttyyyyGGGGGGGGGGGGGyyytttyyytt",
    "ttyyGGGGGGGGGGGGGGGGyyttyyyytt",
    "tOOOOOOOOOOOOOOOOOOOOOOtyyyytt",
    "tGGGGGGGGGGGGGGGGGGGGGGtyyyytt",
    "tGGTTTTGGGGGGGGGGTTTTGGtyyyytt",
    "tGTTTTTTGGGtGGGGTTTTTTGtyyyytt",
    "tGTTTTTTGGtttGGGTTTTTTGtyyyytt",
    "tGGTTTTGGGGtGGGGGTTTTGGGyyyytt",
    "ttGGGGGGGGGGGGGGGGGGGGGGGyyGtt",
    "tttttttGGttttttttGGttttGGGGGGt",
    "tyyyyttGGtttTTTTTGGTTTTTGGGGGt",
    "tyyyyyyGGttTTTTTTGGTTTTTTGGGGt",
    "tyyGGyyGGttTTGGGGGGGGGTTTGGGGt",
    "tyGGGGyyyyyyyyGGGGGGGGGGGGPPPP",
    "tyyGGyyyyyyyyyGGTTTTGGGGGGGGGt",
    "ttyyyyyttttttTTTTTTTTTTTGGGGGt",
    "tttttttttttttttttttttttttttttt"],
    objs:[['takibi',27,21],['takibi',9,17],['takibi',11,4],['onsen',3,22,2,1],['icefall',4,4,2,1],['sign',28,24],['sign',15,2]],
    rocks:[[14,15]],
    signs:{'28,24':[['','雪の原生林 ／ 体が冷えきる前に、焚き火であたたまること(Aで調べる)'],['','ふかい雪は、ふつうの倍、体が冷える']],'15,2':[['','↑ オーロラの丘 ／ 流氷の王者が鎮まるまで、この先は猛吹雪']]},
    warps:{'29,23':{to:'ryuhyo',x:1,y:5,dir:'right'},'13,0':{to:'okanoue',x:11,y:22,dir:'up',need:'boss:ryuhyo',lock:'ゴオオオ……！ 猛吹雪で、一歩も先へ進めない。(流氷の王者を鎮めると、おさまるらしい)'},'14,0':{to:'okanoue',x:11,y:22,dir:'up',need:'boss:ryuhyo',lock:'ゴオオオ……！ 猛吹雪で、一歩も先へ進めない。(流氷の王者を鎮めると、おさまるらしい)'}},
    items:{'26,3':'saino','4,6':'tane','1,24':'kakusei','20,14':'tea','2,10':'drink'},
    npcs:[{id:'matagi',x:26,y:22,dir:'left',look:'matagi',lines:[['マタギのじいさん','この森はな、クレバスが東西にぱっくり口をあけておる。'],['じいさん','東のふかい雪を大回りすれば向こうへ出られるが、凍えちまうぞ。'],['じいさん','雪原のどこかに雪玉がある。クレバスにころがし落とせば、近道ができるんじゃ。'],['じいさん','南西のすみには、だれも知らん秘湯がある。ふかい雪をこいでいく元気があればな。']]}],
    spawn:{x:28,y:23,dir:'left'}},
  hyoukai:{town:'ryuhyo',name:'流氷の海',field:'hyoukai',ground:'snow',enc:'Tyav',rate:.08,cold:70,floes:true,tideSafe:{x:3,y:3,dir:'down'},fallTo:{x:24,y:20,dir:'down'},
    fish:{lv:[60,66],table:[['gomafu',3],['wakasagin',2],['hoyaboya',2],['todoroki',1],['kooriyuurei',1.5,'n'],['rurione',.6]]},rows:[
    "tttttttttttttttttttttttttttt",
    "tGGGTTTGGGGGGGGGGGGGTTTGGGGt",
    "PPPPPPPPPPPPPPPPPPPPPPPPPGGt",
    "tGGGGGGGGTTTGGlGGGGGyyyGGGGt",
    "rrrGrrrrrrrrrrrrrrrrrrrrGrrr",
    "~~~a~~~~~~~~~~~~~~~~~~~~v~~~",
    "~~~aa~~~~~~~~~~~~~~~~~~vv~~~",
    "~~~~a~~~~~~~~~~~~~~~~~~v~~~~",
    "~~~~aa~~~~~~~~~~~~~~~~vv~~~~",
    "~~~~~a~~~~~~~~~~~~~~~~v~~~~~",
    "~~~aaa~~~~~~~~~~~~~~~GGG~~~~",
    "~~~G~~~~~~~~~~~~~~~~~~~~~~~~",
    "~~~Giiiiriiiiriiriiiiirii~~~",
    "~~~riiiiiiiiriiiriiiiiiii~~~",
    "~~~iiriiiiiriiiiiiiiiiiii~~~",
    "~~~iiriiiiiiiiiriiiiriiii~~~",
    "~~~iiiiiririiiiirriiiiiir~~~",
    "~~~iiiiiiiiiriiiiiiriiiii~~~",
    "~~~iiiiriiiiiiiiriiiiiiii~~~",
    "~~~iiiriiiiriiiiririiiiiGG~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~GG~~",
    "~~~~~~~~~~~~~~~~~~~~~~~~v~~~",
    "~~~~~~~~~~~~~~~~~~~~~~vvv~~~",
    "~~~~~~~~~~~~~~~~~~~~~~v~~~~~",
    "~~~~~~~~~~~~~~~~~~vvvvv~~~~~",
    "~~~~~~~~~~~~~~~~~~v~~~~~~~~~",
    "~~~~~~uuuuuuu~uuuuu~~~~~~~~~",
    "~~~~~~u~~u~~u~u~~~u~~~~~~~~~",
    "~~~~~~u~uuu~uuu~~~u~~~~~~~~~",
    "~~~~~~u~u~~~~~~~~~u~~~~~~~~~",
    "tGGGGGGGGG~~~~~~~~~~~~~~~~~~",
    "tGGGGGGGGl~~~~~~~~~~~~~~~~~~",
    "t~~~~~~~~~~~~~~~~~~~~~~~~~~~"],
    objs:[['takibi',6,1],['bench',10,1],['sign',2,3],['bench',25,20],['takibi',25,19],['takibi',2,30],['ferry',3,32,2,1]],
    signs:{'2,3':[['','流氷の海 ／ 沖の氷原は、すべる氷。いっぺんすべると止まれない'],['','氷原の先、王者の海へは、夕方と夜の流氷だけがつながっている']]},
    warps:{'0,2':{to:'ryuhyo',x:20,y:5,dir:'left'}},
    items:{'23,10':'kettou','16,1':'drink'},
    npcs:[{id:'nushi',x:8,y:31,dir:'up',look:'boss',sp:'sakamata',text:'流氷が割れる音。巨大な背びれが、氷の海を切り裂いて近づいてくる！'},
      {id:'gyofu',x:21,y:1,dir:'down',look:'parka',lines:[['流氷の老漁師','沖の氷原の先に、うすい氷の道がある。'],['老漁師','うすい氷は、いっぺん通ったところをもう一度ふむと割れるぞ。行き止まりに入りこんだら、引き返せねえ。']]}],
    spawn:{x:1,y:2,dir:'right'}},
  okanoue:{town:'ryuhyo',name:'オーロラの丘',field:'okanoue',ground:'snow',enc:'Ty',rate:.1,cold:60,aurora:true,fallTo:{x:11,y:14,dir:'up'},thinPrize:{flag:'hyouko',items:{saino:2}},rows:[
    "tttttttttttttttttttttttt",
    "ttttttttGGGGGGGGtttttttt",
    "tttttttGGGGGGGGGGttttttt",
    "ttttttttGGGGGGGGtttttttt",
    "tttttttttttvvttttttttttt",
    "OOOOOOOOOOOvvOOOOOOOOOOO",
    "tttttttttttvvttttttttttt",
    "tttttGGGGGGGGGGGGGGttttt",
    "ttttttttGrrrrrrrtttttttt",
    "ttttrrrruuuruuuurrrrtttt",
    "ttttrrrruuuuuuuurrrrtttt",
    "ttttrrrruuuuruuurrrrtttt",
    "ttttrrrruuuuuuuurrrrtttt",
    "ttttrrrruuuuuuuurrrrtttt",
    "tttttGGGGGGPGGGGGGGttttt",
    "ttttTTGGGGGPGGGGTTTTtttt",
    "tttTTTTyyyyyyyyyTTTTTttt",
    "ttTTTyyyyyyyyyyyyyTTTttt",
    "ttTTyyyyGGGPGGGyyyyTTttt",
    "tttTTyyyGGGPGGGyyyTTtttt",
    "ttttTTTGGGGPGGGGTTTttttt",
    "tttttTTTGGGPGGGTTTtttttt",
    "ttttttttGGGPGGGttttttttt",
    "tttttttttttPtttttttttttt"],
    objs:[['takibi',9,19],['takibi',15,6],['bench',6,7],['sign',13,14]],
    signs:{'13,14':[['','凍った湖 ／ 氷がうすい。同じ所を2度ふむと割れる'],['','「湖のすべての氷を一度ずつ鳴らした者に、湖は宝をさずける」']]},
    warps:{'11,23':{to:'genseirin',x:13,y:1,dir:'down'}},
    items:{'16,2':'tenpu'},
    npcs:[{id:'ura',x:12,y:1,dir:'down',look:'boss',sp:'amanotsuru',ura:true,eve:true,text:'オーロラの幕が割れ、天の川から白い鶴が舞い降りてきた！'},
      {id:'hoshimi',x:18,y:7,dir:'left',look:'kid',lines:[['星見の旅人','オーロラは夕方から夜にしか出ないんだ。'],['旅人','オーロラが出ると、クレバスの上に光の橋がかかるんだって。ベンチで待ってみたら？']]}],
    spawn:{x:11,y:22,dir:'up'}},
};
MAPS.kagami_ura={...MAPS.kagami,name:'湖の鏡',mirror:true,rate:.13,
  rows:MAPS.kagami.rows.map((r,j)=>{let a=[...r].reverse();if(j===10)a[15]='t';if(j===5)for(let i=9;i<13;i++)a[i]='o';return a.join('');}),
  objs:[['mirror',8,9]],doors:{'8,9':'mirror'},warps:{},items:{'7,6':'saino'},
  npcs:[{id:'kappa3',x:12,y:9,dir:'left',look:'kid',lines:[['河童の子……？','るなかわ はらちこ……？'],['','鏡の中の河童の子が、口だけ動かして何か言っている。']]}],spawn:{x:8,y:10,dir:'up'}};
/* 話しかけたとき */
function owNpcTalk(n,m){
  if(n.lines)return n.lines;
  if(n.id==='aoi'){const id=m.town;if(!state.rival[id]&&RIVALS[id]){H.rival();return null;}return id==='ryuhyo'?[['アオイ','ここ、まつげまで凍るんだけど……！'],['アオイ','池の氷ですべって、三回くらいしりもちついちゃった。流氷の海の氷原は、もっとすべるらしいよ。']]:id==='mayoiga'?[['アオイ','ここ、地図にのってない里なんだって……ちょっとこわいね。'],['アオイ','鏡の湖の鏡、のぞきこんだら吸いこまれそうになったよ。中では右と左が逆なんだって！']]:id==='tengu'?[['アオイ','霧の参道、迷わずに来られた？ わたしは三回くらい入口にもどされた……。'],['アオイ','奥宮の灯籠、順番をまちがえると火が消えちゃうんだって。']]:id==='shiomi'?[['アオイ','漁港の網元さんから、釣りざおはもらった？'],['アオイ','引き潮のときに沖の小島へ渡ると、めずらしい物が落ちてるんだって！']]:id==='kasumi'?[['アオイ','ドームの配合杯、もう出てみた？ わたしはまだ予選落ち……。'],['アオイ','路地裏のゴミ箱、ときどき何か入ってるんだよ。たまに魔生物も！']]:[['アオイ','次に会うときは、もっと強くなってるから！'],['アオイ','田んぼのあぜ道の草むらは、昼と夜で出てくる魔生物がちがうんだよ。']];}
  if(n.id==='kenji'){if(!owFlag('rod')){owSetFlag('rod');sfx('win');save();return [['網元のケンジ','おう、見ない顔だな。釣りはやるかい？'],['ケンジ','こいつをやろう。古い釣りざおだが、まだまだ使えるぞ。'],['','釣りざおをもらった！ 海に向かってAボタンで釣りができる。'],['ケンジ','「！」が出たら、すぐに引くんだぞ。']];}return [['網元のケンジ','夜の桟橋は、昼とはちがう魚がかかるぞ。'],['ケンジ','南の島から、まっ赤な魚が流れてくることもあるらしい。']];}
  if(n.id==='obaa')return state.time===3?[['おばあちゃん','ほれ、田んぼを見てごらん。ホタルが飛んどるじゃろう。'],['おばあちゃん','夜の草むらには、光る魔生物が出るんじゃよ。']]:[['おばあちゃん','こんにちは。この町は田んぼと森しかないけれど、いいところでしょう。'],['おばあちゃん','夜になったら、また来てごらん。田んぼがきれいなんじゃよ。']];
  if(n.look==='boss'&&n.ura){if(!state.party.some(x=>x.hp>0))return [['','なかまが戦える状態ではない……']];talk([['',n.text]],()=>H.ura());return null;}
  if(n.id==='warashi')return owWarashi();
  if(n.look==='boss'){if(state.boss[m.town])return null;if(!state.party.some(x=>x.hp>0))return [['','なかまが戦える状態ではない……']];talk([['',n.text]],()=>H.boss());return null;}
  return null;
}
/* 建物に入ったとき */
const OW_DOOR={
  station:()=>{ui.station=true;sfx('sel');render();},
  lab:()=>talk([['ハザマ所長','おお、来たか。配合台はいつでも使ってよいぞ。']],()=>{ui.tab='breed';render();}),
  home:()=>{healAll();sfx('heal');talk([['','家のふとんでひと休みした。'],['','なかま全員が元気になった！']]);save();},
  konbini:()=>talk([['店員','いらっしゃいませー！']],()=>{ui.tab='shop';render();}),
  sauna:()=>{ui.inside='sauna';sfx('sel');render();},
  dome:()=>{ui.inside='dome';sfx('sel');render();},
  board:()=>{ui.inside='board';sfx('sel');render();},
  yashiki:()=>{state.ow={map:'yashiki',...MAPS.yashiki.spawn};OWC.mv=null;OWC.held=null;sfx('sel');ui.toast='迷い家の屋敷';save();render();},
  fusuma:()=>{const r=wpick([{w:2,v:'zashiki'},{w:2,v:'feast'},{w:3,v:'ambush'},{w:2,v:'scroll'},{w:1,v:'empty'}]).v;OWC.room=r;state.ow={map:'okunoma',...MAPS.okunoma.spawn};OWC.mv=null;OWC.held=null;sfx('sel');ui.toast='';save();
    const msg={zashiki:'ふすまを開けると、赤い着物の子どもがちょこんと座っていた。',feast:'ふすまを開けると、湯気の立つお膳が用意されていた。だれもいないのに……',ambush:'ふすまを開けると、魔生物が待ちかまえていた！',scroll:'ふすまを開けると、床の間に古い掛け軸がかかった部屋に出た。',empty:'ふすまを開けると、がらんとした部屋だった。さっきとはちがう部屋のようだ……'}[r];
    render();if(r==='ambush'&&state.party.some(x=>x.hp>0))talk([['',msg]],()=>owEncounter('chikurin'));else talk([['',msg]]);},
  mirror:()=>{const toU=state.ow.map==='kagami',to=toU?'kagami_ura':'kagami';state.ow={map:to,x:15-state.ow.x,y:10,dir:'down'};OWC.mv=null;OWC.held=null;sfx('shiny');save();render();talk(toU?[['','鏡に手をふれると、すうっと吸いこまれた……'],['','鏡の中の世界だ！ 右と左が逆になっている！']]:[['','もとの世界にもどってきた。']]);},
  vend:()=>{if(state.yen<120){talk([['','自動販売機だ。スポーツドリンクが120円で売っている。'],['','……お金が足りない。']]);return;}state.yen-=120;state.items.drink=(state.items.drink||0)+1;sfx('sel');save();talk([['','ガコン！'],['','スポーツドリンクを買った。(120円)']]);},
};
const owFlag=k=>k.startsWith('boss:')?!!state.boss[k.slice(5)]:!!(state.owFlags&&state.owFlags[k]);
const owTideHigh=()=>state.time===0||state.time===2;
function owDoor(d){if(Array.isArray(d))talk(d);else OW_DOOR[d]();}
const owSetFlag=k=>{state.owFlags=state.owFlags||{};state.owFlags[k]=true;};

/* ---- 描画 ---- */
const OWC={bg:{},img:{},raf:0,cv:null,ctx:null,held:null,dash:false,mv:null,anim:0,vh:11,cars:null,carsMap:null,stuck:0};
function owMap(){return MAPS[state.ow&&state.ow.map];}
function owNpcs(m){return (m.npcs||[]).filter(n=>(n.ura?state.boss[m.town]&&!state.boss[m.town+'_ura']:!(n.look==='boss'&&state.boss[m.town]))&&!(n.night&&state.time!==3)&&!(n.eve&&state.time<2)&&!(n.room&&n.room!==OWC.room));}
const owObjOn=o=>!o[7]||o[7]===OWC.room;
const OW_DYN=['light','lever','shutter','panel','chest','jizo','toro','barrier','zen','kakejiku','kaguya','takibi'];
function owPaint(m,ti){
  const P=OW_PALS[ti],W=m.rows[0].length,Hh=m.rows.length,cv=document.createElement('canvas');cv.width=W*TS;cv.height=Hh*TS;const x0=cv.getContext('2d');
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;},rr=n=>Math.floor(rnd()*n);
  const R=(x,y,w,h,c)=>{x0.fillStyle=P[c]||c;x0.fillRect(x,y,w,h);},px=(x,y,c)=>R(x,y,1,1,c);
  const E=(cx,cy,rx,ry,c)=>{for(let y=-ry;y<ry;y++){const w=Math.round(rx*Math.sqrt(1-((y+.5)/ry)**2));R(cx-w,cy+y,w*2,1,c);}};
  const at=(i,j)=>(m.rows[j]||'')[i]||'#';
  const gk=m.ground==='forest'?['forest','forest2']:['grass','grass2'];
  const sn=m.ground==='snow';
  const snowG=(x,y)=>{R(x,y,TS,TS,'snow');for(let k=0;k<4;k++)px(x+rr(16),y+rr(16),'snow2');if(rnd()<.35)R(x+rr(11),y+2+rr(12),4,1,'snow3');if(rnd()<.2)px(x+rr(16),y+rr(16),'ice2');};
  const ground=(x,y)=>{if(sn){snowG(x,y);return;}R(x,y,TS,TS,gk[0]);for(let k=0;k<3;k++){const a=1+rr(13),b=1+rr(13);px(x+a,y+b,gk[1]);px(x+a+1,y+b-1,gk[1]);}if(rnd()<.25)px(x+2+rr(11),y+2+rr(11),'grass3');};
  const side=(x,y)=>{R(x,y,TS,TS,'side');R(x,y+7,TS,1,'side2');R(x+7,y,1,7,'side2');R(x+3,y+8,1,8,'side2');R(x+11,y+8,1,8,'side2');};
  const floor=(x,y)=>{R(x,y,TS,TS,'tile');R(x,y,TS,1,'tile2');R(x,y,1,TS,'tile2');if(rnd()<.3)px(x+2+rr(12),y+2+rr(12),'tile2');};
  const sand=(x,y)=>{R(x,y,TS,TS,'sand');for(let k=0;k<5;k++)px(x+rr(16),y+rr(16),'sand2');};
  const cfl=(x,y)=>{R(x,y,TS,TS,'cfloor');for(let k=0;k<4;k++)px(x+rr(16),y+rr(16),'cfloor2');if(rnd()<.3)R(x+rr(12),y+rr(12),3,2,'cfloor2');};
  const under=(x,y)=>sn?snowG(x,y):m.ground==='city'?side(x,y):m.ground==='floor'?floor(x,y):m.ground==='alley'?side(x,y):m.ground==='sand'?sand(x,y):m.ground==='cave'?cfl(x,y):ground(x,y);
  const high=ti===0||ti===2;
  const bcol=(i,j)=>['b1','b2','b3','b4'][((i*7+j*13)>>2)%4];
  /* 雪のマップのタイル */
  const iceLike=c=>'iul'.includes(c);
  const snowTile=(ch,i,j,x,y)=>{
    if(ch==='t'){snowG(x,y);return true;}
    if(ch==='T'){snowG(x,y);[[4,6],[11,5],[7,12],[13,12]].forEach(([a,b])=>{E(x+a,y+b+1,4,3,'sasa2');E(x+a,y+b,4,2,'sasa');R(x+a-3,y+b-2,5,1,'snow');px(x+a+1,y+b-1,'snow');});return true;}
    if(ch==='P'){R(x,y,TS,TS,'snow2');for(let k=0;k<3;k++)px(x+rr(16),y+rr(16),'snow3');[[4,3],[10,8],[5,13]].forEach(([a,b])=>{R(x+a,y+b,2,1,'snow3');R(x+a+1,y+b+1,1,1,'snow3');});return true;}
    if(ch==='y'){R(x,y,TS,TS,'deep');E(x+4,y+11,5,3,'deep2');E(x+4,y+10,5,3,'deep');E(x+12,y+5,5,3,'deep2');E(x+12,y+4,5,3,'deep');px(x+3+rr(10),y+3+rr(10),'ice2');return true;}
    if(ch==='i'){R(x,y,TS,TS,'ice');R(x+2+((i*5+j*3)%7),y+3,5,1,'ice2');R(x+3+((i*3+j*7)%6),y+10,6,1,'ice2');px(x+12,y+6,'ice2');
      if(!iceLike(at(i,j-1)))R(x,y,TS,1,'ice3');if(!iceLike(at(i,j+1)))R(x,y+TS-1,TS,1,'ice3');if(!iceLike(at(i-1,j)))R(x,y,1,TS,'ice3');if(!iceLike(at(i+1,j)))R(x+TS-1,y,1,TS,'ice3');return true;}
    if(ch==='u'){R(x,y,TS,TS,'thin');x0.strokeStyle=P.thin2;x0.lineWidth=.5;x0.beginPath();x0.moveTo(x+2,y+4+(i%3));x0.lineTo(x+8,y+8);x0.lineTo(x+14,y+5+(j%3));x0.moveTo(x+8,y+8);x0.lineTo(x+6,y+14);x0.stroke();px(x+11,y+11,'isea2');
      if(!iceLike(at(i,j-1)))R(x,y,TS,1,'ice3');if(!iceLike(at(i,j+1)))R(x,y+TS-1,TS,1,'ice3');return true;}
    if(ch==='a'||ch==='v'){const on=ch==='a'?ti<2:ti>=2;
      if(m.aurora){if(on){R(x,y,TS,TS,'crack');R(x+1,y,14,TS,'#7ae8c8');R(x+3,y,10,TS,'#c8fff0');for(let r=(j*5)%4;r<16;r+=4)R(x+2,y+r,12,1,'#a8f8e0');}else{R(x,y,TS,TS,'crack');R(x+4,y+((i+j)%3)*4+2,3,1,'isea');}return true;}
      R(x,y,TS,TS,'isea');if((i+j)%3===0)R(x+3,y+6,5,1,'isea2');if(on){E(x+8,y+9,8,7,'floe2');E(x+8,y+8,8,7,'floe');R(x+4,y+5,4,1,'ice2');R(x+9,y+10,3,1,'snow2');}return true;}
    if(ch==='~'){R(x,y,TS,TS,'isea');if((i+j)%3===0)R(x+2+((i*5)%8),y+5,5,1,'isea2');if((i*3+j)%4===1)R(x+6,y+11,4,1,'isea2');if((i*7+j*3)%9===2){E(x+5+((i*3)%6),y+9,3,2,'floe2');E(x+5+((i*3)%6),y+8,3,2,'floe');}
      if(j>0&&!'~av'.includes(at(i,j-1))){R(x,y,TS,2,'floe');R(x+((i*7)%10),y+2,4,1,'floe2');}return true;}
    if(ch==='l'){R(x,y,TS,TS,at(i-1,j)==='i'||at(i+1,j)==='i'?'ice':'snow');E(x+8,y+9,7,5,'snow3');E(x+8,y+9,6,4,'crack');E(x+8,y+10,5,3,'isea');R(x+5,y+9,3,1,'isea2');return true;}
    if(ch==='r'){const sea='~av'.includes(at(i,j+1))||'~av'.includes(at(i,j-1));if(sea)R(x,y,TS,TS,'isea');else snowG(x,y);E(x+8,y+9,8,6,'rock2');E(x+7,y+8,7,5,'rock');E(x+8,y+5,7,3,'snow');E(x+6,y+5,4,2,'deep');return true;}
    if(ch==='O'){snowG(x,y);R(x,y+3,TS,10,'snow3');R(x,y+4,TS,8,'crack');R(x+((i*5)%9),y+3,5,1,'crack');R(x+((i*3)%10),y+12,4,1,'crack');R(x,y+7,TS,2,'isea');return true;}
    return false;};
  for(let j=0;j<Hh;j++)for(let i=0;i<W;i++){const ch=at(i,j),x=i*TS,y=j*TS;
    if(sn&&snowTile(ch,i,j,x,y))continue;
    if('Gg.t*'.includes(ch)){if(ch==='.')under(x,y);else ground(x,y);}
    if(ch==='*')[[3,4,'flower1'],[10,3,'flower2'],[6,10,'flower2'],[12,11,'flower1']].forEach(([a,b,c])=>{R(x+a,y+b,2,2,c);px(x+a,y+b+2,gk[1]);});
    if(ch==='P'){R(x,y,TS,TS,'path');for(let k=0;k<4;k++)px(x+rr(16),y+rr(16),'path2');if(j>0&&!'P.'.includes(at(i,j-1)))R(x,y,TS,1,'path2');}
    if(ch==='T'){R(x,y,TS,TS,'tall');[[1,3],[9,3],[5,10],[13,10]].forEach(([a,b])=>{for(let k=0;k<3;k++){for(let s=0;s<6;s++)px(x+a+k*2+(s<3?0:1),y+b+5-s,'tall2');px(x+a+k*2+1,y+b,'grass3');}});}
    if(ch==='W'){R(x,y,TS,TS,'water');[[2,4],[9,10]].forEach(([a,b])=>{R(x+a,y+b,4,1,'water2');R(x+a+4,y+b-1,2,1,'water2');});
      if(at(i-1,j)!=='W')R(x,y,2,TS,gk[1]);if(at(i+1,j)!=='W')R(x+TS-2,y,2,TS,gk[1]);if(at(i,j-1)!=='W')R(x,y,TS,2,gk[1]);if(at(i,j+1)!=='W')R(x,y+TS-2,TS,2,gk[1]);}
    if(ch==='R'){R(x,y,TS,TS,'paddy');[3,8,13].forEach(b=>[2,7,12].forEach(a=>{R(x+a,y+b-2,1,3,'paddy2');px(x+a+1,y+b-2,'paddy2');}));if(at(i,j-1)!=='R')R(x,y,TS,2,'sleeper');}
    if(ch==='='){R(x,y,TS,TS,'gravel');[1,6,11].forEach(a=>R(x+a,y+2,3,12,'sleeper'));R(x,y+4,TS,2,'rail');R(x,y+10,TS,2,'rail');}
    if(ch==='-'){R(x,y,TS,TS,'plat');R(x,y+12,TS,2,'plat2');for(let a=0;a<16;a+=4)px(x+a+1,y+13,'plat');R(x,y+TS-1,TS,1,'outline');}
    if(ch==='S')side(x,y);
    if(ch==='A'){R(x,y,TS,TS,'asph');for(let k=0;k<3;k++)px(x+rr(16),y+rr(16),'asph2');if(at(i,j+1)==='A'||at(i,j+1)==='Z'){if(i%2===0)R(x+2,y+TS-1,10,2,'zebra');}if(at(i,j-1)!=='A'&&at(i,j-1)!=='Z')R(x,y,TS,2,'side2');if(at(i,j+1)!=='A'&&at(i,j+1)!=='Z')R(x,y+TS-2,TS,2,'side2');}
    if(ch==='Z'){R(x,y,TS,TS,'asph');for(let a=1;a<16;a+=4)R(x,y+a,TS,2,'zebra');}
    if(ch==='h'){side(x,y);R(x+1,y+3,14,12,'hedge2');R(x+1,y+2,14,10,'hedge');for(let k=0;k<4;k++)px(x+2+rr(12),y+3+rr(8),'grass3');}
    if(ch==='B'){const c=bcol(i,j);R(x,y,TS,TS,c);R(x,y,TS,1,c+'d');if(rnd()<.35){R(x+3+rr(6),y+3+rr(6),4,3,c+'d');}
      if(at(i,j+1)!=='B'&&at(i,j+1)!=='#'){R(x,y+9,TS,7,'bwall');R(x+2,y+11,4,3,'win2');R(x+9,y+11,4,3,'win2');R(x+2,y+11,4,1,'win');R(x+9,y+11,4,1,'win');}}
    if(ch==='D'){R(x,y,TS,TS,'alley');R(x,y+15,TS,1,'alley2');if(rnd()<.5)E(x+3+rr(10),y+3+rr(10),2+rr(2),1+rr(2),'stain');for(let k=0;k<3;k++)px(x+rr(16),y+rr(16),'alley2');}
    if(ch==='X'){R(x,y,TS,TS,'twall');for(let r=0;r<16;r+=4)R(x,y+r,TS,1,'twall2');for(let r=0;r<16;r+=4)R(x+((r/4)%2?4:12),y+r,1,4,'twall2');}
    if(ch==='Y'){R(x,y,TS,TS,'track');R(x,y+3,TS,1,'twall2');R(x,y+12,TS,1,'twall2');for(let a=1;a<16;a+=5)R(x+a,y+2,2,12,'sleeper');R(x,y+5,TS,1,'rail');R(x,y+10,TS,1,'rail');}
    if(ch==='F'){floor(x,y);}
    if(ch==='Q'){floor(x,y);x0.strokeStyle=P.web;x0.lineWidth=.6;x0.beginPath();x0.moveTo(x,y);x0.lineTo(x+16,y+16);x0.moveTo(x+16,y);x0.lineTo(x,y+16);x0.moveTo(x+8,y);x0.lineTo(x+8,y+16);x0.moveTo(x,y+8);x0.lineTo(x+16,y+8);x0.stroke();[3,6].forEach(r=>{x0.strokeRect(x+8-r+.5,y+8-r+.5,r*2-1,r*2-1);});}
    if(ch==='O'){under(x,y);R(x+1,y+1,14,14,'hole');R(x+1,y+1,14,2,m.ground==='cave'?'cwall2':'twall');}
    if(ch==='N')sand(x,y);
    if(ch==='~'){R(x,y,TS,TS,'sea');if((i+j)%3===0)R(x+2+((i*5)%8),y+5,5,1,'sea2');if((i*3+j)%4===1)R(x+6,y+11,4,1,'sea2');if(j>0&&'NUEKrS'.includes(at(i,j-1))){R(x,y,TS,2,'foam');R(x+((i*7)%10),y+2,4,1,'foam');}}
    if(ch==='U'){if(high){R(x,y,TS,TS,'sea');if((i+j)%2)R(x+3,y+7,6,1,'sea2');}else{R(x,y,TS,TS,'wet');for(let k=0;k<4;k++)px(x+rr(16),y+rr(16),'wet2');if(rnd()<.25){R(x+4+rr(8),y+4+rr(8),2,1,'foam');}}}
    if(ch==='E'){R(x,y,TS,TS,'shore');E(x+5,y+6,4,3,'rock');E(x+11,y+11,4,3,'rock2');E(x+12,y+4,2,2,'rock');px(x+4,y+5,'moss');px(x+11,y+10,'moss');}
    if(ch==='r'){R(x,y,TS,TS,at(i,j+1)==='~'||at(i,j-1)==='~'?'sea':'sand');E(x+8,y+8,8,7,'rock2');E(x+7,y+7,7,6,'rock');E(x+5,y+5,3,2,'shore');}
    if(ch==='K'){R(x,y,TS,TS,'pier');for(let a=0;a<16;a+=4)R(x,y+a,TS,1,'pier2');R(x+(j%2?3:11),y,1,TS,'pier2');if(at(i,j+1)==='~'){R(x+1,y+14,2,2,'pier2');R(x+13,y+14,2,2,'pier2');}}
    if(ch==='V'){R(x,y,TS,TS,'cwall');E(x+5,y+5,5,4,'cwall2');E(x+12,y+11,4,3,'cwall2');if(at(i,j+1)==='C'||at(i,j+1)==='O')R(x,y+12,TS,4,'cwall2');}
    if(ch==='C')cfl(x,y);
    if(ch==='w'){R(x,y,TS,TS,'river');[[2,3],[8,9],[11,4]].forEach(([a,b])=>R(x+((a+i*3)%12),y+b,4,1,'river2'));if(at(i,j-1)!=='w'&&at(i,j-1)!=='H')R(x,y,TS,2,'foam');}
    if(ch==='H'){R(x,y,TS,TS,'river');R(x+2,y,12,TS,'bridge');for(let a=1;a<16;a+=3)R(x+2,y+a,12,1,'bridge2');R(x+1,y,1,TS,'rope');R(x+14,y,1,TS,'rope');}
    if(ch==='b'){R(x,y,TS,TS,'pebble');for(let k=0;k<5;k++)E(x+2+rr(12),y+2+rr(12),2,1,'pebble2');}
    if(ch==='o'){R(x,y,TS,TS,'river');E(x+8,y+9,6,5,'rock2');E(x+8,y+8,5,4,'step');}
    if(ch==='q'){R(x,y,TS,TS,'forest2');[[2,'bamboo'],[7,'bamboo2'],[12,'bamboo']].forEach(([a,c])=>{R(x+a,y,3,TS,c);R(x+a,y+((i*3+j*5+a)%11)+2,3,1,'bamboo3');R(x+a+1,y,1,TS,'bamboo3');});}
    if(ch==='M'){R(x,y,TS,TS,'tatami');R(x,y,TS,1,'tatami2');R(x,y,1,TS,'tatami2');if((i+j)%2)R(x+7,y,1,TS,'tatami2');else R(x,y+7,TS,1,'tatami2');}
    if(ch==='J'){R(x,y,TS,TS,'shoji2');if(at(i,j+1)==='M'||at(i+1,j)==='M'||at(i-1,j)==='M'){R(x+1,y+1,14,14,'shoji');R(x+7,y+1,1,14,'shoji2');R(x+1,y+7,14,1,'shoji2');}}
    if(ch==='k'){R(x,y,TS,TS,'cloud2');E(x+5,y+6,6,4,'cloud');E(x+12,y+10,5,4,'cloud');}
    if(ch==='L'){R(x,y,TS,TS,'step');R(x,y+7,TS,1,'step2');R(x,y+15,TS,1,'step2');R(x+(j%2?4:10),y,1,7,'step2');R(x+(j%2?10:4),y+8,1,7,'step2');}
  }
  for(let j=0;j<Hh;j++)for(let i=0;i<W;i++)if(at(i,j)==='t'){const x=i*TS,y=j*TS;
    if(sn){R(x+7,y+12,2,4,'trunk');for(let r=0;r<13;r++){const w=1+Math.floor((r%5)*.9+r*.35);R(x+8-w,y+r,w*2,1,'pine');R(x+8,y+r,w,1,'pine2');if(r%5===0)R(x+8-w,y+r,Math.max(1,w*2-1),1,'snow');}continue;}
    R(x+6,y+10,4,6,'trunk');E(x+8,y+7,8,8,'tree2');E(x+8,y+6,7,6,'tree');E(x+6,y+4,3,2,'tree3');}
  const shadow=(X,Y,WW)=>{x0.fillStyle='rgba(0,0,0,.16)';x0.fillRect(X+1,Y,WW,2);};
  const building=(x,y,w,h,roof,roof2,dx)=>{const X=x*TS,Y=y*TS,WW=w*TS,HH=h*TS,rh=HH/2+2;shadow(X,Y+HH,WW);
    R(X,Y+rh,WW,HH-rh,'wall');R(X,Y+HH-3,WW,3,'wall2');R(X-1,Y,WW+2,rh,roof);for(let k=Y+3;k<Y+rh;k+=4)R(X-1,k,WW+2,1,roof2);R(X-1,Y+rh-2,WW+2,2,roof2);
    R((x+dx)*TS+4,Y+HH-11,8,11,'door');px((x+dx)*TS+10,Y+HH-6,'plat2');
    if(sn){R(X-1,Y,WW+2,3,'snow');for(let a=X;a<X+WW;a+=6)R(a,Y+3,3,1+((a>>2)%2),'snow');for(let a=X+2;a<X+WW;a+=7)R(a,Y+rh,1,2+((a>>3)%3),'ice');}
    return [X,Y,WW,HH,rh];};
  for(const [k,x,y,w=1,h=1] of m.objs){if(OW_DYN.includes(k))continue;const X=x*TS,Y=y*TS;
    if(k==='station'){const WW=w*TS,HH=h*TS,dx=(x+Math.floor(w/2))*TS;R(X,Y,WW,HH,'wall');R(X,Y,WW,6,'roofg');R(X,Y+6,WW,1,'roofg2');[X+6,X+WW-18].forEach(wx=>{R(wx,Y+11,12,8,'win');R(wx,Y+11,12,2,'win2');});
      R(dx+3,Y+HH-14,10,14,'win2');R(dx+4,Y+HH-13,8,12,'win');R(X+WW/2-14,Y+1,28,4,'plat');R(X+WW/2-14,Y+4,28,1,'plat2');R(X,Y+HH-2,WW,2,'wall2');if(sn){R(X,Y,WW,2,'snow');for(let a=X+3;a<X+WW;a+=9)R(a,Y+7,1,3,'ice');}}
    if(k==='lab'){const [X2,Y2,WW,HH,rh]=building(x,y,w,h,'roofb','roofb2',1);[X2+4,X2+40,X2+52].forEach(wx=>{R(wx,Y2+rh+5,9,7,'win');R(wx,Y2+rh+5,9,2,'win2');});R(X2+WW-14,Y2+rh-12,10,8,'plat');R(X2+WW-12,Y2+rh-10,6,1,'roofb2');R(X2+WW-12,Y2+rh-8,6,1,'roofb2');}
    if(k==='house'){const [X2,Y2,WW,HH,rh]=building(x,y,w,h,'roofr','roofr2',1);[X2+3,X2+35].forEach(wx=>{R(wx,Y2+rh+5,9,7,'win');R(wx,Y2+rh+5,9,2,'win2');});}
    if(k==='sauna'){const [X2,Y2,WW,HH,rh]=building(x,y,w,h,'sauna','sauna2',1);[X2+34,X2+48].forEach(wx=>{R(wx,Y2+rh+5,9,7,'win');R(wx,Y2+rh+5,9,2,'win2');});R(X2+WW/2-10,Y2+rh-1,20,6,'plat');R(X2+WW/2-6,Y2+rh+1,12,1,'sauna2');[0,5,10].forEach(o=>{R(X2+WW-12+o/2,Y2-6-o,1,4,'web');});}
    if(k==='konbini'){const WW=w*TS,HH=h*TS;shadow(X,Y+HH,WW);R(X,Y+8,WW,HH-8,'wall');R(X-1,Y+4,WW+2,6,'roofg');R(X-1,Y+10,WW+2,4,'band');R(X-1,Y+14,WW+2,2,'band2');R(X+3,Y+20,WW-6,22,'win');R(X+3,Y+20,WW-6,3,'win2');for(let a=X+3;a<X+WW-3;a+=14)R(a,Y+20,1,22,'wall2');R(X+TS+4,Y+HH-14,10,14,'win2');}
    if(k==='dome'){const WW=w*TS,HH=h*TS;shadow(X,Y+HH,WW);R(X,Y+HH-22,WW,22,'wall2');for(let r=0;r<HH-14;r++){const t=r/(HH-14),hw=Math.round(WW/2*Math.sqrt(1-(1-t)**2));R(X+WW/2-hw,Y+r,hw*2,1,r%6<3?'dome':'dome2');}
      R(X+4,Y+HH-18,WW-8,6,'win');R(X+4,Y+HH-18,WW-8,1,'win2');R(X+WW/2-8,Y+HH-12,16,12,'win2');R(X+WW/2-7,Y+HH-11,14,11,'win');R(X+WW/2-16,Y+HH-26,32,6,'band2');}
    if(k==='board'){R(X+2,Y+12,2,4,'trunk');R(X+12,Y+12,2,4,'trunk');R(X,Y+1,16,12,'sign');R(X+1,Y+2,14,10,'path');[[3,4],[9,3],[4,8],[10,8]].forEach(([a,b])=>R(X+a,Y+b,4,3,'wall'));}
    if(k==='vend'){R(X+1,Y-6,14,22,'vend');R(X+3,Y-4,10,8,'win');[5,8,11].forEach(a=>R(X+a,Y-3,2,5,a===8?'band':'flower2'));R(X+3,Y+6,10,3,'outline');R(X+11,Y+10,2,3,'plat2');}
    if(k==='manhole'){x0.fillStyle=P.asph2;x0.beginPath();x0.arc(X+8,Y+8,6.5,0,7);x0.fill();x0.strokeStyle=P.asph;x0.lineWidth=1;for(let a=-4;a<=4;a+=2.5){x0.beginPath();x0.moveTo(X+8+a,Y+3);x0.lineTo(X+8+a,Y+13);x0.stroke();}}
    if(k==='trash'){R(X+3,Y+4,10,11,'b1d');R(X+2,Y+3,12,3,'bwall');R(X+4,Y+7,1,7,'b1');R(X+8,Y+7,1,7,'b1');R(X+11,Y+7,1,7,'b1');}
    if(k==='unit'){R(X+1,Y+5,14,10,'wall2');R(X+2,Y+6,8,8,'stone2');x0.strokeStyle=P.wall;x0.beginPath();x0.arc(X+6,Y+10,3,0,7);x0.stroke();R(X+11,Y+7,3,6,'stone');}
    if(k==='ladder'){R(X+3,Y,2,16,'stone');R(X+11,Y,2,16,'stone');for(let r=2;r<16;r+=4)R(X+3,Y+r,10,1,'stone2');}
    if(k==='train'){const WW=w*TS;R(X,Y-6,WW,14,'stone2');R(X,Y-6,WW,2,'stone');for(let a=X+4;a<X+WW-8;a+=12)R(a,Y-3,8,5,'win2');R(X,Y+5,WW,2,'band');}
    if(k==='bath'){const [X2,Y2,WW,HH,rh]=building(x,y,w,h,'roofb','roofb2',1);[X2+34,X2+52].forEach(wx=>{R(wx,Y2+rh+5,9,7,'win');R(wx,Y2+rh+5,9,2,'win2');});R(X2+20,Y2+rh+2,12,9,'roofr');R(X2+25,Y2+rh+2,1,9,'wall');[0,6,12].forEach(o=>{R(X2+14+o,Y2-7,1,5,'foam');R(X2+15+o,Y2-10,1,3,'foam');});}
    if(k==='bench'){R(X+1,Y+6,14,3,'pier');R(X+1,Y+9,14,2,'pier2');R(X+2,Y+11,2,4,'pier2');R(X+12,Y+11,2,4,'pier2');}
    if(k==='parasol'){R(X+7,Y+2,2,13,'wall2');E(X+8,Y+3,9,4,'band2');E(X+8,Y+3,9,4,'band2');R(X,Y+3,16,1,'wall');}
    if(k==='lighthouse'){R(X+3,Y-30,10,44,'wall');[Y-24,Y-12,Y].forEach(b=>R(X+3,b,10,5,'band2'));R(X+1,Y-36,14,6,'outline');R(X+4,Y-35,8,4,'lampl');R(X+2,Y-38,12,2,'roofr');R(X+2,Y+12,12,4,'rock');}
    if(k==='pool'){R(X,Y,TS,TS,'shore');E(X+8,Y+8,7,6,'rock2');E(X+8,Y+8,5,4,'sea');E(X+7,Y+7,2,1,'sea2');px(X+10,Y+10,'flower1');}
    if(k==='shell'){px(X+5,Y+9,'flower1');px(X+6,Y+9,'wall');px(X+10,Y+5,'wall');}
    if(k==='cave'){R(X,Y,TS,TS,'rock2');E(X+8,Y+10,6,7,'hole');}
    if(k==='soko'){const WW=w*TS,HH=h*TS;shadow(X,Y+HH,WW);R(X,Y,WW,HH,'b1');for(let a=X+2;a<X+WW;a+=4)R(a,Y,1,HH-14,'b1d');R(X,Y+HH-14,WW,14,'bwall');R(X+WW/2-12,Y+HH-12,24,12,'stone2');for(let r=Y+HH-11;r<Y+HH;r+=3)R(X+WW/2-12,r,24,1,'stone');}
    if(k==='stall'){const WW=w*TS,HH=h*TS;R(X,Y+8,WW,HH-8,'pier');for(let a=0;a<WW;a+=8)R(X+a,Y,8,10,a%16?'wall':'jacket');R(X+4,Y+16,WW-8,6,'sea2');[8,20,32,44].forEach(a=>{E(X+a,Y+19,3,2,'stone');});}
    if(k==='crate'){R(X+2,Y+4,12,11,'pier');R(X+2,Y+4,12,1,'pier2');R(X+2,Y+9,12,1,'pier2');R(X+7,Y+4,1,11,'pier2');}
    if(k==='boat'){const WW=w*TS;E(X+WW/2,Y+9,WW/2,5,'wall');E(X+WW/2,Y+8,WW/2-2,3,'pier');R(X+WW/2,Y-4,1,12,'pier2');R(X+WW/2+1,Y-3,7,7,'wall');}
    if(k==='stele'){R(X+3,Y+1,10,14,'cwall2');R(X+4,Y+2,8,12,'stone2');for(let r=4;r<13;r+=3)R(X+6,Y+r,4,1,'cwall2');}
    if(k==='chest'){}
    if(k==='shukubo'){const [X2,Y2,WW,HH,rh]=building(x,y,w,h,'roofg','roofg2',1);[X2+34,X2+52].forEach(wx=>{R(wx,Y2+rh+5,9,7,'win');R(wx,Y2+rh+5,9,2,'win2');});R(X2+18,Y2+rh+2,12,9,'kimono');}
    if(k==='chaya'){const [X2,Y2,WW,HH,rh]=building(x,y,w,h,'roofr','roofr2',1);R(X2+28,Y2+rh+3,30,4,'bib');R(X2+40,Y2+HH-8,14,6,'bridge');[X2+42,X2+50].forEach(a=>{E(a,Y2+HH-12,2,2,'flower1');E(a,Y2+HH-15,2,2,'wall');});}
    if(k==='fall'){const WW=w*TS,HH=h*TS;R(X,Y-8,WW,HH+8,'rock2');R(X+6,Y-8,WW-12,HH+8,'river2');for(let r=0;r<HH+8;r+=3)R(X+7+(r%6?2:6),Y-8+r,2,2,'foam');E(X+WW/2,Y+HH-2,WW/2,4,'foam');}
    if(k==='honden'){const WW=w*TS,HH=h*TS;R(X,Y+8,WW,HH-8,'pier');for(let a=X+6;a<X+WW;a+=12)R(a,Y+10,2,HH-10,'pier2');R(X-4,Y,WW+8,10,'roofg');R(X-6,Y+8,WW+12,3,'roofg2');R(X+WW/2-10,Y+14,20,HH-14,'pier2');R(X+WW/2-6,Y+16,12,4,'plat2');}
    if(k==='kominka'){const [X2,Y2,WW,HH,rh]=building(x,y,w,h,'thatch','thatch2',2);[X2+6,X2+56].forEach(wx=>{R(wx,Y2+rh+5,10,7,'shoji');R(wx+5,Y2+rh+5,1,7,'shoji2');});R(X2-1,Y2,WW+2,3,'thatch2');}
    if(k==='irori'){const WW=w*TS,HH=h*TS;R(X+2,Y+2,WW-4,HH-4,'shoji2');R(X+5,Y+5,WW-10,HH-10,'outline');E(X+WW/2,Y+HH/2,6,4,'fire');E(X+WW/2,Y+HH/2-1,3,2,'fire2');R(X+WW/2-1,Y-6,2,HH/2+2,'lampp');E(X+WW/2,Y+HH/2-6,6,4,'stone2');}
    if(k==='tokonoma'){const WW=w*TS;R(X,Y,WW,TS,'pier');R(X+2,Y+12,WW-4,3,'pier2');E(X+WW/2,Y+8,3,4,'stone2');R(X+WW/2-1,Y+1,2,5,'hedge');E(X+WW/2+2,Y+2,2,2,'flower1');}
    if(k==='fusuma'){R(X,Y,TS,TS,'shoji');R(X+1,Y+1,6,14,'tatami');R(X+9,Y+1,6,14,'tatami');R(X+5,Y+7,1,2,'shoji2');R(X+10,Y+7,1,2,'shoji2');}
    if(k==='ring'){[[3,4],[8,2],[13,4],[14,9],[12,13],[7,14],[2,12],[1,8]].forEach(([a,b])=>{E(X+a,Y+b,2,1,'wall');R(X+a-1,Y+b,1,2,'trunk');});}
    if(k==='mirror'){R(X+2,Y-8,12,22,'pier2');R(X+3,Y-7,10,19,'mirror');R(X+4,Y-6,3,8,'wall');R(X+5,Y+12,6,3,'pier2');}
    if(k==='sign'){R(X+7,Y+8,2,8,'trunk');R(X+2,Y+2,12,8,'sign');R(X+3,Y+3,10,6,'path');R(X+5,Y+5,6,1,'sign');R(X+5,Y+7,4,1,'sign');}
    if(k==='lamp'){R(X+7,Y+2,2,13,'lampp');R(X+5,Y,6,3,'lampp');R(X+6,Y+3,4,2,'lampl');}
    if(k==='hokora'){const WW=w*TS;R(X,Y+12,WW,4,'stone2');R(X+WW/2-14,Y-2,28,8,'roofr2');R(X+WW/2-16,Y-4,32,4,'roofr');R(X+WW/2-12,Y+6,24,8,'sign');R(X+WW/2-4,Y+7,8,7,'door');R(X+4,Y+4,4,10,'stone');R(X+WW-8,Y+4,4,10,'stone');}
    if(k==='banya'){const [X2,Y2,WW,HH,rh]=building(x,y,w,h,'roofg','roofg2',2);[X2+6,X2+56].forEach(wx=>{R(wx,Y2+rh+5,10,7,'win');R(wx,Y2+rh+5,10,2,'win2');});R(X2+20,Y2+rh+3,10,8,'pier');for(let a=0;a<3;a++)R(X2+21+a*3,Y2+rh+4,2,6,'stone2');}
    if(k==='onsen'){const WW=w*TS;E(X+WW/2,Y+9,WW/2+1,8,'rock2');E(X+WW/2,Y+8,WW/2-1,6,'#5ab8c8');E(X+WW/2-4,Y+6,5,2,'#9ae0e8');[[2,2],[WW-4,3],[WW/2,14]].forEach(([a,b])=>{E(X+a,Y+b,3,2,'rock');E(X+a,Y+b-1,3,1,'snow');});}
    if(k==='icefall'){const WW=w*TS;R(X,Y-26,WW,42,'rock2');R(X+3,Y-26,WW-6,40,'ice');for(let a=X+4;a<X+WW-4;a+=3)R(a,Y-24+((a*7)%9),1,30,'ice2');R(X+5,Y-26,WW-10,3,'snow');E(X+WW/2,Y+13,WW/2,3,'ice3');}
    if(k==='ferry'){const WW=w*TS;E(X+WW/2,Y+9,WW/2,5,'parka');E(X+WW/2,Y+7,WW/2-2,3,'wall');R(X+WW/2-6,Y-6,12,9,'wall');R(X+WW/2-4,Y-4,3,3,'win');R(X+WW/2+1,Y-4,3,3,'win');R(X+WW/2-1,Y-12,2,6,'outline');}
    if(k==='torii'){R(X+3,Y-6,3,20,'torii');R(X+3*TS-6,Y-6,3,20,'torii');R(X-1,Y-10,3*TS+2,3,'torii');R(X+1,Y-7,3*TS-2,1,'torii2');R(X+2,Y-4,3*TS-4,2,'torii');}
  }
  if(ti>=2){const lamps=m.objs.filter(o=>o[0]==='lamp');x0.globalCompositeOperation='lighter';
    for(const [,x,y] of lamps){const cx=x*TS+8,cy=y*TS+12;[[26,.10],[16,.14],[8,.2]].forEach(([r,a])=>{x0.fillStyle=`rgba(255,200,110,${ti===3?a:a*.5})`;x0.beginPath();x0.arc(cx,cy,r,0,7);x0.fill();});}
    x0.globalCompositeOperation='source-over';}
  return cv;
}
function owBg(m,ti){const k=state.ow.map+ti+(m.dark&&owFlag(m.dark)?'L':'');return OWC.bg[k]||(OWC.bg[k]=owPaint(m,ti));}
const OW_LOOKS={fox:['fire','kimono','kimono'],warashi:['hair4','bib','bib'],me:['cap','jacket','pants'],aoi:['hair2','shirt2','pants'],obaa:['hair3','kimono','kimono'],salary:['hair4','suit','suit'],parka:['fur','parka','pants'],matagi:['hair3','fur','fur'],clerk:['hair4','band','pants'],kid:['cap','apron','pants']};
function owPerson(c,X,Y,look,dir,frame){
  const P=OW_PALS[state.time],R=(x,y,w,h,col)=>{c.fillStyle=P[col]||col;c.fillRect(X+x,Y+y,w,h);};
  if(look==='cat'){c.fillStyle='rgba(0,0,0,.25)';c.fillRect(X+3,Y+14,10,2);R(4,9,9,5,'stone2');R(3,6,6,5,'stone2');R(3,5,2,2,'stone2');R(7,5,2,2,'stone2');R(12,6,1,5,'stone2');R(4,8,1,1,'flower2');R(7,8,1,1,'flower2');return;}
  const L=OW_LOOKS[look]||OW_LOOKS.me;
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
  if(look==='me'||look==='kid'){if(dir==='left')R(2,3,4,1,'cap');else if(dir==='right')R(10,3,4,1,'cap');else if(dir==='down')R(3,3,10,1,'cap');}
}
function owSpriteImg(id){if(!OWC.img[id]){const im=new Image();im.src=sprite(id,false);OWC.img[id]=im;}return OWC.img[id];}
/* 信号: 歩行者が青のあいだ、車は横断歩道の手前で止まる */
const OW_SIG=9000;
function owPedGreen(){const t=Date.now()%OW_SIG;return t<1000?'stop':t<4400?'go':t<5400?'blink':'stop';}
function owCarsHold(){return Date.now()%OW_SIG<5700;}
function owCarsInit(m){
  if(OWC.carsMap===state.ow.map&&OWC.cars)return;OWC.carsMap=state.ow.map;OWC.cars=[];if(!m.cars)return;
  const W=m.rows[0].length*TS;
  m.cars.lanes.forEach((l,li)=>{for(let k=0;k<2;k++)OWC.cars.push({lane:li,y:l.y,dir:l.dir,x:(k*W/2+li*90)%W,len:28,col:['#e8402c','#3a7ad8','#f2c43a','#e8e8e8'][(li*2+k)%4],sp:1.1+((li+k)%3)*.25});});
}
function owCarsStep(m){
  if(!m.cars)return;owCarsInit(m);const W=m.rows[0].length*TS,[c0,c1]=m.cars.cross,cx0=c0*TS,cx1=(c1+1)*TS;
  for(const car of OWC.cars){
    let nx=car.x+car.dir*car.sp;
    const front=car.dir>0?nx+car.len:nx;
    if(owCarsHold()){const stopAt=car.dir>0?cx0-3:cx1+3;const before=car.dir>0?car.x+car.len<=cx0:car.x>=cx1;if(before&&(car.dir>0?front>stopAt:front<stopAt))nx=car.x;}
    for(const o of OWC.cars){if(o===car||o.lane!==car.lane)continue;const gap=car.dir>0?o.x-(car.x+car.len):car.x-(o.x+o.len);if(gap>=0&&gap<10)nx=car.x;}
    car.x=nx;if(car.dir>0&&car.x>W+20)car.x=-car.len-20-Math.random()*60;if(car.dir<0&&car.x<-car.len-20)car.x=W+20+Math.random()*60;
  }
}
function owCarHit(m){
  if(!m.cars||!OWC.cars)return false;const o=state.ow;let px=o.x*TS,py=o.y*TS;const mv=OWC.mv;if(mv){px=(mv.fx+(o.x-mv.fx)*mv.t)*TS;py=(mv.fy+(o.y-mv.fy)*mv.t)*TS;}
  return OWC.cars.some(c=>Math.abs(c.y*TS-py)<12&&px+12>c.x&&px+4<c.x+c.len);
}
function owDraw(){
  const m=owMap(),c=OWC.ctx;if(!m||!c)return;
  const bg=owBg(m,state.time),o=state.ow,mv=OWC.mv,P=OW_PALS[state.time];
  let px=o.x*TS,py=o.y*TS;if(mv){const t=mv.t;px=(mv.fx+(o.x-mv.fx)*t)*TS;py=(mv.fy+(o.y-mv.fy)*t)*TS;}
  const MW=bg.width,MH=bg.height,VH=OWC.vh;
  let cx=Math.round(px+8-VW*TS/2),cy=Math.round(py+8-VH*TS/2);
  cx=MW<=VW*TS?Math.round((MW-VW*TS)/2):Math.max(0,Math.min(MW-VW*TS,cx));cy=MH<=VH*TS?Math.round((MH-VH*TS)/2):Math.max(0,Math.min(MH-VH*TS,cy));
  OWC.camX=cx;OWC.camY=cy;OWC.ppx=px-cx+8;OWC.ppy=py-cy+8;
  c.setTransform(OWSCALE,0,0,OWSCALE,0,0);c.imageSmoothingEnabled=false;
  c.fillStyle='#0c1120';c.fillRect(0,0,VW*TS,VH*TS);c.drawImage(bg,-cx,-cy);
  if(OWC.goal&&OWC.path&&OWC.path.length){const gx=OWC.goal[0]*TS-cx,gy=OWC.goal[1]*TS-cy,a=.5+Math.sin(Date.now()/150)*.3;c.strokeStyle=`rgba(242,177,60,${a})`;c.lineWidth=1;c.strokeRect(gx+1.5,gy+1.5,TS-3,TS-3);}
  const F=(x,y,w,h,col)=>{c.fillStyle=P[col]||col;c.fillRect(x-cx,y-cy,w,h);};
  /* 状態で変わる物 */
  for(const ob of m.objs){if(!owObjOn(ob))continue;const [k,x,y,w=1,h=1,flag]=ob;const X=x*TS,Y=y*TS;
    if(k==='zen'){F(X+2,Y+6,12,8,'bib');F(X+3,Y+5,10,2,'outline');F(X+4,Y+3,4,3,'wall');F(X+9,Y+3,3,3,'flower2');}
    if(k==='kakejiku'){F(X+3,Y-2,10,16,'shoji');F(X+3,Y-3,10,1,'pier2');F(X+3,Y+14,10,1,'pier2');F(X+6,Y+2,4,6,'stone2');F(X+5,Y+9,6,1,'outline');}
    if(k==='kaguya'){const on=state.time===3&&!owFlag(flag);F(X+5,Y-6,6,22,on?'#e8ff9a':'bamboo');F(X+5,Y+2,6,1,'bamboo2');if(on){c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(230,255,160,.22)';c.beginPath();c.arc(X-cx+8,Y-cy+4,14+Math.sin(Date.now()/200)*2,0,7);c.fill();c.restore();}}
    if(k==='light'){const s=owPedGreen(),on=s==='go'||(s==='blink'&&Math.floor(Date.now()/250)%2);F(X+7,Y+4,2,12,'lampp');F(X+3,Y-6,10,11,'outline');F(X+5,Y-5,6,4,s==='stop'?'#ff5a4a':'#3a2a2a');F(X+5,Y,6,4,on?'#5af08a':'#1e3a2a');}
    if(k==='lever'){const on=owFlag(flag);F(X+3,Y+10,10,5,'stone2');F(X+4,Y+11,8,3,'stone');F(on?X+9:X+6,Y+2,2,9,'lampp');F(on?X+8:X+4,Y,4,3,on?'#5af08a':'#e8402c');}
    if(k==='shutter'&&!owFlag(flag)){for(let a=0;a<w;a++)for(let b=0;b<h;b++){F(X+a*TS,Y+b*TS,TS,TS,'stone2');for(let r=2;r<16;r+=3)F(X+a*TS,Y+b*TS+r,TS,1,'stone');}F(X,Y+h*TS-2,w*TS,2,'outline');}
    if(k==='jizo'){F(X+3,Y+13,10,3,'stone2');F(X+4,Y+5,8,9,'stone');F(X+5,Y,6,6,'stone');F(X+4,Y+6,8,3,'bib');const ex=flag==='left'?-2:flag==='right'?2:0,ey=flag==='up'?-1:0;F(X+6+ex,Y+2+ey,1,1,'outline');F(X+9+ex,Y+2+ey,1,1,'outline');F(X+7+ex,Y+4,2,1,'stone2');}
    if(k==='toro'){const on=owFlag('kitsune')||(OWC.lseq||[]).includes(flag);F(X+5,Y+11,6,5,'lantern');F(X+7,Y+6,2,6,'lantern');F(X+3,Y-2,10,8,'lantern');F(X+5,Y,6,4,on?'fire':'outline');if(on){F(X+6,Y+1,4,2,'fire2');c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,170,80,.18)';c.beginPath();c.arc(X-cx+8,Y-cy+2,12+Math.sin(Date.now()/150)*1.5,0,7);c.fill();c.restore();}F(X+2,Y-4,12,2,'stone2');}
    if(k==='barrier'){F(X+3,Y-6,3,20,'torii');F(X+w*TS-6,Y-6,3,20,'torii');F(X-1,Y-10,w*TS+2,3,'torii');F(X+2,Y-4,w*TS-4,2,'torii');if(!owFlag(flag)){const a=.35+Math.sin(Date.now()/300)*.15;c.fillStyle=`rgba(200,140,255,${a})`;c.fillRect(X+TS-cx,Y-cy-2,TS,TS+2);c.fillStyle=`rgba(255,220,255,${a})`;for(let r=0;r<16;r+=4)c.fillRect(X+TS-cx,Y-cy+r+((Date.now()/80|0)%4),TS,1);}}
    if(k==='chest'){const op=owFlag(flag);F(X+2,Y+5,12,10,'pier2');F(X+2,Y+(op?2:5),12,op?3:4,'pier');F(X+7,Y+8,2,3,'plat2');if(op)F(X+3,Y+5,10,2,'outline');}
    if(k==='takibi'){F(X+2,Y+11,12,3,'trunk');F(X+4,Y+9,8,3,'pier2');const fl=Math.floor(Date.now()/120)%3;F(X+5,Y+3+fl,6,7-fl,'fire');F(X+6,Y+5+fl,4,4,'fire2');F(X+7+(fl-1),Y+1+fl,2,3,'fire');
      c.save();c.globalCompositeOperation='lighter';c.fillStyle=`rgba(255,150,60,${state.time>=2?.22:.1})`;c.beginPath();c.arc(X-cx+8,Y-cy+8,(state.time>=2?26:16)+Math.sin(Date.now()/160)*2,0,7);c.fill();c.restore();}
    if(k==='onsen'){c.fillStyle='rgba(240,248,255,.5)';for(let i=0;i<4;i++){const t=(Date.now()/1300+i*.25)%1;c.fillRect(Math.round(X-cx+4+i*(w*TS-8)/3+Math.sin(t*6+i)*2),Math.round(Y-cy+4-t*14),3,2);}}
    if(k==='panel'){const on=owFlag(flag);F(X+1,Y-4,14,19,'bwall');F(X+3,Y-2,10,8,'outline');F(X+4,Y-1,3,2,on?'#5af08a':'#5a2a2a');F(X+9,Y-1,3,2,on?'#5af08a':'#e8402c');F(X+4,Y+3,8,1,'stone');F(X+6,Y+8,4,4,'plat2');}
  }
  if(m.rocks&&m.ground==='snow'){const RK=owRocks(m);for(const k in RK.filled){const [hx,hy]=k.split(',').map(Number);F(hx*TS,hy*TS+3,TS,10,'snow2');F(hx*TS+2,hy*TS+5,12,6,'snow');F(hx*TS+4,hy*TS+6,4,1,'snow3');}
    for(const [rx,ry] of RK.rocks){F(rx*TS+2,ry*TS+13,12,3,'snow3');c.fillStyle=P.snow2;c.beginPath();c.arc(rx*TS-cx+8,ry*TS-cy+8,7.5,0,7);c.fill();c.fillStyle=P.deep;c.beginPath();c.arc(rx*TS-cx+7,ry*TS-cy+7,6,0,7);c.fill();F(rx*TS+4,ry*TS+4,2,2,'ice2');}}
  else if(m.rocks){const RK=owRocks(m);for(const k in RK.filled){const [hx,hy]=k.split(',').map(Number);F(hx*TS,hy*TS,TS,TS,'cfloor');F(hx*TS+3,hy*TS+3,10,9,'rock2');F(hx*TS+4,hy*TS+4,7,5,'rock');}
    for(const [rx,ry] of RK.rocks){F(rx*TS+1,ry*TS+12,14,3,'cwall2');c.fillStyle=P.rock2;c.beginPath();c.ellipse(rx*TS-cx+8,ry*TS-cy+8,7.5,7,0,0,7);c.fill();c.fillStyle=P.rock;c.beginPath();c.ellipse(rx*TS-cx+7,ry*TS-cy+7,6,5.5,0,0,7);c.fill();F(rx*TS+4,ry*TS+4,3,2,'shore');}}
  if(OWC.crack)for(const k in OWC.crack){const [hx,hy]=k.split(',').map(Number);const X=hx*TS-cx,Y=hy*TS-cy;c.strokeStyle=P.crack;c.lineWidth=1;c.beginPath();c.moveTo(X+2,Y+3);c.lineTo(X+7,Y+8);c.lineTo(X+13,Y+4);c.moveTo(X+7,Y+8);c.lineTo(X+5,Y+14);c.moveTo(X+7,Y+8);c.lineTo(X+14,Y+12);c.stroke();c.fillStyle='rgba(30,70,110,.35)';c.fillRect(X+5,Y+6,5,4);}
  const items=m.items||{};for(const k in items){if(state.owItems&&state.owItems[state.ow.map+k])continue;const [ix,iy]=k.split(',').map(Number);const X=ix*TS-cx,Y=iy*TS-cy;c.fillStyle='#f2604a';c.fillRect(X+5,Y+6,6,3);c.fillStyle='#f2f2f2';c.fillRect(X+5,Y+9,6,3);c.fillStyle='#283040';c.fillRect(X+5,Y+9,6,1);c.fillRect(X+7,Y+8,2,2);}
  const ents=owNpcs(m).map(n=>({y:n.y*TS,draw:()=>{const X=n.x*TS-cx,Y=n.y*TS-cy;if(n.look==='boss'){const im=owSpriteImg(n.sp);c.fillStyle='rgba(0,0,0,.25)';c.fillRect(X-2,Y+13,20,3);if(im.complete)c.drawImage(im,X-6,Y-12,28,28);}else owPerson(c,X,Y,n.look,n.dir,0);}}));
  if(m.cars&&OWC.cars)OWC.cars.forEach(car=>ents.push({y:car.y*TS,draw:()=>{const X=Math.round(car.x)-cx,Y=car.y*TS-cy;c.fillStyle='rgba(0,0,0,.3)';c.fillRect(X+1,Y+12,car.len,3);c.fillStyle=car.col;c.fillRect(X,Y+2,car.len,11);c.fillStyle='#283040';c.fillRect(X+(car.dir>0?16:4),Y+4,8,7);c.fillStyle='#8ad0f0';c.fillRect(X+(car.dir>0?17:5),Y+5,6,5);c.fillStyle='#1a1a1a';c.fillRect(X+4,Y+12,5,3);c.fillRect(X+car.len-9,Y+12,5,3);c.fillStyle=state.time>=2?'#fff2b0':'#f2f2d0';c.fillRect(car.dir>0?X+car.len-2:X,Y+4,2,3);}}));
  ents.push({y:py,draw:()=>owPerson(c,Math.round(px-cx),Math.round(py-cy)-1,'me',o.dir,mv?Math.floor(OWC.anim/6)%4===1||Math.floor(OWC.anim/6)%4===3?1:0:0)});
  ents.sort((a,b)=>a.y-b.y).forEach(e=>e.draw());
  const here=m.rows[o.y]&&m.rows[o.y][o.x];
  const lh=m.objs.find(x=>x[0]==='lighthouse');
  if(lh&&state.time>=2){const lx=lh[1]*TS+8-cx,ly=lh[2]*TS-33-cy,a=Date.now()/1400;c.save();c.globalCompositeOperation='lighter';c.fillStyle=`rgba(255,240,170,${state.time===3?.2:.1})`;c.beginPath();c.moveTo(lx,ly);c.arc(lx,ly,190,a-.18,a+.18);c.closePath();c.fill();c.beginPath();c.moveTo(lx,ly);c.arc(lx,ly,190,a+Math.PI-.18,a+Math.PI+.18);c.closePath();c.fill();c.restore();}
  if(OWC.fish){const X=Math.round(px-cx),Y=Math.round(py-cy);const [dx,dy]=OWD[o.dir];c.strokeStyle='rgba(240,240,240,.8)';c.lineWidth=.5;c.beginPath();c.moveTo(X+8+dx*6,Y+4);c.lineTo(X+8+dx*20,Y+8+dy*20);c.stroke();
    const bite=OWC.fish.phase==='bite';c.fillStyle='#0a0f1c';c.fillRect(X+3,Y-13,11,10);c.fillStyle=bite?'#ff5a4a':'#eaeef7';if(bite){c.fillRect(X+8,Y-12,2,5);c.fillRect(X+8,Y-6,2,2);}else{[5,8,11].forEach((a,i)=>{if(Math.floor(Date.now()/300)%4>i)c.fillRect(X+a,Y-7,1,1);});}
    c.fillStyle=bite?'#ff5a4a':'#eaeef7';c.fillRect(X+8+dx*20,Y+8+dy*20+(bite?Math.sin(Date.now()/40):0),2,2);}
  if(here==='y'&&!mv){const X=o.x*TS-cx,Y=o.y*TS-cy;c.fillStyle=P.deep2;c.fillRect(X+2,Y+12,12,4);c.fillStyle=P.deep;c.fillRect(X+3,Y+11,10,3);}
  if(here==='T'&&!mv&&m.ground==='snow'){const X=o.x*TS-cx,Y=o.y*TS-cy;c.fillStyle=P.sasa;c.fillRect(X+2,Y+12,12,4);c.fillStyle=P.snow;c.fillRect(X+3,Y+11,4,1);c.fillRect(X+9,Y+11,4,1);}
  else if(here==='T'&&!mv){const X=o.x*TS-cx,Y=o.y*TS-cy;c.fillStyle=P.tall;c.fillRect(X+2,Y+12,12,4);c.fillStyle=P.tall2;for(let k=0;k<4;k++)c.fillRect(X+3+k*3,Y+11,1,4);}
  if(here==='Q'&&!mv){c.strokeStyle='rgba(232,238,246,.85)';c.lineWidth=.6;const X=o.x*TS-cx,Y=o.y*TS-cy;c.beginPath();c.moveTo(X+1,Y+4);c.lineTo(X+15,Y+12);c.moveTo(X+15,Y+3);c.lineTo(X+1,Y+13);c.stroke();}
  if(state.time===3&&m.ground==='grass'){for(let i=0;i<10;i++){const t=(Date.now()/900+i*1.7);const fx=((i*53)%(m.rows[0].length*TS))-cx+Math.sin(t)*4,fy=((i*97)%(m.rows.length*TS))-cy+Math.cos(t*1.3)*3;const rw=m.rows[Math.floor((fy+cy)/TS)];if(rw&&'RTW'.includes(rw[Math.floor((fx+cx)/TS)])){c.fillStyle=(i+Math.floor(t))%3?'#e8ff8a':'rgba(232,255,138,.4)';c.fillRect(Math.round(fx),Math.round(fy),1,1);}}}
  if(m.ground==='snow')owSnowFx(c,m,px-cx+8,py-cy+8);
  if(m.mirror){c.fillStyle='rgba(150,110,230,.16)';c.fillRect(0,0,VW*TS,VH*TS);}
  if(m.fog){c.save();const fx=px-cx+8,fy=py-cy+8,nt=state.time===3,g=c.createRadialGradient(fx,fy,16,fx,fy,state.time===0?50:62);const col=nt?'26,32,48':'214,222,230';g.addColorStop(0,`rgba(${col},0)`);g.addColorStop(1,`rgba(${col},.96)`);c.fillStyle=g;c.fillRect(0,0,VW*TS,VH*TS);
    c.fillStyle=`rgba(${col},.18)`;for(let i=0;i<6;i++){const t=Date.now()/4000+i;c.fillRect(((Math.sin(t)*.5+.5)*VW*TS+i*37)%(VW*TS)-20,(i*29)%(VH*TS),60,10);}c.restore();}
  if(m.wind){const gs=owGust();if(gs!=='calm'){const n=gs==='gust'?26:9;c.fillStyle=P.tree3;for(let i=0;i<n;i++){const t=Date.now()/(gs==='gust'?3:7)+i*97;const lx=(t%(VW*TS+40))-20,ly=(i*53+Math.sin(t/30)*6)%(VH*TS);c.fillRect(Math.round(lx),Math.round(ly),2,1);c.fillRect(Math.round(lx)+1,Math.round(ly)+1,1,1);}}}
  /* まっ暗なトンネル: 主人公のまわりだけ見える */
  if(m.dark){const lit=!m.dim&&owFlag(m.dark);c.save();c.setTransform(OWSCALE,0,0,OWSCALE,0,0);
    const g=c.createRadialGradient(px-cx+8,py-cy+8,lit?40:m.dim?30:14,px-cx+8,py-cy+8,lit?150:m.dim?96:46);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,lit?'rgba(4,6,12,.45)':m.dim?'rgba(4,6,12,.9)':'rgba(4,6,12,.97)');
    c.fillStyle=g;c.fillRect(0,0,VW*TS,VH*TS);c.restore();}
  if(m.cold)owColdBar(c,m);
}
/* 雪: ふる雪・地吹雪・オーロラ */
function owBliz(){const t=Date.now()%26000;return t<18000?'calm':t<21000?'warn':'storm';}
function owSnowFx(c,m,fx,fy){
  const VH=OWC.vh,bz=m.blizzard?owBliz():'calm',now=Date.now();
  if(m.aurora&&state.time>=2){c.save();c.globalCompositeOperation='lighter';for(let b=0;b<3;b++){const a=(state.time===3?.16:.09)*(1-b*.25);c.fillStyle=b===1?`rgba(150,110,255,${a})`:`rgba(90,240,170,${a})`;
      for(let xx=0;xx<VW*TS;xx+=2){const yy=14+b*10+Math.sin(xx/22+now/2400+b*1.7)*7+Math.sin(xx/9+now/1300)*2;c.fillRect(xx,0,2,Math.max(0,yy));}}c.restore();}
  const n=bz==='storm'?70:bz==='warn'?40:18,sp=bz==='storm'?.09:bz==='warn'?.05:.018;
  c.fillStyle='rgba(255,255,255,.85)';
  for(let i=0;i<n;i++){const t=now*sp/16+i*137;const x=bz==='calm'?((i*53+Math.sin(t/40+i)*6)%(VW*TS)+VW*TS)%(VW*TS):(VW*TS)-((t*1.6+i*29)%(VW*TS+20));const y=bz==='calm'?((t*.6+i*41)%(VH*TS)):((i*31+t*.3)%(VH*TS));c.fillRect(Math.round(x),Math.round(y),bz==='calm'?1:2,1);}
  if(bz==='storm'){c.save();const g=c.createRadialGradient(fx,fy,12,fx,fy,46);g.addColorStop(0,'rgba(236,242,250,0)');g.addColorStop(1,'rgba(236,242,250,.95)');c.fillStyle=g;c.fillRect(0,0,VW*TS,VH*TS);c.restore();}
  else if(bz==='warn'){c.fillStyle='rgba(236,242,250,.18)';c.fillRect(0,0,VW*TS,VH*TS);}
}
/* 寒さ: 焚き火から離れて歩くと体が冷える。いっぱいになると焚き火の前へもどされる */
function owColdBar(c,m){
  const v=Math.min(1,(state.owCold||0)/m.cold),VH=OWC.vh,x=5,y=VH*TS-11,w=46;
  c.fillStyle='rgba(10,16,32,.7)';c.fillRect(x-2,y-2,w+16,9);
  c.fillStyle='#bfe4f4';c.fillRect(x,y+2,1,1);c.fillRect(x+2,y,1,5);c.fillRect(x+1,y+1,3,3);c.fillRect(x,y,1,1);c.fillRect(x+4,y,1,1);c.fillRect(x,y+4,1,1);c.fillRect(x+4,y+4,1,1);
  c.fillStyle='#283040';c.fillRect(x+8,y,w,5);
  const col=v<.5?'#8ad0f0':v<.75?'#f2c43a':'#ff5a4a';c.fillStyle=col;c.fillRect(x+8,y,Math.round(w*v),5);
  if(v>=.75&&Math.floor(Date.now()/300)%2){c.fillStyle='rgba(255,90,74,.5)';c.fillRect(x+8,y,w,5);}
}
function owWarashi(){const d=dayKey();if(state.owWara===d)return [['座敷わらし','……(にこにこしている)']];state.owWara=d;healAll();sfx('heal');save();return [['座敷わらし','……あそんでくれるの？'],['','座敷わらしと手まりをついて遊んだ。'],['','なかまの疲れが、すっかりとれた！']];}
function owFeast(){const d=dayKey();if(state.owFeast===d)return [['','お膳は空になっている。']];state.owFeast=d;const it=pick(['onigiri','onigiri','tea','drink','tane']);state.items[it]=(state.items[it]||0)+1;sfx('shiny');save();return [['','お膳の上に、だれかが用意してくれたものがある。'],['',`${ITEMS[it].n}をもらった。`]];}
/* 吊り橋の突風: 7秒ごとに、予兆(木の葉)のあと強い風が吹く */
function owGust(){const t=Date.now()%7000;return t<4600?'calm':t<5400?'warn':'gust';}
/* 狐火の灯籠: 東→西→南→北の順に灯す */
const OW_LSEQ=['E','W','S','N'];
function owToro(id){
  if(owFlag('kitsune')){talk([['','狐火が静かに燃えている。']]);return;}
  OWC.lseq=OWC.lseq||[];if(OWC.lseq.includes(id)){talk([['','この灯籠には、もう火がともっている。']]);return;}
  OWC.lseq.push(id);const ok=OWC.lseq.every((v,i)=>v===OW_LSEQ[i]);
  if(!ok){OWC.lseq=[];sfx('sel');talk([['','灯籠に火をともした……'],['','ふっ、とすべての狐火が消えた。どこかで狐が笑っている……']]);return;}
  sfx('shiny');if(OWC.lseq.length<4){talk([['','灯籠に、青白い狐火がともった。']]);return;}
  owSetFlag('kitsune');save();sfx('win');talk([['','四つの灯籠に、狐火がそろった！'],['','鳥居をふさいでいた結界が、すうっと消えていく……']]);
}
/* 押せる岩: マップに入るたびに元の位置にもどる */
function owRocks(m){const id=state.ow.map;if(!OWC.rk||OWC.rk.map!==id)OWC.rk={map:id,rocks:(m.rocks||[]).map(r=>r.slice()),filled:{}};return OWC.rk;}
const owRockAt=(m,x,y)=>m.rocks?owRocks(m).rocks.findIndex(r=>r[0]===x&&r[1]===y):-1;
/* ---- 移動 ---- */
const OWD={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
function owSolid(m,x,y){
  const ch=(m.rows[y]||'')[x];if(ch===undefined)return true;
  if(ch==='O'&&m.rocks&&owRocks(m).filled[x+','+y]){}else if(OW_SOLID.includes(ch))return true;
  if(ch==='U'&&owTideHigh())return true;
  if((ch==='a'||ch==='v')&&!owFloeOn(ch))return true;
  if(owRockAt(m,x,y)>=0)return true;
  for(const o of m.objs){const [k,ox,oy,w=1,h=1,flag]=o;if(!owObjOn(o))continue;
    if(k==='manhole'||k==='ladder'||k==='shell'||k==='cave'||k==='ring'||k==='fusuma')continue;
    if(k==='shutter'&&owFlag(flag))continue;
    if(k==='torii'){if(y===oy&&(x===ox||x===ox+w-1))return true;continue;}
    if(k==='barrier'){if(y===oy&&(x===ox||x===ox+w-1||!owFlag(flag)))return true;continue;}
    if(x>=ox&&x<ox+w&&y>=oy&&y<oy+h)return true;}
  if(owNpcs(m).some(n=>n.x===x&&n.y===y))return true;
  if(m.items&&m.items[x+','+y]&&!(state.owItems&&state.owItems[state.ow.map+x+','+y]))return true;
  return false;
}
function owTryMove(dir){
  const m=owMap(),o=state.ow;
  if(m.mirror&&(dir==='left'||dir==='right'))dir=dir==='left'?'right':'left';
  if(m.noLook&&dir==='up'&&o.y>=m.noLook[0]&&o.y<=m.noLook[1]){OWC.held=null;OWC.mv=null;state.ow={map:state.ow.map,x:5,y:2,dir:'down'};save();render();talk([['','思わず、後ろをふり返ってしまった……'],['','気がつくと、千本鳥居の入口に立っていた。']]);return;}
  o.dir=dir;if(performance.now()<OWC.stuck)return;const [dx,dy]=OWD[dir],nx=o.x+dx,ny=o.y+dy;
  if(OWC.fish){OWC.fish=null;ui.toast='釣りをやめた。';render();}
  if(m.wind&&owGust()==='gust'&&((m.rows[ny]||'')[nx]==='H'||(m.rows[o.y]||'')[o.x]==='H')){if(performance.now()>(OWC.windMsg||0)){OWC.windMsg=performance.now()+1500;ui.toast='ビュウウウ！ 風が強くて進めない！';render();}return;}
  const door=m.doors&&m.doors[nx+','+ny];if(door&&dir==='up'){OWC.held=null;owDoor(door);return;}
  const w=m.warps&&m.warps[nx+','+ny];if(w&&w.need&&!owFlag(w.need)){if(w.lock&&performance.now()>(OWC.lockMsg||0)){OWC.lockMsg=performance.now()+1500;OWC.held=null;talk([['',w.lock]]);}return;}
  const ri=owRockAt(m,nx,ny);if(ri>=0){const bx=nx+dx,by=ny+dy,RK=owRocks(m),bch=(m.rows[by]||'')[bx];
    if(bch==='O'&&!RK.filled[bx+','+by]){RK.rocks.splice(ri,1);RK.filled[bx+','+by]=true;OWC.stuck=performance.now()+250;sfx('win');ui.toast='ズズン……！ 岩が穴にはまって、道ができた！';render();return;}
    if(!owSolid(m,bx,by)&&!(m.warps&&m.warps[bx+','+by])){RK.rocks[ri]=[bx,by];OWC.stuck=performance.now()+220;sfx('sel');}
    return;}
  if(owSolid(m,nx,ny))return;
  OWC.mv={fx:o.x,fy:o.y,t:0};o.x=nx;o.y=ny;
}
function owArrive(){
  const m=owMap(),o=state.ow,w=m.warps&&m.warps[o.x+','+o.y],here=m.rows[o.y][o.x];
  state.owSteps=(state.owSteps||0)+1;dailyInc('walk');if(state.owSteps>=120){state.owSteps=0;owTimePass();return;}
  if(w&&(!w.need||owFlag(w.need))){state.ow={map:w.to,x:w.x,y:w.y,dir:w.dir};OWC.mv=null;OWC.held=null;OWC.cars=null;OWC.rk=null;OWC.fish=null;OWC.lseq=[];OWC.slide=null;OWC.crack=null;if(!MAPS[w.to].cold)state.owCold=0;owCancelPath();ui.toast=w.msg||MAPS[w.to].name;save();render();return;}
  if(m.cold&&here!=='i'){if(owColdAdd(m,here==='y'?2:1))return;}
  if(here==='u'){if(owThin(m,o))return;}else if(OWC.crack){OWC.crack=null;ui.toast='うしろで、割れた氷がまた凍りついていく……';render();}
  if(here==='i'){OWC.slide=o.dir;}else OWC.slide=null;
  if(m.rings){const rg=m.rings.find(r=>(r[0]===o.x&&r[1]===o.y)||(r[2]===o.x&&r[3]===o.y));if(rg){const to=rg[0]===o.x&&rg[1]===o.y?[rg[2],rg[3]]:[rg[0],rg[1]];o.x=to[0];o.y=to[1];OWC.held=null;OWC.mv=null;sfx('shiny');ui.toast='キノコの輪に足をふみ入れると、ふわりと体がうき上がった……';render();return;}}
  if(OWC.slide)return;
  if(here==='Q'){OWC.stuck=performance.now()+650;OWC.held=null;owCancelPath();ui.toast='クモの糸にからまった！';render();}
  const enc=m.enc||'T';
  if(enc.includes(here)&&state.party.some(x=>x.hp>0)){
    const rate=(m.rate||.11)*(state.lure>0?1.8:1);if(!enc.includes(here))return;
    if(Math.random()<rate){OWC.held=null;OWC.mv=null;owCancelPath();save();owEncounter(m.field);return;}
  }
  if(state.owSteps%10===0)save();
}
/* すべる氷: 何かにぶつかるか、氷の外に出るまで止まれない */
function owSlideStep(){const d=OWC.slide,o=state.ow,bx=o.x,by=o.y,bm=o.map;owTryMove(d);if(!OWC.mv&&o.x===bx&&o.y===by&&state.ow.map===bm){OWC.slide=null;const m=owMap();if(m.cold)owColdAdd(m,1);}}
function owSlideEnd(m,x,y,dx,dy){while((m.rows[y]||'')[x]==='i'){const nx=x+dx,ny=y+dy;if(owSolid(m,nx,ny)||(m.doors&&m.doors[nx+','+ny]))break;x=nx;y=ny;if(m.warps&&m.warps[x+','+y])break;}return [x,y];}
function owHurt(f){state.party.forEach(x=>{if(x.hp>0){const mx=calc(x).hp;x.hp=Math.max(1,x.hp-Math.floor(mx*f));}});}
function owColdAdd(m,n){
  if(m.blizzard&&owBliz()==='storm')n++;
  state.owCold=(state.owCold||0)+n;const v=state.owCold/m.cold;
  if(v>=1){owFreeze();return true;}
  if(v>=.75&&!OWC.coldWarn){OWC.coldWarn=true;ui.toast='体が冷えきってきた……焚き火であたたまろう！';render();}
  if(v<.75)OWC.coldWarn=false;return false;}
function owWarm(msg){state.owCold=0;OWC.coldWarn=false;const o=state.ow;state.owFire={map:o.map,x:o.x,y:o.y,dir:o.dir};save();}
function owFreeze(){
  const m=owMap(),f=state.owFire&&MAPS[state.owFire.map]&&MAPS[state.owFire.map].town===m.town?state.owFire:{map:m.town,...MAPS[m.town].spawn};
  OWC.mv=null;OWC.held=null;OWC.slide=null;OWC.crack=null;OWC.rk=null;OWC.fish=null;owCancelPath();owHurt(.2);state.owCold=0;OWC.coldWarn=false;
  state.ow={map:f.map,x:f.x,y:f.y,dir:f.dir||'down'};sfx('sel');save();render();
  talk([['','寒さで、体が動かなくなってきた……'],['','……気がつくと、焚き火のそばに寝かされていた。'],['','(なかまのHPが減った)']]);}
/* 薄氷: 同じ所を2度ふむと割れる。氷から出ると、割れ目はまた凍る */
function owThin(m,o){
  const k=o.x+','+o.y;OWC.crack=OWC.crack||{};
  if(OWC.crack[k]){OWC.crack=null;OWC.slide=null;OWC.held=null;owCancelPath();owHurt(.15);if(m.cold)state.owCold=Math.min(m.cold-1,(state.owCold||0)+12);const f=m.fallTo;state.ow={map:state.ow.map,x:f.x,y:f.y,dir:f.dir};OWC.mv=null;sfx('sel');save();render();
    talk([['','ピシッ……バリバリッ！'],['','氷が割れて、冷たい水に落ちてしまった！'],['','なんとか、はい上がった……(なかまのHPが減った)']]);return true;}
  OWC.crack[k]=1;
  const tp=m.thinPrize;if(tp&&!owFlag(tp.flag)){const all=m.rows.reduce((n,r)=>n+[...r].filter(c=>c==='u').length,0);if(Object.keys(OWC.crack).length>=all){owSetFlag(tp.flag);OWC.crack=null;OWC.held=null;owCancelPath();Object.entries(tp.items).forEach(([it,n])=>state.items[it]=(state.items[it]||0)+n);sfx('win');save();render();
    talk([['','湖じゅうの氷が、いっせいに鳴りひびいた……！'],['','氷の下から、光るものが浮かび上がってきた。'],['',Object.entries(tp.items).map(([it,n])=>`${ITEMS[it].n}×${n}`).join('と')+'を手に入れた！'],['','割れた氷は、またたく間に凍りなおした。']]);return true;}}
  return false;}
function owTimePass(msg){
  owCancelPath();
  const before=owTideHigh();advanceTime();const m=owMap(),o=state.ow;let t=(msg||'')+`${TIMES[state.time].n}になった。`;
  if(MAPS[state.ow.map]&&TOWN[m.town]&&m.town==='shiomi'&&before!==owTideHigh())t+=owTideHigh()?' 潮が満ちてきた。':' 潮が引いてきた。';
  if(m.rows[o.y][o.x]==='U'&&owTideHigh()&&m.tideSafe){state.ow={map:state.ow.map,...m.tideSafe};OWC.mv=null;OWC.held=null;t+=' 波に押しもどされて、岸にもどった！';}
  if(m.floes)t+=state.time===2?' 沖の流氷が、ゆっくりと流れてきた。':state.time===0?' 流氷の位置が変わった。':'';
  if(m.aurora)t+=state.time===2?' 空にオーロラがかかりはじめた……！':state.time===0?' オーロラが消えた。':'';
  const ch=m.rows[o.y][o.x];if((ch==='a'||ch==='v')&&!owFloeOn(ch)){const f=m.tideSafe||m.spawn;state.ow={map:state.ow.map,x:f.x,y:f.y,dir:f.dir};OWC.mv=null;OWC.held=null;OWC.slide=null;t+=m.aurora?' 光の橋が消えて、足もとがくずれた！ あわてて引き返した。':' 足もとの流氷が流されていく！ あわてて岸へもどった。';}
  ui.toast=t;save();render();
}
/* 釣り */
function owFishStart(m){
  if(!owFlag('rod')){talk([['','海だ。釣りざおがあれば、釣りができそうだ。']]);return;}
  if(!state.party.some(x=>x.hp>0)){talk([['','なかまが戦える状態ではない……']]);return;}
  OWC.fish={phase:'wait',until:performance.now()+1200+Math.random()*2600};OWC.held=null;ui.toast='釣り糸をたらした……';render();
}
function owFishStep(){
  const f=OWC.fish;if(!f)return;const now=performance.now();
  if(f.phase==='wait'&&now>=f.until){f.phase='bite';f.until=now+700;sfx('shiny');}
  else if(f.phase==='bite'&&now>=f.until){OWC.fish=null;ui.toast='にげられた……';render();}
}
function owFishPull(){
  const f=OWC.fish;OWC.fish=null;
  if(f.phase!=='bite'){ui.toast='早すぎた！ 魚に気づかれた。';render();return;}
  const m=owMap(),t=TOWN[m.town],fs=m.fish,tb=fs.table.filter(([,,tm])=>timeOK(tm,state.time)).map(([s,w])=>({w,s}));
  const n=Math.random()<.25?2:1,foes=[];for(let i=0;i<n;i++)foes.push([wpick(tb).s,ri(OW_LV(fs.lv[0],1.25),OW_LV(fs.lv[1],1.25))]);
  ui.toast='';save();startBattle(foes,{field:`${t.name}・釣り`,scene:'port'});
}
function owEncounter(fid){
  const t=TOWN[state.town],f=t.fields.find(x=>x.id===fid);if(!f)return;
  const n=Math.min(f.max,wpick([{w:6,v:1},{w:3,v:2},{w:1,v:3}]).v);
  const tb=f.table.filter(([,,tm])=>timeOK(tm,state.time)).map(([s,w])=>({w,s}));
  const foes=[];for(let i=0;i<n;i++)foes.push([wpick(tb).s,ri(f.lv[0],f.lv[1])]);
  const mrate=.035*((state.lure||0)>0?4:1);if(state.lure>0)state.lure--;
  if(Math.random()<mrate)foes[0]=[pick(TOWNS.indexOf(t)>=2?['haganetsubu','gintachi']:['haganetsubu','koganetsubu','koganetsubu']),ri(f.lv[0],f.lv[1])];
  ui.toast='';startBattle(foes,{field:`${t.name}・${f.name}`,scene:f.scene});
}
/* ゴミ箱: 1日1回ずつ調べられる */
function owTrash(k,kind){
  const pool=kind==='pool',nm=pool?'潮だまり':'ゴミ箱';if(pool&&owTideHigh()){talk([['','潮だまりだ。いまは潮が満ちていて、中がよく見えない。']]);return;}
  const d=dayKey();if(!state.owTrash||state.owTrash.d!==d)state.owTrash={d,u:{}};
  const id=state.ow.map+k;if(state.owTrash.u[id]){talk([['',`${nm}だ。今日はもう何もなさそうだ。`]]);return;}
  state.owTrash.u[id]=true;const r=Math.random();
  const look=`${nm}をのぞきこんだ……`;
  if(r<.3&&state.party.some(x=>x.hp>0)){save();talk([['',look],['','なにかが飛び出してきた！']],()=>owEncounter(owMap().field));return;}
  if(r<.75){const it=pool?pick(['tea','bansoko','drink','tea','bansoko','bansoko','tea','kai']):pick(['bansoko','bansoko','tea','drink','onigiri']);state.items[it]=(state.items[it]||0)+1;sfx('shiny');save();talk([['',look],['',pool?`${ITEMS[it].n}を見つけた！`:`${ITEMS[it].n}が捨てられていた。もらっておこう。`]]);return;}
  if(r<.88&&!pool){const y=ri(30,90);state.yen+=y;save();talk([['',look],['',`${y}円を見つけた！`]]);return;}
  save();talk([['',look],['',pool?'小さなカニが逃げていった。':'ただのゴミだった。']]);
}
function owA(){
  if(ui.dlg){H.dlgNext();return;}
  if(OWC.fish){owFishPull();return;}
  const m=owMap(),o=state.ow;if(!m||OWC.mv)return;const [dx,dy]=OWD[o.dir],x=o.x+dx,y=o.y+dy,k=x+','+y;
  const n=owNpcs(m).find(n=>n.x===x&&n.y===y);
  if(n){if(n.look!=='boss'&&n.look!=='cat')n.dir={up:'down',down:'up',left:'right',right:'left'}[o.dir];const lines=owNpcTalk(n,m);if(lines)talk(lines);else owDraw();return;}
  const obj=m.objs.filter(owObjOn).find(([kk,ox,oy,w=1,h=1])=>x>=ox&&x<ox+w&&y>=oy&&y<oy+h);
  if(obj){const [kk,,,,,flag]=obj;
    if(kk==='trash'){owTrash(k);return;}
    if(kk==='zen'){talk(owFeast());return;}
    if(kk==='kakejiku'||(kk==='tokonoma'&&state.ow.map==='okunoma')){talk(pick([[['','掛け軸に、鏡の前で手をふる子どもの絵が描かれている。'],['','そえ書き「鏡の湖の島へは、鏡の中から渡るべし」']],[['','掛け軸に、長い長い鳥居の道が描かれている。'],['','そえ書き「千本の鳥居をくぐるとき、ふり返る者は入口へもどされる」']],[['','掛け軸に、光る竹と狐の輪が描かれている。'],['','そえ書き「夜の竹林、輪をたどった先に、光る竹あり」']]]));return;}
    if(kk==='irori'){talk([['','囲炉裏に火が入っている。だれもいないのに、鍋がことことと煮えている。']]);return;}
    if(kk==='kaguya'){if(state.time!==3){talk([['','ほかより少し太い竹だ。夜になると、何か起こるのだろうか。']]);return;}if(owFlag(flag)){talk([['','竹の光は、もう消えている。']]);return;}owSetFlag(flag);state.items.saino=(state.items.saino||0)+1;sfx('win');save();talk([['','竹がぼうっと光っている……そっと割ってみた。'],['',`中から${ITEMS.saino.n}が出てきた！`]]);return;}
    if(kk==='ring'){talk([['','地面に、キノコが輪の形に生えている。狐の通り道らしい。']]);return;}
    if(kk==='jizo'){talk([['','お地蔵さまだ。霧の向こうの、ある一点をじっと見つめている。']]);return;}
    if(kk==='toro'){owToro(flag);return;}
    if(kk==='barrier'&&!owFlag(flag)){talk([['','鳥居のあいだに、ふしぎな光の壁がある。通れない。']]);return;}
    if(kk==='honden'){talk([['','天狗岳の奥宮だ。ミチクサ沿線の守り神がまつられている。']]);return;}
    if(kk==='fall'){talk([['','ごうごうと音を立てて、滝が流れ落ちている。']]);return;}
    if(kk==='pool'){owTrash(k,'pool');return;}
    if(kk==='bench'){talk([['','ベンチにすわって、海をながめた……']],()=>owTimePass());return;}
    if(kk==='lighthouse'){talk([['',m.town==='ryuhyo'?'岬の灯台だ。流氷の季節は、夜通し海を照らしている。':'潮見浜の灯台だ。夜になると、海を照らす。']]);return;}
    if(kk==='takibi'){owWarm();sfx('heal');talk([['','焚き火にあたって、体があたたまった。'],['','(寒さがなくなった。体が冷えきったときは、ここへもどってくる)']]);return;}
    if(kk==='onsen'){owWarm();healAll();sfx('heal');save();talk([['','雪にかこまれた、秘湯の露天風呂だ。'],['','なかまといっしょに、ゆっくりつかった……'],['','体のしんまであたたまって、なかま全員が元気になった！']]);return;}
    if(kk==='icefall'){talk([['','滝がまるごと凍りついている。氷の中で、水の流れが止まったまま光っている。']]);return;}
    if(kk==='ferry'){if(!state.boss.ryuhyo){talk([['','流氷観光船だ。氷にはばまれて、ここまでは来られないらしい。']]);return;}talk([['観光船の船長','おーい！ 王者が鎮まったおかげで、氷がゆるんだ。岬まで送るぞ！']],()=>{state.ow={map:'ryuhyo',x:9,y:12,dir:'up'};state.owCold=0;OWC.crack=null;OWC.slide=null;OWC.rk=null;sfx('sel');ui.toast='流氷岬';save();render();});return;}
    if(kk==='crate'){talk([['','魚を入れる木箱だ。少し生ぐさい。']]);return;}
    if(kk==='soko'){talk([['','漁協の倉庫だ。カギがかかっている。']]);return;}
    if(kk==='boat'){talk([['','漁船がもやってある。']]);return;}
    if(kk==='chest'){if(owFlag(flag)){talk([['','宝箱は空っぽだ。']]);return;}owSetFlag(flag);state.items.omamori=(state.items.omamori||0)+1;state.items.kai=(state.items.kai||0)+2;sfx('win');save();talk([['','古い宝箱を開けた！'],['',`${ITEMS.omamori.n}と、${ITEMS.kai.n}×2が入っていた！`]]);return;}
    if(kk==='lever'){if(owFlag(flag)){talk([['','レバーは下がったままだ。']]);return;}owSetFlag(flag);sfx('win');save();talk([['','さびたレバーを、力いっぱい引いた！'],['','ガシャン……！ どこかでシャッターが開く音がした。']]);return;}
    if(kk==='panel'){if(owFlag(flag)){talk([['','配電盤のランプは緑色に光っている。']]);return;}owSetFlag(flag);OWC.bg={};sfx('win');save();talk([['','配電盤のスイッチを入れた！'],['','ブウン……。トンネルに明かりがともった！'],['','地上のほうでも、何かが動き出したようだ。']]);return;}
    if(kk==='shutter'&&!owFlag(flag)){talk([['','シャッターが下りている。びくともしない。']]);return;}
    if(kk==='unit'){talk([['','エアコンの室外機だ。熱い風が出ている。']]);return;}
    if(kk==='train'){talk([['','古い地下鉄の車両が置き去りにされている。']]);return;}
  }
  if(m.signs&&m.signs[k]){talk(m.signs[k]);return;}
  if(m.fish&&'~l'.includes((m.rows[y]||'')[x])){owFishStart(m);return;}
  if((m.rows[y]||'')[x]==='l'){talk([['','氷に穴があいている。釣りざおがあれば、穴釣りができそうだ。']]);return;}
  if(m.doors&&Array.isArray(m.doors[k])){talk(m.doors[k]);return;}
  if(m.items&&m.items[k]){state.owItems=state.owItems||{};const id=state.ow.map+k;if(!state.owItems[id]){state.owItems[id]=true;const it=m.items[k];state.items[it]=(state.items[it]||0)+1;sfx('shiny');save();talk([['',`${ITEMS[it].n}を拾った！`]]);}return;}
  if(m.doors&&m.doors[k]){owDoor(m.doors[k]);}
}
/* ---- タップで歩く ---- */
function owCancelPath(){OWC.path=null;OWC.goal=null;OWC.pathAct=null;}
function owTapLimit(m){if(m.fog)return 3;if(m.blizzard&&owBliz()==='storm')return 3;if(m.dim)return 4;if(m.dark&&!owFlag(m.dark))return 2;return 99;}
function owFindPath(m,sx,sy,goals){
  const W=m.rows[0].length,Hh=m.rows.length,key=(x,y)=>y*W+x,prev=new Map([[key(sx,sy),null]]),q=[[sx,sy]];
  const isGoal=(x,y)=>goals.some(g=>g[0]===x&&g[1]===y);
  if(isGoal(sx,sy))return {path:[],end:[sx,sy]};
  const wd=(x,y)=>(m.warps&&m.warps[x+','+y])||(m.doors&&m.doors[x+','+y]);
  while(q.length){const [x,y]=q.shift();for(const [d,[dx,dy]] of Object.entries(OWD)){let nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=Hh)continue;
      if(!isGoal(nx,ny)&&wd(nx,ny))continue;if(owSolid(m,nx,ny))continue;if(OWC.crack&&OWC.crack[nx+','+ny])continue;
      if((m.rows[ny]||'')[nx]==='i'){[nx,ny]=owSlideEnd(m,nx,ny,dx,dy);}
      const k=key(nx,ny);if(prev.has(k))continue;const goal=isGoal(nx,ny);if(!goal&&wd(nx,ny))continue;
      prev.set(k,[x,y,d]);if(goal){const path=[];let c=[nx,ny];while(true){const pv=prev.get(key(c[0],c[1]));if(!pv)break;path.unshift(pv[2]);c=[pv[0],pv[1]];}return {path,end:[nx,ny]};}
      q.push([nx,ny]);if(prev.size>2500)return null;}}
  return null;
}
function owTap(tx,ty){
  const m=owMap(),o=state.ow;if(!m||ui.dlg||B)return;
  if(OWC.fish){owFishPull();return;}
  if(OWC.slide)return;
  if(m.mirror){ui.toast='鏡の中では、思った場所へうまく進めない……(十字キーで歩こう)';render();return;}
  if(tx===o.x&&ty===o.y){owA();return;}
  const dist=Math.abs(tx-o.x)+Math.abs(ty-o.y),lim=owTapLimit(m);
  if(Math.hypot(tx-o.x,ty-o.y)>lim+.5){ui.toast=m.fog?'霧で先が見えない……':m.blizzard?'吹雪で先が見えない……':'暗くて先が見えない……';render();return;}
  const dirTo=(ax,ay,bx,by)=>bx>ax?'right':bx<ax?'left':by>ay?'down':'up';
  /* となりのマスなら、その方向へ1歩(岩を押す・扉に入る・ワープ) */
  if(dist===1){const d=dirTo(o.x,o.y,tx,ty);const npc=owNpcs(m).some(n=>n.x===tx&&n.y===ty),obj=m.objs.filter(owObjOn).some(([kk,ox,oy,w=1,h=1])=>tx>=ox&&tx<ox+w&&ty>=oy&&ty<oy+h&&!['manhole','ladder','shell','cave','ring','fusuma'].includes(kk));
    const sea='~l'.includes((m.rows[ty]||'')[tx]),door=m.doors&&m.doors[tx+','+ty],item=m.items&&m.items[tx+','+ty]&&!(state.owItems&&state.owItems[state.ow.map+tx+','+ty]),sign=m.signs&&m.signs[tx+','+ty];
    if((npc||obj||sea||item||sign)&&!(door&&d==='up')){o.dir=d;owA();return;}
    OWC.path=[d];OWC.goal=[tx,ty];OWC.pathAct=null;OWC.pathMap=state.ow.map;return;}
  const free=!owSolid(m,tx,ty)&&!(m.doors&&m.doors[tx+','+ty]);
  let goals,act=null;
  if(free)goals=[[tx,ty]];
  else if(m.doors&&m.doors[tx+','+ty]){goals=[[tx,ty+1]];act={dir:'up',step:true};}
  else{goals=Object.entries(OWD).map(([d,[dx,dy]])=>[tx-dx,ty-dy,d]).filter(([x,y])=>!owSolid(m,x,y)||(x===o.x&&y===o.y));act={target:[tx,ty]};}
  const r=owFindPath(m,o.x,o.y,goals);
  if(!r){ui.toast='そこへは行けないようだ。';render();return;}
  if(r.path.length>lim+1&&lim<99){ui.toast=m.fog?'霧で先が見えない……':m.blizzard?'吹雪で先が見えない……':'暗くて先が見えない……';render();return;}
  if(act&&act.target)act.dir=dirTo(r.end[0],r.end[1],tx,ty);
  OWC.path=r.path;OWC.goal=[tx,ty];OWC.pathAct=act;OWC.pathMap=state.ow.map;
}
function owPathStep(){
  if(!OWC.path)return false;const m=owMap();
  if(OWC.pathMap!==state.ow.map||ui.dlg||B){owCancelPath();return false;}
  if(!OWC.path.length){const a=OWC.pathAct;owCancelPath();if(a){if(a.step)owTryMove(a.dir);else{state.ow.dir=a.dir;owA();}}return true;}
  const d=OWC.path.shift(),bx=state.ow.x,by=state.ow.y,bm=state.ow.map;owTryMove(d);
  if(!OWC.mv&&state.ow.x===bx&&state.ow.y===by&&state.ow.map===bm){owCancelPath();}
  return true;
}
function owLoop(ts){
  OWC.raf=requestAnimationFrame(owLoop);
  const cv=document.getElementById('owc');if(!cv){return;}
  if(cv!==OWC.cv){OWC.cv=cv;OWC.ctx=cv.getContext('2d');}
  const m=owMap();
  if(B||!m){OWC.held=null;return;}
  if(ui.dlg||ui.result||ui.gacha){OWC.held=null;owDraw();return;}
  owCarsStep(m);owFishStep();
  if(m.wind&&owGust()==='gust'&&!OWC.mv&&m.rows[state.ow.y][state.ow.x]==='H'&&performance.now()>(OWC.pushT||0)){OWC.pushT=performance.now()+420;const o=state.ow,by=o.y+1;if(!owSolid(m,o.x,by)){OWC.mv={fx:o.x,fy:o.y,t:0};o.y=by;OWC.held=null;}}if(OWC.fish&&OWC.held){OWC.fish=null;ui.toast='釣りをやめた。';OWC.held=null;render();return;}
  if(m.cars&&owCarHit(m)){owCancelPath();const o=state.ow;const back=o.y<=7?6:9;OWC.mv=null;OWC.held=null;o.y=back;o.dir=back===6?'down':'up';OWC.stuck=performance.now()+500;sfx('sel');ui.toast='プップー！ 危ない！ 信号を守ろう。';render();return;}
  const hereT=(m.rows[state.ow.y]||'')[state.ow.x];
  const sp=OWC.slide?.2:hereT==='y'||(OWC.mv&&(m.rows[OWC.mv.fy]||'')[OWC.mv.fx]==='y')?.05:OWC.dash?.17:.09;
  if(OWC.mv){OWC.mv.t+=sp;OWC.anim+=OWC.slide?0:1;if(OWC.mv.t>=1){OWC.mv=null;owArrive();if(OWC.slide&&!B&&!ui.dlg)owSlideStep();else if(OWC.held&&!B&&!ui.dlg)owTryMove(OWC.held);else if(OWC.path&&!B&&!ui.dlg)owPathStep();}}
  else if(OWC.slide&&!B&&!ui.dlg)owSlideStep();
  else if(OWC.held){owCancelPath();owTryMove(OWC.held);}
  else if(OWC.path)owPathStep();
  owDraw();
}
function owEnsureLoop(){if(!OWC.raf)OWC.raf=requestAnimationFrame(owLoop);}
function owActive(){return state&&state.started&&!B&&ui.tab==='map'&&!ui.station&&!ui.inside&&MAPS[state.town]&&state.ow&&MAPS[state.ow.map]&&MAPS[state.ow.map].town===state.town;}
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
    <p class="small muted ow-help">マップをタップでその場所へ・押し続けると指の方へ歩く ・ 十字キーでも歩ける ・ Aで話す・調べる ・ Bで走る(キーボード: 矢印 / Z / X)</p>
  </section>`;
}
function renderStationIn(){
  const h=renderMap(),cut=h.indexOf('<section class="town-grid">');const t=TOWN[state.town];
  return `${h.slice(0,cut)}<div class="panel stack"><h3>${t.name}駅</h3><p class="small muted">電車でほかの駅へ移動できる。歩いて探索できるのは、いまは${TOWNS.filter(x=>MAPS[x.id]).map(x=>x.name).join('・')}(試作)。</p><div class="row"><button class="btn primary" data-act="owExit">駅を出る</button>${t.id==='komorebi'?`<button class="btn" data-act="sento" ${state.yen>=t.sentoP?'':'disabled'}>${t.sento}(${t.sentoP}円)で回復</button>`:''}</div></div>${reqBoard(t)}`;
}
/* 建物の中 */
function renderInside(){
  const t=TOWN[state.town],alive=state.party.some(m=>m.hp>0),k=ui.inside;
  const head=(title,desc)=>`<div class="panel stack inside"><div class="row between"><h3>${title}</h3><button class="btn sm" data-act="owLeave">外に出る</button></div>${desc?`<p class="small muted">${desc}</p>`:''}</div>`;
  if(k==='sauna')return head(t.sento,'なかま全員のHPとMPが全回復する。')+`<div class="panel stack"><div class="row between"><b>${t.id==='kasumi'?'ととのう':'ひとっ風呂'}</b><span class="lv num">${t.sentoP}円</span></div><div><button class="btn primary" data-act="sento" ${state.yen>=t.sentoP?'':'disabled'}>${t.id==='kasumi'?'サウナに入る':'お湯につかる'}</button></div></div><div class="panel stack"><h4>パーティ</h4><div class="list">${state.party.map(m=>mrow(m,false,'gosel')).join('')}</div></div>`;
  if(k==='dome')return head('霞ヶ丘ドーム','配合杯の会場。3試合を勝ち抜けば優勝。')+cupsPanel(alive);
  if(k==='board')return head('掲示板','町の人からの依頼がはり出されている。')+reqBoard(t);
  return head('建物','');
}
/* 入力 */
(function(){
  let tp=null;
  const tileAt=(cv,e)=>{const r=cv.getBoundingClientRect(),s=r.width/(VW*TS);return [Math.floor(((e.clientX-r.left)/s+OWC.camX)/TS),Math.floor(((e.clientY-r.top)/s+OWC.camY)/TS)];};
  const dirAt=(cv,e)=>{const r=cv.getBoundingClientRect(),s=r.width/(VW*TS),dx=(e.clientX-r.left)/s-OWC.ppx,dy=(e.clientY-r.top)/s-OWC.ppy;if(Math.abs(dx)<6&&Math.abs(dy)<6)return null;return Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');};
  document.addEventListener('pointerdown',e=>{const cv=e.target.closest&&e.target.closest('#owc');if(!cv||!owActive())return;e.preventDefault();
    tp={id:e.pointerId,x:e.clientX,y:e.clientY,t:performance.now(),hold:false,cv,last:e};
    try{cv.setPointerCapture(e.pointerId);}catch(_){}
    setTimeout(()=>{if(tp&&!tp.hold&&tp.id===e.pointerId&&!ui.dlg&&!B&&!OWC.fish){const m=owMap();if(m&&m.mirror)return;tp.hold=true;owCancelPath();OWC.held=dirAt(tp.cv,tp.last);}},280);});
  document.addEventListener('pointermove',e=>{if(!tp||e.pointerId!==tp.id)return;tp.last=e;
    if(!tp.hold&&Math.hypot(e.clientX-tp.x,e.clientY-tp.y)>14&&!ui.dlg&&!B&&!OWC.fish){const m=owMap();if(m&&!m.mirror){tp.hold=true;owCancelPath();}}
    if(tp.hold)OWC.held=dirAt(tp.cv,e);});
  const end=e=>{if(!tp||e.pointerId!==tp.id)return;const t=tp;tp=null;if(t.hold){OWC.held=null;return;}
    if(ui.dlg){H.dlgNext();return;}const [x,y]=tileAt(t.cv,e);owTap(x,y);};
  document.addEventListener('pointerup',end);document.addEventListener('pointercancel',e=>{if(tp&&e.pointerId===tp.id){tp=null;OWC.held=null;}});
})();
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

