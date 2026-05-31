// ============================================
// BLACKJACK ROOM
// ============================================

(function () {
  'use strict';

  var SUITS = [
    { code: 'clubs', symbol: '♣', red: false },
    { code: 'diamonds', symbol: '♦', red: true },
    { code: 'hearts', symbol: '♥', red: true },
    { code: 'spades', symbol: '♠', red: false }
  ];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var MAX_ROUNDS = 3;
  var STARTING_CHIPS = 100;
  var BASE_BET = 10;

  // Pacing (ms). Everything routes through wait(), which collapses to 0 under
  // reduced-motion so the whole game still plays, just instantly.
  var DEAL_GAP = 240;     // between each card in the opening deal
  var REVEAL_GAP = 480;   // between each dealer hit during the reveal
  var FLIP_BEAT = 520;    // pause after the hole card flips
  var SETTLE_BEAT = 360;  // pause before the result is announced
  var CHIP_TWEEN = 620;   // chip count-up duration

  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Ghost Bryan is flavor only now: he sits at the felt, holds a hand, and
  // reacts. He does not bet, bank chips, or affect the outcome.
  var GHOST = {
    deal: ['Cards feel warm tonight.', 'Let us see what the felt gives us.', 'Down to business.', 'Place your faith and your chips.'],
    win: ['Clean. I taught you that.', 'The house blinks first.', 'Nicely played.'],
    loss: ['The house always whispers back.', 'Ouch. Walk it off.', 'I felt that one from here.'],
    push: ['A draw. Nobody breathes.', 'Even. The table holds.'],
    bust: ['Too greedy. Classic you.', 'Over the line.', 'I would have stood, but who is counting.'],
    dealerBust: ['Dealer is cooked.', 'The house overreached.', 'A gift from the felt.'],
    blackjack: ['Natural. Show-off.', 'Twenty-one on the nose.', 'Beautiful. Almost unfair.'],
    doubled: ['Bold. I like bold.', 'Doubling? Respect.', 'All or nothing, then.']
  };

  function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createDeck() {
    var deck = [];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < RANKS.length; r++) {
        deck.push({
          suit: SUITS[s].code,
          suitSymbol: SUITS[s].symbol,
          red: SUITS[s].red,
          rank: RANKS[r]
        });
      }
    }
    return deck;
  }

  function shuffle(deck) {
    for (var i = deck.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var temp = deck[i];
      deck[i] = deck[j];
      deck[j] = temp;
    }
    return deck;
  }

  function cardValue(card) {
    if (card.rank === 'A') return 11;
    if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 10;
    return Number(card.rank);
  }

  function handValue(hand) {
    var total = 0;
    var aces = 0;
    for (var i = 0; i < hand.length; i++) {
      total += cardValue(hand[i]);
      if (hand[i].rank === 'A') aces++;
    }

    var soft = aces > 0;
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return {
      total: total,
      soft: soft && total <= 21,
      blackjack: hand.length === 2 && total === 21,
      bust: total > 21
    };
  }

  function handLabel(hand, hideHole) {
    if (!hand.length) return '';
    if (hideHole) {
      return String(cardValue(hand[0]));
    }
    var value = handValue(hand);
    return value.soft && value.total < 21 ? value.total + ' soft' : String(value.total);
  }

  function draw(deck) {
    if (deck.length < 12) {
      deck.push.apply(deck, shuffle(createDeck()));
    }
    return deck.pop();
  }

  function payoutFor(result, bet) {
    if (result === 'blackjack') return Math.round(bet * 1.5);
    if (result === 'win') return bet;
    if (result === 'loss') return -bet;
    return 0;
  }

  function resultText(result, amount) {
    if (result === 'blackjack') return 'Blackjack +' + amount;
    if (result === 'win') return 'Win +' + amount;
    if (result === 'loss') return 'Loss -' + amount;
    return 'Push';
  }

  function rankName(rank) {
    if (rank === 'A') return 'Ace';
    if (rank === 'J') return 'Jack';
    if (rank === 'Q') return 'Queen';
    if (rank === 'K') return 'King';
    return rank;
  }

  function cardFaceHTML(card) {
    return '<span class="blackjack-card__corner">' + card.rank + '<i>' + card.suitSymbol + '</i></span>' +
      '<strong><span>' + card.suitSymbol + '</span><em>' + rankName(card.rank) + '</em></strong>' +
      '<span class="blackjack-card__corner">' + card.rank + '<i>' + card.suitSymbol + '</i></span>';
  }

  // Mutating the face/back in place (rather than recreating the element) is what
  // lets us animate only the card that actually changed.
  function setFace(el, card) {
    el.classList.remove('blackjack-card--hidden');
    el.classList.toggle('blackjack-card--red', !!card.red);
    el.innerHTML = cardFaceHTML(card);
  }

  function setHidden(el) {
    el.classList.add('blackjack-card--hidden');
    el.classList.remove('blackjack-card--red');
    el.innerHTML = '<span></span><strong>BYL</strong><span></span>';
  }

  function createCardEl(card, hidden) {
    var el = document.createElement('div');
    el.className = 'blackjack-card';
    if (hidden) setHidden(el); else setFace(el, card);
    return el;
  }

  function initBlackjackGame(root) {
    var scope = root && root.querySelector ? root : document;
    var game = scope.querySelector('[data-blackjack-game]');
    if (!game || game.dataset.blackjackReady === 'true') return;
    game.dataset.blackjackReady = 'true';

    var els = {
      round: game.querySelector('#blackjack-round'),
      message: game.querySelector('#blackjack-message'),
      chips: game.querySelector('#blackjack-chips'),
      wager: game.querySelector('#blackjack-wager-display'),
      dealerValue: game.querySelector('#blackjack-dealer-value'),
      playerValue: game.querySelector('#blackjack-player-value'),
      dealerHand: game.querySelector('#blackjack-dealer-hand'),
      playerHand: game.querySelector('#blackjack-player-hand'),
      cpuHand: game.querySelector('#blackjack-cpu-hand'),
      ghostQuip: game.querySelector('#blackjack-ghost-quip'),
      result: game.querySelector('#blackjack-result'),
      gameOver: game.querySelector('#blackjack-game-over'),
      finalTitle: game.querySelector('#blackjack-final-title'),
      finalDetail: game.querySelector('#blackjack-final-detail'),
      playAgain: game.querySelector('#blackjack-play-again'),
      deal: game.querySelector('#blackjack-deal'),
      hit: game.querySelector('#blackjack-hit'),
      stand: game.querySelector('#blackjack-stand'),
      doubleDown: game.querySelector('#blackjack-double'),
      betButtons: game.querySelectorAll('[data-bet-step]'),
      controlsLeft: game.querySelector('.blackjack-controls__left'),
      wagerPanel: game.querySelector('[data-blackjack-panel="wager"]'),
      actionPanel: game.querySelector('[data-blackjack-panel="actions"]')
    };

    var state = null;
    // Bumping the token aborts any in-flight animation sequence (e.g. the player
    // hits New Game while the dealer is still drawing).
    var seqToken = 0;
    // While the chip total is counting up/down, render() leaves it alone.
    var chipTween = false;

    function wait(ms) {
      return new Promise(function (resolve) {
        setTimeout(resolve, reduceMotion ? 0 : ms);
      });
    }

    function alive(token) {
      return token === seqToken;
    }

    function resetGame() {
      seqToken++;
      chipTween = false;
      state = {
        deck: shuffle(createDeck()),
        phase: 'idle',
        round: 1,
        chips: STARTING_CHIPS,
        bet: BASE_BET,
        playerBet: BASE_BET,
        player: [],
        cpu: [],
        dealer: [],
        dealerHidden: false,
        playerDoubled: false,
        roundResult: '',
        roundDelta: 0,
        lastResult: '',
        locked: false,
        message: 'Place your bet',
        wins: 0,
        losses: 0,
        pushes: 0
      };
      ghostSay('');
      render();
    }

    function setBet(step) {
      if (state.phase !== 'idle' || state.locked) return;
      if (state.round > MAX_ROUNDS || state.chips <= 0) return;
      var maxBet = Math.max(0, state.chips);
      state.bet = clamp(state.bet + step, Math.min(BASE_BET, maxBet), maxBet);
      if (state.bet % BASE_BET !== 0 && state.bet > BASE_BET) {
        state.bet = Math.floor(state.bet / BASE_BET) * BASE_BET;
      }
      render();
    }

    // ---- Game flow ---------------------------------------------------------

    function startRound() {
      if (state.locked) return;

      if (state.phase === 'game-over' || state.round > MAX_ROUNDS || state.chips <= 0) {
        resetGame();
        return;
      }
      if (state.phase === 'round-over') {
        prepareNextBet();
        return;
      }
      if (state.phase !== 'idle') return;

      dealSequence();
    }

    function prepareNextBet() {
      state.round++;
      if (state.round > MAX_ROUNDS || state.chips <= 0) {
        endGame();
        return;
      }
      state.phase = 'idle';
      state.player = [];
      state.cpu = [];
      state.dealer = [];
      state.dealerHidden = false;
      state.playerDoubled = false;
      state.roundResult = '';
      state.roundDelta = 0;
      state.bet = clamp(state.bet, Math.min(BASE_BET, state.chips), state.chips);
      state.playerBet = state.bet;
      state.message = 'Place your bet';
      ghostSay('');
      render();
    }

    // Deal one card at a time around the table so the round opens with a beat
    // instead of six cards snapping in at once.
    function dealSequence() {
      var token = ++seqToken;
      state.phase = 'dealing';
      state.locked = true;
      state.player = [];
      state.cpu = [];
      state.dealer = [];
      state.dealerHidden = true;
      state.playerDoubled = false;
      state.roundResult = '';
      state.roundDelta = 0;
      state.lastResult = '';
      state.playerBet = Math.min(state.bet, state.chips);
      state.message = 'Dealing';
      render();
      ghostSay(pick(GHOST.deal));

      var steps = [
        function () { state.player.push(draw(state.deck)); },
        function () { state.dealer.push(draw(state.deck)); },
        function () { state.cpu.push(draw(state.deck)); },
        function () { state.player.push(draw(state.deck)); },
        function () { state.dealer.push(draw(state.deck)); },
        function () { state.cpu.push(draw(state.deck)); }
      ];

      var chain = Promise.resolve();
      steps.forEach(function (step) {
        chain = chain.then(function () {
          if (!alive(token)) return;
          return wait(DEAL_GAP).then(function () {
            if (!alive(token)) return;
            step();
            render();
          });
        });
      });

      return chain.then(function () {
        if (!alive(token)) return;
        var playerValue = handValue(state.player);
        var dealerValue = handValue(state.dealer);
        if (playerValue.blackjack || dealerValue.blackjack) {
          return revealAndResolve(token);
        }
        state.phase = 'player-turn';
        state.locked = false;
        state.message = 'Your move - hit or stand';
        render();
      });
    }

    function playerHit() {
      if (state.phase !== 'player-turn' || state.locked) return;
      var token = ++seqToken;
      state.locked = true;
      state.player.push(draw(state.deck));
      state.message = '';
      render();
      wait(300).then(function () {
        if (!alive(token)) return;
        if (handValue(state.player).bust) {
          revealAndResolve(token);
        } else {
          state.locked = false;
          state.message = 'Your move - hit or stand';
          render();
        }
      });
    }

    function playerStand() {
      if (state.phase !== 'player-turn' || state.locked) return;
      revealAndResolve(++seqToken);
    }

    function playerDoubleDown() {
      if (state.phase !== 'player-turn' || state.locked) return;
      var token = ++seqToken;
      state.playerBet = Math.min(state.playerBet * 2, state.chips);
      state.playerDoubled = true;
      state.locked = true;
      state.player.push(draw(state.deck));
      state.message = 'Doubled - one card';
      ghostSay(pick(GHOST.doubled));
      render();
      wait(460).then(function () {
        if (!alive(token)) return;
        revealAndResolve(token);
      });
    }

    // Flip the hole card, let the dealer draw card-by-card, then settle.
    function revealAndResolve(token) {
      state.phase = 'resolving';
      state.locked = true;
      state.dealerHidden = false;
      state.message = 'Dealer turn';
      render();

      var playerBust = handValue(state.player).bust;

      return wait(FLIP_BEAT)
        .then(function () {
          if (!alive(token)) return;
          if (playerBust) return;
          return dealerDrawLoop(token);
        })
        .then(function () {
          if (!alive(token)) return;
          return wait(SETTLE_BEAT);
        })
        .then(function () {
          if (!alive(token)) return;
          var fromChips = state.chips;
          settleRound();
          state.locked = false;
          // Hold the old chip number on screen through this render so the count
          // starts from it, then animate to the new total.
          chipTween = !reduceMotion && fromChips !== state.chips;
          render();
          animateChips(token, fromChips);
          reactGhost();
        });
    }

    function dealerDrawLoop(token) {
      var value = handValue(state.dealer);
      var mustHit = !value.bust && (value.total < 17 || (value.soft && value.total === 17));
      if (!mustHit) {
        state.message = value.bust ? 'Dealer busts' : 'Dealer stands on ' + value.total;
        render();
        return Promise.resolve();
      }
      state.message = 'Dealer hits';
      render();
      return wait(REVEAL_GAP).then(function () {
        if (!alive(token)) return;
        state.dealer.push(draw(state.deck));
        render();
        return dealerDrawLoop(token);
      });
    }

    function settle(hand) {
      var player = handValue(hand);
      var dealer = handValue(state.dealer);

      if (player.bust) return 'loss';
      if (player.blackjack && !dealer.blackjack) return 'blackjack';
      if (dealer.blackjack && !player.blackjack) return 'loss';
      if (dealer.bust) return 'win';
      if (player.total > dealer.total) return 'win';
      if (player.total < dealer.total) return 'loss';
      return 'push';
    }

    function settleRound() {
      var result = settle(state.player);
      var delta = payoutFor(result, state.playerBet);

      state.chips = Math.max(0, state.chips + delta);
      state.lastResult = result;
      state.roundResult = result === 'loss' ? 'You lose' : (result === 'push' ? 'Push' : 'You win');
      state.roundDelta = delta;

      if (result === 'loss') state.losses++;
      else if (result === 'push') state.pushes++;
      else state.wins++;

      state.phase = (state.round >= MAX_ROUNDS || state.chips <= 0) ? 'game-over' : 'round-over';
      // The result overlay carries the outcome; keep the header status quiet.
      state.message = '';
    }

    function endGame() {
      state.phase = 'game-over';
      state.message = '';
      render();
    }

    function reactGhost() {
      var line;
      if (state.lastResult === 'blackjack') line = pick(GHOST.blackjack);
      else if (handValue(state.player).bust) line = pick(GHOST.bust);
      else if (handValue(state.dealer).bust) line = pick(GHOST.dealerBust);
      else if (state.lastResult === 'win') line = pick(GHOST.win);
      else if (state.lastResult === 'loss') line = pick(GHOST.loss);
      else line = pick(GHOST.push);
      ghostSay(line);
    }

    function ghostSay(line) {
      if (!els.ghostQuip) return;
      els.ghostQuip.textContent = line || '';
      els.ghostQuip.classList.remove('is-show');
      // restart the fade
      void els.ghostQuip.offsetWidth;
      if (line) els.ghostQuip.classList.add('is-show');
    }

    // Count the chip total from its old value to the new one rather than
    // snapping. state.chips stays the source of truth; this only animates the
    // displayed number. A setTimeout backstop finalizes the value even if rAF is
    // paused (e.g. the tab is in the background), so the count can never stick.
    function animateChips(token, from) {
      var to = state.chips;
      var done = false;
      function finalize() {
        if (done) return;
        done = true;
        chipTween = false;
        if (alive(token)) els.chips.textContent = state.chips;
      }
      if (reduceMotion || from === to) {
        finalize();
        return;
      }
      chipTween = true;
      var startTs = null;
      function frame(ts) {
        if (!alive(token)) { finalize(); return; }
        if (startTs === null) startTs = ts;
        var t = Math.min(1, (ts - startTs) / CHIP_TWEEN);
        var eased = 1 - Math.pow(1 - t, 3);
        els.chips.textContent = Math.round(from + (to - from) * eased);
        if (t < 1) requestAnimationFrame(frame);
        else finalize();
      }
      requestAnimationFrame(frame);
      setTimeout(finalize, CHIP_TWEEN + 400);
    }

    // ---- Rendering ---------------------------------------------------------

    // Reconcile the DOM with the hand instead of rebuilding it. New cards animate
    // in; existing cards are left alone; the hole card flips when revealed.
    function renderHand(container, hand, hideHole) {
      if (!hand.length) {
        container.innerHTML = '<div class="blackjack-card blackjack-card--ghost"><span></span><strong></strong><span></span></div>';
        return;
      }

      var placeholder = container.querySelector('.blackjack-card--ghost');
      if (placeholder) container.innerHTML = '';

      // Trim leftovers from a previous hand.
      while (container.children.length > hand.length) {
        container.removeChild(container.lastChild);
      }

      for (var i = 0; i < hand.length; i++) {
        var hidden = hideHole && i === 1;
        var el = container.children[i];
        if (!el) {
          el = createCardEl(hand[i], hidden);
          el.setAttribute('data-hidden', hidden ? '1' : '0');
          container.appendChild(el);
        } else if (el.getAttribute('data-hidden') === '1' && !hidden) {
          flipReveal(el, hand[i]);
          el.setAttribute('data-hidden', '0');
        }
      }
    }

    // Turn the card edge-on, swap to the face at the midpoint, then turn back.
    // A transition (not an animation) avoids fighting the card's entrance keyframes.
    function flipReveal(el, card) {
      if (reduceMotion) {
        setFace(el, card);
        return;
      }
      el.style.transition = 'transform 0.16s ease';
      el.style.transform = 'rotateY(90deg)';
      setTimeout(function () {
        setFace(el, card);
        el.style.transform = 'rotateY(0deg)';
      }, 170);
      setTimeout(function () {
        el.style.transition = '';
        el.style.transform = '';
      }, 360);
    }

    function render() {
      var isAction = state.phase === 'player-turn';
      var isIdle = state.phase === 'idle';
      var isGameOver = state.phase === 'game-over';
      var isBusy = state.phase === 'dealing' || state.phase === 'resolving';

      els.round.textContent = 'Round ' + Math.min(state.round, MAX_ROUNDS) + '/' + MAX_ROUNDS;
      els.message.textContent = state.message || '';
      if (!chipTween) els.chips.textContent = state.chips;
      els.wager.textContent = state.bet;
      els.dealerValue.textContent = state.dealer.length ? handLabel(state.dealer, state.dealerHidden) : '';
      els.playerValue.textContent = state.player.length ? handLabel(state.player, false) : '';

      renderHand(els.dealerHand, state.dealer, state.dealerHidden);
      renderHand(els.playerHand, state.player, false);
      renderHand(els.cpuHand, state.cpu, false);
      renderResult();
      renderFinalOverlay();

      var canAct = isAction && !state.locked;
      els.hit.disabled = !canAct;
      els.stand.disabled = !canAct;
      els.doubleDown.disabled = !canAct;
      els.doubleDown.classList.toggle('is-hidden', !isAction);
      els.betButtons.forEach(function (button) {
        button.disabled = !isIdle || state.locked;
      });

      if (isGameOver) {
        els.deal.textContent = 'New Game';
      } else if (state.phase === 'round-over') {
        els.deal.textContent = 'Next Round';
      } else {
        els.deal.textContent = 'Deal';
      }

      els.deal.disabled = state.locked || isAction || isBusy;
      els.deal.classList.toggle('is-hidden', isAction || isBusy || isGameOver);
      els.controlsLeft.classList.toggle('is-hidden', !isIdle);
      els.wagerPanel.classList.toggle('is-hidden', !isIdle);
      els.actionPanel.classList.toggle('is-hidden', !isAction);
    }

    function renderResult() {
      var shouldShow = state.roundResult && (state.phase === 'round-over' || state.phase === 'game-over');
      els.result.classList.toggle('is-visible', Boolean(shouldShow));
      if (!shouldShow) {
        els.result.innerHTML = '';
        return;
      }
      var delta = state.roundDelta;
      var deltaText = delta > 0 ? '+' + delta : (delta < 0 ? String(delta) : '0');
      els.result.innerHTML = '<span>' + state.roundResult + '</span> <small>' + deltaText + '</small>';
    }

    function renderFinalOverlay() {
      var showFinal = state.phase === 'game-over';
      els.gameOver.classList.toggle('is-visible', showFinal);
      els.gameOver.setAttribute('aria-hidden', showFinal ? 'false' : 'true');
      if (!showFinal) return;

      var finalResult = state.chips > STARTING_CHIPS ? 'You win' : (state.chips < STARTING_CHIPS ? 'You lose' : 'Push');
      var delta = state.chips - STARTING_CHIPS;
      var deltaText = delta > 0 ? '+' + delta : String(delta);
      els.finalTitle.textContent = finalResult;
      els.finalDetail.textContent = state.chips + ' chips (' + deltaText + ')';
    }

    // ---- Entrance: lights rise over the table ------------------------------

    function runIntro() {
      var intro = document.getElementById('blackjack-intro');
      if (!intro) return;

      var shell = game.querySelector('.blackjack-shell');
      var nav = document.querySelector('.blackjack-nav');
      var controls = game.querySelector('.blackjack-controls');
      var seats = game.querySelectorAll('.blackjack-seat');
      var spot = intro.querySelector('.blackjack-intro__spot');

      if (reduceMotion || typeof gsap === 'undefined') {
        intro.style.display = 'none';
        return;
      }

      var chrome = [];
      if (nav) chrome.push(nav);
      if (controls) chrome.push(controls);

      gsap.set(intro, { opacity: 1 });
      gsap.set(spot, { opacity: 0, scale: 0.35 });
      gsap.set(shell, { opacity: 0, y: 12 });
      gsap.set(seats, { opacity: 0, y: 16 });
      gsap.set(chrome, { opacity: 0 });
      if (nav) gsap.set(nav, { y: -8 });

      gsap.timeline({
        onComplete: function () {
          intro.style.display = 'none';
          gsap.set([shell, seats].concat(chrome), { clearProps: 'opacity,transform' });
        }
      })
        .to(spot, { opacity: 0.95, scale: 1, duration: 0.75, ease: 'power2.out' }, 0.15)
        .to(intro, { opacity: 0, duration: 0.9, ease: 'power2.inOut' }, 0.55)
        .to(shell, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, 0.6)
        .to(seats, { opacity: 1, y: 0, duration: 0.6, stagger: 0.12, ease: 'power2.out' }, 0.75)
        .to(chrome, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, 1.0);

      // Backstop: never leave the room curtained if a tween hiccups.
      setTimeout(function () { intro.style.display = 'none'; }, 2600);
    }

    // ---- Wire up -----------------------------------------------------------

    els.deal.addEventListener('click', startRound);
    els.hit.addEventListener('click', playerHit);
    els.stand.addEventListener('click', playerStand);
    els.doubleDown.addEventListener('click', playerDoubleDown);
    els.playAgain.addEventListener('click', resetGame);
    els.betButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        setBet(Number(button.getAttribute('data-bet-step')) || 0);
      });
    });

    resetGame();
    runIntro();
  }

  window.initBlackjackGame = initBlackjackGame;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initBlackjackGame(document);
    });
  } else {
    initBlackjackGame(document);
  }
})();
