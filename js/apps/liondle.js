/* Store app — Liondle: the daily word game. 6 tries, 5 letters, colour feedback. */
(function () {
  'use strict';
  const H = LX.h;
  const WORDS = ('about above actor admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along alter among anger angle angry apart apply arena argue arise armor array aside asset audit avoid award aware badly baker bases basic beach began begin being below bench birth black blade blame blind block blood board boost bound brain brand brave bread break brick brief bring broad broke brown build built bunch burst buyer cabin cable calib camera canal candle canvas carbon career cargo carpet carry carve cause cease chain chair chalk charm chart chase cheap check cheek cheer chess chief child chill china chose civil claim clay clean clear clerk click cliff climb clinic clock close cloth cloud coach coast color comet comic coral corner couch count court cover crack craft crane crash crazy cream crime crisp cross crowd crown crumb crust curve cycle daily dance dated dealt death debut decay delay delta dense depth devil diary digit dirty ditch dizzy dodge doing domain donor doubt dozen draft drain drama drank dream dress drift drill drink drive drove drown drunk dwarf eager eagle early earth easel echo edge eight elite empty enemy enjoy enter entry equal equip error essay event every exact exam exist extra fabric facing factor fairy false fancy fault favor feast fence ferry fever fiber field fiery fifth fifty fight final first flame flash fleet flesh float flood floor flour fluid flute focus force forge forth forty forum found frame fraud fresh front frost fruit fully funny gauge ghost giant given glass globe glory glove going grace grand grant grape graph grass grave great green greet grief grill grind gross group grown guard guess guest guide habit handy happy harsh haste hatch heart heavy hedge hello hence hero hidden hinge hobby hold holiday hollow honor horse hotel house human humid humor hurry ideal image imply index inner input irony issue ivory jelly jewel joint judge juice jumbo kneel knife knock known label labor large laser later laugh layer learn lease least leave legal lemon level lever light limit linen liver lobby local lodge logic loose lorry lower loyal lucky lunch macro magma major maker mango maple march marsh match maybe mayor meant medal media melon mercy merge merit metal meter midst might minor minus mixed model moist money month moral motor mount mouse mouth movie music naive narrow nasty naval navel needy nerve never newly night noble noise north noted novel nurse ocean offer often olive onion opera orbit order organ other otter ought ounce outer owner oxide paint panel paper party pasta patch pause peace pearl pedal penny phase phone photo piano piece pilot pinch pitch pixel place plain plane plate point polar porch pouch pound power press price pride prime print prize probe prone proof proud prove pulse punch pupil puppy purse queen query quest queue quick quiet quite quota radar radio raise rally ranch range rapid ratio reach ready realm rebel refer reign relax reply ridge rifle right rigid rinse risky rival river roast robin robot rocky rough round route royal rugby ruler rumor rural sable saddle salad salon sauce scale scene scent scoop scope score scout scrap screw seize sense serve seven shade shaft shake shall shape share sharp shelf shell shine shirt shock shoot shore short shout shown sight silly since siren sixth skate skill skirt slate sleep slice slide slope small smart smile smoke snack snake solar solid solve sorry sound south space spare spark speak speed spend spice spine spilt spoke spoon sport spray spread squad stack staff stage stain stair stake stamp stand stare start state steam steel steep steer stem step stick stiff still sting stock stone stool storm story stove strap straw strip study stuff style sugar suite sunny super surge swamp sweep sweet table taken taste teach teeth tempo tenor tense thank theme there these thick thief thing think third those three throw thumb tiger tight timer tired title toast today token tooth topic torch total touch tough tower toxic trace track trade trail train trait tramp treat trend trial tribe trick troop trout truck truly trunk trust truth tulip tutor twice twist ultra uncle under union unity until upper upset urban urgent usage useful valid valve vapor vault venue verse video vigil villa vinyl viral virus visit vital vivid vocal voice voter wagon waste watch water weary wheat wheel where which while white whole whose widow width woman world worry worse worth would wound wrist write wrong yacht young youth zebra')
    .split(/\s+/).filter((w) => w.length === 5);
  const STAT = { max: 6 };

  LX.apps.register({
    id: 'liondle', name: 'Liondle', icon: 'gamepad', color: '#F6C177', category: 'Games',
    pkg: true, pkgVersion: '1.0', pkgSize: 4, developer: 'Moonlit Byte', downloads: 1620,
    desc: 'Guess the five-letter word', longDesc: 'A new word every day — six tries, colour feedback, an on-screen keyboard and full stats with streaks. Plus practice mode if you cannot wait for tomorrow.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 560, height: 680, minWidth: 420, minHeight: 560,
    open(win) {
      let mode = 'daily';
      let target = '', cur = '', row = 0, done = false;
      let grid = []; // per-row array of {ch, state}
      let kb = {};
      const boardEl = H('div', { class: 'ld-board' });
      const kbdEl = H('div', { class: 'ld-kbd' });
      const statusEl = H('div', { class: 'ld-status muted' });

      function dailyWord() {
        const day = Math.floor(Date.now() / 86400000);
        return WORDS[(day * 2654435761 >>> 0) % WORDS.length];
      }
      function stats() { return LX.store.get('app.liondle.stats', { played: 0, wins: 0, streak: 0, dist: [0, 0, 0, 0, 0, 0], lastDay: -1 }); }
      function saveStats(s) { LX.store.set('app.liondle.stats', s); }

      function newGame(m) {
        mode = m;
        target = m === 'daily' ? dailyWord() : WORDS[Math.floor(Math.random() * WORDS.length)];
        cur = ''; row = 0; done = false; grid = []; kb = {};
        statusEl.textContent = m === 'daily' ? 'Daily · a new word each day' : 'Practice · unlimited';
        paint();
      }
      function mark(ch, i) {
        if (target[i] === ch) return 'hit';
        if (target.indexOf(ch) >= 0) return 'near';
        return 'miss';
      }
      function submit() {
        if (done || cur.length < 5) return;
        if (WORDS.indexOf(cur) < 0) {
          statusEl.textContent = '“' + cur.toUpperCase() + '” is not in the word list.';
          LX.audio.beep(190, .07, 'square', .1);
          return;
        }
        const res = cur.split('').map((ch, i) => mark(ch, i));
        grid.push(res.map((st, i) => ({ ch: cur[i], st })));
        cur.split('').forEach((ch, i) => { kb[ch] = kb[ch] === 'hit' ? 'hit' : res[i]; });
        row++;
        if (res.every((r) => r === 'hit')) {
          done = true;
          const s = stats();
          s.played++; s.wins++; s.dist[row - 1]++;
          if (mode === 'daily') { if (s.lastDay === Math.floor(Date.now() / 86400000) - 1) s.streak++; else s.streak = 1; s.lastDay = Math.floor(Date.now() / 86400000); }
          saveStats(s);
          statusEl.textContent = 'Got it in ' + row + '! 🦁';
          [523, 659, 784].forEach((f, i) => setTimeout(() => LX.audio.beep(f, .18, 'sine', .25), i * 150));
        } else if (row >= STAT.max) {
          done = true;
          const s = stats(); s.played++; if (mode === 'daily') { s.streak = 0; s.lastDay = Math.floor(Date.now() / 86400000); }
          saveStats(s);
          statusEl.textContent = 'The word was “' + target.toUpperCase() + '”.';
        } else statusEl.textContent = '';
        cur = '';
        paint();
      }
      function key(ch) {
        if (done) return;
        if (ch === '⏎') return submit();
        if (ch === '⌫') { cur = cur.slice(0, -1); paint(); return; }
        if (cur.length < 5 && /^[a-z]$/.test(ch)) { cur += ch; paint(); }
      }
      function paint() {
        boardEl.innerHTML = '';
        for (let r = 0; r < STAT.max; r++) {
          const rowEl = H('div', { class: 'ld-row' + (r === row && !done ? ' cur' : '') });
          for (let c = 0; c < 5; c++) {
            const cellData = grid[r] ? grid[r][c] : (r === row ? { ch: cur[c] || '', st: 'pending' } : null);
            const cell = H('span', { class: 'ld-cell' + (cellData ? ' ' + cellData.st : ''), text: (cellData && cellData.ch) || '' });
            rowEl.appendChild(cell);
          }
          boardEl.appendChild(rowEl);
        }
        kbdEl.innerHTML = '';
        const rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
        const row2 = H('div', { class: 'ld-krow' }, H('button', { class: 'ld-key wide', text: '⏎', onclick: () => key('⏎') }));
        rows.forEach((rs, i) => {
          const rEl = H('div', { class: 'ld-krow' });
          if (i === 2) rEl.appendChild(H('button', { class: 'ld-key wide', text: '⌫', onclick: () => key('⌫') }));
          rs.split('').forEach((ch) => rEl.appendChild(H('button', { class: 'ld-key' + (kb[ch] ? ' ' + kb[ch] : ''), text: ch.toUpperCase(), onclick: () => key(ch) })));
          if (i === 2) rEl.appendChild(H('button', { class: 'ld-key wide', text: '⏎', onclick: () => key('⏎') }));
          kbdEl.appendChild(rEl);
        });
        win.setTitle('Liondle — ' + (done ? 'done' : 'row ' + (row + 1) + '/6'));
      }
      function paintStats() {
        const s = stats();
        return H('div', { class: 'ld-stats' },
          H('div', null, H('b', { text: String(s.played) }), H('div', { class: 'muted', style: { fontSize: '10px' }, text: 'played' })),
          H('div', null, H('b', { text: String(s.wins) }), H('div', { class: 'muted', style: { fontSize: '10px' }, text: 'wins' })),
          H('div', null, H('b', { text: String(s.streak) }), H('div', { class: 'muted', style: { fontSize: '10px' }, text: 'streak' })));
      }
      win.body.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        if (e.key === 'Enter') key('⏎');
        else if (e.key === 'Backspace') key('⌫');
        else if (/^[a-zA-Z]$/.test(e.key)) key(e.key.toLowerCase());
      });
      win.body.tabIndex = 0;
      win.body.append(
        H('div', { class: 'toolbar' },
          H('button', { class: 'btn sm' + (mode === 'daily' ? ' primary' : ''), text: 'Daily', onclick: () => newGame('daily') }),
          H('button', { class: 'btn sm' + (mode === 'practice' ? ' primary' : ''), text: 'Practice', onclick: () => newGame('practice') }),
          H('span', { class: 'grow' }), statusEl, paintStats()),
        boardEl, kbdEl,
        H('div', { class: 'muted', style: { fontSize: '11px', textAlign: 'center', padding: '10px' }, text: 'Type on your keyboard or use the buttons. Green = right spot, yellow = wrong spot.' }));
      newGame('daily');
      setTimeout(() => win.body.focus(), 50);
    },
  });
})();
