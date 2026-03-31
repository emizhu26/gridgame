# Renewable Grid Game

A browser-based educational game inspired by "The Grid Game."  
Goal: retire all 4 fossil plants by buying renewables, then survive 2 more rounds without a blackout.

## How to Run

1. Open `index.html` in your browser.
2. Click `Play Round` to simulate demand and renewable output.
3. Click `Buy Renewable (24)` when you have enough money.

No build step or dependencies are required.

## Rules Implemented

- Demand each round is random from 1 to 16.
- Each renewable produces random output from 1 to 4 each round.
- Fossil plants provide backup supply, with total capacity of `4 * fossilPlants`.
- Fossil usage cost is `ceil(fossilUsed / 2)`.
- Net income each round is `demand - fossilCost`, added to your money.
- Buying 1 renewable costs 24 and retires 1 fossil plant.
- If demand cannot be met by renewable output + fossil capacity, you lose immediately (blackout).
- You win after retiring all fossil plants and surviving 2 additional rounds.

## Manual Test Checklist

- Start game and play 2-3 rounds with 0 renewables; verify fossil usage and cost logic.
- Confirm income matches `demand - ceil(fossilUsed/2)`.
- Verify `Buy Renewable (24)` is disabled when money < 24.
- Verify buy button disables when fossil plants are already 0.
- Verify blackout occurs when shortfall exceeds fossil capacity.
- Verify win triggers only after all fossil plants are replaced and 2 rounds are survived.
