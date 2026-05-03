// ============================================
// BLACKJACK ROOM
// ============================================

(function () {
  'use strict';

  var SUITS = [
    { code: 'clubs', symbol: '\u2663', red: false },
    { code: 'diamonds', symbol: '\u2666', red: true },
    { code: 'hearts', symbol: '\u2665', red: true },
    { code: 'spades', symbol: '\u2660', red: false }
  ];
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

    var originalAces = aces;
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return {
      total: total,
      soft: aces > 0 && originalAces > 0 && total <= 21,
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

  function createCardEl(card, hidden) {
    var el = document.createElement('div');
    el.className = hidden ? 'blackjack-card blackjack-card--hidden' : 'blackjack-card';

    if (hidden) {
      el.innerHTML = '<span></span><strong>BYL</strong><span></span>';
      return el;
    }

    if (card.red) el.classList.add('blackjack-card--red');
    el.innerHTML =
      '<span class="blackjack-card__corner">' + card.rank + '<i>' + card.suitSymbol + '</i></span>' +
      '<strong><span>' + card.suitSymbol + '</span><em>' + rankName(card.rank) + '</em></strong>' +
      '<span class="blackjack-card__corner">' + card.rank + '<i>' + card.suitSymbol + '</i></span>';
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
      wager: game.querySelector('#blackjack-wager-display'),
      dealerValue: game.querySelector('#blackjack-dealer-value'),
      playerValue: game.querySelector('#blackjack-player-value'),
      cpuValue: game.querySelector('#blackjack-cpu-value'),
      dealerHand: game.querySelector('#blackjack-dealer-hand'),
      playerHand: game.querySelector('#blackjack-player-hand'),
      cpuHand: game.querySelector('#blackjack-cpu-hand'),
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
        roundResult: '',
        roundDelta: 0,
        wins: 0,
        losses: 0,
        pushes: 0
      };
      render('Wager');
    }

    function setBet(step) {
      if (state.phase !== 'idle') return;
      if (state.round > MAX_ROUNDS || state.chips <= 0) return;
      var maxBet = Math.max(0, state.chips);
      state.bet = clamp(state.bet + step, Math.min(BASE_BET, maxBet), maxBet);
      if (state.bet % BASE_BET !== 0 && state.bet > BASE_BET) {
        state.bet = Math.floor(state.bet / BASE_BET) * BASE_BET;
      }
      render('Wager');
    }

    function startRound() {
      if (state.phase === 'game-over' || state.round > MAX_ROUNDS || state.chips <= 0) {
        resetGame();
        return;
      }

      if (state.phase === 'round-over') {
        prepareNextBet();
        return;
      }

      state.phase = 'player-turn';
      state.player = [];
      state.cpu = [];
      state.dealer = [];
      state.dealerHidden = true;
      state.playerDoubled = false;
      state.roundResult = '';
      state.roundDelta = 0;
      state.playerBet = Math.min(state.bet, state.chips);
      state.cpuBet = Math.min(BASE_BET, state.cpuChips);

      state.player.push(draw(state.deck));
      state.cpu.push(draw(state.deck));
      state.dealer.push(draw(state.deck));
      state.player.push(draw(state.deck));
      state.cpu.push(draw(state.deck));
      state.dealer.push(draw(state.deck));

      var playerValue = handValue(state.player);
      var dealerValue = handValue(state.dealer);
      if (playerValue.blackjack || dealerValue.blackjack) {
        finishRound();
        return;
      }

      render('');
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
      state.cpuBet = Math.min(BASE_BET, state.cpuChips);
      render('Wager');
    }

    function playerHit() {
      if (state.phase !== 'player-turn') return;
      state.player.push(draw(state.deck));
      var value = handValue(state.player);
      if (value.bust) {
        finishRound();
      } else {
        render('');
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
      finishRound();
    }

    function canDoubleDown() {
      return state.phase === 'player-turn' &&
        state.player.length === 2 &&
        state.chips >= state.playerBet * 2;
    }

    function playCpu() {
      var value = handValue(state.cpu);
      if (state.cpu.length === 2 && value.total >= 9 && value.total <= 12 && state.cpuChips >= state.cpuBet * 2) {
        state.cpuBet = Math.min(state.cpuBet * 2, state.cpuChips);
        state.cpu.push(draw(state.deck));
      } else {
        while (!value.bust && (value.total < 18 || (value.soft && value.total <= 18))) {
          state.cpu.push(draw(state.deck));
          value = handValue(state.cpu);
        }
      }
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
      playCpu();
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

      state.roundResult = playerResult === 'loss' ? 'You lose' : (playerResult === 'push' ? 'Push' : 'You win');
      state.roundDelta = playerDelta;

      state.phase = 'round-over';
      if (state.round >= MAX_ROUNDS || state.chips <= 0) {
        state.phase = 'game-over';
      }

      var message = resultText(playerResult, Math.abs(playerDelta));
      if (state.phase === 'game-over') {
        message = state.chips > STARTING_CHIPS ? 'Final +' + (state.chips - STARTING_CHIPS) : 'Final ' + state.chips;
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

    function render(message) {
      var isAction = state.phase === 'player-turn';
      var isIdle = state.phase === 'idle';
      var isGameOver = state.phase === 'game-over';

      els.round.textContent = 'Round ' + Math.min(state.round, MAX_ROUNDS) + '/' + MAX_ROUNDS;
      els.message.textContent = message || '';
      els.chips.textContent = state.chips;
      els.bet.textContent = isIdle ? state.bet : (state.playerBet || state.bet);
      els.cpuChips.textContent = state.cpuChips;
      els.wager.textContent = state.bet;
      els.dealerValue.textContent = handLabel(state.dealer, state.dealerHidden);
      els.playerValue.textContent = handLabel(state.player, false);
      els.cpuValue.textContent = handLabel(state.cpu, false);

      renderHand(els.dealerHand, state.dealer, state.dealerHidden);
      renderHand(els.playerHand, state.player, false);
      renderHand(els.cpuHand, state.cpu, false);
      renderResult();
      renderFinalOverlay();

      els.hit.disabled = !isAction;
      els.stand.disabled = !isAction;
      els.doubleDown.disabled = !canDoubleDown();
      els.doubleDown.classList.toggle('is-hidden', !isAction);
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
      els.deal.classList.toggle('is-hidden', isAction || state.phase === 'resolving' || isGameOver);
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
