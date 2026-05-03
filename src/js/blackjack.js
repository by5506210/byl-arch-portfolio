// ============================================
// BLACKJACK ROOM
// ============================================

(function () {
  'use strict';

  var SUITS = ['C', 'D', 'H', 'S'];
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  var MAX_ROUNDS = 3;
  var STARTING_CHIPS = 100;
  var BASE_BET = 10;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function createDeck() {
    var deck = [];
    for (var s = 0; s < SUITS.length; s++) {
      for (var r = 0; r < RANKS.length; r++) {
        deck.push({
          suit: SUITS[s],
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
    if (!hand.length) return '0';
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
    if (result === 'blackjack') return 'blackjack +' + amount;
    if (result === 'win') return 'win +' + amount;
    if (result === 'loss') return 'loss ' + amount;
    return 'push';
  }

  function createCardEl(card, hidden) {
    var el = document.createElement('div');
    el.className = hidden ? 'blackjack-card blackjack-card--hidden' : 'blackjack-card';

    if (hidden) {
      el.innerHTML = '<span></span><strong>BYL</strong><span></span>';
      return el;
    }

    var isRed = card.suit === 'H' || card.suit === 'D';
    if (isRed) el.classList.add('blackjack-card--red');
    el.innerHTML = '<span>' + card.rank + '</span><strong>' + card.suit + '</strong><span>' + card.rank + '</span>';
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
      bet: game.querySelector('#blackjack-bet'),
      cpuChips: game.querySelector('#blackjack-cpu-chips'),
      record: game.querySelector('#blackjack-record'),
      wager: game.querySelector('#blackjack-wager-display'),
      dealerValue: game.querySelector('#blackjack-dealer-value'),
      playerValue: game.querySelector('#blackjack-player-value'),
      cpuValue: game.querySelector('#blackjack-cpu-value'),
      dealerHand: game.querySelector('#blackjack-dealer-hand'),
      playerHand: game.querySelector('#blackjack-player-hand'),
      cpuHand: game.querySelector('#blackjack-cpu-hand'),
      cpuNote: game.querySelector('#blackjack-cpu-note'),
      log: game.querySelector('#blackjack-log'),
      deal: game.querySelector('#blackjack-deal'),
      hit: game.querySelector('#blackjack-hit'),
      stand: game.querySelector('#blackjack-stand'),
      doubleDown: game.querySelector('#blackjack-double'),
      betButtons: game.querySelectorAll('[data-bet-step]')
    };

    var state = null;

    function resetGame() {
      state = {
        deck: shuffle(createDeck()),
        phase: 'idle',
        round: 1,
        chips: STARTING_CHIPS,
        cpuChips: STARTING_CHIPS,
        bet: BASE_BET,
        playerBet: BASE_BET,
        cpuBet: BASE_BET,
        player: [],
        cpu: [],
        dealer: [],
        dealerHidden: false,
        playerDoubled: false,
        wins: 0,
        losses: 0,
        pushes: 0,
        log: ['CPU Bryan is already acting suspicious.']
      };
      render('Set your wager.');
    }

    function addLog(text) {
      state.log.unshift(text);
      state.log = state.log.slice(0, 5);
    }

    function setBet(step) {
      if (state.phase !== 'idle' && state.phase !== 'round-over') return;
      if (state.round > MAX_ROUNDS || state.chips <= 0) return;
      var maxBet = Math.max(0, state.chips);
      state.bet = clamp(state.bet + step, Math.min(BASE_BET, maxBet), maxBet);
      if (state.bet % BASE_BET !== 0 && state.bet > BASE_BET) {
        state.bet = Math.floor(state.bet / BASE_BET) * BASE_BET;
      }
      render('Wager set to ' + state.bet + '.');
    }

    function startRound() {
      if (state.phase === 'game-over' || state.round > MAX_ROUNDS || state.chips <= 0) {
        resetGame();
        return;
      }

      if (state.phase === 'round-over') {
        state.round++;
        if (state.round > MAX_ROUNDS || state.chips <= 0) {
          endGame();
          return;
        }
      }

      state.phase = 'player-turn';
      state.player = [];
      state.cpu = [];
      state.dealer = [];
      state.dealerHidden = true;
      state.playerDoubled = false;
      state.playerBet = Math.min(state.bet, state.chips);
      state.cpuBet = Math.min(BASE_BET, state.cpuChips);

      state.player.push(draw(state.deck));
      state.cpu.push(draw(state.deck));
      state.dealer.push(draw(state.deck));
      state.player.push(draw(state.deck));
      state.cpu.push(draw(state.deck));
      state.dealer.push(draw(state.deck));

      addLog('Round ' + state.round + ' opened at ' + state.playerBet + ' chips.');

      var playerValue = handValue(state.player);
      var dealerValue = handValue(state.dealer);
      if (playerValue.blackjack || dealerValue.blackjack) {
        finishRound();
        return;
      }

      render('Your move.');
    }

    function playerHit() {
      if (state.phase !== 'player-turn') return;
      state.player.push(draw(state.deck));
      var value = handValue(state.player);
      if (value.bust) {
        addLog('You busted at ' + value.total + '.');
        finishRound();
      } else {
        render('Your move.');
      }
    }

    function playerStand() {
      if (state.phase !== 'player-turn') return;
      finishRound();
    }

    function playerDoubleDown() {
      if (!canDoubleDown()) return;
      state.playerBet *= 2;
      state.playerDoubled = true;
      state.player.push(draw(state.deck));
      addLog('Double down: wager locked at ' + state.playerBet + '.');
      finishRound();
    }

    function canDoubleDown() {
      return state.phase === 'player-turn' &&
        state.player.length === 2 &&
        state.chips >= state.playerBet * 2;
    }

    function playCpu() {
      var value = handValue(state.cpu);
      var doubled = false;
      if (state.cpu.length === 2 && value.total === 11 && state.cpuChips >= state.cpuBet * 2) {
        state.cpuBet *= 2;
        state.cpu.push(draw(state.deck));
        doubled = true;
      } else {
        while (!value.bust && (value.total < 16 || (value.soft && value.total < 18))) {
          state.cpu.push(draw(state.deck));
          value = handValue(state.cpu);
        }
      }

      value = handValue(state.cpu);
      if (value.bust) return 'CPU Bryan busted at ' + value.total + '.';
      if (doubled) return 'CPU Bryan doubled and froze at ' + value.total + '.';
      return 'CPU Bryan stayed at ' + value.total + '.';
    }

    function playDealer() {
      var value = handValue(state.dealer);
      while (!value.bust && (value.total < 17 || (value.soft && value.total === 17))) {
        state.dealer.push(draw(state.deck));
        value = handValue(state.dealer);
      }
    }

    function settle(hand, bet) {
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

    function finishRound() {
      state.dealerHidden = false;
      state.phase = 'resolving';

      var playerValue = handValue(state.player);
      var cpuNote = playCpu();
      var cpuValue = handValue(state.cpu);

      if (!playerValue.bust || !cpuValue.bust) {
        playDealer();
      }

      var playerResult = settle(state.player, state.playerBet);
      var cpuResult = settle(state.cpu, state.cpuBet);
      var playerDelta = payoutFor(playerResult, state.playerBet);
      var cpuDelta = payoutFor(cpuResult, state.cpuBet);

      state.chips = Math.max(0, state.chips + playerDelta);
      state.cpuChips = Math.max(0, state.cpuChips + cpuDelta);

      if (playerResult === 'loss') state.losses++;
      else if (playerResult === 'push') state.pushes++;
      else state.wins++;

      addLog('You: ' + resultText(playerResult, Math.abs(playerDelta)) + '.');
      addLog('CPU Bryan: ' + resultText(cpuResult, Math.abs(cpuDelta)) + '.');

      state.phase = 'round-over';
      if (state.round >= MAX_ROUNDS || state.chips <= 0) {
        state.phase = 'game-over';
      }

      var message = cpuNote;
      if (state.phase === 'game-over') {
        message = state.chips > STARTING_CHIPS ? 'Three rounds complete. You left up.' : 'Three rounds complete. The table remembers.';
      }

      render(message);
    }

    function endGame() {
      state.phase = 'game-over';
      render('Three rounds complete.');
    }

    function renderHand(container, hand, hideHole) {
      container.innerHTML = '';
      if (!hand.length) {
        var empty = document.createElement('div');
        empty.className = 'blackjack-card blackjack-card--ghost';
        empty.innerHTML = '<span></span><strong></strong><span></span>';
        container.appendChild(empty);
        return;
      }

      for (var i = 0; i < hand.length; i++) {
        container.appendChild(createCardEl(hand[i], hideHole && i === 1));
      }
    }

    function renderLog() {
      els.log.innerHTML = '';
      for (var i = 0; i < state.log.length; i++) {
        var item = document.createElement('p');
        item.textContent = state.log[i];
        els.log.appendChild(item);
      }
    }

    function render(message) {
      var isAction = state.phase === 'player-turn';
      var isIdle = state.phase === 'idle' || state.phase === 'round-over';
      var isGameOver = state.phase === 'game-over';

      els.round.textContent = 'Round ' + Math.min(state.round, MAX_ROUNDS) + ' of ' + MAX_ROUNDS;
      els.message.textContent = message || '';
      els.chips.textContent = state.chips;
      els.bet.textContent = state.playerBet || state.bet;
      els.cpuChips.textContent = state.cpuChips;
      els.record.textContent = state.wins + '-' + state.losses + '-' + state.pushes;
      els.wager.textContent = state.bet;
      els.dealerValue.textContent = handLabel(state.dealer, state.dealerHidden);
      els.playerValue.textContent = handLabel(state.player, false);
      els.cpuValue.textContent = handLabel(state.cpu, false);
      els.cpuNote.textContent = state.phase === 'player-turn' ? 'Studying the dealer.' : (message || 'Waiting for the deal.');

      renderHand(els.dealerHand, state.dealer, state.dealerHidden);
      renderHand(els.playerHand, state.player, false);
      renderHand(els.cpuHand, state.cpu, false);
      renderLog();

      els.hit.disabled = !isAction;
      els.stand.disabled = !isAction;
      els.doubleDown.disabled = !canDoubleDown();
      els.betButtons.forEach(function (button) {
        button.disabled = !isIdle || isGameOver;
      });

      if (isGameOver) {
        els.deal.textContent = 'New Game';
      } else if (state.phase === 'round-over') {
        els.deal.textContent = 'Next Round';
      } else {
        els.deal.textContent = 'Deal';
      }

      els.deal.disabled = isAction || state.phase === 'resolving';
    }

    els.deal.addEventListener('click', startRound);
    els.hit.addEventListener('click', playerHit);
    els.stand.addEventListener('click', playerStand);
    els.doubleDown.addEventListener('click', playerDoubleDown);
    els.betButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        setBet(Number(button.getAttribute('data-bet-step')) || 0);
      });
    });

    resetGame();
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
