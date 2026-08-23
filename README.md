# Near Reality Provably Fair

Public dice and mines verifiers for [Near Reality](https://near-reality.com).

Hosted on Cloudflare Pages:

- https://fair.near-reality.com
- https://fair.near-reality.com/dice.html
- https://fair.near-reality.com/mines.html

The pages run in the browser. Seeds are not sent to any server.

## How to verify a round

1. In game, copy your client seed, the revealed server seed, and the nonce from the fairness panel.
2. Open the matching page above, or add the values as query parameters:

```
https://fair.near-reality.com/dice.html?client_seed=YOUR_SEED&server_seed=REVEALED_HEX&nonce=0
https://fair.near-reality.com/mines.html?client_seed=YOUR_SEED&server_seed=REVEALED_HEX&nonce=0&mines=3
```

3. Confirm the roll or mine layout matches what you were shown.
4. Optionally paste the hash that was published before the round. It must equal `SHA-256(revealed server seed)`.

## Algorithm

Port of `com.near_reality.content.fairness.CasinoFairness`.

Hash material is UTF-8. The seed order is **client, then server**:

```
digest = SHA-256(clientSeed + ":" + serverSeed + ":" + nonce)
```

### Dice

1. Take the first 4 bytes of `digest` as an unsigned 32-bit integer.
2. `rollBasisPoints = (uint32 * 10001) / 2^32` using integer division.
3. Display `rollBasisPoints / 100` with two decimals (`00.00` through `100.00`).

This is multiply/divide, not modulo, so the 10,001 outcomes stay unbiased.

### Mines

1. Start with tiles `0..24`.
2. Fisher-Yates shuffle using a SHA-256 byte stream:
   `SHA-256(clientSeed + ":" + serverSeed + ":" + nonce + ":" + blockIndex)`
3. Each hash block yields eight unsigned 32-bit integers. `nextInt(bound)` uses rejection sampling.
4. The first `mineCount` tiles after the shuffle are mines, then sorted.

## Develop

```bash
npm test
```

The tests lock the JavaScript port to vectors produced by the Java class.

## License

MIT
