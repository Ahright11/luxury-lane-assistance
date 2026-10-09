/* ============================================================
   ΠΡΟΕΠΙΣΚΟΠΗΣΗ ΣΧΕΔΙΑΣΜΟΥ — συμπεριφορά (βλ. preview.css)
   Φορτώνει στο τέλος του <body>, πριν το window.load.
   ============================================================ */
(function(){
  'use strict';
  var $=function(s,r){return (r||document).querySelector(s)};
  var $$=function(s,r){return [].slice.call((r||document).querySelectorAll(s))};
  var clamp=function(v,a,b){return v<a?a:v>b?b:v};
  var REDUCED=window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---------- 6. Διαδικασία: «01 —» -> «01» (το νούμερο γίνεται γραφικό) ---------- */
  function trimSteps(){
    $$('#process .step .n').forEach(function(n){
      var t=n.textContent.replace(/\s*[—–-]\s*$/,'');
      if(t!==n.textContent) n.textContent=t;
    });
  }
  trimSteps();

  /* ---------- 2. Η ΦΟΡΤΩΣΗ ---------- */
  var SEQ={dir:'assets/load-seq/',count:44,shots:[13,16,15]};
  var about=(function(){
    var sec=$('#about'), band=sec&&$('.band',sec); if(!band) return null;
    var m=$('.m',band), c=$('.c',band); if(!m||!c) return null;

    sec.classList.add('v2'); band.classList.remove('rv');
    var vid=$('video',m); if(vid) vid.remove();          /* αλλιώς ο lazy loader θα το κατέβαζε */
    var stage=document.createElement('div'); stage.className='stage';
    band.appendChild(stage); stage.appendChild(m); stage.appendChild(c);
    var cv=document.createElement('canvas'); cv.setAttribute('role','img');
    cv.setAttribute('aria-label','Φόρτωση οχήματος στην πλατφόρμα'); m.appendChild(cv);
    m.style.backgroundImage='url('+SEQ.dir+'000.webp)';
    var beats=document.createElement('div'); beats.className='beats'; beats.setAttribute('aria-hidden','true');
    beats.innerHTML='<span><b></b></span><span><b></b></span><span><b></b></span>';
    stage.appendChild(beats);
    var bars=$$('b',beats);

    /* οι τρεις λέξεις της υπόσχεσης -> <i>. Το CMS ξαναγράφει το κείμενο όταν
       φορτώσει το περιεχόμενο, οπότε το ξανατυλίγουμε όποτε αλλάξει. */
    var promise=$('.promise',c), words=[];
    function wrapPromise(){
      if(!promise || promise.querySelector('i')) return;
      var parts=promise.textContent.trim().split(/\s+/).filter(Boolean);
      promise.textContent='';
      parts.forEach(function(w,k){ var i=document.createElement('i'); i.textContent=w; promise.appendChild(i); if(k<parts.length-1) promise.appendChild(document.createTextNode(' ')) });
      words=$$('i',promise); lastBeat=-1;
    }
    var lastBeat=-1;
    if(promise){ wrapPromise(); new MutationObserver(wrapPromise).observe(promise,{childList:true,characterData:true,subtree:true}) }

    /* καρέ */
    var imgs=new Array(SEQ.count), asked=false;
    function pad3(n){ return ('00'+n).slice(-3) }
    function loadFrames(){
      if(asked) return; asked=true;
      for(var i=0;i<SEQ.count;i++){ (function(i){ var im=new Image(); im.decoding='async';
        im.onload=function(){ imgs[i]=im; if(i===drawn||drawn<0) draw(Math.max(0,drawn),true) };
        im.src=SEQ.dir+pad3(i)+'.webp'; })(i) }
    }
    var ctx=cv.getContext('2d'), drawn=-1, cw=0, ch=0;
    function size(){
      var r=m.getBoundingClientRect(), d=Math.min(window.devicePixelRatio||1,2);
      var w=Math.round(r.width*d), h=Math.round(r.height*d);
      if(w&&h&&(w!==cw||h!==ch)){ cw=cv.width=w; ch=cv.height=h; drawn=-1 }
    }
    function nearest(i){ if(imgs[i]) return imgs[i]; for(var k=1;k<SEQ.count;k++){ if(imgs[i-k]) return imgs[i-k]; if(imgs[i+k]) return imgs[i+k] } return null }
    function draw(i,force){
      if(i===drawn&&!force) return; var im=nearest(i); if(!im||!cw) return;
      /* cover */
      var s=Math.max(cw/im.naturalWidth,ch/im.naturalHeight), w=im.naturalWidth*s, h=im.naturalHeight*s;
      ctx.drawImage(im,(cw-w)/2,(ch-h)*0.5,w,h); drawn=i;
    }

    var cyc=[$('h2',c)].concat($$('p',c)).filter(Boolean);
    function setBeat(b,local){
      bars.forEach(function(x,k){ x.style.transform='scaleX('+(k<b?1:k===b?local:0)+')' });
      if(b===lastBeat) return; lastBeat=b;
      words.forEach(function(w,k){ w.classList.toggle('on', words.length===3 ? k<=b : true) });
      cyc.forEach(function(el,k){ el.classList.toggle('show', k===Math.min(b,cyc.length-1)) });
      if(promise) promise.classList.add('show');
    }

    var cur=0, target=0, running=false, inView=false;
    function measure(){
      var r=band.getBoundingClientRect(), span=r.height-window.innerHeight;
      var p=span>0 ? clamp(-r.top/span,0,1) : 0;
      target=clamp((p-0.03)/0.94,0,1)*(SEQ.count-1);
    }
    function frame(){
      cur+=(target-cur)*0.2; if(Math.abs(target-cur)<0.02) cur=target;
      var i=Math.round(cur); draw(i);
      var b=0, acc=0; for(var k=0;k<SEQ.shots.length;k++){ if(i<acc+SEQ.shots[k]){ b=k; break } acc+=SEQ.shots[k]; b=k }
      setBeat(b, clamp((cur-acc)/(SEQ.shots[b]-1),0,1));
      if(inView||cur!==target) requestAnimationFrame(frame); else running=false;
    }
    function kick(){ measure(); if(!running){ running=true; requestAnimationFrame(frame) } }

    if(REDUCED){ setBeat(2,1); cyc.forEach(function(el){ el.classList.add('show') }); return {refresh:function(){}} }

    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting) loadFrames() }) },{rootMargin:'120% 0px'}).observe(band);
      new IntersectionObserver(function(es){ es.forEach(function(e){ inView=e.isIntersecting; if(inView){ size(); kick() } }) }).observe(band);
    } else { loadFrames(); inView=true }
    window.addEventListener('scroll',function(){ if(inView) kick() },{passive:true});
    window.addEventListener('resize',function(){ size(); kick() });
    size(); setBeat(0,0); kick();
    return {refresh:function(){ size(); kick() }};
  })();

  /* ---------- 3. Η ΔΙΑΓΡΑΜΜΙΣΗ ---------- */
  var lane=(function(){
    var NS='http://www.w3.org/2000/svg';
    var ORDER=['#why','#services','#coverage','#location','#process','#assistance','#reviews','#contact'];
    var wrap=document.createElement('div'); wrap.id='lane'; wrap.setAttribute('aria-hidden','true');
    function mk(cls){ var s=document.createElementNS(NS,'svg'); s.setAttribute('class',cls);
      s.style.cssText='position:absolute;left:0;top:0;overflow:visible'; var p=document.createElementNS(NS,'path'); s.appendChild(p); wrap.appendChild(s); return {svg:s,path:p} }
    var base=mk('track'), gold=mk('drive'); base.path.setAttribute('class','base'); gold.path.setAttribute('class','gold');
    var stopsG=document.createElementNS(NS,'g'); base.svg.appendChild(stopsG);
    var head=document.createElement('div'); head.id='lane-head'; head.setAttribute('aria-hidden','true');
    document.body.appendChild(wrap); document.body.appendChild(head);

    var top0=0, H=0, ys=[], xs=[], stops=[];
    function pageTop(el){ return el.getBoundingClientRect().top+window.pageYOffset }

    function build(){
      var ref=$('#why .hd')||$('#why .wrap'); var a=$('#about'); if(!ref||!a) return;
      var W=document.documentElement.clientWidth;
      var cl=ref.getBoundingClientRect().left, g=cl<40 ? Math.max(5,cl*0.3) : cl/2;   /* κινητό: κοντά στην άκρη, μακριά από το κείμενο */
      var xL=g, xR=W-g;
      var secs=ORDER.map(function(s){return $(s)}).filter(Boolean); if(secs.length<2) return;

      top0=pageTop(a)+a.offsetHeight;                      /* ξεκινά εκεί που τελειώνει η «φόρτωση» */
      var side=0, x=xL, y=0, d='M'+x+' 0', marks=[];
      secs.forEach(function(s,i){
        var st=pageTop(s)-top0, cs=getComputedStyle(s), pt=parseFloat(cs.paddingTop)||0;
        var hd=$('.hd',s);
        if(i>0){
          var prev=secs[i-1], pb=parseFloat(getComputedStyle(prev).paddingBottom)||0;
          var last=i===secs.length-1;
          var y0=st-pb*0.86, y1=st+pt*0.42;
          if(last){ y1=st; }                                 /* τελευταία στροφή: καταλήγει στο κέντρο, πάνω από το τελικό CTA */
          if(y1-y0>=34){
            var nx=last ? W/2 : (side?xL:xR), k=(y1-y0)*0.62;
            d+=' L'+x+' '+y0.toFixed(1)+' C'+x+' '+(y0+k).toFixed(1)+' '+nx+' '+(y1-k).toFixed(1)+' '+nx+' '+y1.toFixed(1);
            x=nx; y=y1; if(!last) side^=1;
          }
        }
        if(hd && i<secs.length-1){ var hy=pageTop(hd)-top0+hd.offsetHeight*0.5; marks.push([x,hy]) }
      });
      var end=pageTop(secs[secs.length-1])-top0;
      if(y<end) d+=' L'+x+' '+end.toFixed(1);
      H=end+2;

      [base,gold].forEach(function(o){ o.svg.setAttribute('width',W); o.svg.setAttribute('height',H); o.path.setAttribute('d',d) });
      wrap.style.top=top0+'px'; wrap.style.height=H+'px';

      while(stopsG.firstChild) stopsG.removeChild(stopsG.firstChild);
      stops=marks.map(function(mk){ var c=document.createElementNS(NS,'circle'); c.setAttribute('class','stop');
        c.setAttribute('cx',mk[0]); c.setAttribute('cy',mk[1].toFixed(1)); c.setAttribute('r',cl<40?2.75:4.5); stopsG.appendChild(c); return {el:c,y:mk[1]} });

      /* δείγματα (y -> x) για την κεφαλή */
      var L=base.path.getTotalLength(), n=Math.max(2,Math.ceil(L/6)); ys=new Array(n+1); xs=new Array(n+1);
      for(var k=0;k<=n;k++){ var pt2=base.path.getPointAtLength(L*k/n); ys[k]=pt2.y; xs[k]=pt2.x }
      update();
    }

    function xAt(yv){ var lo=0, hi=ys.length-1; if(hi<1) return 0;
      while(lo<hi){ var mid=(lo+hi)>>1; if(ys[mid]<yv) lo=mid+1; else hi=mid }
      if(lo===0) return xs[0];
      var y0=ys[lo-1], y1=ys[lo], t=y1>y0?(yv-y0)/(y1-y0):0; return xs[lo-1]+(xs[lo]-xs[lo-1])*t }

    var raf=0;
    function update(){
      raf=0; if(!H) return;
      var yv=window.pageYOffset+window.innerHeight*0.62-top0;
      var yc=clamp(yv,0,H);
      if(!REDUCED) gold.svg.style.clipPath='inset(0 0 '+Math.max(0,H-yc).toFixed(1)+'px 0)';
      stops.forEach(function(s){ s.el.classList.toggle('on', REDUCED || s.y<=yc) });
      var live=yv>4 && yv<H-4;
      head.classList.toggle('on',live);
      if(live) head.style.transform='translate3d('+xAt(yc).toFixed(1)+'px,'+(top0+yc).toFixed(1)+'px,0)';
    }
    function onScroll(){ if(!raf) raf=requestAnimationFrame(update) }
    var t=0; function later(){ clearTimeout(t); t=setTimeout(build,140) }

    window.addEventListener('scroll',onScroll,{passive:true});
    window.addEventListener('resize',later);
    window.addEventListener('load',later);
    if(document.fonts&&document.fonts.ready) document.fonts.ready.then(later);
    /* το ύψος της σελίδας αλλάζει όταν φορτώσει το περιεχόμενο του CMS / οι εικόνες */
    if('ResizeObserver' in window){ var ro=new ResizeObserver(later); $$('main,section,.sec,.roadside,.end').forEach(function(s){ ro.observe(s) }) }
    build();
    return {build:build};
  })();

  /* το CMS γεμίζει τη σελίδα λίγο μετά: ξανακόβουμε τα νούμερα των βημάτων */
  window.addEventListener('load',function(){ setTimeout(trimSteps,400); setTimeout(trimSteps,1800) });
})();
