const STARTING_FOSSIL = 4;
const RENEWABLE_COST = 24;
const POST_TRANSITION_ROUNDS = 4;
const STARTING_MONEY = 12;

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
  sellableSurplus: 0
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
  closeMarketButton: document.getElementById("closeMarketButton"),
  closeRulesButton: document.getElementById("closeRulesButton"),
  closeLogButton: document.getElementById("closeLogButton"),
  rulesModal: document.getElementById("rulesModal"),
  logModal: document.getElementById("logModal"),
  marketModal: document.getElementById("marketModal"),
  marketPricesText: document.getElementById("marketPricesText"),
  marketInventoryText: document.getElementById("marketInventoryText"),
  sellEnergyButton: document.getElementById("sellEnergyButton"),
  buyEnergyButton: document.getElementById("buyEnergyButton")
};

const REVEAL_DELAY = 1400;
let pendingRoundTimeoutId = null;
let pendingBreakdownTimeoutIds = [];
const HIGHLIGHT_DURATION_MS = 900;
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
}

function rerollMarketPrices() {
  state.marketSellPrice = randInt(1, 2);
  state.marketBuyPrice = randInt(3, 5);
}

function updateMarketUi() {
  if (els.marketPricesText) {
    els.marketPricesText.textContent = `Round ${state.round} prices — Sell: ${state.marketSellPrice}/unit, Buy: ${state.marketBuyPrice}/unit.`;
  }
  if (els.marketInventoryText) {
    els.marketInventoryText.textContent = `Stored energy: ${state.marketEnergy}. Sellable renewable surplus: ${state.sellableSurplus}.`;
  }
  if (els.sellEnergyButton) {
    els.sellEnergyButton.disabled = state.sellableSurplus <= 0 || state.gameOver;
  }
  if (els.buyEnergyButton) {
    els.buyEnergyButton.disabled = state.money < state.marketBuyPrice || state.gameOver;
  }
}

function addLog(message) {
  const item = document.createElement("li");
  item.textContent = message;
  els.logList.prepend(item);
}

function flashElement(target, className = "is-updating", durationMs = HIGHLIGHT_DURATION_MS) {
  if (!target) {
    return;
  }

  const previousTimeout = highlightTimeoutIds.get(target);
  if (previousTimeout) {
    window.clearTimeout(previousTimeout);
  }

  target.classList.remove(className);
  // Force reflow so repeated flashes replay the animation.
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
    state.money < RENEWABLE_COST ||
    state.fossilPlants <= 0;
  els.playRoundButton.disabled = state.gameOver || state.isResolvingRound;
  els.restartButton.disabled = state.isResolvingRound;
  if (els.marketButton) {
    els.marketButton.disabled = state.gameOver;
  }
}

function renderFossilIcons() {
  els.fossilIcons.innerHTML = "";

  for (let i = 0; i < state.fossilPlants; i += 1) {
    const icon = document.createElement("img");
    icon.src = "./src/img/fossil_fuel.png";
    icon.alt = "Fossil fuel plant";
    icon.className = "fossil-icon";
    els.fossilIcons.append(icon);
  }
  if(state.renewables != 0){
    if (state.renewables == 1) {
    const icon = solarIcon();
    els.fossilIcons.append(icon);
  }
    if(state.renewables == 2) {
    const icon2 = windIcon();
    els.fossilIcons.append(icon2);
    const icon1 = solarIcon();
    els.fossilIcons.append(icon1);
  }
    if(state.renewables == 3) {
    const icon1 = solarIcon();
    els.fossilIcons.append(icon1);
    const icon2 = windIcon();
    els.fossilIcons.append(icon2);
    const icon3 = solarIcon();
    els.fossilIcons.append(icon3);
  }
  if(state.renewables == 4) {
    const icon2 = windIcon();
    els.fossilIcons.append(icon2);
    const icon1 = solarIcon();
    els.fossilIcons.append(icon1);
    const icon4 = windIcon();
    els.fossilIcons.append(icon4);
    const icon3 = solarIcon();
    els.fossilIcons.append(icon3);   
    }
  }
}

function solarIcon(){
  const icon = document.createElement("img");
  icon.src = "./src/img/renewables.png";
  icon.alt = "Renewable energy source";
  icon.className = "fossil-icon"
  return icon; 
}

function windIcon(){
  const icon = document.createElement("img");
    icon.src = "./src/img/wind_renewable.jpeg";
    icon.alt = "Renewable energy source";
    icon.className = "fossil-icon";
    return icon;
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
  els.fossilUsedValue.textContent = fossilUsed === null ? "-" : String(fossilUsed);
  els.incomeValue.textContent = income === null ? "-" : String(income);

  renderFossilIcons();
  updateButtons();
  updateMarketUi();
}

function setRoundDemandAnnouncement(message = "") {
  els.roundDemandAnnouncement.textContent = message;
}

function setDisplayedRoundValues(roundValues = {}, displayedMoney = state.displayedMoney) {
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
        text:
          marketUsed > 0
            ? `Market energy covered ${marketUsed} units. Fossil fuels covered 0 units because you have none left.`
            : "Fossil fuels covered 0 units because you have none left.",
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
        text: "Overall, you added 0 money this round and blacked out.",
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
        }
      }
    ]);
    els.statusText.textContent = "Blackout: demand exceeded your available supply.";
    els.tipText.textContent = getTip({
      demand,
      renewableOutput,
      fossilUsed: 0,
      income: 0,
      boughtThisTurn: false
    });
    addLog(
      `Round ${state.round}: Demand ${demand}, renewables ${renewableOutput}. Blackout occurred.`
    );
    render();
    return;
  }

  const fossilUsed = shortfall;
  const fossilCost = Math.ceil(fossilUsed / 2);
  const income = demand - fossilCost;
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
      text:
        marketUsed > 0
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
    `Round ${state.round}: Demand ${demand}, renewables ${renewableOutput}, market used ${marketUsed}, fossil used ${fossilUsed}, income +${income}.`
  );

  els.statusText.textContent = "Round complete. You can buy a renewable before the next round.";
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
  rerollMarketPrices();

  els.logList.innerHTML = "";
  setRoundDemandAnnouncement("");
  setRoundBreakdown([]);
  els.statusText.textContent = "Game reset. Press Play Round to start.";
  els.tipText.textContent =
    "Renewable output changes each round, so planning reserves is key for reliability.";
  render();
}

els.playRoundButton.addEventListener("click", playRound);
els.buyButton.addEventListener("click", buyRenewable);
els.marketButton?.addEventListener("click", () => openModal(els.marketModal));
els.restartButton.addEventListener("click", restartGame);
els.sellEnergyButton?.addEventListener("click", sellSurplusEnergy);
els.buyEnergyButton?.addEventListener("click", buyMarketEnergy);
els.closeMarketButton?.addEventListener("click", () => closeModal(els.marketModal));
els.openRulesButton?.addEventListener("click", () => openModal(els.rulesModal));
els.openLogButton?.addEventListener("click", () => openModal(els.logModal));
els.closeRulesButton?.addEventListener("click", () => closeModal(els.rulesModal));
els.closeLogButton?.addEventListener("click", () => closeModal(els.logModal));
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
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllModals();
  }
});

render();
