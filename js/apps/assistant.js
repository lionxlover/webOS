/* Lion Assistant — offline rule-based chat assistant that genuinely controls Leonux OS. */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.assistant.history', RKEY = 'app.assistant.reminders';
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // ---------- text utils ----------
  const norm = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9%+\-*/^().:,°=×÷ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const d = []; for (let i = 0; i <= a.length; i++) { d[i] = [i]; } for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  const VOCAB = 'open launch start close quit volume brightness theme dark light accent wallpaper timer remind reminder note calculate convert time date search find joke help mute louder quieter brighter dimmer settings terminal calculator browser music files weather calendar camera paint notes todo tasks'.split(' ');
  const TYPO = { opn: 'open', opne: 'open', oepn: 'open', lanuch: 'launch', launhc: 'launch', cloes: 'close', clsoe: 'close', vol: 'volume' };
  function fixTypos(s) {
    return s.split(' ').map((w) => {
      if (TYPO[w]) return TYPO[w];
      if (w.length < 5 || VOCAB.indexOf(w) >= 0 || /\d/.test(w)) return w;
      let best = w, bd = w.length > 7 ? 2 : 1, bl = 9;
      VOCAB.forEach((v) => { if (v[0] !== w[0]) return; const d = lev(w, v); const l = Math.abs(v.length - w.length); if (d < bd || (d === bd && best !== w && l < bl) || (d === bd && best === w)) { bd = d; best = v; bl = l; } });
      return best;
    }).join(' ');
  }
  const SYN = [[/\b(turn up|raise|increase|boost|higher)\b/g, 'up'], [/\b(turn down|lower|decrease|reduce)\b/g, 'down'], [/\b(louder)\b/g, 'volume up'], [/\b(quieter|softer)\b/g, 'volume down'], [/\b(brighter)\b/g, 'brightness up'], [/\b(dimmer|darker screen)\b/g, 'brightness down'], [/\b(sound|audio|speakers?)\b/g, 'volume'], [/\b(screen light|backlight)\b/g, 'brightness'], [/\b(please|pls|could you|can you|would you|hey lion|lion|kindly|for me|go ahead and)\b/g, ''], [/\b(wi-fi|wireless)\b/g, 'wifi'], [/\b(night mode|blue light)\b/g, 'night light'], [/\b(colour|color scheme)\b/g, 'color'], [/\b(background|backdrop|desktop picture|desktop image)\b/g, 'wallpaper'], [/\b(whats|what is the)\b/g, 'what is']];
  function prep(raw) { let s = norm(raw); SYN.forEach((r) => { s = s.replace(r[0], r[1]); }); return fixTypos(s.replace(/\s+/g, ' ').trim()); }

  // ---------- app resolution ----------
  const APP_ALIAS = { browser: 'browser web internet surf chrome firefox www', terminal: 'terminal console shell cmd command line bash', calculator: 'calculator calc', files: 'files file manager explorer finder folders', texteditor: 'text editor texteditor editor notepad', settings: 'settings preferences prefs config system settings', music: 'music player songs audio player', video: 'video movies player', photos: 'photos pictures gallery images', notes: 'notes notebook', todo: 'tasks todo to-do reminders list', calendar: 'calendar agenda schedule', weather: 'weather forecast', clock: 'clock alarm stopwatch', taskmanager: 'task manager processes', softwarecenter: 'app store store software center apps store', sysmonitor: 'system monitor performance', paint: 'paint draw drawing', camera: 'camera webcam', mail: 'mail email', pomodoro: 'pomodoro focus timer' };
  function findApp(text) {
    const s = ' ' + norm(text) + ' ';
    let best = null, bs = 0;
    LX.apps.list().forEach((a) => {
      if (a.id === 'assistant') return;
      const names = [norm(a.name), a.id];
      let sc = 0;
      names.forEach((n) => { if (n && s.indexOf(' ' + n + ' ') >= 0) sc = Math.max(sc, 100 + n.length); else if (n && n.length > 3 && s.indexOf(n) >= 0) sc = Math.max(sc, 50 + n.length); });
      const al = APP_ALIAS[a.id]; if (al) {
        [al].forEach((str) => { str.split(' ').forEach((w) => { if (w.length > 2 && s.indexOf(' ' + w + ' ') >= 0) sc = Math.max(sc, 60 + w.length); }); });
      }
      if (!sc) s.trim().split(' ').forEach((w) => { if (w.length > 3 && !/^(open|close|start|launch|quit|please|the|app|application)$/.test(w) && lev(w, norm(a.name)) <= 1) sc = Math.max(sc, 55); });
      if (sc > bs) { bs = sc; best = a; }
    });
    return best;
  }

  // ---------- reminders ----------
  let reminders = []; try { reminders = LX.store.get(RKEY, []) || []; } catch (e) { reminders = []; }
  const saveR = () => LX.store.set(RKEY, reminders);
  function tickReminders() {
    const now = Date.now(); let ch = false;
    reminders.slice().forEach((r) => {
      if (r.due <= now) { reminders.splice(reminders.indexOf(r), 1); ch = true; if (now - r.due < 864e5) { LX.notify({ title: r.kind === 'timer' ? 'Timer finished' : 'Reminder', body: r.text, icon: r.kind === 'timer' ? 'clock' : 'bell', appId: 'assistant', timeout: 9000 }); try { LX.audio.beep(880, .15, 'sine', .2); setTimeout(() => LX.audio.beep(1100, .2, 'sine', .2), 200); } catch (e) {} } }
    });
    if (ch) { saveR(); LX.bus.emit('assistant:reminders'); }
  }
  LX.onInit(() => { setInterval(tickReminders, 1000); tickReminders(); });
  function parseDur(s) {
    let ms = 0, found = false;
    s.replace(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g, (m, n, u) => { found = true; n = +n; ms += n * (u[0] === 'h' ? 36e5 : u[0] === 'm' ? 6e4 : 1e3); return m; });
    if (!found) { const m = /\b(?:an?|one)\s+(hour|minute|min|second)\b/.exec(s); if (m) { found = true; ms = m[1][0] === 'h' ? 36e5 : m[1][0] === 'm' ? 6e4 : 1e3; } }
    if (/half an hour/.test(s)) { ms = 18e5; found = true; }
    return found ? ms : 0;
  }
  const fmtDur = (ms) => { const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return [h && h + ' h', m && m + ' min', (x && (!h)) && x + ' s'].filter(Boolean).join(' ') || '0 s'; };
  function parseAt(s) {
    const m = /\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(s); if (!m) return 0;
    let h = +m[1]; const mi = +(m[2] || 0); if (m[3]) { h = h % 12 + (m[3] === 'pm' ? 12 : 0); }
    const d = new Date(); d.setHours(h, mi, 0, 0); if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1); return d.getTime();
  }

  // ---------- data ----------
  const JOKES = ['Why do programmers prefer dark mode? Because light attracts bugs.', 'There are 10 kinds of people: those who understand binary and those who don\'t.', 'A SQL query walks into a bar, walks up to two tables and asks: "Can I join you?"', 'Why did the lion bring a laptop to the savanna? To keep an eye on the pride-ware.', '"It works on my machine." - Every developer, right before shipping the machine.', 'I would tell you a UDP joke, but you might not get it.', 'Why was the computer cold? It left its Windows open. (Don\'t worry, Leonux has doors.)', 'To understand recursion, you must first understand recursion.', 'Why do Java developers wear glasses? Because they can\'t C#.', 'How many programmers does it take to change a light bulb? None, that\'s a hardware problem.'];
  const HOWTO = [
    [/dock/, 'The **dock** sits at the bottom of the screen. Click an icon to open or focus an app, right-click it for options, and drag to reorder. Hover to magnify. Tune it under Settings > Menu bar & Dock. You can also switch the whole layout to a classic taskbar there.'],
    [/mission|spaces?|virtual desktop|overview/, '**Mission Control**: press `Ctrl+Alt+Up` (or F3) to see all windows and spaces at once. Use `Ctrl+Alt+Left/Right` to move between spaces and `Ctrl+Alt+Down` to close the overview. Moving the pointer to the top-left hot corner opens it too.'],
    [/spotlight|search bar|find anything/, '**Spotlight**: press `Ctrl+Space`. Type to find apps, files, settings and actions. It also calculates (`calc 2+2`) and converts units (`5 km in miles`). Try `>` for actions and `/` for files; Shift+Enter previews a file.'],
    [/app store|software|store|install|package|zapp|lionapp/, 'Open the **App Store** (Software Center) from the dock or launcher to browse and install apps. Installs are fully **offline**: packages live inside Leonux and are stored in your browser. You can also install a package from code via LionApps, or from a repository added in the store.'],
    [/offline/, 'Leonux works completely **offline**. Everything, including the App Store catalog, is bundled; installed apps and your files are saved in your browser storage. You can even install it as an app (PWA) from your browser menu.'],
    [/snap|tile|split/, '**Snapping**: drag a window to the left or right screen edge to tile it, or to the top to maximise. Hover over a window\'s maximise button to open the snap-layout flyout and pick a layout.'],
    [/launcher|launchpad|all apps/, 'Press the **Meta (Windows) key** or `Alt+Space` for the launcher: a paged grid of every app with search.'],
    [/quick ?look|preview/, '**Quick Look**: select a file in Files and press `Space` for an instant preview. Press Space or Esc to dismiss it.'],
    [/shortcut|hotkey|keyboard/, 'Handy shortcuts:\n`Ctrl+Space` Spotlight\n`Alt+Space` Launcher\n`Alt+A` Lion Assistant\n`Ctrl+Alt+Up` Mission Control\n`Alt+Tab` switch windows\n`Ctrl+Alt+T` Terminal\n`Ctrl+Alt+D` show desktop\n`Ctrl+Alt+L` lock\n`Alt+F4` close window'],
    [/hot ?corner/, '**Hot corners** trigger actions when you push the pointer into a screen corner (Mission Control, show desktop, screensaver...). Configure them in Settings > Hot Corners.'],
    [/focus|do not disturb|dnd/, '**Focus modes** (Do Not Disturb, Work, Sleep) silence notifications. Toggle from Control Center, the menu bar, or say "turn on work focus".'],
    [/screensaver|screen saver/, 'The **screensaver** starts after a period of idle time. Pick the style and delay under Settings > Screensaver.'],
    [/theme|wallpaper|appearance|customi/, 'Personalise Leonux under **Settings > Appearance**: light/dark/auto theme, accent colour, and wallpapers. Or just tell me: "dark mode", "accent purple", "wallpaper ocean".'],
    [/file|folder/, 'Use the **Files** app to browse your virtual disk (`/home/user`). Right-click for New Folder, Rename, Delete (to Trash). I can also create files for you: "create file todo.txt".'],
  ];
  const COLORS = { blue: 0, green: 1, yellow: 2, orange: 6, red: 3, purple: 4, violet: 4, cyan: 5, teal: 5, aqua: 5, pink: 7 };
  const WP_ALIAS = { borealis: 'aurora2', northern: 'aurora2', lava: 'volcano', sky: 'dawn', sunrise: 'dawn', space: 'nebula', night: 'midnight', black: 'graphite', gray: 'graphite', grey: 'graphite', white: 'paper', sea: 'ocean', water: 'ocean', rainbow: 'prism', time: 'dynamic', clock: 'dynamic' };
  const GREET = ['Hello! What can I do for you?', 'Hi there! Ready when you are.', 'Hey! Tell me what you need, or tap a suggestion.'];

  // ---------- intents ----------
  const ctx = { lastApp: null };
  const reply = (text, o) => Object.assign({ text }, o || {});
  function setNum(key, label, s, cur) {
    const n = /(\d{1,3})\s*%?/.exec(s.replace(/\bto\b/, ''));
    let v;
    if (/\b(mute|silent|off|zero)\b/.test(s) && key === 'volume') v = 0;
    else if (/\b(max|maximum|full|highest)\b/.test(s)) v = 100;
    else if (/\b(min|minimum|lowest)\b/.test(s)) v = key === 'volume' ? 0 : 10;
    else if (/\bhalf\b/.test(s)) v = 50;
    else if (n && !/\b(up|down)\b/.test(s.replace(/\d+/, ''))) v = +n[1];
    else if (/\bup\b/.test(s)) v = cur + (n ? +n[1] : 15);
    else if (/\bdown\b/.test(s)) v = cur - (n ? +n[1] : 15);
    else if (n) v = +n[1];
    else return reply(label + ' is at **' + cur + '%**. Say "' + label.toLowerCase() + ' 50", "' + label.toLowerCase() + ' up" or "' + label.toLowerCase() + ' down".');
    v = LX.clamp(Math.round(v), key === 'brightness' ? 10 : 0, 100);
    LX.settings.set(key, v);
    if (key === 'volume') { try { LX.audio.beep(660, .08); } catch (e) {} }
    return reply((v === 0 && key === 'volume' ? 'Muted.' : label + ' set to **' + v + '%**.'), { acts: [label + ' ' + v + '%'] });
  }
  const TOGGLES = [['wifi', /\bwifi\b/, 'Wi-Fi'], ['bluetooth', /\b(bluetooth|bt)\b/, 'Bluetooth'], ['dnd', /\b(do not disturb|dnd)\b/, 'Do Not Disturb'], ['airplane', /\b(airplane|flight) mode\b|\bairplane\b/, 'Airplane mode'], ['nightLight', /\bnight light\b/, 'Night light'], ['clock24', /\b24 ?(h|hour)\b/, '24-hour clock'], ['animations', /\banimations?\b/, 'Animations'], ['highContrast', /\bhigh contrast\b/, 'High contrast'], ['battSaver', /\b(battery saver|power saver)\b/, 'Battery saver']];

  const INTENTS = [
    { id: 'clear', t: (s) => /^(clear|reset|wipe)( the)?( chat| history| conversation)?$|^new chat$/.test(s), run() { return { clear: true }; } },
    { id: 'help', t: (s) => /^(help|what can you do|commands|abilities|capabilities|what do you do|how do i use you)\??$|\bwhat can you do\b/.test(s), run() { return reply('I can really control Leonux. Try:\n**Apps** "open terminal", "close notes"\n**Look & feel** "dark mode", "accent pink", "wallpaper ocean"\n**Sound & screen** "volume 40", "brightness down", "turn on night light"\n**Time** "timer 10 minutes", "remind me to stretch in 30 min", "what time is it"\n**Create** "note: buy milk", "create file ideas.txt", "add task call mum tomorrow 5pm"\n**Math** "15% of 240", "sqrt(144)*3", "5 km in miles"\n**Find** "find report", "what is open"\n**Learn** "how do I use Mission Control", "tell me a joke"'); } },
    { id: 'greet', t: (s) => /^(hi|hello|hey|yo|hola|good (morning|afternoon|evening)|sup|howdy)\b/.test(s) && s.length < 30, run(s) { const h = new Date().getHours(); return reply(/good/.test(s) ? 'Good ' + (h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening') + ', ' + (LX.settings.get('fullname') || 'friend').split(' ')[0] + '! How can I help?' : LX.pick(GREET)); } },
    { id: 'thanks', t: (s) => /^(thanks|thank you|thx|ty|cheers|great|nice|cool|awesome|perfect|ok|okay)\b/.test(s) && s.length < 25, run() { return reply(LX.pick(['You are welcome!', 'Anytime.', 'Happy to help.', 'Glad to be of use.'])); } },
    { id: 'who', t: (s) => /\b(who are you|your name|what are you|are you (real|ai|a bot))\b/.test(s), run() { return reply('I am **Lion Assistant**, the built-in helper of Leonux OS. I run entirely offline with a rule-based brain, and I can drive the system for you: open apps, change settings, set timers, make files and more.'); } },
    // timers & reminders
    { id: 'listrem', t: (s) => /\b(my |show |list |what |any )?(timers?|reminders?)\b/.test(s) && /\b(list|show|what|any|active|pending|my|running)\b/.test(s) && !/\b(set|start|create|add|new|in \d|for \d|at \d)\b/.test(s) && !/\bremind me\b/.test(s) && !/\b(cancel|clear|stop|delete|remove)\b/.test(s), run() {
      if (!reminders.length) return reply('No active timers or reminders. Try "timer 5 minutes" or "remind me to call Sam in 1 hour".');
      return reply('Active:\n' + reminders.sort((a, b) => a.due - b.due).map((r) => '- ' + (r.kind === 'timer' ? 'Timer' : 'Reminder') + ': ' + r.text + ' (in ' + fmtDur(r.due - Date.now()) + ')').join('\n')); } },
    { id: 'cancelrem', t: (s) => /\b(cancel|clear|stop|delete|remove)\b.*\b(timers?|reminders?|alarms?)\b/.test(s), run() { const n = reminders.length; reminders = []; saveR(); return reply(n ? 'Cancelled ' + n + ' timer' + (n > 1 ? 's' : '') + '/reminder' + (n > 1 ? 's' : '') + '.' : 'Nothing to cancel.'); } },
    { id: 'remind', t: (s) => /\bremind me\b|\breminder\b|\b(set|start|create|add)\b.*\b(timer|alarm)\b|^timer\b|\btimer for\b|\balarm\b|\bcount ?down\b/.test(s), run(s, raw) {
      const timer = /\b(timer|alarm|countdown)\b/.test(s) && !/\bremind me\b/.test(s);
      let ms = parseDur(s), at = 0;
      if (!ms) { at = parseAt(s); if (at) ms = at - Date.now(); }
      if (!ms) return reply('For how long? Say e.g. "timer 5 minutes" or "remind me to stretch in 20 min" or "remind me at 6pm to call Sam".');
      let text = timer ? 'Timer (' + fmtDur(ms) + ')' : '';
      if (!timer) {
        let m = /remind me (?:to |about |that )?(.+?)(?: (?:in|at|after) \d.*| for \d.*|$)/i.exec(raw.replace(/\s+/g, ' '));
        let m2 = /remind me (?:in|at|after) [\w :.]+? (?:to|about|that) (.+)$/i.exec(raw);
        text = ((m2 && m2[1]) || (m && m[1]) || 'Reminder').trim();
      } else { const lab = /(?:called|named|for the|labell?ed)\s+([a-z ]+)$/i.exec(raw); if (lab) text = lab[1].trim() + ' (' + fmtDur(ms) + ')'; }
      reminders.push({ id: LX.uid(), kind: timer ? 'timer' : 'reminder', text, due: Date.now() + ms }); saveR(); LX.bus.emit('assistant:reminders');
      return reply((timer ? 'Timer set for **' + fmtDur(ms) + '**.' : 'Okay, I will remind you to **' + text + '** in ' + fmtDur(ms) + (at ? ' (at ' + LX.fmtTime(at) + ')' : '') + '.') + ' You will get a notification.', { acts: [timer ? 'Timer ' + fmtDur(ms) : 'Reminder set'] }); } },
    // tasks / notes / files
    { id: 'task', t: (s) => /^(add|create|new) (a )?(task|todo|to-do)\b/.test(s) || /\badd .+ to (my )?(tasks|todo|to-do)( list)?$/.test(s), run(s, raw) {
      let txt = raw.replace(/^\s*(please )?(add|create|new)\s+(a\s+)?(task|todo|to-do)\s*(called|named|to|:)?\s*/i, '').replace(/\s+to (my )?(tasks|todo|to-do)( list)?$/i, '').replace(/^add\s+/i, '').trim();
      if (!txt) return reply('What is the task? e.g. "add task call mum tomorrow 5pm".');
      if (!LX.todoApi) return reply('The Tasks app is not available.');
      const o = LX.todoApi.parse(txt); LX.todoApi.add(o.title || txt, o);
      return reply('Added task **' + (o.title || txt) + '**' + (o.due ? ' (due ' + LX.fmtDateTime(o.due) + ')' : '') + '.', { acts: ['Task added'], chips: ['Open Tasks'] }); } },
    { id: 'note', t: (s) => /^(note|jot|write down|take a note|make a note|create (a )?note|new note|save a note|remember)\b/.test(s), run(s, raw) {
      let m = /^\s*(?:please )?(?:create |make |take |save |new )?(?:a )?(?:note|jot|write down|remember)(?: that)?\s*(?:called|named|titled)?\s*[:\-]?\s*(.*)$/i.exec(raw);
      let body = (m && m[1] || '').trim(), title = '';
      const w = /^"?([^":]{1,40}?)"?\s+(?:with|saying|that says|containing)\s+(.+)$/i.exec(body); if (w) { title = w[1]; body = w[2]; }
      if (!body && !title) return reply('What should the note say? e.g. "note: buy milk and eggs".');
      const dir = LX.vfs.HOME + '/Documents'; if (!LX.vfs.isDir(dir)) LX.vfs.mkdir(dir);
      let name = (title || body.split(/\s+/).slice(0, 4).join(' ')).replace(/[^\w \-]/g, '').trim().replace(/\s+/g, '-').slice(0, 30) || 'note';
      let p = dir + '/' + name + '.md', i = 2; while (LX.vfs.exists(p)) p = dir + '/' + name + '-' + (i++) + '.md';
      LX.vfs.write(p, '# ' + (title || name.replace(/-/g, ' ')) + '\n\n' + (body || '') + '\n\n_Saved by Lion Assistant on ' + LX.fmtDateTime(Date.now()) + '_\n');
      ctx.lastFile = p; return reply('Saved your note to `' + p + '`.', { acts: ['Note saved'], chips: ['Open that file'] }); } },
    { id: 'mkfile', t: (s) => /\b(create|make|new|touch)\b.*\b(file|folder|directory|dir)\b/.test(s), run(s, raw) {
      const isDir = /\b(folder|directory|dir)\b/.test(s);
      let m = /(?:called|named|name)\s+["']?([^"']+?)["']?(?:\s+(?:in|inside|on|with)\s+(.+))?$/i.exec(raw) || /\b(?:file|folder|directory|dir)\s+["']?([\w.\- ]+?)["']?(?:\s+(?:in|inside|on|with)\s+(.+))?$/i.exec(raw);
      if (!m) return reply('What should it be called? e.g. "create file ideas.txt" or "create folder Projects".');
      let name = m[1].trim().replace(/[\/\\]/g, '-'), where = (m[2] || '').toLowerCase();
      let dir = LX.vfs.HOME + '/Documents';
      if (/desktop/.test(where) || /\bon (the )?desktop\b/.test(s)) dir = LX.vfs.HOME + '/Desktop'; else if (/download/.test(where)) dir = LX.vfs.HOME + '/Downloads'; else if (/home/.test(where)) dir = LX.vfs.HOME;
      if (!isDir && !/\.\w+$/.test(name)) name += '.txt';
      const p = dir + '/' + name; try { if (LX.vfs.exists(p)) return reply('`' + p + '` already exists.'); if (isDir) LX.vfs.mkdir(p); else LX.vfs.write(p, ''); } catch (e) { return reply('Could not create it: ' + e.message); }
      ctx.lastFile = isDir ? null : p; return reply('Created ' + (isDir ? 'folder' : 'file') + ' `' + p + '`.', { acts: [isDir ? 'Folder created' : 'File created'], chips: isDir ? ['Open Files'] : ['Open that file'] }); } },
    { id: 'find', t: (s) => /^(find|search|look for|locate|where is|where are|where s)\b/.test(s) && !/\bweb\b/.test(s), run(s, raw) {
      const q = raw.replace(/^\s*(find|search( for)?|look for|locate|where(?:'s| is| are)?)\s+(my |the |a |an |any )?(files? |documents? )?(named |called |matching )?/i, '').replace(/[?.!]+$/, '').trim();
      if (!q) return reply('What should I look for?');
      const r = LX.vfs.search(q, 8);
      if (!r.length) return reply('I found nothing matching "' + q + '".');
      ctx.lastFile = r.filter((x) => x.type === 'file')[0] ? r.filter((x) => x.type === 'file')[0].path : null;
      return reply('Found ' + r.length + ' item' + (r.length > 1 ? 's' : '') + ':\n' + r.map((x) => '- `' + x.path + '`' + (x.type === 'dir' ? ' (folder)' : '')).join('\n'), { chips: ctx.lastFile ? ['Open that file'] : [] }); } },
    { id: 'openlast', t: (s) => /^open (that|it|this)( file)?$|^open that file$/.test(s) && ctx.lastFile, run() { LX.apps.openFile(ctx.lastFile); return reply('Opening `' + LX.vfs.basename(ctx.lastFile) + '`.', { acts: ['Opened file'] }); } },
    // theme
    { id: 'theme', t: (s) => /\b(dark|light|auto)\b/.test(s) && /\b(mode|theme|appearance|ui|interface|system)\b|^(go |switch |make it |turn |set )?(dark|light)$|\bmake it (dark|light)\b/.test(s) && !/\b(wallpaper|accent)\b/.test(s), run(s) { const v = /\bauto|system\b/.test(s) && !/dark|light/.test(s) ? 'auto' : /\blight\b/.test(s) ? 'light' : /\bdark\b/.test(s) ? 'dark' : 'auto'; LX.settings.set('theme', v); return reply('Switched to **' + v + '** theme.', { acts: ['Theme: ' + v] }); } },
    { id: 'toggletheme', t: (s) => /\b(toggle|switch|flip) (the )?(theme|dark mode|mode)\b/.test(s), run() { const v = LX.theme.isDark() ? 'light' : 'dark'; LX.settings.set('theme', v); return reply('Switched to **' + v + '** theme.', { acts: ['Theme: ' + v] }); } },
    { id: 'accent', t: (s) => /\b(accent|highlight|color)\b/.test(s) && !/wallpaper/.test(s) || /^(make it|go) (blue|green|yellow|orange|red|purple|violet|cyan|teal|pink)$/.test(s), run(s) {
      let hex = (/#([0-9a-f]{6})\b/i.exec(s) || [])[0];
      const names = Object.keys(COLORS); const hit = names.filter((n) => new RegExp('\\b' + n + '\\b').test(s))[0];
      if (!hex && hit) hex = LX.theme.accents[COLORS[hit]];
      if (!hex && /\b(random|surprise|any)\b/.test(s)) hex = LX.pick(LX.theme.accents);
      if (!hex) return reply('Which colour? I know: ' + names.join(', ') + ', or a hex like #ff8800.', { chips: ['Accent purple', 'Accent green', 'Accent pink'] });
      LX.settings.set('accent', hex.toUpperCase()); return reply('Accent colour changed' + (hit ? ' to **' + hit + '**' : '') + '.', { acts: ['Accent ' + (hit || hex)] }); } },
    { id: 'wallpaper', t: (s) => /\bwallpaper\b/.test(s), run(s) {
      const W = LX.theme.wallpapers, keys = Object.keys(W);
      if (/\b(random|surprise|any|shuffle)\b/.test(s)) { const k = LX.pick(keys.filter((x) => x !== LX.settings.get('wallpaper'))); LX.settings.set('wallpaper', k); return reply('Wallpaper set to **' + W[k].name + '**.', { acts: ['Wallpaper: ' + W[k].name] }); }
      if (/\b(next|another|different|change)\b/.test(s) && !keys.some((k) => s.indexOf(norm(W[k].name)) >= 0)) { const i = keys.indexOf(LX.settings.get('wallpaper')); const k = keys[(i + 1) % keys.length]; LX.settings.set('wallpaper', k); return reply('Wallpaper set to **' + W[k].name + '**.', { acts: ['Wallpaper: ' + W[k].name] }); }
      let k = keys.filter((x) => s.indexOf(norm(W[x].name)) >= 0 || new RegExp('\\b' + x + '\\b').test(s)).sort((a, b) => b.length - a.length)[0];
      if (!k) { const al = Object.keys(WP_ALIAS).filter((a) => new RegExp('\\b' + a + '\\b').test(s))[0]; if (al) k = WP_ALIAS[al]; }
      if (!k) return reply('Available wallpapers: ' + keys.map((x) => W[x].name).join(', ') + '. Try "wallpaper ocean" or "random wallpaper".', { chips: ['Wallpaper ocean', 'Random wallpaper'] });
      LX.settings.set('wallpaper', k); return reply('Wallpaper set to **' + W[k].name + '**.', { acts: ['Wallpaper: ' + W[k].name] }); } },
    { id: 'volume', t: (s) => /\bvolume\b|^(un)?mute\b/.test(s), run(s) { if (/^unmute/.test(s)) return setNum('volume', 'Volume', '60', 0); return setNum('volume', 'Volume', s, +LX.settings.get('volume')); } },
    { id: 'brightness', t: (s) => /\bbrightness\b/.test(s), run(s) { return setNum('brightness', 'Brightness', s, +LX.settings.get('brightness')); } },
    { id: 'toggle', t: (s) => TOGGLES.some((t) => t[1].test(s)) && /\b(on|off|enable|disable|toggle|switch|turn|activate|deactivate)\b/.test(s), run(s) {
      const t = TOGGLES.filter((x) => x[1].test(s))[0]; const cur = !!LX.settings.get(t[0]);
      const v = /\b(off|disable|deactivate)\b/.test(s) ? false : /\b(on|enable|activate)\b/.test(s) ? true : !cur;
      LX.settings.set(t[0], v); return reply(t[2] + ' is now **' + (v ? 'on' : 'off') + '**.', { acts: [t[2] + ': ' + (v ? 'on' : 'off')] }); } },
    { id: 'focus', t: (s) => /\bfocus\b/.test(s) && !/\bpomodoro\b/.test(s) && LX.focus, run(s) {
      const m = /\b(work|sleep|dnd|do not disturb|personal|gaming|reading)\b/.exec(s); const off = /\b(off|stop|end|disable)\b/.test(s);
      if (off) { const c = LX.focus.current(); if (c) LX.focus.toggle(c.id); return reply('Focus is **off**.', { acts: ['Focus off'] }); }
      const id = m ? (m[1] === 'do not disturb' ? 'dnd' : m[1]) : 'work'; const c = LX.focus.current();
      if (!c || c.id !== id) LX.focus.toggle(id); return reply('Focus mode **' + id + '** is on. Notifications are quieter.', { acts: ['Focus: ' + id] }); } },
    // system actions
    { id: 'mc', t: (s) => /\b(mission control|spaces?|overview|show all windows)\b/.test(s) && /\b(open|show|toggle|launch|start|go|enter|activate)\b|^mission control$/.test(s) && !/\bhow\b/.test(s), run() { LX.spaces.toggle(); return reply('Mission Control toggled.', { acts: ['Mission Control'] }); } },
    { id: 'spot', t: (s) => /\bspotlight\b/.test(s) && !/\bhow\b/.test(s), run() { setTimeout(() => LX.search.open(), 100); return reply('Opening Spotlight.', { acts: ['Spotlight'] }); } },
    { id: 'desktop', t: (s) => /\b(show|go to|reveal) (the )?desktop\b|\bminimi[sz]e (all|everything)\b/.test(s), run() { LX.wm.showDesktop(); return reply('Showing the desktop.', { acts: ['Show desktop'] }); } },
    { id: 'lock', t: (s) => /^(lock|lock (the )?(screen|computer|pc))$/.test(s), run() { setTimeout(() => LX.power.lock(), 400); return reply('Locking the screen...', { acts: ['Lock'] }); } },
    { id: 'power', t: (s) => /^(shut ?down|power off|turn off|restart|reboot|sleep|suspend)( (the )?(computer|pc|system|leonux))?$/.test(s), run(s) {
      const k = /restart|reboot/.test(s) ? 'restart' : /sleep|suspend/.test(s) ? 'sleep' : 'shutdown';
      LX.dialog.confirm('Do you really want to ' + (k === 'shutdown' ? 'shut down' : k) + '?', 'Lion Assistant').then((ok) => { if (ok) LX.power[k](); });
      return reply('I need a confirmation first: please confirm the ' + k + ' dialog.'); } },
    { id: 'closeall', t: (s) => /\b(close|quit) (all|every)( the)?( open)?( windows| apps)?\b/.test(s), run() { const me = LX.wm.list().filter((w) => w.appId !== 'assistant'); me.forEach((w) => w.close()); return reply('Closed ' + me.length + ' window' + (me.length === 1 ? '' : 's') + '.', { acts: ['Closed all'] }); } },
    { id: 'close', t: (s) => /^(close|quit|exit|kill|stop|shut)\b/.test(s) && !/\b(timer|reminder)\b/.test(s), run(s) {
      const a = findApp(s.replace(/^(close|quit|exit|kill|stop|shut)\s*/, ''));
      if (!a) { const f = LX.wm.focused(); if (f && f.appId !== 'assistant' && /\b(window|this|it)\b/.test(s)) { f.close(); return reply('Closed the focused window.'); } return reply('Which app should I close? Say e.g. "close terminal".'); }
      const ws = LX.wm.list().filter((w) => w.appId === a.id); if (!ws.length) return reply(a.name + ' is not open.');
      ws.forEach((w) => w.close()); return reply('Closed **' + a.name + '**' + (ws.length > 1 ? ' (' + ws.length + ' windows)' : '') + '.', { acts: ['Closed ' + a.name] }); } },
    { id: 'whatsopen', t: (s) => /\b(what|which)\b.*\b(open|running)\b|\bopen (windows|apps)\b|\brunning (apps|programs)\b/.test(s), run() { const ws = LX.wm.list().filter((w) => w.appId !== 'assistant'); return reply(ws.length ? 'Open right now:\n' + ws.map((w) => '- ' + w.title).join('\n') : 'Nothing else is open.'); } },
    { id: 'listapps', t: (s) => /\b(list|show|what)\b.*\b(apps|applications|programs)\b|\bwhat apps\b|\binstalled apps\b/.test(s) && !/\bopen\b.*\b(windows|running)\b/.test(s), run() { const l = LX.apps.visible().map((a) => a.name).sort(); return reply('You have **' + l.length + '** apps: ' + l.join(', ') + '.'); } },
    { id: 'open', t: (s) => /^(open|launch|start|run|show|go to|bring up|fire up|switch to|take me to|load)\b/.test(s) || /^(i want|i need|id like|want|need) (to (use|open) )?(a |the )?/.test(s) && !!findApp(s), run(s) {
      const a = findApp(s.replace(/^(open|launch|start|run|show|go to|bring up|fire up|switch to|take me to|load)\s*/, ''));
      if (!a) { const q = s.replace(/^\S+\s*/, ''); return reply('I could not find an app called "' + q + '". Say "list apps" to see what is installed, or search the App Store.', { chips: ['List apps', 'Open App Store'] }); }
      LX.apps.launch(a.id); ctx.lastApp = a.id; return reply('Opening **' + a.name + '**.', { acts: ['Opened ' + a.name] }); } },
    // info
    { id: 'time', t: (s) => /\b(what|tell).*\b(time|clock)\b|^time$|\bwhat time\b|\bcurrent time\b/.test(s) && !/\b(date|day)\b/.test(s), run() { const d = new Date(); return reply('It is **' + (LX.settings.get('clock24') ? LX.fmtTime(d) : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })) + '** on ' + LX.fmtDate(d) + '.'); } },
    { id: 'date', t: (s) => /\b(date|today|day is it|what day|day of the week)\b/.test(s) && !/\b(task|remind|add|note)\b/.test(s) && /\b(what|tell|show|today s|is)\b/.test(s), run() { const d = new Date(); const doy = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5); return reply('Today is **' + DAYS[d.getDay()] + ', ' + LX.fmtDate(d).replace(/^\w+, /, '') + '** (day ' + doy + ' of the year).'); } },
    { id: 'joke', t: (s) => /\b(joke|funny|make me laugh|humou?r|laugh)\b/.test(s), run() { return reply(LX.pick(JOKES), { chips: ['Another joke'] }); } },
    { id: 'status', t: (s) => /\b(battery|storage|disk space|system status|system info|how much (space|storage)|status|about this)\b/.test(s) && !/\bsaver\b/.test(s), run() {
      const u = LX.vfs.usage(); return reply('**System**\n- Host: ' + LX.settings.get('hostname') + ' (user ' + LX.settings.get('username') + ')\n- Storage used: ' + LX.fmtBytes(u.used) + ' of ' + LX.fmtBytes(u.total) + '\n- Theme: ' + LX.settings.get('theme') + ', wallpaper ' + LX.settings.get('wallpaper') + '\n- Volume ' + LX.settings.get('volume') + '%, brightness ' + LX.settings.get('brightness') + '%\n- Open windows: ' + LX.wm.list().length); } },
    { id: 'howto', t: (s) => /\b(how (do|can|to|does)|what is|what are|whats|explain|tell me about|help with|where (do|can)|shortcut|tips?)\b/.test(s) || HOWTO.some((h) => h[0].test(s)) && s.split(' ').length < 6, run(s) {
      const h = HOWTO.filter((x) => x[0].test(s))[0]; if (h) return reply(h[1], { chips: ['Keyboard shortcuts', 'How do I install apps offline'] }); return null; } },
    // math (last resort)
    { id: 'convert', t: (s) => !!(LX.search && LX.search.convert) && /\b(to|in|into|as|->)\b/.test(s) && /\d/.test(s), run(s, raw) {
      const clean = raw.toLowerCase().replace(/^(convert|how (much|many) is|what is|what's|whats)\s*/, '').replace(/[?!]+$/, '').replace(/\bdegrees?\s*/g, '').replace(/\bcelsius\b/g, 'c').replace(/\bfahrenheit\b/g, 'f').replace(/\bkilometers?|kilometres?\b/g, 'km').replace(/\bmiles?\b/g, 'mi').replace(/\bpounds?\b/g, 'lb').replace(/\bkilograms?\b/g, 'kg').replace(/\bmeters?|metres?\b/g, 'm').replace(/\bfeet|foot\b/g, 'ft').replace(/\binches|inch\b/g, 'in').trim();
      const clean2 = clean.replace(/^(\S+)\s+(?:in|to)\s+(\S+)\s+(?:in|to)\s+/, '$1 $2 to ');
      let r = LX.search.convert(clean) || LX.search.convert(clean.replace(/^(-?[\d.,]+)\s+(\S+)\s+(?:in|to)\s+/, '$1 $2 to ')) || LX.search.convert(clean2);
      if (!r) return null; return reply('**' + r.text + '**', { acts: ['Converted'] }); } },
    { id: 'calc', t: (s) => /\d/.test(s) && /[+\-*/^%×÷]|\b(plus|minus|times|divided|multiplied|sqrt|sin|cos|tan|log|ln|percent|squared|cubed|of)\b|\bpi\b/.test(s), run(s, raw) { return doCalc(raw); } },
  ];
  function doCalc(raw) {
    let e = raw.toLowerCase().replace(/^(please |hey )?(calc(ulate)?|compute|solve|evaluate|what is|what's|whats|how much is|math|eval)\s*:?\s*/, '').replace(/[?=!]+$/, '').trim();
    e = e.replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-').replace(/\b(times|multiplied by|x)\b/g, '*').replace(/\b(divided by|over)\b/g, '/').replace(/\bto the power of\b/g, '^').replace(/(\d)\s*squared\b/g, '$1^2').replace(/(\d)\s*cubed\b/g, '$1^3').replace(/(\d+(?:\.\d+)?)\s*percent of\s*(\d)/g, '$1% of $2').replace(/square root of\s*(\d+(?:\.\d+)?)/g, 'sqrt($1)').replace(/(\d)\s*x\s*(\d)/g, '$1*$2');
    const v = LX.search && LX.search.calc ? LX.search.calc(e) : null;
    if (v == null) return null;
    return reply('**' + e.replace(/\*/g, '×').replace(/\//g, '÷') + ' = ' + (+v.toPrecision(12)).toLocaleString('en-US', { maximumFractionDigits: 10 }) + '**', { acts: ['Calculated'] });
  }
  const FALLBACK = ['I did not quite get that. Try "help" to see what I can do.', 'Hmm, I am not sure how to do that yet. Say "help" for ideas.', 'That is outside my toolbox for now. Try "help".'];
  function respond(raw) {
    const s = prep(raw);
    for (const it of INTENTS) {
      let ok = false; try { ok = it.t(s, raw); } catch (e) { ok = false; }
      if (!ok) continue;
      let r = null; try { r = it.run(s, raw); } catch (e) { r = reply('Something went wrong while doing that: ' + e.message); }
      if (r) return r;
    }
    const direct = doCalc(raw); if (direct) return direct;
    const a = findApp(s); if (a && s.split(' ').length <= 3) { LX.apps.launch(a.id); return reply('Opening **' + a.name + '**.', { acts: ['Opened ' + a.name] }); }
    return reply(LX.pick(FALLBACK), { chips: ['Help', 'Tell me a joke'] });
  }
  const CHIPS = ['Open Terminal', 'Dark mode', 'Timer 5 minutes', 'What time is it', '15% of 240', '5 km in miles', 'Tell me a joke', 'How do I use Mission Control', 'Random wallpaper', 'Help'];

  // ---------- history ----------
  let hist = []; try { hist = LX.store.get(KEY, []) || []; if (!Array.isArray(hist)) hist = []; } catch (e) { hist = []; }
  const saveH = () => LX.store.set(KEY, hist.slice(-80));

  // ---------- UI ----------
  function md(t) {
    return LX.escape(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
  }
  function open(win) {
    const body = win.body; let typing = null, alive = true, busy = false;
    const log = H('div', { class: 'as-log scroll' });
    const chipsEl = H('div', { class: 'as-chips' });
    const input = H('input', { class: 'as-input', placeholder: 'Ask me anything or give a command...', autocomplete: 'off', spellcheck: 'false' });
    const send = H('button', { class: 'as-send', title: 'Send', html: LX.icon('arrow-up', 18) });
    const head = H('div', { class: 'as-head' }, H('div', { class: 'as-avatar', html: LX.icon('zap', 18) }), H('div', { class: 'as-hd' }, H('b', { text: 'Lion Assistant' }), H('span', { class: 'as-sub', text: 'Offline - controls your OS' })),
      H('button', { class: 'btn ghost icon sm', title: 'Clear conversation', html: LX.icon('trash', 15), onclick: () => clearAll() }));
    body.append(head, log, chipsEl, H('div', { class: 'as-bar' }, input, send));
    const scroll = () => { log.scrollTop = log.scrollHeight; };
    // simpler robust typing implementation using a flag
    let skipFlag = false;
    function typeBubble(text, acts) {
      const b = H('div', { class: 'as-msg as-bot' }, H('div', { class: 'as-mini', html: LX.icon('zap', 12) }));
      const t = H('div', { class: 'as-txt' }); b.append(t); log.append(b);
      const fin = () => { t.innerHTML = md(text); if (acts && acts.length) b.append(H('div', { class: 'as-acts' }, acts.map((a) => H('span', { class: 'as-act', html: LX.icon('check', 12) + LX.escape(a) })))); scroll(); };
      return new Promise((res) => {
        let i = 0; skipFlag = false;
        (function step() {
          if (!alive) return res();
          if (skipFlag || i >= text.length) { fin(); return res(); }
          i = Math.min(text.length, i + (text.length > 220 ? 4 : 2)); t.innerHTML = md(text.slice(0, i)) + '<span class="as-caret"></span>'; scroll();
          setTimeout(step, 14);
        })();
      });
    }
    function showChips(list) {
      chipsEl.textContent = '';
      (list && list.length ? list : LX.pick([CHIPS.slice(0, 5), CHIPS.slice(3, 8), CHIPS.slice(5)])).slice(0, 5).forEach((c) => chipsEl.append(H('button', { class: 'as-chip', text: c, onclick: () => submit(c) })));
    }
    function addStatic(r, text, acts) {
      const b = H('div', { class: 'as-msg ' + (r === 'u' ? 'as-user' : 'as-bot') });
      if (r !== 'u') b.append(H('div', { class: 'as-mini', html: LX.icon('zap', 12) }));
      b.append(H('div', { class: 'as-txt', html: md(text) }));
      if (acts && acts.length) b.append(H('div', { class: 'as-acts' }, acts.map((a) => H('span', { class: 'as-act', html: LX.icon('check', 12) + LX.escape(a) }))));
      log.append(b); return b;
    }
    function welcome() {
      log.textContent = '';
      if (!hist.length) {
        log.append(H('div', { class: 'as-hero' }, H('div', { class: 'as-hero-ic', html: LX.icon('zap', 30) }), H('b', { text: 'Hi, I am Lion Assistant' }), H('span', { class: 'muted', text: 'I can open apps, change settings, set timers, make notes, do maths and more. Everything runs offline.' }), H('span', { class: 'muted as-hint', html: 'Press <span class="kbd">Alt</span> + <span class="kbd">A</span> any time to summon me.' })));
      } else hist.forEach((m) => addStatic(m.r, m.t, m.a));
      scroll(); showChips();
    }
    function clearAll() { hist = []; saveH(); welcome(); }
    async function submit(text) {
      text = String(text == null ? input.value : text).trim(); if (!text) return;
      if (busy) { skipFlag = true; }
      input.value = '';
      const hero = log.querySelector('.as-hero'); if (hero) hero.remove();
      addStatic('u', text); hist.push({ r: 'u', t: text, ts: Date.now() }); scroll();
      chipsEl.textContent = ''; busy = true;
      const think = H('div', { class: 'as-msg as-bot as-think' }, H('div', { class: 'as-mini', html: LX.icon('zap', 12) }), H('div', { class: 'as-txt', html: '<i></i><i></i><i></i>' })); log.append(think); scroll();
      await new Promise((r) => setTimeout(r, 220 + Math.random() * 180));
      think.remove(); if (!alive) return;
      let r; try { r = respond(text); } catch (e) { r = reply('Sorry, something broke: ' + e.message); }
      if (r.clear) { busy = false; clearAll(); return; }
      hist.push({ r: 'a', t: r.text, a: r.acts, ts: Date.now() }); saveH();
      await typeBubble(r.text, r.acts); busy = false;
      if (!alive) return; showChips(r.chips); scroll(); input.focus();
    }
    // chips like "Open Tasks", "Open that file" are plain text commands
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } else if (e.key === 'ArrowUp' && !input.value) { const u = hist.filter((m) => m.r === 'u').pop(); if (u) input.value = u.t; e.preventDefault(); } });
    send.addEventListener('click', () => submit());
    const off = LX.bus.on('assistant:reminders', () => {});
    win.setMenu([{ label: 'Chat', items: [{ label: 'Clear conversation', action: clearAll }, { separator: true }, { label: 'Help', action: () => submit('help') }] }]);
    win.onClose(() => { alive = false; off && off(); });
    win.on('args', (a) => { if (a && a.ask) submit(a.ask); });
    win.on('focus', () => setTimeout(() => input.focus(), 30));
    welcome(); setTimeout(() => input.focus(), 50);
    if (win.args && win.args.ask) submit(win.args.ask);
    win._ask = submit;
  }

  LX.apps.register({ id: 'assistant', name: 'Lion Assistant', icon: 'zap', color: '#F6C177', category: 'Utilities', desc: 'Offline assistant that opens apps, changes settings, sets timers and more.', width: 460, height: 640, minWidth: 340, minHeight: 380, singleton: true, open });
  LX.assistant = { ask: (t) => respond(t), respond };

  // Alt+A global shortcut
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && (e.code === 'KeyA' || e.key.toLowerCase() === 'a')) {
      e.preventDefault();
      const ex = LX.wm.list().find((w) => w.appId === 'assistant');
      if (ex && !ex.minimized && ex.isFocused()) { ex.minimize(); return; }
      LX.apps.launch('assistant');
    }
  });
})();
