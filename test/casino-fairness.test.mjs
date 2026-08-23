import assert from "node:assert/strict";
import { test } from "node:test";
import { CasinoFairness } from "../public/js/casino-fairness.js";

const SERVER = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const CLIENT = "player-seed";

test("hashServerSeed matches Java", async () => {
  assert.equal(
    await CasinoFairness.hashServerSeed(SERVER),
    "a8ae6e6ee929abea3afcfc5258c8ccd6f85273e0d4626d26c7279f3250f77c8e"
  );
});

test("verifyDiceRoll nonce 0 matches Java", async () => {
  const proof = await CasinoFairness.verifyDiceRoll(SERVER, CLIENT, 0);
  assert.equal(proof.roll, "32.47");
  assert.equal(proof.rollBasisPoints, 3247);
  assert.equal(proof.resultDigest, "5322babb492810d15c5e56878b9f62ec7fa28484e4eb7b27fabc90099787dd3a");
});

test("verifyDiceRoll nonce 1 matches Java", async () => {
  const proof = await CasinoFairness.verifyDiceRoll(SERVER, CLIENT, 1);
  assert.equal(proof.roll, "54.33");
  assert.equal(proof.rollBasisPoints, 5433);
  assert.equal(proof.resultDigest, "8b17b867ce72cbc92541a998d18dd026792b7fc3021ee081a2becd16c51265ec");
});

test("generateMineTiles count 3 matches Java", async () => {
  assert.deepEqual(await CasinoFairness.generateMineTiles(SERVER, CLIENT, 0, 3), [4, 10, 16]);
});

test("generateMineTiles count 24 matches Java", async () => {
  assert.deepEqual(
    await CasinoFairness.generateMineTiles(SERVER, CLIENT, 7, 24),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24]
  );
});

test("rejects an invalid server seed", async () => {
  await assert.rejects(() => CasinoFairness.verifyDiceRoll("nope", CLIENT, 0));
});
