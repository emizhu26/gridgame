const STARTING_FOSSIL = 4;
const RENEWABLE_COST = 24;
const POST_TRANSITION_ROUNDS = 2;
const STARTING_MONEY = 12;

const state = {
  round: 1,
  money: STARTING_MONEY,
  fossilPlants: STARTING_FOSSIL,
  renewables: 0,
  postTransitionRoundsSurvived: 0,
  gameOver: false,
  won: false,
  lastRound: {
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
    state.gameOver || state.money < RENEWABLE_COST || state.fossilPlants <= 0;
  els.playRoundButton.disabled = state.gameOver;
}

function render() {
  const { demand, renewableOutput, fossilUsed, income } = state.lastRound;

  els.roundValue.textContent = String(state.round);
  els.moneyValue.textContent = String(state.money);
  els.fossilValue.textContent = String(state.fossilPlants);
  els.renewableValue.textContent = String(state.renewables);
  els.demandValue.textContent = demand === null ? "-" : String(demand);
  els.renewableOutputValue.textContent =
    renewableOutput === null ? "-" : String(renewableOutput);
  els.fossilUsedValue.textContent = fossilUsed === null ? "-" : String(fossilUsed);
  els.incomeValue.textContent = income === null ? "-" : String(income);

  updateButtons();
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

function playRound() {
  if (state.gameOver) {
    return;
  }

  const demand = rollDemand();
  const renewableOutput = rollRenewableOutput(state.renewables);
  const fossilCapacity = state.fossilPlants * 4;
  const shortfall = Math.max(0, demand - renewableOutput);

  if (shortfall > fossilCapacity) {
    state.lastRound = {
      demand,
      renewableOutput,
      fossilUsed: fossilCapacity,
      income: 0
    };
    state.gameOver = true;
    state.won = false;
    els.statusText.textContent = "Blackout: demand exceeded your available supply.";
    els.tipText.textContent = getTip({
      demand,
      renewableOutput,
      fossilUsed: fossilCapacity,
      income: 0,
      boughtThisTurn: false
    });
    addLog(
      `Round ${state.round}: Demand ${demand}, renewables ${renewableOutput}, max fossil ${fossilCapacity}. Blackout occurred.`
    );
    render();
    return;
  }

  const fossilUsed = shortfall;
  const fossilCost = Math.ceil(fossilUsed / 2);
  const income = demand - fossilCost;
  state.money += income;

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

  state.round += 1;
  render();
}

function buyRenewable() {
  if (
    state.gameOver ||
    state.money < RENEWABLE_COST ||
    state.fossilPlants <= 0
  ) {
    return;
  }

  state.money -= RENEWABLE_COST;
  state.fossilPlants -= 1;
  state.renewables += 1;

  addLog(
    `Investment: Bought 1 renewable for ${RENEWABLE_COST}. Fossil plants now ${state.fossilPlants}.`
  );
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
  state.round = 1;
  state.money = STARTING_MONEY;
  state.fossilPlants = STARTING_FOSSIL;
  state.renewables = 0;
  state.postTransitionRoundsSurvived = 0;
  state.gameOver = false;
  state.won = false;
  state.lastRound = {
    demand: null,
    renewableOutput: null,
    fossilUsed: null,
    income: null
  };

  els.logList.innerHTML = "";
  els.statusText.textContent = "Game reset. Press Play Round to start.";
  els.tipText.textContent =
    "Renewable output changes each round, so planning reserves is key for reliability.";
  render();
}

els.playRoundButton.addEventListener("click", playRound);
els.buyButton.addEventListener("click", buyRenewable);
els.restartButton.addEventListener("click", restartGame);

render();
