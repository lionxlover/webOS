/* Store app — Flashcards: decks, 3D flip study mode and a Leitner box system. */
(function () {
  'use strict';
  const H = LX.h;
  const KEY = 'app.flashcards';

  LX.apps.register({
    id: 'flashcards', name: 'Flashcards', icon: 'book', color: '#CBA6F7', category: 'Productivity',
    pkg: true, pkgVersion: '1.0', pkgSize: 11, developer: 'Moonlit Byte', downloads: 720,
    desc: 'Study with spaced repetition', longDesc: 'Create decks of flashcards and study them with 3D flips and a Leitner box system: cards you know come back less often, cards you struggle with return sooner. Ships with a sample deck.',
    permissions: ['Local storage'], changelog: 'First release.',
    width: 720, height: 560, minWidth: 420, minHeight: 400,
    open(win) {
      let data = LX.store.get(KEY) || sample();
      const save = () => LX.store.set(KEY, data);
      function sample() {
        return {
          decks: [
            { id: LX.uid(), name: 'World capitals', cards: [
              { id: LX.uid(), front: 'France', back: 'Paris', box: 1 },
              { id: LX.uid(), front: 'Japan', back: 'Tokyo', box: 1 },
              { id: LX.uid(), front: 'Canada', back: 'Ottawa', box: 1 },
              { id: LX.uid(), front: 'Australia', back: 'Canberra', box: 1 },
              { id: LX.uid(), front: 'Brazil', back: 'Brasília', box: 1 },
            ] },
            { id: LX.uid(), name: 'Leonux shortcuts', cards: [
              { id: LX.uid(), front: 'Global search', back: 'Ctrl + Space', box: 1 },
              { id: LX.uid(), front: 'Mission Control', back: 'Ctrl + Alt + ↑', box: 1 },
              { id: LX.uid(), front: 'Switch space', back: 'Ctrl + Alt + ← / →', box: 1 },
              { id: LX.uid(), front: 'Terminal', back: 'Ctrl + Alt + T', box: 1 },
            ] },
          ],
        };
      }

      let view = 'decks'; // decks | study
      let deck = null, idx = 0, queue = [];
      const stage = H('div', { class: 'fc-stage grow' });

      function paintDecks() {
        stage.innerHTML = '';
        stage.appendChild(H('div', { class: 'fc-grid' }, data.decks.map((d) => {
          const known = d.cards.filter((c) => c.box >= 3).length;
          return H('button', { class: 'card fc-deck', onclick: () => startStudy(d) },
            H('div', { class: 'fc-deck-ico', html: LX.icon('book', 26) }),
            H('b', { text: d.name }),
            H('div', { class: 'muted', style: { fontSize: '12px' }, text: d.cards.length + ' cards · ' + known + ' mastered' }),
            H('div', { class: 'progress', style: { marginTop: '8px' } }, H('div', { style: { width: (d.cards.length ? known / d.cards.length * 100 : 0) + '%' } })));
        })));
        stage.appendChild(H('div', { class: 'row gap', style: { marginTop: '16px' } },
          H('button', { class: 'btn primary', html: LX.icon('plus', 14) + ' New deck', onclick: async () => {
            const n = await LX.dialog.prompt('Deck name', '', 'New deck');
            if (n && n.trim()) { data.decks.push({ id: LX.uid(), name: n.trim(), cards: [] }); save(); paintDecks(); }
          } }),
          deck && H('button', { class: 'btn', html: LX.icon('plus', 14) + ' Add card to ' + deck.name, onclick: addCard })));
      }
      async function addCard() {
        if (!deck) return;
        const f = await LX.dialog.prompt('Front (question)', '', 'New card');
        if (f == null) return;
        const b = await LX.dialog.prompt('Back (answer)', '', 'New card');
        if (b == null) return;
        deck.cards.push({ id: LX.uid(), front: f.trim(), back: b.trim(), box: 1 });
        save();
        if (view === 'study') next(); else paintDecks();
      }
      function startStudy(d) {
        deck = d; view = 'study';
        queue = d.cards.slice().sort((a, b) => a.box - b.box).slice(0, 20).map((c) => c.id);
        idx = 0;
        paintStudy();
      }
      function cur() { return deck.cards.find((c) => c.id === queue[idx]); }
      function paintStudy() {
        stage.innerHTML = '';
        if (!queue.length) { doneAll(); return; }
        const c = cur();
        if (!c) { doneAll(); return; }
        const flip = H('div', { class: 'fc-card', onclick: () => flip.classList.toggle('flip') },
          H('div', { class: 'fc-inner' },
            H('div', { class: 'fc-face fc-front' }, H('div', { class: 'muted', style: { fontSize: '11px' }, text: 'CARD ' + (idx + 1) + ' / ' + queue.length }), H('h2', { text: c.front }), H('div', { class: 'muted', text: 'Box ' + c.box + ' · tap to flip' })),
            H('div', { class: 'fc-face fc-back' }, H('div', { class: 'muted', style: { fontSize: '11px' }, text: 'ANSWER' }), H('h2', { text: c.back }))));
        const top = H('div', { class: 'fc-study-top' }, H('button', { class: 'btn sm ghost', html: LX.icon('chevron-left', 13) + ' Decks', onclick: () => { view = 'decks'; deck = null; paintDecks(); } }),
          H('b', { text: deck.name }), H('span', { class: 'grow' }), H('button', { class: 'btn sm', html: LX.icon('plus', 13) + ' Card', onclick: addCard }));
        const actions = H('div', { class: 'fc-actions' },
          H('button', { class: 'btn danger', text: 'Again', onclick: () => grade(0) }),
          H('button', { class: 'btn', text: 'Good', onclick: () => grade(1) }),
          H('button', { class: 'btn primary', text: 'Easy', onclick: () => grade(2) }));
        stage.append(top, flip, actions);
      }
      function grade(g) {
        const c = cur();
        if (!c) return;
        c.box = LX.clamp(c.box + (g === 0 ? -1 : g), 1, 5);
        save();
        if (g === 0) queue.push(c.id); // requeue at the end
        next();
      }
      function next() { idx++; if (idx >= queue.length) doneAll(); else paintStudy(); }
      function doneAll() {
        stage.innerHTML = '';
        stage.append(H('div', { class: 'fc-done' }, H('div', { html: LX.icon('check-circle', 52) }), H('h2', { text: 'Deck complete!' }),
          H('p', { class: 'muted', text: 'Mastered ' + deck.cards.filter((c) => c.box >= 3).length + ' of ' + deck.cards.length + ' cards.' }),
          H('button', { class: 'btn primary', text: 'Back to decks', onclick: () => { view = 'decks'; deck = null; paintDecks(); } })));
        LX.notify({ title: 'Study session done', body: deck.name + ' — nice work!', icon: 'check-circle' });
      }
      win.body.append(H('div', { class: 'fc-wrap col' }, stage));
      paintDecks();
    },
  });
})();
