/* ========== ミチクサ: 歩けるマップ ========== */
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
  dome:'#e8e8ee',dome2:'#c8c8d4',sauna:'#c87a4a',sauna2:'#a85a30',vend:'#e8402c',sand:'#ecd9a6',sand2:'#d8c08a',wet:'#c8b48a',wet2:'#b09c74',sea:'#2a7ac8',sea2:'#5aa8e8',foam:'#e8f6fa',rock:'#7a7470',rock2:'#5e5854',shore:'#8a8278',moss:'#6a8a5a',pier:'#9a7048',pier2:'#7a5434',river:'#3a8ac8',river2:'#8ac8f0',bridge:'#a87a48',bridge2:'#7a5434',rope:'#d8c8a0',pebble:'#b8b0a0',pebble2:'#9a9288',step:'#b0aca4',step2:'#8a8680',lantern:'#8a8a92',fire:'#ff9a3a',fire2:'#ffe08a',bib:'#e8402c',cwall:'#4a4048',cwall2:'#3a3038',cfloor:'#6a6070',cfloor2:'#5a5060',
  skin:'#f2c8a0',cap:'#d84a3a',jacket:'#3a6ad8',pants:'#3a3a4a',hair2:'#3aa8d8',shirt2:'#f2f2f2',hair3:'#d8d8d8',kimono:'#8a5ab8',suit:'#3a3e4a',hair4:'#3a2a20',apron:'#e8a83a',ball:'#f2604a'};
const owMix=(a,b,t)=>{const p=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),A=p(a),B=p(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');};
const OW_LIT=['win','win2','lampl'];
const OW_PALS=[OW_DAY,OW_DAY,
  Object.fromEntries(Object.entries(OW_DAY).map(([k,v])=>[k,OW_LIT.includes(k)?{win:'#ffd36a',win2:'#f2a03a',lampl:'#fff2b0'}[k]:owMix(owMix(v,'#f08a4a',.16),'#1a1020',.14)])),
  Object.fromEntries(Object.entries(OW_DAY).map(([k,v])=>[k,OW_LIT.includes(k)?{win:'#ffd36a',win2:'#f2a03a',lampl:'#fff2b0'}[k]:owMix(v,'#0e1630',.58)]))];

/* タイル
   t木 G草地 P道 T草むら W水 R田んぼ =線路 -ホーム *花 .建物の下
   S歩道 A車道 Z横断歩道 h植えこみ Bビル D路地(出会う) Xトンネルの壁 Y線路跡(出会う) F床 Q蜘蛛の巣 O穴
   N砂浜 U干潟(満潮で海) ~海 E磯 r岩 K桟橋 V洞窟の壁 C洞窟の床
   w川 H吊り橋 b河原 o飛び石 L石段・石だたみ */
const OW_SOLID='tWR=-BAhXO~rVw';
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
    objs:[['shutter',8,1,2,1,'power'],['trash',3,2],['trash',16,4],['trash',1,7],['trash',2,14],['trash',15,14],['trash',6,16],['unit',4,5],['unit',13,11],['lamp',9,8]],
    signs:{'7,9':[['','落書き「廃ビルのシャッターは、地下の配電盤で動くらしい」']]},
    warps:{'0,9':{to:'kasumi',x:18,y:16,dir:'left'},'8,1':{to:'haibiru',x:7,y:11,dir:'up',need:'power'},'9,1':{to:'haibiru',x:7,y:11,dir:'up',need:'power'}},
    npcs:[{id:'cat',x:12,y:9,dir:'left',look:'cat',lines:[['ノラネコ','ニャア。'],['','ネコはゴミ箱のほうをじっと見ている。なにか入っているのかもしれない。']]}],
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
    objs:[['station',6,3,7,2],['bath',1,6,5,3],['house',10,6,4,3],['bench',4,10],['board',12,10],['lighthouse',16,11],['lamp',5,5],['lamp',13,5],['lamp',8,10],['parasol',3,12]],
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
    objs:[['station',6,3,7,2],['shukubo',1,6,5,3],['chaya',10,6,4,3],['board',4,10],['torii',7,12,4,1],['lamp',5,5],['lamp',13,5],['lamp',7,9]],
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
};
/* 話しかけたとき */
function owNpcTalk(n,m){
  if(n.lines)return n.lines;
  if(n.id==='aoi'){const id=m.town;if(!state.rival[id]&&RIVALS[id]){H.rival();return null;}return id==='tengu'?[['アオイ','霧の参道、迷わずに来られた？ わたしは三回くらい入口にもどされた……。'],['アオイ','奥宮の灯籠、順番をまちがえると火が消えちゃうんだって。']]:id==='shiomi'?[['アオイ','漁港の網元さんから、釣りざおはもらった？'],['アオイ','引き潮のときに沖の小島へ渡ると、めずらしい物が落ちてるんだって！']]:id==='kasumi'?[['アオイ','ドームの配合杯、もう出てみた？ わたしはまだ予選落ち……。'],['アオイ','路地裏のゴミ箱、ときどき何か入ってるんだよ。たまに魔生物も！']]:[['アオイ','次に会うときは、もっと強くなってるから！'],['アオイ','田んぼのあぜ道の草むらは、昼と夜で出てくる魔生物がちがうんだよ。']];}
  if(n.id==='kenji'){if(!owFlag('rod')){owSetFlag('rod');sfx('win');save();return [['網元のケンジ','おう、見ない顔だな。釣りはやるかい？'],['ケンジ','こいつをやろう。古い釣りざおだが、まだまだ使えるぞ。'],['','釣りざおをもらった！ 海に向かってAボタンで釣りができる。'],['ケンジ','「！」が出たら、すぐに引くんだぞ。']];}return [['網元のケンジ','夜の桟橋は、昼とはちがう魚がかかるぞ。'],['ケンジ','南の島から、まっ赤な魚が流れてくることもあるらしい。']];}
  if(n.id==='obaa')return state.time===3?[['おばあちゃん','ほれ、田んぼを見てごらん。ホタルが飛んどるじゃろう。'],['おばあちゃん','夜の草むらには、光る魔生物が出るんじゃよ。']]:[['おばあちゃん','こんにちは。この町は田んぼと森しかないけれど、いいところでしょう。'],['おばあちゃん','夜になったら、また来てごらん。田んぼがきれいなんじゃよ。']];
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
  vend:()=>{if(state.yen<120){talk([['','自動販売機だ。スポーツドリンクが120円で売っている。'],['','……お金が足りない。']]);return;}state.yen-=120;state.items.drink=(state.items.drink||0)+1;sfx('sel');save();talk([['','ガコン！'],['','スポーツドリンクを買った。(120円)']]);},
};
const owFlag=k=>k.startsWith('boss:')?!!state.boss[k.slice(5)]:!!(state.owFlags&&state.owFlags[k]);
const owTideHigh=()=>state.time===0||state.time===2;
function owDoor(d){if(Array.isArray(d))talk(d);else OW_DOOR[d]();}
const owSetFlag=k=>{state.owFlags=state.owFlags||{};state.owFlags[k]=true;};

/* ---- 描画 ---- */
const OWC={bg:{},img:{},raf:0,cv:null,ctx:null,held:null,dash:false,mv:null,anim:0,vh:11,cars:null,carsMap:null,stuck:0};
function owMap(){return MAPS[state.ow&&state.ow.map];}
function owNpcs(m){return (m.npcs||[]).filter(n=>!(n.look==='boss'&&state.boss[m.town])&&!(n.night&&state.time!==3));}
const OW_DYN=['light','lever','shutter','panel','chest','jizo','toro','barrier'];
function owPaint(m,ti){
  const P=OW_PALS[ti],W=m.rows[0].length,Hh=m.rows.length,cv=document.createElement('canvas');cv.width=W*TS;cv.height=Hh*TS;const x0=cv.getContext('2d');
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;},rr=n=>Math.floor(rnd()*n);
  const R=(x,y,w,h,c)=>{x0.fillStyle=P[c]||c;x0.fillRect(x,y,w,h);},px=(x,y,c)=>R(x,y,1,1,c);
  const E=(cx,cy,rx,ry,c)=>{for(let y=-ry;y<ry;y++){const w=Math.round(rx*Math.sqrt(1-((y+.5)/ry)**2));R(cx-w,cy+y,w*2,1,c);}};
  const at=(i,j)=>(m.rows[j]||'')[i]||'#';
  const gk=m.ground==='forest'?['forest','forest2']:['grass','grass2'];
  const ground=(x,y)=>{R(x,y,TS,TS,gk[0]);for(let k=0;k<3;k++){const a=1+rr(13),b=1+rr(13);px(x+a,y+b,gk[1]);px(x+a+1,y+b-1,gk[1]);}if(rnd()<.25)px(x+2+rr(11),y+2+rr(11),'grass3');};
  const side=(x,y)=>{R(x,y,TS,TS,'side');R(x,y+7,TS,1,'side2');R(x+7,y,1,7,'side2');R(x+3,y+8,1,8,'side2');R(x+11,y+8,1,8,'side2');};
  const floor=(x,y)=>{R(x,y,TS,TS,'tile');R(x,y,TS,1,'tile2');R(x,y,1,TS,'tile2');if(rnd()<.3)px(x+2+rr(12),y+2+rr(12),'tile2');};
  const sand=(x,y)=>{R(x,y,TS,TS,'sand');for(let k=0;k<5;k++)px(x+rr(16),y+rr(16),'sand2');};
  const cfl=(x,y)=>{R(x,y,TS,TS,'cfloor');for(let k=0;k<4;k++)px(x+rr(16),y+rr(16),'cfloor2');if(rnd()<.3)R(x+rr(12),y+rr(12),3,2,'cfloor2');};
  const under=(x,y)=>m.ground==='city'?side(x,y):m.ground==='floor'?floor(x,y):m.ground==='alley'?side(x,y):m.ground==='sand'?sand(x,y):m.ground==='cave'?cfl(x,y):ground(x,y);
  const high=ti===0||ti===2;
  const bcol=(i,j)=>['b1','b2','b3','b4'][((i*7+j*13)>>2)%4];
  for(let j=0;j<Hh;j++)for(let i=0;i<W;i++){const ch=at(i,j),x=i*TS,y=j*TS;
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
    if(ch==='L'){R(x,y,TS,TS,'step');R(x,y+7,TS,1,'step2');R(x,y+15,TS,1,'step2');R(x+(j%2?4:10),y,1,7,'step2');R(x+(j%2?10:4),y+8,1,7,'step2');}
  }
  for(let j=0;j<Hh;j++)for(let i=0;i<W;i++)if(at(i,j)==='t'){const x=i*TS,y=j*TS;R(x+6,y+10,4,6,'trunk');E(x+8,y+7,8,8,'tree2');E(x+8,y+6,7,6,'tree');E(x+6,y+4,3,2,'tree3');}
  const shadow=(X,Y,WW)=>{x0.fillStyle='rgba(0,0,0,.16)';x0.fillRect(X+1,Y,WW,2);};
  const building=(x,y,w,h,roof,roof2,dx)=>{const X=x*TS,Y=y*TS,WW=w*TS,HH=h*TS,rh=HH/2+2;shadow(X,Y+HH,WW);
    R(X,Y+rh,WW,HH-rh,'wall');R(X,Y+HH-3,WW,3,'wall2');R(X-1,Y,WW+2,rh,roof);for(let k=Y+3;k<Y+rh;k+=4)R(X-1,k,WW+2,1,roof2);R(X-1,Y+rh-2,WW+2,2,roof2);
    R((x+dx)*TS+4,Y+HH-11,8,11,'door');px((x+dx)*TS+10,Y+HH-6,'plat2');return [X,Y,WW,HH,rh];};
  for(const [k,x,y,w=1,h=1] of m.objs){if(OW_DYN.includes(k))continue;const X=x*TS,Y=y*TS;
    if(k==='station'){const WW=w*TS,HH=h*TS,dx=(x+Math.floor(w/2))*TS;R(X,Y,WW,HH,'wall');R(X,Y,WW,6,'roofg');R(X,Y+6,WW,1,'roofg2');[X+6,X+WW-18].forEach(wx=>{R(wx,Y+11,12,8,'win');R(wx,Y+11,12,2,'win2');});
      R(dx+3,Y+HH-14,10,14,'win2');R(dx+4,Y+HH-13,8,12,'win');R(X+WW/2-14,Y+1,28,4,'plat');R(X+WW/2-14,Y+4,28,1,'plat2');R(X,Y+HH-2,WW,2,'wall2');}
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
function owBg(m,ti){const k=state.ow.map+ti+(m.dark&&owFlag(m.dark)?'L':'');return OWC.bg[k]||(OWC.bg[k]=owPaint(m,ti));}
const OW_LOOKS={me:['cap','jacket','pants'],aoi:['hair2','shirt2','pants'],obaa:['hair3','kimono','kimono'],salary:['hair4','suit','suit'],clerk:['hair4','band','pants'],kid:['cap','apron','pants']};
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
  c.setTransform(OWSCALE,0,0,OWSCALE,0,0);c.imageSmoothingEnabled=false;
  c.fillStyle='#0c1120';c.fillRect(0,0,VW*TS,VH*TS);c.drawImage(bg,-cx,-cy);
  const F=(x,y,w,h,col)=>{c.fillStyle=P[col]||col;c.fillRect(x-cx,y-cy,w,h);};
  /* 状態で変わる物 */
  for(const [k,x,y,w=1,h=1,flag] of m.objs){const X=x*TS,Y=y*TS;
    if(k==='light'){const s=owPedGreen(),on=s==='go'||(s==='blink'&&Math.floor(Date.now()/250)%2);F(X+7,Y+4,2,12,'lampp');F(X+3,Y-6,10,11,'outline');F(X+5,Y-5,6,4,s==='stop'?'#ff5a4a':'#3a2a2a');F(X+5,Y,6,4,on?'#5af08a':'#1e3a2a');}
    if(k==='lever'){const on=owFlag(flag);F(X+3,Y+10,10,5,'stone2');F(X+4,Y+11,8,3,'stone');F(on?X+9:X+6,Y+2,2,9,'lampp');F(on?X+8:X+4,Y,4,3,on?'#5af08a':'#e8402c');}
    if(k==='shutter'&&!owFlag(flag)){for(let a=0;a<w;a++)for(let b=0;b<h;b++){F(X+a*TS,Y+b*TS,TS,TS,'stone2');for(let r=2;r<16;r+=3)F(X+a*TS,Y+b*TS+r,TS,1,'stone');}F(X,Y+h*TS-2,w*TS,2,'outline');}
    if(k==='jizo'){F(X+3,Y+13,10,3,'stone2');F(X+4,Y+5,8,9,'stone');F(X+5,Y,6,6,'stone');F(X+4,Y+6,8,3,'bib');const ex=flag==='left'?-2:flag==='right'?2:0,ey=flag==='up'?-1:0;F(X+6+ex,Y+2+ey,1,1,'outline');F(X+9+ex,Y+2+ey,1,1,'outline');F(X+7+ex,Y+4,2,1,'stone2');}
    if(k==='toro'){const on=owFlag('kitsune')||(OWC.lseq||[]).includes(flag);F(X+5,Y+11,6,5,'lantern');F(X+7,Y+6,2,6,'lantern');F(X+3,Y-2,10,8,'lantern');F(X+5,Y,6,4,on?'fire':'outline');if(on){F(X+6,Y+1,4,2,'fire2');c.save();c.globalCompositeOperation='lighter';c.fillStyle='rgba(255,170,80,.18)';c.beginPath();c.arc(X-cx+8,Y-cy+2,12+Math.sin(Date.now()/150)*1.5,0,7);c.fill();c.restore();}F(X+2,Y-4,12,2,'stone2');}
    if(k==='barrier'){F(X+3,Y-6,3,20,'torii');F(X+w*TS-6,Y-6,3,20,'torii');F(X-1,Y-10,w*TS+2,3,'torii');F(X+2,Y-4,w*TS-4,2,'torii');if(!owFlag(flag)){const a=.35+Math.sin(Date.now()/300)*.15;c.fillStyle=`rgba(200,140,255,${a})`;c.fillRect(X+TS-cx,Y-cy-2,TS,TS+2);c.fillStyle=`rgba(255,220,255,${a})`;for(let r=0;r<16;r+=4)c.fillRect(X+TS-cx,Y-cy+r+((Date.now()/80|0)%4),TS,1);}}
    if(k==='chest'){const op=owFlag(flag);F(X+2,Y+5,12,10,'pier2');F(X+2,Y+(op?2:5),12,op?3:4,'pier');F(X+7,Y+8,2,3,'plat2');if(op)F(X+3,Y+5,10,2,'outline');}
    if(k==='panel'){const on=owFlag(flag);F(X+1,Y-4,14,19,'bwall');F(X+3,Y-2,10,8,'outline');F(X+4,Y-1,3,2,on?'#5af08a':'#5a2a2a');F(X+9,Y-1,3,2,on?'#5af08a':'#e8402c');F(X+4,Y+3,8,1,'stone');F(X+6,Y+8,4,4,'plat2');}
  }
  if(m.rocks){const RK=owRocks(m);for(const k in RK.filled){const [hx,hy]=k.split(',').map(Number);F(hx*TS,hy*TS,TS,TS,'cfloor');F(hx*TS+3,hy*TS+3,10,9,'rock2');F(hx*TS+4,hy*TS+4,7,5,'rock');}
    for(const [rx,ry] of RK.rocks){F(rx*TS+1,ry*TS+12,14,3,'cwall2');c.fillStyle=P.rock2;c.beginPath();c.ellipse(rx*TS-cx+8,ry*TS-cy+8,7.5,7,0,0,7);c.fill();c.fillStyle=P.rock;c.beginPath();c.ellipse(rx*TS-cx+7,ry*TS-cy+7,6,5.5,0,0,7);c.fill();F(rx*TS+4,ry*TS+4,3,2,'shore');}}
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
  if(here==='T'&&!mv){const X=o.x*TS-cx,Y=o.y*TS-cy;c.fillStyle=P.tall;c.fillRect(X+2,Y+12,12,4);c.fillStyle=P.tall2;for(let k=0;k<4;k++)c.fillRect(X+3+k*3,Y+11,1,4);}
  if(here==='Q'&&!mv){c.strokeStyle='rgba(232,238,246,.85)';c.lineWidth=.6;const X=o.x*TS-cx,Y=o.y*TS-cy;c.beginPath();c.moveTo(X+1,Y+4);c.lineTo(X+15,Y+12);c.moveTo(X+15,Y+3);c.lineTo(X+1,Y+13);c.stroke();}
  if(state.time===3&&m.ground==='grass'){for(let i=0;i<10;i++){const t=(Date.now()/900+i*1.7);const fx=((i*53)%(m.rows[0].length*TS))-cx+Math.sin(t)*4,fy=((i*97)%(m.rows.length*TS))-cy+Math.cos(t*1.3)*3;const rw=m.rows[Math.floor((fy+cy)/TS)];if(rw&&'RTW'.includes(rw[Math.floor((fx+cx)/TS)])){c.fillStyle=(i+Math.floor(t))%3?'#e8ff8a':'rgba(232,255,138,.4)';c.fillRect(Math.round(fx),Math.round(fy),1,1);}}}
  if(m.fog){c.save();const fx=px-cx+8,fy=py-cy+8,nt=state.time===3,g=c.createRadialGradient(fx,fy,16,fx,fy,state.time===0?50:62);const col=nt?'26,32,48':'214,222,230';g.addColorStop(0,`rgba(${col},0)`);g.addColorStop(1,`rgba(${col},.96)`);c.fillStyle=g;c.fillRect(0,0,VW*TS,VH*TS);
    c.fillStyle=`rgba(${col},.18)`;for(let i=0;i<6;i++){const t=Date.now()/4000+i;c.fillRect(((Math.sin(t)*.5+.5)*VW*TS+i*37)%(VW*TS)-20,(i*29)%(VH*TS),60,10);}c.restore();}
  if(m.wind){const gs=owGust();if(gs!=='calm'){const n=gs==='gust'?26:9;c.fillStyle=P.tree3;for(let i=0;i<n;i++){const t=Date.now()/(gs==='gust'?3:7)+i*97;const lx=(t%(VW*TS+40))-20,ly=(i*53+Math.sin(t/30)*6)%(VH*TS);c.fillRect(Math.round(lx),Math.round(ly),2,1);c.fillRect(Math.round(lx)+1,Math.round(ly)+1,1,1);}}}
  /* まっ暗なトンネル: 主人公のまわりだけ見える */
  if(m.dark){const lit=!m.dim&&owFlag(m.dark);c.save();c.setTransform(OWSCALE,0,0,OWSCALE,0,0);
    const g=c.createRadialGradient(px-cx+8,py-cy+8,lit?40:m.dim?30:14,px-cx+8,py-cy+8,lit?150:m.dim?96:46);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,lit?'rgba(4,6,12,.45)':m.dim?'rgba(4,6,12,.9)':'rgba(4,6,12,.97)');
    c.fillStyle=g;c.fillRect(0,0,VW*TS,VH*TS);c.restore();}
}
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
  if(owRockAt(m,x,y)>=0)return true;
  for(const [k,ox,oy,w=1,h=1,flag] of m.objs){
    if(k==='manhole'||k==='ladder'||k==='shell'||k==='cave')continue;
    if(k==='shutter'&&owFlag(flag))continue;
    if(k==='torii'){if(y===oy&&(x===ox||x===ox+w-1))return true;continue;}
    if(k==='barrier'){if(y===oy&&(x===ox||x===ox+w-1||!owFlag(flag)))return true;continue;}
    if(x>=ox&&x<ox+w&&y>=oy&&y<oy+h)return true;}
  if(owNpcs(m).some(n=>n.x===x&&n.y===y))return true;
  if(m.items&&m.items[x+','+y]&&!(state.owItems&&state.owItems[state.ow.map+x+','+y]))return true;
  return false;
}
function owTryMove(dir){
  const m=owMap(),o=state.ow;o.dir=dir;if(performance.now()<OWC.stuck)return;const [dx,dy]=OWD[dir],nx=o.x+dx,ny=o.y+dy;
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
  if(w&&(!w.need||owFlag(w.need))){state.ow={map:w.to,x:w.x,y:w.y,dir:w.dir};OWC.mv=null;OWC.held=null;OWC.cars=null;OWC.rk=null;OWC.fish=null;OWC.lseq=[];ui.toast=w.msg||MAPS[w.to].name;save();render();return;}
  if(here==='Q'){OWC.stuck=performance.now()+650;OWC.held=null;ui.toast='クモの糸にからまった！';render();}
  const enc=m.enc||'T';
  if(enc.includes(here)&&state.party.some(x=>x.hp>0)){
    const rate=(m.rate||.11)*(state.lure>0?1.8:1);if(!enc.includes(here))return;
    if(Math.random()<rate){OWC.held=null;OWC.mv=null;save();owEncounter(m.field);return;}
  }
  if(state.owSteps%10===0)save();
}
function owTimePass(msg){
  const before=owTideHigh();advanceTime();const m=owMap(),o=state.ow;let t=(msg||'')+`${TIMES[state.time].n}になった。`;
  if(MAPS[state.ow.map]&&TOWN[m.town]&&m.town==='shiomi'&&before!==owTideHigh())t+=owTideHigh()?' 潮が満ちてきた。':' 潮が引いてきた。';
  if(m.rows[o.y][o.x]==='U'&&owTideHigh()&&m.tideSafe){state.ow={map:state.ow.map,...m.tideSafe};OWC.mv=null;OWC.held=null;t+=' 波に押しもどされて、岸にもどった！';}
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
  const n=Math.random()<.25?2:1,foes=[];for(let i=0;i<n;i++)foes.push([wpick(tb).s,ri(fs.lv[0],fs.lv[1])]);
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
  const obj=m.objs.find(([kk,ox,oy,w=1,h=1])=>x>=ox&&x<ox+w&&y>=oy&&y<oy+h);
  if(obj){const [kk,,,,,flag]=obj;
    if(kk==='trash'){owTrash(k);return;}
    if(kk==='jizo'){talk([['','お地蔵さまだ。霧の向こうの、ある一点をじっと見つめている。']]);return;}
    if(kk==='toro'){owToro(flag);return;}
    if(kk==='barrier'&&!owFlag(flag)){talk([['','鳥居のあいだに、ふしぎな光の壁がある。通れない。']]);return;}
    if(kk==='honden'){talk([['','天狗岳の奥宮だ。ミチクサ沿線の守り神がまつられている。']]);return;}
    if(kk==='fall'){talk([['','ごうごうと音を立てて、滝が流れ落ちている。']]);return;}
    if(kk==='pool'){owTrash(k,'pool');return;}
    if(kk==='bench'){talk([['','ベンチにすわって、海をながめた……']],()=>owTimePass());return;}
    if(kk==='lighthouse'){talk([['','潮見浜の灯台だ。夜になると、海を照らす。']]);return;}
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
  if(m.fish&&(m.rows[y]||'')[x]==='~'){owFishStart(m);return;}
  if(m.doors&&Array.isArray(m.doors[k])){talk(m.doors[k]);return;}
  if(m.items&&m.items[k]){state.owItems=state.owItems||{};const id=state.ow.map+k;if(!state.owItems[id]){state.owItems[id]=true;const it=m.items[k];state.items[it]=(state.items[it]||0)+1;sfx('shiny');save();talk([['',`${ITEMS[it].n}を拾った！`]]);}return;}
  if(m.doors&&m.doors[k]){owDoor(m.doors[k]);}
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
  if(m.cars&&owCarHit(m)){const o=state.ow;const back=o.y<=7?6:9;OWC.mv=null;OWC.held=null;o.y=back;o.dir=back===6?'down':'up';OWC.stuck=performance.now()+500;sfx('sel');ui.toast='プップー！ 危ない！ 信号を守ろう。';render();return;}
  const sp=OWC.dash?.17:.09;
  if(OWC.mv){OWC.mv.t+=sp;OWC.anim++;if(OWC.mv.t>=1){OWC.mv=null;owArrive();if(OWC.held&&!B&&!ui.dlg)owTryMove(OWC.held);}}
  else if(OWC.held)owTryMove(OWC.held);
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
    <p class="small muted ow-help">十字キーで歩く ・ Aで話す・調べる ・ Bを押しながら走る(キーボード: 矢印 / Z / X)</p>
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

