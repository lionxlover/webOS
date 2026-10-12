# Metadata for the extra store content built by scripts/build_store.py
APPS = {  # id: (name, category, icon, color, desc, long, window, rating, downloads)
 'connectfour': ('Connect Four', 'Games', '🔴', '#f43f5e', 'Drop discs, line up four — vs a minimax CPU', 'The classic vertical strategy game with a depth-limited minimax opponent. Choose Easy, Medium or Hard, track wins and draws, and hover a column to preview your drop.', {'width':480,'height':560,'minWidth':360,'minHeight':480}, 4.7, 9800),
 'reversi': ('Reversi', 'Games', '⚫', '#10b981', 'Flip the board in this 8x8 strategy classic', 'Outflank your opponent to flip their discs. Legal moves are highlighted, the CPU plays corner-aware, and scores update live.', {'width':460,'height':560,'minWidth':340,'minHeight':460}, 4.6, 7400),
 'hangman': ('Hangman', 'Games', '🪢', '#f59e0b', 'Guess the word before the gallows is complete', 'Four word categories, on-screen and physical keyboard input, streak tracking and a hand-drawn gallows.', {'width':460,'height':580,'minWidth':360,'minHeight':500}, 4.4, 6100),
 'mazerunner': ('Maze Runner', 'Games', '🧭', '#38bdf8', 'Procedural mazes — race through at growing sizes', 'Every maze is freshly generated with a recursive backtracker. Steer with arrows or WASD and beat the clock as mazes grow larger each level.', {'width':520,'height':600,'minWidth':380,'minHeight':460}, 4.5, 6900),
 'gameoflife': ('Game of Life', 'Education', '🧬', '#7EE787', "Conway's cellular automaton, draw and evolve", "Paint cells, choose a preset pattern such as a glider or pulsar, and watch generations unfold at an adjustable speed on a wrap-around grid.", {'width':560,'height':600,'minWidth':380,'minHeight':420}, 4.8, 11200),
 'mandelbrot': ('Mandelbrot Explorer', 'Education', '🌌', '#818cf8', 'Zoom endlessly into the Mandelbrot set', 'Click to zoom, right-click to zoom out, change the iteration depth and colour palette. Rendering is progressive so the UI stays responsive.', {'width':600,'height':520,'minWidth':380,'minHeight':360}, 4.7, 8300),
 'solarsystem': ('Solar System', 'Education', '🪐', '#fbbf24', 'Animated orrery of the eight planets', 'Watch the planets orbit at relative speeds, click any world for facts, pause the clock, hide orbit lines and scrub the simulation speed.', {'width':620,'height':600,'minWidth':380,'minHeight':420}, 4.8, 12800),
 'morse': ('Morse Translator', 'Utilities', '📡', '#34d399', 'Text to Morse and back, with audio playback', 'Translate both ways as you type, hear the code via Web Audio at your chosen words-per-minute, and keep a reference chart at hand.', {'width':560,'height':620,'minWidth':380,'minHeight':480}, 4.5, 5300),
 'barcode': ('Barcode Maker', 'Utilities', '▮▯▮', '#e5e7eb', 'Create Code 39 barcodes and export as SVG', 'Type text and get a scannable Code 39 barcode instantly. Adjust the height, download a crisp vector SVG or copy its markup.', {'width':520,'height':440,'minWidth':360,'minHeight':380}, 4.3, 4200),
 'gradientgen': ('Gradient Studio', 'Design', '🌈', '#c084fc', 'Build CSS gradients visually and copy the code', 'Linear, radial and conic gradients with up to eight colour stops, a live preview, randomise button and one-click CSS copy.', {'width':520,'height':640,'minWidth':380,'minHeight':520}, 4.7, 9100),
 'boxshadow': ('Shadow Lab', 'Design', '🔲', '#94a3b8', 'Design box-shadows and copy the CSS', 'Sliders for offset, blur, spread, opacity and radius, inset toggle and custom colours — with ready-to-paste CSS output.', {'width':480,'height':640,'minWidth':380,'minHeight':540}, 4.5, 6200),
 'emicalc': ('Loan EMI Calculator', 'Finance', '🏦', '#60a5fa', 'Monthly instalments, interest and totals at a glance', 'Slide amount, rate and tenure to see your EMI, total interest and total payment, with a principal-vs-interest chart.', {'width':520,'height':640,'minWidth':380,'minHeight':560}, 4.6, 8800),
 'bmicalc': ('BMI Calculator', 'Health', '⚖️', '#4ade80', 'Body-mass index with metric and imperial units', 'Enter height and weight in metric or imperial units and see your BMI, category, a colour scale and the healthy weight range.', {'width':440,'height':560,'minWidth':340,'minHeight':480}, 4.2, 5100),
 'tipcalc': ('Tip & Split', 'Finance', '🧾', '#fb923c', 'Tip and bill splitter for dinner with friends', 'Choose a tip percentage, set the number of diners and optionally round up each share. Clear totals, nothing more.', {'width':440,'height':560,'minWidth':340,'minHeight':500}, 4.6, 7700),
 'matrixrain': ('Matrix Rain', 'Media', '💊', '#00ff66', 'Cascading code rain with adjustable style', 'Falling glyphs in katakana, binary, hex or symbols, with speed, size and colour controls including a rainbow mode. Great as a screensaver window.', {'width':560,'height':420,'minWidth':320,'minHeight':260}, 4.6, 10400),
 'asciiart': ('ASCII Art', 'Media', '🔤', '#a3e635', 'Turn images and text into ASCII art', 'Drop in a picture to convert it into characters, or render big block text. Adjust width, invert shades and copy the result.', {'width':620,'height':560,'minWidth':400,'minHeight':380}, 4.4, 5600),
 'particles': ('Particle Toy', 'Media', '✨', '#f472b6', 'Thousands of particles that follow your pointer', 'Attract, repel, swirl or burst up to 1,500 colourful particles with the mouse or touch. Toggle motion trails and watch the patterns.', {'width':620,'height':500,'minWidth':360,'minHeight':320}, 4.7, 9700),
 'loremgen': ('Lorem Forge', 'Utilities', '📝', '#fcd34d', 'Placeholder text in four flavours', 'Generate paragraphs, sentences or words in classic Latin, hipster, corporate-tech or space-opera vocabularies — then copy.', {'width':560,'height':520,'minWidth':380,'minHeight':400}, 4.3, 3900),
 'wordcounter': ('Word Counter', 'Productivity', '🔢', '#38bdf8', 'Words, characters, reading time and top keywords', 'Live counts for words, characters, sentences and paragraphs, estimated read time, keyword frequency and quick case tools.', {'width':560,'height':560,'minWidth':400,'minHeight':440}, 4.5, 6800),
 'sortviz': ('Sort Visualizer', 'Education', '📊', '#fb7185', 'Watch six sorting algorithms race', 'Bubble, insertion, selection, quick, merge and heap sort animated on up to 150 bars with adjustable speed and a comparison counter.', {'width':640,'height':460,'minWidth':400,'minHeight':320}, 4.6, 7100),
 'numberbase': ('Base Converter', 'Utilities', '💾', '#22d3ee', 'Decimal, binary, octal, hex and any base to 36', 'Edit any field and the others follow. Includes a 32-bit toggle grid, an ASCII preview and a custom base up to 36.', {'width':540,'height':560,'minWidth':380,'minHeight':460}, 4.4, 4600),
 'fractaltree': ('Fractal Tree', 'Education', '🌳', '#4ade80', 'A wind-swept recursive tree through the seasons', 'Tweak depth, branch angle and shrink factor, add wind and flip through the seasons. Every seed grows a different tree.', {'width':560,'height':560,'minWidth':380,'minHeight':420}, 4.6, 6400),
}
ZIPS = {  # id: (category-from-app.json, long, rating, downloads, changelog)
 'periodictable': ('All 118 elements in a colour-coded table with search, category filters, electron configurations and a detail panel. Data lives in its own js file — a multi-file package.', 4.8, 10900),
 'journal': ('A private daily journal: dated entries, mood picker, search, word count, autosave to on-device storage and Markdown export. Split into store.js and app.js modules.', 4.7, 8600),
 'bookmarks': ('A tag-filterable bookmark manager with seeded favourites, visit counts, sorting, JSON import/export and persistent storage.', 4.5, 5200),
 'palettes': ('Generate analogous, complementary, triadic, split or random palettes from a base colour, lock swatches, save favourites and copy CSS variables. Ships its own SVG logo asset.', 4.7, 7800),
 'spirograph': ('Hypotrochoid curve designer with a maths module, progressive rendering, random presets and PNG export.', 4.6, 6300),
}
THEMES = [
 dict(id='aurora', name='Aurora', mode='dark', accent='#5eead4', desc='Northern lights ribbons over a polar night sky.',
  wallpaper='radial-gradient(60% 50% at 20% 25%, rgba(94,234,212,.45), transparent 65%), radial-gradient(50% 45% at 80% 20%, rgba(129,140,248,.45), transparent 65%), radial-gradient(70% 40% at 50% 85%, rgba(74,222,128,.28), transparent 70%), linear-gradient(170deg,#050b1a,#0a1630 60%,#0b1f2a)'),
 dict(id='solardusk', name='Solar Dusk', mode='dark', accent='#b58900', desc='A warm solarized-style dark theme that is easy on the eyes.',
  wallpaper='radial-gradient(70% 60% at 70% 20%, rgba(203,75,22,.25), transparent 65%), linear-gradient(160deg,#002b36,#073642 60%,#0a3f4b)'),
 dict(id='oceanbreeze', name='Ocean Breeze', mode='light', accent='#0ea5e9', desc='Bright seaside blues for sunny-day computing.',
  wallpaper='radial-gradient(60% 45% at 25% 15%, rgba(255,255,255,.8), transparent 60%), radial-gradient(70% 50% at 80% 100%, rgba(14,165,233,.45), transparent 70%), linear-gradient(180deg,#d9f1ff,#a9dcf7 55%,#6fc0ea)'),
 dict(id='mono', name='Mono Paper', mode='light', accent='#111827', desc='Minimal black-on-paper greys with a calm, focused feel.',
  wallpaper='radial-gradient(60% 50% at 50% 0%, #ffffff, transparent 70%), linear-gradient(180deg,#f3f4f6,#e5e7eb 60%,#d1d5db)'),
 dict(id='sunsetblvd', name='Sunset Boulevard', mode='dark', accent='#fb7185', desc='Magenta-to-orange dusk gradients over a violet horizon.',
  wallpaper='radial-gradient(80% 50% at 50% 100%, rgba(251,146,60,.65), transparent 70%), radial-gradient(60% 40% at 20% 30%, rgba(244,63,94,.35), transparent 65%), linear-gradient(180deg,#1b0b33,#3b1048 55%,#6b1d4a)'),
 dict(id='forestcabin', name='Forest Cabin', mode='dark', accent='#86efac', desc='Mossy greens and deep pine shadows — cosy and quiet.',
  wallpaper='radial-gradient(55% 45% at 30% 20%, rgba(134,239,172,.2), transparent 65%), radial-gradient(70% 50% at 80% 90%, rgba(21,128,61,.35), transparent 70%), linear-gradient(165deg,#06150d,#0d2a18 55%,#123521)'),
 dict(id='vaporwave', name='Vaporwave', mode='dark', accent='#f0abfc', desc='Neon pink and cyan haze straight out of 1986.',
  wallpaper='radial-gradient(50% 40% at 25% 25%, rgba(240,171,252,.5), transparent 65%), radial-gradient(55% 45% at 80% 75%, rgba(34,211,238,.45), transparent 65%), linear-gradient(160deg,#1a0b3a,#2a1058 55%,#3a1b6e)'),
]
def _w(h):  # widget shell
    return ('<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%}body{background:linear-gradient(165deg,rgba(17,21,32,.86),rgba(10,13,20,.9));color:#e9edf5;font-family:-apple-system,\'Segoe UI\',system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;user-select:none;overflow:hidden;text-align:center}' + h)
WIDGETS = [
 dict(id='moonphase', name='Moon Phase', desc='Tonight\'s moon phase, illumination and age.', size={'w':240,'h':180}, html=_w(
  'canvas{width:90px;height:90px}.n{font-size:15px;font-weight:700;margin-top:6px}.s{font-size:11px;color:#9aa4b8;margin-top:2px}</style></head><body><canvas id="c" width="180" height="180"></canvas><div class="n" id="n"></div><div class="s" id="s"></div><script>'
  'function age(d){return((d.getTime()/86400000-1.913)%29.530588+29.530588)%29.530588}'
  'function draw(){var a=age(new Date()),f=a/29.530588,x=document.getElementById("c").getContext("2d");x.clearRect(0,0,180,180);x.fillStyle="#1d2437";x.beginPath();x.arc(90,90,70,0,7);x.fill();'
  'x.save();x.beginPath();x.arc(90,90,70,0,7);x.clip();x.fillStyle="#f5efd2";var k=Math.cos(f*2*Math.PI);x.beginPath();'
  'if(f<.5){x.arc(90,90,70,-Math.PI/2,Math.PI/2);x.ellipse(90,90,Math.abs(k)*70,70,0,Math.PI/2,-Math.PI/2,k>0)}else{x.arc(90,90,70,Math.PI/2,-Math.PI/2);x.ellipse(90,90,Math.abs(k)*70,70,0,-Math.PI/2,Math.PI/2,k>0)}x.fill();x.restore();'
  'var N=["New Moon","Waxing Crescent","First Quarter","Waxing Gibbous","Full Moon","Waning Gibbous","Last Quarter","Waning Crescent"];document.getElementById("n").textContent=N[Math.round(f*8)%8];'
  'document.getElementById("s").textContent=Math.round((1-Math.cos(f*2*Math.PI))/2*100)+"% lit · day "+a.toFixed(1)}draw();setInterval(draw,600000)</script></body></html>')),
 dict(id='worldclock', name='World Clock', desc='Five cities, live time with day/night dots.', size={'w':240,'h':200}, html=_w(
  'body{justify-content:center;gap:2px;padding:6px 14px;align-items:stretch}.r{display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px}.r:last-child{border:0}.t{font:600 15px ui-monospace,Menlo,monospace}.d{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px}.z{font-size:10px;color:#8b94ab}</style></head><body><div id="l"></div><script>'
  'var C=[["Los Angeles","America/Los_Angeles"],["New York","America/New_York"],["London","Europe/London"],["Mumbai","Asia/Kolkata"],["Tokyo","Asia/Tokyo"]];'
  'function tick(){var now=new Date();document.getElementById("l").innerHTML=C.map(function(c){var t,h;try{t=now.toLocaleTimeString([],{timeZone:c[1],hour:"2-digit",minute:"2-digit",hour12:false});h=+now.toLocaleString("en-GB",{timeZone:c[1],hour:"2-digit",hour12:false})}catch(e){t="--:--";h=12}'
  'return \'<div class="r"><span><i class="d" style="background:\'+(h>=6&&h<19?"#fbbf24":"#6366f1")+\'"></i>\'+c[0]+\'</span><span class="t">\'+t+"</span></div>"}).join("")}tick();setInterval(tick,5000)</script></body></html>')),
 dict(id='breathe', name='Breathing Guide', desc='A calming 4-4-6 breathing circle.', size={'w':240,'h':190}, html=_w(
  '.o{width:100px;height:100px;border-radius:50%;background:radial-gradient(circle,#5eead4,#0ea5e9);box-shadow:0 0 30px rgba(94,234,212,.5);transition:transform 4s ease-in-out;display:grid;place-items:center;color:#06202a;font-weight:800;font-size:13px}.s{font-size:11px;color:#9aa4b8;margin-top:12px}</style></head><body><div class="o" id="o">Inhale</div><div class="s" id="s">Cycle 0</div><script>'
  'var o=document.getElementById("o"),s=document.getElementById("s"),n=0,P=[["Inhale",4,1.3],["Hold",4,1.3],["Exhale",6,.7]],i=0;'
  'function step(){var p=P[i];o.textContent=p[0];o.style.transitionDuration=p[1]+"s";if(i!=1)o.style.transform="scale("+p[2]+")";if(i==2){n++;s.textContent="Cycle "+n}setTimeout(function(){i=(i+1)%3;step()},p[1]*1000)}step()</script></body></html>')),
 dict(id='yearprogress', name='Year Progress', desc='How much of the year has passed, with a day counter.', size={'w':240,'h':150}, html=_w(
  '.p{font-size:34px;font-weight:800;color:#7EE787}.b{width:80%;height:8px;border-radius:4px;background:rgba(255,255,255,.1);margin:8px 0;overflow:hidden}.b i{display:block;height:100%;background:linear-gradient(90deg,#7EE787,#38bdf8)}.s{font-size:11px;color:#9aa4b8}</style></head><body><div class="p" id="p"></div><div class="b"><i id="f"></i></div><div class="s" id="s"></div><script>'
  'function u(){var n=new Date(),y=n.getFullYear(),a=new Date(y,0,1),b=new Date(y+1,0,1),f=(n-a)/(b-a),d=Math.floor((n-a)/864e5)+1,t=Math.round((b-a)/864e5);document.getElementById("p").textContent=(f*100).toFixed(1)+"%";document.getElementById("f").style.width=f*100+"%";document.getElementById("s").textContent=y+" · day "+d+" of "+t+" · "+(t-d)+" left"}u();setInterval(u,60000)</script></body></html>')),
 dict(id='luckydice', name='Lucky Dice', desc='Tap to roll a pair of dice.', size={'w':240,'h':150}, html=_w(
  '.r{display:flex;gap:14px}.d{width:56px;height:56px;border-radius:12px;background:#f8fafc;display:grid;grid-template:repeat(3,1fr)/repeat(3,1fr);padding:7px;box-shadow:0 4px 12px rgba(0,0,0,.4);cursor:pointer;transition:transform .25s}.d i{border-radius:50%;margin:1px}.d i.on{background:#10131c}.s{font-size:12px;color:#9aa4b8;margin-top:10px}</style></head><body><div class="r" id="r"></div><div class="s" id="s">Tap the dice</div><script>'
  'var M=[[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]],v=[1,1],r=document.getElementById("r");'
  'function paint(){r.innerHTML=v.map(function(n){var h="";for(var i=0;i<9;i++)h+=\'<i class="\'+(M[n-1].indexOf(i)>=0?"on":"")+\'"></i>\';return \'<div class="d">\'+h+"</div>"}).join("");[].forEach.call(r.children,function(d){d.onclick=roll})}'
  'function roll(){var k=0,t=setInterval(function(){v=[1+Math.random()*6|0,1+Math.random()*6|0];paint();if(++k>8){clearInterval(t);document.getElementById("s").textContent="Total: "+(v[0]+v[1])+(v[0]==v[1]?" - doubles!":"")}},60)}paint();roll()</script></body></html>')),
]
def _n(f,t,d,w='sine',v=.4,slide=None):
    o={'f':f,'t':t,'d':d,'w':w,'v':v}
    if slide: o['slide']=slide
    return o
SOUNDPACKS = [
 dict(id='marimba', name='Marimba', desc='Warm wooden mallets — soft, rounded and friendly.', sounds={
  'startup':[_n(392,0,.35,'triangle',.5),_n(523.25,.14,.35,'triangle',.5),_n(659.25,.28,.35,'triangle',.5),_n(784,.42,.6,'triangle',.5)],
  'shutdown':[_n(784,0,.3,'triangle',.45),_n(587.33,.14,.3,'triangle',.45),_n(392,.28,.5,'triangle',.45)],
  'unlock':[_n(523.25,0,.2,'triangle',.5),_n(783.99,.1,.4,'triangle',.5)],'lock':[_n(659.25,0,.2,'triangle',.45),_n(440,.1,.35,'triangle',.45)],
  'launch':[_n(659.25,0,.18,'triangle',.4)],'notify':[_n(880,0,.15,'triangle',.5),_n(1174.66,.12,.3,'triangle',.5)],
  'install':[_n(392,0,.12,'triangle',.45),_n(523.25,.1,.12,'triangle',.45),_n(659.25,.2,.12,'triangle',.45),_n(1046.5,.3,.4,'triangle',.5)],
  'error':[_n(220,0,.2,'triangle',.55),_n(185,.15,.35,'triangle',.55)],'trash':[_n(300,0,.12,'triangle',.4),_n(220,.08,.12,'triangle',.4),_n(150,.16,.2,'triangle',.4)],
  'click':[_n(900,0,.05,'triangle',.3)]}),
 dict(id='spacebleeps', name='Space Bleeps', desc='Retro sci-fi gliding tones and radar pings.', sounds={
  'startup':[_n(150,0,.5,'sawtooth',.25,900),_n(900,.45,.4,'sine',.35,1500),_n(1500,.8,.5,'sine',.3)],
  'shutdown':[_n(1200,0,.5,'sawtooth',.25,120),_n(300,.4,.4,'sine',.3,80)],
  'unlock':[_n(400,0,.15,'square',.2,1200),_n(1200,.14,.2,'sine',.3)],'lock':[_n(1200,0,.15,'square',.2,400),_n(400,.14,.2,'sine',.3)],
  'launch':[_n(500,0,.12,'sawtooth',.2,1400)],'notify':[_n(1760,0,.08,'sine',.4),_n(1760,.14,.08,'sine',.4),_n(2093,.28,.2,'sine',.4)],
  'install':[_n(300,0,.4,'sawtooth',.22,1800),_n(1800,.4,.3,'sine',.3)],'error':[_n(200,0,.3,'square',.3,100),_n(200,.3,.3,'square',.3,100)],
  'trash':[_n(900,0,.3,'sawtooth',.2,100)],'click':[_n(1400,0,.04,'square',.18)]}),
 dict(id='waterdrops', name='Water Drops', desc='Soft droplets and gentle ripples.', sounds={
  'startup':[_n(1200,0,.25,'sine',.4,700),_n(900,.25,.3,'sine',.38,520),_n(1500,.55,.4,'sine',.35,900)],
  'shutdown':[_n(1000,0,.25,'sine',.38,500),_n(700,.28,.35,'sine',.35,300)],
  'unlock':[_n(900,0,.18,'sine',.4,1300),_n(1300,.15,.3,'sine',.35,1000)],'lock':[_n(1300,0,.18,'sine',.4,800),_n(900,.15,.3,'sine',.35,500)],
  'launch':[_n(1000,0,.14,'sine',.35,1400)],'notify':[_n(1400,0,.2,'sine',.45,900),_n(1800,.2,.3,'sine',.4,1100)],
  'install':[_n(800,0,.14,'sine',.4,1200),_n(1000,.13,.14,'sine',.4,1500),_n(1300,.26,.35,'sine',.4,1800)],'error':[_n(400,0,.3,'sine',.5,200),_n(300,.25,.4,'sine',.5,150)],
  'trash':[_n(1100,0,.1,'sine',.4,500),_n(800,.1,.1,'sine',.4,300),_n(500,.2,.2,'sine',.4,200)],'click':[_n(1500,0,.05,'sine',.3,900)]}),
]
