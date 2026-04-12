const STARTING_FOSSIL = 4;
const RENEWABLE_COST = 24;
const POST_TRANSITION_ROUNDS = 2;
const STARTING_MONEY = 200;

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
  }
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
  restartButton: document.getElementById("restartButton")
};

const REVEAL_DELAY = 1400;
let pendingRoundTimeoutId = null;
let pendingBreakdownTimeoutIds = [];

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

function addLog(message) {
  const item = document.createElement("li");
  item.textContent = message;
  els.logList.prepend(item);
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
}

function setRoundDemandAnnouncement(message = "") {
  els.roundDemandAnnouncement.textContent = message;
}

function setDisplayedRoundValues(roundValues = {}, displayedMoney = state.displayedMoney) {
  state.displayedRound = {
    ...state.displayedRound,
    ...roundValues
  };
  state.displayedMoney = displayedMoney;
  render();
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
  const shortfall = Math.max(0, demand - renewableOutput);
  const renewableUsed = Math.min(demand, renewableOutput);

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
        text: "Fossil fuels covered 0 units because you have none left.",
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
      text: `Fossil fuels covered ${fossilUsed} units of energy at a cost of ${fossilCost} money units.`,
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
    `Round ${state.round}: Demand ${demand}, renewables ${renewableOutput}, fossil used ${fossilUsed}, income +${income}.`
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
}

function playRound() {
  if (state.gameOver || state.isResolvingRound) {
    return;
  }

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
els.restartButton.addEventListener("click", restartGame);

render();
