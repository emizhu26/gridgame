const STARTING_FOSSIL = 4;
const RENEWABLE_COST = 24;
const POST_TRANSITION_ROUNDS = 4;
const STARTING_MONEY = 12;
const REVEAL_DELAY = 1400;
const HIGHLIGHT_DURATION_MS = 900;
const EMERGENCY_MARKET_SURCHARGE = 2;

const SPARKY_INTRO_MESSAGE =
  "Hi I'm sparky! Welcome to the grid game. Your goal is to replace all the power plants with renewable energy sources to make the grid greener! But beware of blackouts! To see all the rules press the ? box in the top corner. Have fun!";

const SPARKY_RENEWABLE_TIPS = [
  "Great first step. Renewable energy sources like solar and wind generate electricity without burning fuel, which helps cut air pollution and carbon emissions.",
  "Mixing renewable sources can make the grid stronger because different technologies produce power under different weather conditions.",
  "As more renewables come online, you must balance changing supply with demand, storage, and backup planning to avoid shortages. Reminder: you can sell surplus renewables energy in the market for extra money!",
  "You replaced the last fossil plant! A fully renewable grid still needs careful planning so clean energy stays reliable. Tip: you can buy energy from the market to be prepared if renewables come up short!",
];

const SPARKY_WIN_MESSAGE =
  "You won! You replaced every fossil plant and kept the grid reliable through the full transition. That is exactly how a cleaner power system succeeds.";

const SPARKY_LOSS_MESSAGE =
  "Uh oh! You did not have enough renewable energy to meet demand, and the emergency market price was too high so the grid experienced a blackout. In a real blackout, power outages can last for hours or days and cause major disruptions. To avoid blackouts, grid operators need to carefully balance supply and demand and maintain backup resources";

const state = {
  round: 1,
  money: STARTING_MONEY,
  displayedMoney: STARTING_MONEY,
  fossilPlants: STARTING_FOSSIL,
  renewables: 0,
  postTransitionRoundsSurvived: 0,
  isResolvingRound: false,
  gameOver: false,
  won: false,
  lastRound: {
    demand: null,
    renewableOutput: null,
    fossilUsed: null,
    income: null
  },
  displayedRound: {
    demand: null,
    renewableOutput: null,
    fossilUsed: null,
    income: null
  },
  marketSellPrice: randInt(1, 2),
  marketBuyPrice: randInt(3, 5),
  marketEnergy: 0,
  sellableSurplus: 0,
  awaitingEmergencyPurchase: false,
  emergencyRound: null
};

const els = {
  roundValue: document.getElementById("roundValue"),
  moneyValue: document.getElementById("moneyValue"),
  fossilValue: document.getElementById("fossilValue"),
  fossilIcons: document.getElementById("fossilIcons"),
  roundDemandAnnouncement: document.getElementById("roundDemandAnnouncement"),
  roundBreakdown: document.getElementById("roundBreakdown"),
  renewableValue: document.getElementById("renewableValue"),
  demandValue: document.getElementById("demandValue"),
  renewableOutputValue: document.getElementById("renewableOutputValue"),
  fossilUsedValue: document.getElementById("fossilUsedValue"),
  incomeValue: document.getElementById("incomeValue"),
  tipText: document.getElementById("tipText"),
  statusText: document.getElementById("statusText"),
  logList: document.getElementById("logList"),
  playRoundButton: document.getElementById("playRoundButton"),
  buyButton: document.getElementById("buyButton"),
  marketButton: document.getElementById("marketButton"),
  restartButton: document.getElementById("restartButton"),
  openRulesButton: document.getElementById("openRulesButton"),
  openLogButton: document.getElementById("openLogButton"),
  closeRulesButton: document.getElementById("closeRulesButton"),
  closeLogButton: document.getElementById("closeLogButton"),
  closeMarketButton: document.getElementById("closeMarketButton"),
  closeSparkyButton: document.getElementById("closeSparkyButton"),
  rulesModal: document.getElementById("rulesModal"),
  logModal: document.getElementById("logModal"),
  marketModal: document.getElementById("marketModal"),
  sparkyModal: document.getElementById("sparkyModal"),
  marketPricesText: document.getElementById("marketPricesText"),
  marketInventoryText: document.getElementById("marketInventoryText"),
  sellEnergyButton: document.getElementById("sellEnergyButton"),
  buyEnergyButton: document.getElementById("buyEnergyButton"),
  sparkyModalTitle: document.getElementById("sparkyModalTitle"),
  sparkyBubble: document.getElementById("sparkyBubble"),
  sparkyLabel: document.getElementById("sparkyLabel"),
  sparkyText: document.getElementById("sparkyText"),
  sparkyImg: document.getElementById("sparkyImg")
};

let pendingRoundTimeoutId = null;
let pendingBreakdownTimeoutIds = [];
const highlightTimeoutIds = new Map();

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollDemand() {
  return randInt(1, 16);
}

function rollRenewableOutput(renewableCount) {
  let total = 0;
  for (let i = 0; i < renewableCount; i += 1) {
    total += randInt(1, 4);
  }
  return total;
}

function openModal(modalEl) {
  modalEl?.classList.remove("hidden");
}

function closeModal(modalEl) {
  modalEl?.classList.add("hidden");
}

function closeAllModals() {
  closeModal(els.rulesModal);
  closeModal(els.logModal);
  closeModal(els.marketModal);
  closeModal(els.sparkyModal);
}

function rerollMarketPrices() {
  state.marketSellPrice = randInt(1, 2);
  state.marketBuyPrice = randInt(3, 5);
}

function updateMarketUi() {
  const isEmergency = state.awaitingEmergencyPurchase && state.emergencyRound;
  const activeBuyPrice = isEmergency
    ? state.emergencyRound.buyPrice
    : state.marketBuyPrice;

  if (els.marketPricesText) {
    els.marketPricesText.textContent = isEmergency
      ? `Emergency market pricing - Sell: ${state.marketSellPrice}/unit, Buy: ${activeBuyPrice}/unit.`
      : `Round ${state.round} prices - Sell: ${state.marketSellPrice}/unit, Buy: ${activeBuyPrice}/unit.`;
  }

  if (els.marketInventoryText) {
    els.marketInventoryText.textContent = isEmergency
      ? `Stored energy: ${state.marketEnergy}. You must buy ${state.emergencyRound.unitsNeeded} more unit(s) at the emergency price to avoid a blackout.`
      : `Stored energy: ${state.marketEnergy}. Sellable renewable surplus: ${state.sellableSurplus}.`;
  }

  if (els.sellEnergyButton) {
    els.sellEnergyButton.disabled =
      state.sellableSurplus <= 0 || state.gameOver || state.awaitingEmergencyPurchase;
  }

  if (els.buyEnergyButton) {
    els.buyEnergyButton.disabled = state.money < activeBuyPrice || state.gameOver;
  }
}

function addLog(message) {
  const item = document.createElement("li");
  item.textContent = message;
  els.logList.prepend(item);
}

function flashElement(
  target,
  className = "is-updating",
  durationMs = HIGHLIGHT_DURATION_MS
) {
  if (!target) {
    return;
  }

  const previousTimeout = highlightTimeoutIds.get(target);
  if (previousTimeout) {
    window.clearTimeout(previousTimeout);
  }

  target.classList.remove(className);
  void target.offsetWidth;
  target.classList.add(className);

  const timeoutId = window.setTimeout(() => {
    target.classList.remove(className);
    highlightTimeoutIds.delete(target);
  }, durationMs);

  highlightTimeoutIds.set(target, timeoutId);
}

function flashStatValue(valueEl) {
  const card = valueEl?.closest(".card");
  flashElement(card);
}

function getTip({ demand, renewableOutput, fossilUsed, income, boughtThisTurn }) {
  if (state.gameOver && state.won) {
    return "Great job balancing reliability and emissions. A clean grid still needs careful planning.";
  }

  if (state.gameOver && !state.won) {
    return "Blackout risk falls when you diversify clean power and maintain enough backup capacity.";
  }

  if (boughtThisTurn) {
    return "Investing in renewables reduces long-term fossil reliance, even when output varies.";
  }

  if (state.renewables === 0) {
    return "With no renewables yet, every unit depends on fossil plants and adds operating cost.";
  }

  if (renewableOutput >= demand) {
    return "High renewable output covered demand this round. Variability can create big savings.";
  }

  if (fossilUsed > renewableOutput) {
    return "Fossil backup kept the lights on, but fuel costs reduced your net income.";
  }

  if (income <= Math.ceil(demand * 0.6)) {
    return "High fossil usage can eat into earnings and slow down your clean-energy transition.";
  }

  return "Balancing variable supply with dependable backup is central to grid planning.";
}

function updateButtons() {
  els.buyButton.disabled =
    state.gameOver ||
    state.isResolvingRound ||
    state.awaitingEmergencyPurchase ||
    state.money < RENEWABLE_COST ||
    state.fossilPlants <= 0;

  els.playRoundButton.disabled =
    state.gameOver || state.isResolvingRound || state.awaitingEmergencyPurchase;
  els.restartButton.disabled = state.isResolvingRound;

  if (els.marketButton) {
    els.marketButton.disabled = state.gameOver;
  }
}

function createPlantIcon(src, alt) {
  const icon = document.createElement("img");
  icon.src = src;
  icon.alt = alt;
  icon.className = "fossil-icon";
  return icon;
}

function createRenewableIcon(index) {
  if (index % 2 === 0) {
    return createPlantIcon("./src/img/renewables.png", "Solar renewable source");
  }

  return createPlantIcon("./src/img/wind_renewable.png", "Wind renewable source");
}

function renderFossilIcons() {
  els.fossilIcons.innerHTML = "";

  for (let i = 0; i < state.fossilPlants; i += 1) {
    els.fossilIcons.append(
      createPlantIcon("./src/img/fossil_fuel.png", "Fossil fuel plant")
    );
  }

  for (let i = 0; i < state.renewables; i += 1) {
    els.fossilIcons.append(createRenewableIcon(i));
  }
}

function render() {
  const { demand, renewableOutput, fossilUsed, income } = state.displayedRound;

  els.roundValue.textContent = String(state.round);
  els.moneyValue.textContent = String(state.displayedMoney);
  els.fossilValue.textContent = String(state.fossilPlants);
  els.renewableValue.textContent = String(state.renewables);
  els.demandValue.textContent = demand === null ? "-" : String(demand);
  els.renewableOutputValue.textContent =
    renewableOutput === null ? "-" : String(renewableOutput);
  els.fossilUsedValue.textContent =
    fossilUsed === null ? "-" : String(fossilUsed);
  els.incomeValue.textContent = income === null ? "-" : String(income);

  renderFossilIcons();
  updateButtons();
  updateMarketUi();
}

function setRoundDemandAnnouncement(message = "") {
  els.roundDemandAnnouncement.textContent = message;
}

function setDisplayedRoundValues(
  roundValues = {},
  displayedMoney = state.displayedMoney
) {
  const previousDisplayedRound = { ...state.displayedRound };
  const previousDisplayedMoney = state.displayedMoney;

  state.displayedRound = {
    ...state.displayedRound,
    ...roundValues
  };
  state.displayedMoney = displayedMoney;
  render();

  if (
    Object.prototype.hasOwnProperty.call(roundValues, "demand") &&
    roundValues.demand !== previousDisplayedRound.demand
  ) {
    flashStatValue(els.demandValue);
  }

  if (
    Object.prototype.hasOwnProperty.call(roundValues, "renewableOutput") &&
    roundValues.renewableOutput !== previousDisplayedRound.renewableOutput
  ) {
    flashStatValue(els.renewableOutputValue);
  }

  if (
    Object.prototype.hasOwnProperty.call(roundValues, "fossilUsed") &&
    roundValues.fossilUsed !== previousDisplayedRound.fossilUsed
  ) {
    flashStatValue(els.fossilUsedValue);
  }

  if (
    Object.prototype.hasOwnProperty.call(roundValues, "income") &&
    roundValues.income !== previousDisplayedRound.income
  ) {
    flashStatValue(els.incomeValue);
  }

  if (displayedMoney !== previousDisplayedMoney) {
    flashStatValue(els.moneyValue);
  }
}

function clearRoundBreakdownReveal() {
  pendingBreakdownTimeoutIds.forEach((timeoutId) => {
    window.clearTimeout(timeoutId);
  });
  pendingBreakdownTimeoutIds = [];
}

function setRoundBreakdown(steps = []) {
  clearRoundBreakdownReveal();
  els.roundBreakdown.textContent = "";

  if (!Array.isArray(steps) || steps.length === 0) {
    return;
  }

  steps.forEach((step, index) => {
    const timeoutId = window.setTimeout(() => {
      step.onReveal?.();

      if (index === 0) {
        els.roundBreakdown.textContent = step.text;
      } else {
        els.roundBreakdown.textContent += `\n${step.text}`;
      }
    }, index * REVEAL_DELAY);

    pendingBreakdownTimeoutIds.push(timeoutId);
  });
}

function setSparkyMessage(text, educational = false) {
  if (!els.sparkyText || !els.sparkyImg) {
    return;
  }

  if (els.sparkyModalTitle) {
    els.sparkyModalTitle.textContent = educational ? "Sparky's tip" : "Sparky says...";
  }

  if (els.sparkyLabel) {
    els.sparkyLabel.hidden = !educational;
  }

  els.sparkyText.textContent = text;
  els.sparkyImg.classList.remove("sparky-talking");
  void els.sparkyImg.offsetWidth;
  els.sparkyImg.classList.add("sparky-talking");

  window.setTimeout(() => {
    els.sparkyImg?.classList.remove("sparky-talking");
  }, 600);
}

function showSparkyMessage(text, educational = false) {
  setSparkyMessage(text, educational);
  openModal(els.sparkyModal);
}

function showIntroSparkyMessage() {
  showSparkyMessage(SPARKY_INTRO_MESSAGE, false);
}

function showRenewableTip() {
  const renewableIndex = Math.max(0, state.renewables - 1);
  const tip =
    SPARKY_RENEWABLE_TIPS[renewableIndex] ??
    SPARKY_RENEWABLE_TIPS[SPARKY_RENEWABLE_TIPS.length - 1];

  els.tipText.textContent = tip;
  showSparkyMessage(tip, true);
}

function showEndGameSparkyMessage() {
  const message = state.won ? SPARKY_WIN_MESSAGE : SPARKY_LOSS_MESSAGE;
  showSparkyMessage(message, false);
}

function startEmergencyMarketResponse({
  demand,
  renewableOutput,
  renewableUsed,
  marketUsed,
  shortfall,
  moneyBeforeRound
}) {
  const emergencyBuyPrice = state.marketBuyPrice + EMERGENCY_MARKET_SURCHARGE;
  const totalEmergencyCost = shortfall * emergencyBuyPrice;

  if (state.money < totalEmergencyCost) {
    state.lastRound = {
      demand,
      renewableOutput,
      fossilUsed: 0,
      income: 0
    };
    state.gameOver = true;
    state.won = false;

    setRoundDemandAnnouncement(`Your energy demand for the round is ${demand}.`);
    setRoundBreakdown([
      {
        text: `Renewables covered ${renewableUsed} units of energy.`,
        onReveal: () => {
          setDisplayedRoundValues(
            {
              demand,
              renewableOutput,
              fossilUsed: null,
              income: null
            },
            moneyBeforeRound
          );
        }
      },
      {
        text: marketUsed > 0
          ? `Stored market energy covered ${marketUsed} units. You still needed ${shortfall} more unit(s), but the emergency market price jumped to ${emergencyBuyPrice} per unit.`
          : `You still needed ${shortfall} more unit(s), and the emergency market price jumped to ${emergencyBuyPrice} per unit.`,
        onReveal: () => {
          setDisplayedRoundValues(
            {
              demand,
              renewableOutput,
              fossilUsed: 0,
              income: null
            },
            moneyBeforeRound
          );
        }
      },
      {
        text: `Overall, you needed ${totalEmergencyCost} money to avoid the blackout, but you did not have enough.`,
        onReveal: () => {
          state.isResolvingRound = false;
          setDisplayedRoundValues(
            {
              demand,
              renewableOutput,
              fossilUsed: 0,
              income: 0
            },
            moneyBeforeRound
          );
          render();
          showEndGameSparkyMessage();
        }
      }
    ]);

    els.statusText.textContent = "Blackout: you could not afford the emergency market price.";
    els.tipText.textContent = getTip({
      demand,
      renewableOutput,
      fossilUsed: 0,
      income: 0,
      boughtThisTurn: false
    });
    addLog(
      `Round ${state.round}: Demand ${demand}, renewables ${renewableOutput}, stored market used ${marketUsed}, emergency price ${emergencyBuyPrice}/unit, needed ${shortfall} more unit(s). Blackout occurred.`
    );
    render();
    return true;
  }

  state.awaitingEmergencyPurchase = true;
  state.isResolvingRound = false;
  state.emergencyRound = {
    demand,
    renewableOutput,
    renewableUsed,
    marketUsed,
    unitsNeeded: shortfall,
    unitsPurchased: 0,
    buyPrice: emergencyBuyPrice,
    totalPurchaseCost: 0,
    moneyBeforeRound
  };

  setRoundDemandAnnouncement(`Your energy demand for the round is ${demand}.`);
  setRoundBreakdown([
    {
      text: `Renewables accounted for ${renewableUsed} units of energy.`,
      onReveal: () => {
        setDisplayedRoundValues(
          {
            demand,
            renewableOutput,
            fossilUsed: null,
            income: null
          },
          moneyBeforeRound
        );
      }
    },
    {
      text: marketUsed > 0
        ? `Stored market energy covered ${marketUsed} units. You still need ${shortfall} more unit(s).`
        : `You still need ${shortfall} more unit(s) to meet demand.`,
      onReveal: () => {
        setDisplayedRoundValues(
          {
            demand,
            renewableOutput,
            fossilUsed: 0,
            income: null
          },
          moneyBeforeRound
        );
      }
    },
    {
      text: `Emergency market prices are now ${emergencyBuyPrice} per unit. Open the market and buy ${shortfall} unit(s) to avoid a blackout.`,
      onReveal: () => {
        render();
        showSparkyMessage(
          `You do not have enough renewable energy this round. The market can save you, but the emergency price has gone up to ${emergencyBuyPrice} per unit. Buy ${shortfall} unit(s) now to avoid a blackout.`,
          true
        );
      }
    }
  ]);

  els.statusText.textContent = `Emergency: buy ${shortfall} market unit(s) at ${emergencyBuyPrice} each to avoid a blackout.`;
  els.tipText.textContent =
    "When the grid is tight, emergency energy usually costs more than normal market power.";
  addLog(
    `Round ${state.round}: Demand ${demand}, renewables ${renewableOutput}, stored market used ${marketUsed}. Emergency market triggered at ${emergencyBuyPrice}/unit for ${shortfall} unit(s).`
  );
  render();
  return true;
}

function finalizeEmergencyRound() {
  if (!state.awaitingEmergencyPurchase || !state.emergencyRound) {
    return;
  }

  const {
    demand,
    renewableOutput,
    marketUsed,
    unitsPurchased,
    totalPurchaseCost
  } = state.emergencyRound;
  const income = demand - totalPurchaseCost;

  state.money += demand;
  state.round += 1;
  state.awaitingEmergencyPurchase = false;
  state.isResolvingRound = false;

  setRoundBreakdown([
    {
      text:
        marketUsed > 0
          ? `Stored market energy covered ${marketUsed} units, and emergency market purchases covered ${unitsPurchased} more unit(s) for ${totalPurchaseCost} money.`
          : `Emergency market purchases covered ${unitsPurchased} unit(s) for ${totalPurchaseCost} money.`,
      onReveal: () => {
        setDisplayedRoundValues(
          {
            demand,
            renewableOutput,
            fossilUsed: 0,
            income: null
          },
          state.money - demand
        );
      }
    },
    {
      text: `Overall, you added ${income} money units this round and avoided a blackout.`,
      onReveal: () => {
        setDisplayedRoundValues(
          {
            demand,
            renewableOutput,
            fossilUsed: 0,
            income
          },
          state.money
        );
        render();

        if (state.gameOver && state.won) {
          showEndGameSparkyMessage();
        }
      }
    }
  ]);

  state.lastRound = {
    demand,
    renewableOutput,
    fossilUsed: 0,
    income
  };

  addLog(
    `Round ${state.round - 1}: Emergency market bought ${unitsPurchased} unit(s) for ${totalPurchaseCost}. Income ${income >= 0 ? "+" : ""}${income}.`
  );

  els.statusText.textContent =
    "Emergency purchases kept the lights on. You can play the next round.";
  els.tipText.textContent =
    "Emergency energy can prevent a blackout, but price spikes make last-minute fixes expensive.";
  state.emergencyRound = null;
  checkWinProgress();
  render();
  rerollMarketPrices();
  updateMarketUi();
}

function checkWinProgress() {
  if (state.fossilPlants > 0) {
    state.postTransitionRoundsSurvived = 0;
    return;
  }

  state.postTransitionRoundsSurvived += 1;

  if (state.postTransitionRoundsSurvived >= POST_TRANSITION_ROUNDS) {
    state.gameOver = true;
    state.won = true;
    els.statusText.textContent =
      "You won: full renewable transition completed and grid stayed reliable.";
  } else {
    const remaining = POST_TRANSITION_ROUNDS - state.postTransitionRoundsSurvived;
    els.statusText.textContent = `All fossil plants replaced. Survive ${remaining} more round(s) to win.`;
  }
}

function resolveRound(demand) {
  const moneyBeforeRound = state.money;
  const renewableOutput = rollRenewableOutput(state.renewables);
  const shortfallAfterRenewables = Math.max(0, demand - renewableOutput);
  const marketUsed = Math.min(state.marketEnergy, shortfallAfterRenewables);
  state.marketEnergy -= marketUsed;
  const shortfall = Math.max(0, shortfallAfterRenewables - marketUsed);
  const renewableUsed = Math.min(demand, renewableOutput);
  state.sellableSurplus = Math.max(0, renewableOutput - demand);
  
  if (shortfall > 0 && state.fossilPlants === 0) {
    const handledByEmergencyMarket = startEmergencyMarketResponse({
      demand,
      renewableOutput,
      renewableUsed,
      marketUsed,
      shortfall,
      moneyBeforeRound
    });

    if (handledByEmergencyMarket) {
      updateMarketUi();
    }
    return;
  }

  const fossilUsed = shortfall;
  const fossilCost = Math.ceil(fossilUsed / 2);
  const marketCoveredThisRound = marketUsed;
  const income = demand - fossilCost;
  const roundStatusText =
    "Round complete. You can buy a renewable before the next round.";
  state.money += income;

  setRoundDemandAnnouncement(`Your energy demand for the round is ${demand}.`);
  setRoundBreakdown([
    {
      text: `Renewables accounted for ${renewableUsed} units of energy.`,
      onReveal: () => {
        setDisplayedRoundValues(
          {
            demand,
            renewableOutput,
            fossilUsed: null,
            income: null
          },
          moneyBeforeRound
        );
      }
    },
    {
      text: marketUsed > 0
        ? `Stored market energy covered ${marketUsed} units. Fossil fuels covered ${fossilUsed} units of energy at a cost of ${fossilCost} money units.`
        : `Fossil fuels covered ${fossilUsed} units of energy at a cost of ${fossilCost} money units.`,
      onReveal: () => {
        setDisplayedRoundValues(
          {
            demand,
            renewableOutput,
            fossilUsed,
            income: null
          },
          moneyBeforeRound
        );
      }
    },
    {
      text: `Overall, you added ${income} money units this round.`,
      onReveal: () => {
        state.round += 1;
        state.isResolvingRound = false;
        setDisplayedRoundValues(
          {
            demand,
            renewableOutput,
            fossilUsed,
            income
          },
          state.money
        );
        render();

        if (state.gameOver && state.won) {
          showEndGameSparkyMessage();
        }
      }
    }
  ]);

  state.lastRound = {
    demand,
    renewableOutput,
    fossilUsed,
    income
  };

  addLog(
    `Round ${state.round}: Demand ${demand}, renewables ${renewableOutput}, market used ${marketCoveredThisRound}, fossil used ${fossilUsed}, income ${income >= 0 ? "+" : ""}${income}.`
  );

  els.statusText.textContent = roundStatusText;
  checkWinProgress();
  els.tipText.textContent = getTip({
    demand,
    renewableOutput,
    fossilUsed,
    income,
    boughtThisTurn: false
  });

  render();
  rerollMarketPrices();
  updateMarketUi();
}

function playRound() {
  if (state.gameOver || state.isResolvingRound) {
    return;
  }

  state.sellableSurplus = 0;
  const demand = rollDemand();
  state.isResolvingRound = true;

  setRoundDemandAnnouncement(`Your energy demand for the round is ${demand}.`);
  setDisplayedRoundValues(
    {
      demand,
      renewableOutput: null,
      fossilUsed: null,
      income: null
    },
    state.money
  );
  setRoundBreakdown([{ text: "Rolling renewable output and fossil cost..." }]);
  render();

  pendingRoundTimeoutId = window.setTimeout(() => {
    pendingRoundTimeoutId = null;
    resolveRound(demand);
  }, REVEAL_DELAY);
}

function buyRenewable() {
  if (
    state.gameOver ||
    state.isResolvingRound ||
    state.money < RENEWABLE_COST ||
    state.fossilPlants <= 0
  ) {
    return;
  }

  state.money -= RENEWABLE_COST;
  state.displayedMoney = state.money;
  state.fossilPlants -= 1;
  state.renewables += 1;

  addLog(
    `Investment: Bought 1 renewable for ${RENEWABLE_COST}. Fossil plants now ${state.fossilPlants}.`
  );
  setRoundDemandAnnouncement("");
  setRoundBreakdown([]);
  els.statusText.textContent = "Purchased 1 renewable source and retired 1 fossil plant.";
  els.tipText.textContent = getTip({
    demand: state.lastRound.demand ?? 0,
    renewableOutput: state.lastRound.renewableOutput ?? 0,
    fossilUsed: state.lastRound.fossilUsed ?? 0,
    income: state.lastRound.income ?? 0,
    boughtThisTurn: true
  });

  render();
  flashStatValue(els.moneyValue);
  flashStatValue(els.fossilValue);
  flashStatValue(els.renewableValue);
  showRenewableTip();
}

function sellSurplusEnergy() {
  if (state.gameOver || state.sellableSurplus <= 0) {
    return;
  }

  const unitsSold = state.sellableSurplus;
  const revenue = unitsSold * state.marketSellPrice;
  state.sellableSurplus = 0;
  state.money += revenue;
  state.displayedMoney = state.money;

  addLog(`Market: Sold ${unitsSold} surplus renewable unit(s) for +${revenue}.`);
  els.statusText.textContent = `Sold ${unitsSold} surplus energy unit(s) on the market.`;
  render();
  flashStatValue(els.moneyValue);
}

function buyMarketEnergy() {
  if (state.gameOver || state.money < state.marketBuyPrice) {
    if (!state.awaitingEmergencyPurchase) {
      return;
    }
  }

  if (state.awaitingEmergencyPurchase && state.emergencyRound) {
    const emergencyBuyPrice = state.emergencyRound.buyPrice;

    if (state.money < emergencyBuyPrice) {
      return;
    }

    state.money -= emergencyBuyPrice;
    state.displayedMoney = state.money;
    state.emergencyRound.unitsNeeded -= 1;
    state.emergencyRound.unitsPurchased += 1;
    state.emergencyRound.totalPurchaseCost += emergencyBuyPrice;

    addLog(
      `Emergency market: Bought 1 energy unit for ${emergencyBuyPrice}. ${state.emergencyRound.unitsNeeded} more unit(s) needed.`
    );
    els.statusText.textContent =
      state.emergencyRound.unitsNeeded > 0
        ? `Emergency purchase made. Buy ${state.emergencyRound.unitsNeeded} more unit(s) to avoid a blackout.`
        : "Emergency purchase complete. The round can now be resolved.";
    render();
    flashStatValue(els.moneyValue);
    updateMarketUi();

    if (state.emergencyRound.unitsNeeded <= 0) {
      finalizeEmergencyRound();
    }
    return;
  }

  if (state.gameOver || state.money < state.marketBuyPrice) {
    return;
  }

  state.money -= state.marketBuyPrice;
  state.displayedMoney = state.money;
  state.marketEnergy += 1;
  addLog(`Market: Bought 1 energy unit for ${state.marketBuyPrice}.`);
  els.statusText.textContent = "Purchased 1 market energy unit.";
  render();
  flashStatValue(els.moneyValue);
}

function restartGame() {
  if (pendingRoundTimeoutId !== null) {
    window.clearTimeout(pendingRoundTimeoutId);
    pendingRoundTimeoutId = null;
  }

  clearRoundBreakdownReveal();
  closeAllModals();

  state.round = 1;
  state.money = STARTING_MONEY;
  state.displayedMoney = STARTING_MONEY;
  state.fossilPlants = STARTING_FOSSIL;
  state.renewables = 0;
  state.postTransitionRoundsSurvived = 0;
  state.isResolvingRound = false;
  state.gameOver = false;
  state.won = false;
  state.lastRound = {
    demand: null,
    renewableOutput: null,
    fossilUsed: null,
    income: null
  };
  state.displayedRound = {
    demand: null,
    renewableOutput: null,
    fossilUsed: null,
    income: null
  };
  state.marketEnergy = 0;
  state.sellableSurplus = 0;
  state.awaitingEmergencyPurchase = false;
  state.emergencyRound = null;
  rerollMarketPrices();

  els.logList.innerHTML = "";
  setRoundDemandAnnouncement("");
  setRoundBreakdown([]);
  els.statusText.textContent = "Game reset. Press Play Round to start.";
  els.tipText.textContent =
    "Renewable output changes each round, so planning reserves is key for reliability.";
  render();
  showIntroSparkyMessage();
}

els.playRoundButton.addEventListener("click", playRound);
els.buyButton.addEventListener("click", buyRenewable);
els.marketButton?.addEventListener("click", () => openModal(els.marketModal));
els.restartButton.addEventListener("click", restartGame);
els.sellEnergyButton?.addEventListener("click", sellSurplusEnergy);
els.buyEnergyButton?.addEventListener("click", buyMarketEnergy);
els.openRulesButton?.addEventListener("click", () => openModal(els.rulesModal));
els.openLogButton?.addEventListener("click", () => openModal(els.logModal));
els.closeRulesButton?.addEventListener("click", () => closeModal(els.rulesModal));
els.closeLogButton?.addEventListener("click", () => closeModal(els.logModal));
els.closeMarketButton?.addEventListener("click", () => closeModal(els.marketModal));
els.closeSparkyButton?.addEventListener("click", () => closeModal(els.sparkyModal));

els.rulesModal?.addEventListener("click", (event) => {
  if (event.target === els.rulesModal) {
    closeModal(els.rulesModal);
  }
});

els.logModal?.addEventListener("click", (event) => {
  if (event.target === els.logModal) {
    closeModal(els.logModal);
  }
});

els.marketModal?.addEventListener("click", (event) => {
  if (event.target === els.marketModal) {
    closeModal(els.marketModal);
  }
});

els.sparkyModal?.addEventListener("click", (event) => {
  if (event.target === els.sparkyModal) {
    closeModal(els.sparkyModal);
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllModals();
  }
});

render();
showIntroSparkyMessage();
