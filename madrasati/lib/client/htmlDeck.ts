// العرض التفاعلي: ملف HTML واحد فيه التصميم والحركات والأزرار.
// المحتوى ينحط كبيانات JSON وينرسم بـ textContent، فما فيه أي نص من المساعد ينفّذ ككود.
import type { Presentation } from "@/lib/types";
import type { SlideTheme } from "./pptx";

export interface HtmlDeckOptions {
  theme: SlideTheme;
  byline: string; // مثل: إعداد الطالب: فلان
  meta: string; // المادة — الصف
}

const hex = (c: string) => `#${c}`;
function isDark(c: string) {
  const n = parseInt(c, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CSS = `
:root{--bg:#F4F7FF;--ink:#0B1220;--dim:#56627A;--card:#fff;--line:#D9E2F3;--blue:#0149AD;--navy:#041E52;--accent:#3B82F6;--ok:#16A34A;--bad:#DC2626;--warn:#D97706}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--ink);font-family:"Readex Pro","Tajawal",system-ui,sans-serif;overflow:hidden;-webkit-tap-highlight-color:transparent}
.bgfx{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0}
.bgfx i{position:absolute;width:45vmax;height:45vmax;border-radius:50%;filter:blur(70px);opacity:.16;background:var(--accent);animation:float 22s ease-in-out infinite alternate}
.bgfx i:nth-child(1){top:-15vmax;right:-10vmax}
.bgfx i:nth-child(2){bottom:-20vmax;left:-12vmax;background:var(--blue);animation-duration:28s}
.bgfx i:nth-child(3){top:30%;left:35%;width:25vmax;height:25vmax;background:var(--navy);opacity:.08;animation-duration:34s}
@keyframes float{to{transform:translate(6vmax,4vmax) scale(1.15)}}
#bar{position:fixed;top:0;right:0;height:5px;background:linear-gradient(270deg,var(--blue),var(--accent));transition:width .4s;z-index:5}
.s{position:absolute;inset:0;display:none;flex-direction:column;justify-content:center;align-items:center;gap:2.2vh;padding:8vh 7vw 12vh;text-align:center;z-index:1}
.s.on{display:flex;animation:in .7s cubic-bezier(.2,.7,.2,1)}
@keyframes in{from{opacity:0;transform:translateY(24px) scale(.985)}}
.s.hero{background:linear-gradient(140deg,var(--navy),var(--blue));color:#fff}
.s.hero h1{color:#fff}.s.hero p{color:rgba(255,255,255,.88)}
h1{font:900 clamp(32px,6vw,84px)/1.15 "Alexandria","Tajawal",sans-serif;margin:0;color:var(--blue);letter-spacing:-.5px}
h2{font:800 clamp(24px,3.8vw,52px)/1.25 "Alexandria","Tajawal",sans-serif;margin:0;color:var(--navy)}
h3{font:800 clamp(18px,2.2vw,30px) "Alexandria","Tajawal",sans-serif;margin:0 0 1vh}
p,li{font-size:clamp(16px,2.1vw,28px);line-height:1.8;margin:0}
.sub{color:var(--dim);font-size:clamp(15px,1.8vw,24px)}
.dark h2{color:#fff}
.card{background:var(--card);border:1.5px solid var(--line);border-radius:22px;padding:2.2vh 2.2vw;box-shadow:0 10px 30px rgba(4,30,82,.07)}
.f{opacity:0;transform:translateY(16px);transition:opacity .45s,transform .45s}.f.v{opacity:1;transform:none}
ul.pts{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:1.6vh;width:min(1100px,100%);text-align:start}
ul.pts li{display:flex;gap:1.2vw;align-items:flex-start;background:var(--card);border:1.5px solid var(--line);border-radius:18px;padding:1.6vh 1.8vw}
ul.pts li::before{content:"";flex:none;width:.7em;height:.7em;margin-top:.55em;border-radius:50%;background:var(--accent)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:2vw;width:min(1150px,100%)}
.grid .card{text-align:start}.grid .card b{display:block;color:var(--blue);font:800 clamp(17px,2vw,28px) "Alexandria","Tajawal",sans-serif;margin-bottom:.6vh}
.steps{display:flex;flex-direction:column;gap:1.4vh;width:min(1000px,100%)}
.step{display:flex;align-items:center;gap:1.4vw;text-align:start}
.step .n{flex:none;width:clamp(36px,4vw,56px);height:clamp(36px,4vw,56px);border-radius:50%;display:grid;place-items:center;background:var(--blue);color:#fff;font:800 clamp(16px,1.8vw,24px) "Alexandria",sans-serif}
.step .card{flex:1}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:2.5vw;width:min(1150px,100%)}
.col{display:flex;flex-direction:column;gap:1.2vh}
.col h3{color:#fff;background:var(--blue);border-radius:14px;padding:1vh 1vw}.col.l h3{background:var(--navy)}
.col .card{text-align:start;padding:1.4vh 1.6vw}
.scale{position:relative;width:min(900px,100%);height:min(48vh,420px)}
.post{position:absolute;bottom:0;left:50%;width:14px;height:70%;margin-left:-7px;background:var(--navy);border-radius:8px}
.post::after{content:"";position:absolute;bottom:-6px;left:-60px;width:134px;height:18px;border-radius:10px;background:var(--navy)}
.beam{position:absolute;top:22%;left:8%;right:8%;height:12px;border-radius:8px;background:var(--blue);transition:transform .8s cubic-bezier(.3,1.4,.5,1);transform-origin:50% 50%}
.pan{position:absolute;top:12px;width:38%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center}
.pan.r{left:100%}.pan.l{left:0}
.pan .rope{width:2px;height:6vh;background:var(--dim)}
.pan .dish{min-height:14vh;width:100%;border-radius:0 0 50% 50%/0 0 30% 30%;border:3px solid var(--blue);border-top:none;background:var(--card);display:flex;flex-wrap:wrap;gap:6px;justify-content:center;align-content:flex-end;padding:8px}
.pan h3{font-size:clamp(15px,1.7vw,24px);margin:0 0 .5vh;color:var(--navy)}
.chip{font-size:clamp(12px,1.25vw,18px);padding:4px 10px;border-radius:99px;background:var(--blue);color:#fff;animation:drop .5s cubic-bezier(.3,1.5,.5,1)}
.pan.l .chip{background:var(--navy)}
@keyframes drop{from{transform:translateY(-40px);opacity:0}}
.stats{display:flex;flex-wrap:wrap;justify-content:center;gap:2.5vw}
.stat{min-width:min(240px,40vw)}.stat .v{font:900 clamp(34px,5.5vw,80px) "Alexandria",sans-serif;color:var(--blue);direction:ltr}
.quote{font:800 clamp(24px,3.6vw,52px)/1.5 "Alexandria","Tajawal",sans-serif;color:var(--navy);max-width:1100px;position:relative;padding:0 3vw}
.quote::before,.quote::after{color:var(--accent);font-size:1.4em}.quote::before{content:"«"}.quote::after{content:"»"}
.quiz{width:min(900px,100%);display:flex;flex-direction:column;gap:1.4vh}
.quiz .q{font:800 clamp(19px,2.4vw,32px)/1.5 "Alexandria","Tajawal",sans-serif;margin-bottom:.6vh}
.quiz .meta{color:var(--dim);font-size:clamp(13px,1.4vw,18px)}
.opt{font:600 clamp(15px,1.9vw,26px) "Readex Pro","Tajawal",sans-serif;text-align:start;padding:1.6vh 1.8vw;border-radius:16px;border:2px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;transition:.2s}
.opt:hover:not(:disabled){border-color:var(--accent);transform:translateX(-4px)}
.opt.ok{background:#DCFCE7;border-color:var(--ok);color:#14532D}.opt.bad{background:#FEE2E2;border-color:var(--bad);color:#7F1D1D}
.opt:disabled{cursor:default}
.btn{font:700 clamp(14px,1.5vw,19px) "Readex Pro","Tajawal",sans-serif;border:none;background:var(--blue);color:#fff;border-radius:99px;padding:1.2vh 2.4vw;cursor:pointer}
.btn.ghost{background:transparent;color:var(--blue);border:2px solid var(--blue)}
.score{font:900 clamp(30px,5vw,70px) "Alexandria",sans-serif;color:var(--blue)}
.timer{font:900 clamp(60px,14vw,200px)/1 "Alexandria",sans-serif;color:var(--navy);direction:ltr;font-variant-numeric:tabular-nums}
.timer.done{color:var(--bad);animation:pulse 1s infinite}@keyframes pulse{50%{opacity:.35}}
.row{display:flex;gap:1vw;flex-wrap:wrap;justify-content:center}
.badge{position:absolute;top:3vh;left:3vw;font:700 clamp(12px,1.2vw,16px) "Readex Pro",sans-serif;padding:.6vh 1.2vw;border-radius:99px}
.badge.high{background:#FEE2E2;color:#B91C1C}.badge.medium{background:#FEF3C7;color:#92400E}
.nav{position:fixed;bottom:2vh;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:8px;z-index:6}
.nav button{font:700 15px "Readex Pro","Tajawal",sans-serif;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:99px;min-width:42px;height:42px;padding:0 16px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.06)}
#num{font:700 14px "Readex Pro",sans-serif;color:var(--dim);min-width:64px;text-align:center}
#notes{position:fixed;right:2vw;left:2vw;bottom:9vh;max-height:30vh;overflow:auto;background:rgba(11,18,32,.92);color:#fff;border-radius:18px;padding:2vh 2vw;font-size:clamp(14px,1.5vw,20px);line-height:1.8;display:none;z-index:7}
#notes.on{display:block}
#ov{position:fixed;inset:0;background:var(--bg);z-index:8;display:none;overflow:auto;padding:4vh 4vw}
#ov.on{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;align-content:start}
#ov button{font:700 15px "Readex Pro","Tajawal",sans-serif;text-align:start;aspect-ratio:16/9;border-radius:14px;border:2px solid var(--line);background:var(--card);color:var(--ink);padding:12px;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between}
#ov button.cur{border-color:var(--blue)}#ov small{color:var(--dim)}
#help{position:fixed;top:2vh;right:2vw;font:500 12px "Readex Pro",sans-serif;color:var(--dim);z-index:6;opacity:.8}
@media (max-width:700px){.cols{grid-template-columns:1fr}.s{padding:7vh 5vw 14vh;justify-content:flex-start;overflow-y:auto}#help{display:none}.scale{height:38vh}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media print{.nav,#bar,#help,.bgfx{display:none}}
`;

// كود المشغّل (يشتغل داخل ملف HTML)
const PLAYER = String.raw`
(function(){
var D=JSON.parse(document.getElementById('deck-data').textContent);
var deck=document.getElementById('deck'),bar=document.getElementById('bar'),num=document.getElementById('num'),notes=document.getElementById('notes'),ov=document.getElementById('ov');
function el(t,c,txt){var e=document.createElement(t);if(c)e.className=c;if(txt!=null)e.textContent=txt;return e}
function add(p){for(var i=1;i<arguments.length;i++)if(arguments[i])p.appendChild(arguments[i]);return p}
function kid(p,c){p.appendChild(c);return c}
var S=[],N=[],hooks=[];
function slide(cls,note){var s=el('section','s'+(cls?' '+cls:''));deck.appendChild(s);S.push(s);N.push(note||'');hooks.push(null);return s}
function badge(s,p){if(p==='high'||p==='medium')s.appendChild(el('span','badge '+p,p==='high'?'مهم للاختبار':'يجي أحياناً'))}
function split(t){var i=t.indexOf(':');if(i<0)i=t.indexOf('—');return i>0&&i<60?[t.slice(0,i).trim(),t.slice(i+1).trim()]:['',t]}

// شريحة العنوان
var t=slide('hero',D.title+'. '+(D.subtitle||''));
add(t,el('h1',null,D.title),el('p',null,D.subtitle||''));
if(D.byline||D.meta)t.appendChild(el('p','sub',[D.byline,D.meta].filter(Boolean).join('  •  ')));

D.slides.forEach(function(x){
  var type=x.type||'bullets',s=slide('',x.notes);badge(s,x.priority);
  s.appendChild(el('h2',null,x.title));
  if(x.subtitle&&type!=='quote'&&type!=='timer')s.appendChild(el('p','sub',x.subtitle));
  if(type==='cards'){var g=kid(s,el('div','grid'));x.bullets.forEach(function(b){var p=split(b),c=el('div','card f');if(p[0])c.appendChild(el('b',null,p[0]));c.appendChild(el('p',null,p[1]));g.appendChild(c)})}
  else if(type==='steps'){var st=kid(s,el('div','steps'));x.bullets.forEach(function(b,i){var r=el('div','step f');add(r,el('span','n',String(i+1)),add(el('div','card'),el('p',null,b)));st.appendChild(r)})}
  else if(type==='compare'){var cs=kid(s,el('div','cols')),R=kid(cs,el('div','col')),L=kid(cs,el('div','col l'));R.appendChild(el('h3',null,x.right_title));L.appendChild(el('h3',null,x.left_title));
    var n=Math.max(x.right_items.length,x.left_items.length);for(var i=0;i<n;i++){if(x.right_items[i])R.appendChild(add(el('div','card f'),el('p',null,x.right_items[i])));if(x.left_items[i])L.appendChild(add(el('div','card f'),el('p',null,x.left_items[i])))}}
  else if(type==='balance'){var sc=kid(s,el('div','scale')),beam=el('div','beam');sc.appendChild(el('div','post'));sc.appendChild(beam);
    var pr=el('div','pan r'),pl=el('div','pan l');add(pr,el('div','rope'),el('h3',null,x.right_title),el('div','dish'));add(pl,el('div','rope'),el('h3',null,x.left_title),el('div','dish'));add(beam,pr,pl);
    var queue=[],m=Math.max(x.right_items.length,x.left_items.length);for(var k=0;k<m;k++){if(x.right_items[k])queue.push(['r',x.right_items[k]]);if(x.left_items[k])queue.push(['l',x.left_items[k]])}
    var put=0,rc=0,lc=0;function tilt(){var d=Math.max(-16,Math.min(16,(lc-rc)*5));beam.style.transform='rotate('+d+'deg)';pr.style.transform='translateX(-50%) rotate('+(-d)+'deg)';pl.style.transform='translateX(-50%) rotate('+(-d)+'deg)'}
    hooks[S.length-1]={next:function(){if(put>=queue.length)return false;var it=queue[put++];(it[0]==='r'?pr:pl).querySelector('.dish').appendChild(el('span','chip',it[1]));it[0]==='r'?rc++:lc++;tilt();return true},
      reset:function(){put=rc=lc=0;pr.querySelector('.dish').textContent='';pl.querySelector('.dish').textContent='';tilt()},
      all:function(){while(this.next());}};tilt()}
  else if(type==='stats'){var sw=kid(s,el('div','stats'));x.stats.forEach(function(v){add(sw,add(el('div','card stat f'),el('div','v',v.value),el('p','sub',v.label)))})}
  else if(type==='quote'){s.appendChild(el('p','quote f',x.subtitle||x.bullets[0]||''));if(x.subtitle)x.bullets.forEach(function(b){s.appendChild(el('p','sub f',b))})}
  else if(type==='quiz'){var qz=kid(s,el('div','quiz')),qi=0,score=0;
    function render(){qz.textContent='';if(qi>=x.quiz.length){add(qz,el('p','sub','النتيجة'),el('div','score',score+' / '+x.quiz.length),el('p',null,score===x.quiz.length?'ممتاز! كلها صح':score>=x.quiz.length/2?'زين، راجع اللي غلطت فيه':'راجع الدرس وجرّب مرة ثانية'));var rb=el('button','btn ghost','أعد الاختبار');rb.onclick=function(e){e.stopPropagation();qi=0;score=0;render()};qz.appendChild(add(el('div','row'),rb));return}
      var Q=x.quiz[qi];add(qz,el('div','meta','سؤال '+(qi+1)+' من '+x.quiz.length),el('div','q',Q.question));
      var bs=Q.options.map(function(o,j){var b=el('button','opt',o);b.onclick=function(e){e.stopPropagation();bs.forEach(function(z){z.disabled=true});if(j===Q.answer_index){b.classList.add('ok');score++}else{b.classList.add('bad');bs[Q.answer_index].classList.add('ok')}
        var nb=el('button','btn',qi+1<x.quiz.length?'السؤال التالي':'النتيجة');nb.onclick=function(e){e.stopPropagation();qi++;render()};qz.appendChild(add(el('div','row'),nb));nb.focus()};qz.appendChild(b);return b})}
    render();hooks[S.length-1]={reset:function(){qi=0;score=0;render()}}}
  else if(type==='timer'){if(x.subtitle)s.appendChild(el('p','sub',x.subtitle));var total=(x.timer_minutes||5)*60,left=total,iv=null,tm=el('div','timer');s.appendChild(tm);
    function fmt(){var m=Math.floor(left/60),z=left%60;tm.textContent=(m<10?'0':'')+m+':'+(z<10?'0':'')+z;tm.classList.toggle('done',left===0)}
    var go=el('button','btn','تشغيل'),rs=el('button','btn ghost','إعادة');
    function stop(){clearInterval(iv);iv=null;go.textContent='تشغيل'}
    go.onclick=function(e){e.stopPropagation();if(iv)return stop();if(left===0)left=total;go.textContent='إيقاف';iv=setInterval(function(){left=Math.max(0,left-1);fmt();if(!left)stop()},1000)};
    rs.onclick=function(e){e.stopPropagation();stop();left=total;fmt()};
    s.appendChild(add(el('div','row'),go,rs));if(x.bullets.length){var tl=kid(s,el('ul','pts'));x.bullets.forEach(function(b){tl.appendChild(el('li','f',b))})}fmt()}
  else{var ul=kid(s,el('ul','pts'));x.bullets.forEach(function(b){ul.appendChild(el('li','f',b))})}
});

var e=slide('hero','');add(e,el('h1',null,'شكراً لكم'),D.name?el('p',null,D.name):null);

var i=0;
function hidden(){return Array.prototype.filter.call(S[i].querySelectorAll('.f'),function(f){return!f.classList.contains('v')})}
function show(k,reveal){i=Math.max(0,Math.min(S.length-1,k));S.forEach(function(s,j){s.classList.toggle('on',j===i)});
  var fs=S[i].querySelectorAll('.f');for(var a=0;a<fs.length;a++)fs[a].classList.toggle('v',!!reveal);
  var h=hooks[i];if(h&&h.reset)h.reset();if(reveal&&h&&h.all)h.all();
  num.textContent=(i+1)+' / '+S.length;bar.style.width=((i+1)/S.length*100)+'%';
  notes.textContent=N[i]?'ملاحظات: '+N[i]:'ما فيه ملاحظات لهذي الشريحة.';
  try{history.replaceState(null,'','#'+(i+1))}catch(_){}}
function next(){var h=hidden();if(h.length){h[0].classList.add('v');return}var k=hooks[i];if(k&&k.next&&k.next())return;if(i<S.length-1)show(i+1)}
function prev(){if(i>0)show(i-1,true)}
function overview(on){ov.classList.toggle('on',on);if(!on)return;ov.textContent='';S.forEach(function(s,j){var b=el('button',j===i?'cur':'');var h=s.querySelector('h1,h2');add(b,el('span',null,h?h.textContent:''),el('small',null,String(j+1)));b.onclick=function(e){e.stopPropagation();overview(false);show(j)};ov.appendChild(b)})}
function full(){var d=document;if(!d.fullscreenElement){(d.documentElement.requestFullscreen||function(){}).call(d.documentElement)}else d.exitFullscreen()}
document.getElementById('next').onclick=function(e){e.stopPropagation();next()};
document.getElementById('prev').onclick=function(e){e.stopPropagation();prev()};
document.getElementById('bov').onclick=function(e){e.stopPropagation();overview(!ov.classList.contains('on'))};
document.getElementById('bfs').onclick=function(e){e.stopPropagation();full()};
document.getElementById('bnt').onclick=function(e){e.stopPropagation();notes.classList.toggle('on')};
addEventListener('keydown',function(e){if(e.target.closest&&e.target.closest('input,textarea'))return;var k=e.key;
  if(k==='ArrowLeft'||k===' '||k==='Enter'||k==='PageDown'){if(k!=='Enter'||!(e.target.closest&&e.target.closest('button'))){e.preventDefault();next()}}
  else if(k==='ArrowRight'||k==='PageUp'){e.preventDefault();prev()}
  else if(k==='Home')show(0);else if(k==='End')show(S.length-1,true);
  else if(k==='n'||k==='N'||k==='ى')notes.classList.toggle('on');
  else if(k==='o'||k==='O'||k==='خ')overview(!ov.classList.contains('on'));
  else if(k==='f'||k==='F'||k==='ب')full();
  else if(k==='Escape'){overview(false);notes.classList.remove('on')}});
document.body.addEventListener('click',function(e){if(e.target.closest('button,a,input,select,#notes,#ov'))return;next()});
var x0=null;addEventListener('touchstart',function(e){x0=e.touches[0].clientX},{passive:true});
addEventListener('touchend',function(e){if(x0==null)return;var dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>60){dx>0?next():prev()}},{passive:true});
var h0=parseInt((location.hash||'').slice(1),10);show(h0>0?h0-1:0,h0>1);
})();
`;

/** يبني ملف HTML كامل للعرض */
export function buildHtmlDeck(p: Presentation, o: HtmlDeckOptions & { name?: string }): string {
  const t = o.theme;
  const dark = isDark(t.bg);
  const vars = `:root{--bg:${hex(t.bg)};--ink:${hex(t.text)};--blue:${hex(t.heading)};--navy:${hex(t.titleBg)};--accent:${hex(t.accent)};${
    dark ? "--card:rgba(255,255,255,.06);--line:rgba(255,255,255,.16);--dim:#A5B4CC" : ""
  }}`;
  const data = JSON.stringify({ title: p.title, subtitle: p.subtitle, byline: o.byline, meta: o.meta, name: o.name ?? "", slides: p.slides })
    .replace(/</g, "\\u003c")
    .replace(/[\u2028\u2029]/g, " ");
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(p.title)}</title>
<meta name="generator" content="مساعدي المدرسي">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Alexandria:wght@700;800;900&family=Readex+Pro:wght@400;600;700&display=swap" rel="stylesheet">
<style>${CSS}${vars}</style>
</head>
<body class="${dark ? "dark" : ""}">
<div class="bgfx" aria-hidden="true"><i></i><i></i><i></i></div>
<div id="bar"></div>
<div id="help">التالي: ← أو مسافة · ملاحظات: N · كل الشرائح: O · ملء الشاشة: F</div>
<main id="deck"></main>
<aside id="notes" aria-live="polite"></aside>
<div id="ov"></div>
<nav class="nav">
<button id="prev" aria-label="السابق">→</button>
<span id="num"></span>
<button id="next" aria-label="التالي">←</button>
<button id="bnt" title="ملاحظات المقدم (N)" aria-label="ملاحظات المقدم">ملاحظات</button>
<button id="bov" title="كل الشرائح (O)" aria-label="كل الشرائح">الكل</button>
<button id="bfs" title="ملء الشاشة (F)" aria-label="ملء الشاشة">⛶</button>
</nav>
<script id="deck-data" type="application/json">${data}</script>
<script>${PLAYER}</script>
</body>
</html>`;
}
