import sys,os,json,hashlib
src,out=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf8').read()
k=s.index('<style>')
headpart,body=s[:k],s[k:]
ver=hashlib.sha1(s.encode()).hexdigest()[:10]
html=f'''<!doctype html>
<html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0c1120">
<meta name="description" content="ローカル線を降りて、草むらで魔生物と出会う。歩いて、配合して、育てるRPG">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
{headpart}<style>html,body{{margin:0;padding:0}}body{{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}</style>
<script>window.JG_APP=true;window.JG_VER="{ver}";</script>
</head><body>
{body}
<script>
/* 新しい版の自動チェック: 開いたときと、アプリに戻ってきたときに確かめる */
(function(){{
  let reg=null,asked=false;
  if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{{updateViaCache:'none'}}).then(r=>{{reg=r;}}).catch(()=>{{}}));
  async function hardReload(){{try{{if(reg)await reg.update();const ks=await caches.keys();await Promise.all(ks.filter(k=>k.startsWith('michikusa-')).map(k=>caches.delete(k)));}}catch(e){{}}location.reload();}}
  function bar(nv){{if(asked||document.getElementById('jg-upd'))return;asked=true;const d=document.createElement('div');d.id='jg-upd';
    d.style.cssText='position:fixed;left:50%;bottom:calc(16px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:99;display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:10px;background:#0a0f1c;border:2px solid #f2b13c;color:#eaeef7;font:14px sans-serif;box-shadow:0 8px 24px #000a;width:max-content;max-width:calc(100% - 32px)';
    d.innerHTML='<span>新しい版があります</span><button style="padding:6px 14px;border-radius:8px;border:0;background:#f2b13c;color:#1b1404;font:inherit;cursor:pointer">更新する</button>';
    d.querySelector('button').onclick=()=>{{try{{if(typeof save==='function')save();}}catch(e){{}}hardReload();}};document.body.appendChild(d);}}
  async function check(){{try{{const t=await (await fetch('./index.html?v='+Date.now(),{{cache:'no-store'}})).text();const m=t.match(/JG_VER="([0-9a-f]+)"/);if(m&&m[1]!==window.JG_VER)bar(m[1]);}}catch(e){{}}}}
  window.addEventListener('load',()=>setTimeout(check,1500));
  document.addEventListener('visibilitychange',()=>{{if(document.visibilityState==='visible'){{check();if(reg)reg.update().catch(()=>{{}});}}}});
}})();
try{{navigator.storage&&navigator.storage.persist&&navigator.storage.persist();}}catch(e){{}}
</script>
</body></html>
'''
os.makedirs(out+'/icons',exist_ok=True)
open(out+'/index.html','w',encoding='utf8').write(html)
man={"name":"ミチクサ鉄道","short_name":"ミチクサ鉄道","description":"ローカル線を降りて、草むらで魔生物と出会う。歩いて、配合して、育てるRPG","lang":"ja","start_url":"./","scope":"./","display":"standalone","orientation":"portrait","background_color":"#0c1120","theme_color":"#0c1120",
 "icons":[{"src":"icons/icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},{"src":"icons/icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},{"src":"icons/icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}
open(out+'/manifest.webmanifest','w',encoding='utf8').write(json.dumps(man,ensure_ascii=False,indent=1))
sw=f'''/* ミチクサ鉄道 オフライン用 (版 {ver}) */
const V='michikusa-{ver}';
const CORE=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));}});
self.addEventListener('activate',e=>{{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('michikusa-')&&k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));}});
self.addEventListener('fetch',e=>{{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.pathname.includes('/kingyo/'))return;
  if(r.mode==='navigate'||(u.origin===location.origin&&u.pathname.endsWith('.html'))){{
    e.respondWith(fetch(r.url,{{cache:'no-store',credentials:'same-origin'}}).then(res=>{{if(res.ok){{const cp=res.clone();caches.open(V).then(c=>c.put('./index.html',cp));}}return res;}}).catch(()=>caches.match('./index.html')));return;
  }}
  if(u.origin===location.origin||/fonts\\.(googleapis|gstatic)\\.com$/.test(u.hostname)){{
    e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{{if(res.ok||res.type==='opaque'){{const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));}}return res;}})));
  }}
}});
'''
open(out+'/sw.js','w',encoding='utf8').write(sw)
print('built',ver)
