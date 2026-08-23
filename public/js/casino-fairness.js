/**
 * Browser/Node port of com.near_reality.content.fairness.CasinoFairness.
 *
 * Hash material is always UTF-8. Dice and mines both use:
 *   SHA-256(clientSeed + ":" + serverSeed + ":" + nonce [+ ":" + blockIndex])
 *
 * Dice maps the first 4 digest bytes with multiply/divide, not modulo:
 *   rollBasisPoints = (uint32 * 10001) / 2^32
 *   roll            = rollBasisPoints / 100
 *
 * Mines Fisher-Yates the 25 tiles with a SHA-256 byte stream and
 * rejection sampling, then takes the first mineCount tiles.
 */

const SERVER_SEED_BYTES = 32;
const MAX_CLIENT_SEED_BYTES = 128;
const MINES_TILE_COUNT = 25;
const MIN_MINES = 1;
const MAX_MINES = 24;
const UINT_RANGE = 1n << 32n;
const DICE_OUTCOMES = 10_001n;
const HEX = /^[0-9a-f]+$/i;

const textEncoder = new TextEncoder();

export const CasinoFairness = {
  SERVER_SEED_BYTES,
  MAX_CLIENT_SEED_BYTES,
  MINES_TILE_COUNT,
  MIN_MINES,
  MAX_MINES,
  DICE_OUTCOMES: Number(DICE_OUTCOMES),

  async sha256(input) {
    const bytes = typeof input === "string" ? textEncoder.encode(input) : input;
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return new Uint8Array(digest);
  },

  toHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  },

  utf8Length(value) {
    return textEncoder.encode(value).length;
  },

  isIsoControl(codePoint) {
    return codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
  },

  isValidClientSeed(clientSeed) {
    return clientSeed != null
      && clientSeed.trim() !== ""
      && this.utf8Length(clientSeed) <= MAX_CLIENT_SEED_BYTES
      && ![...clientSeed].some((char) => this.isIsoControl(char.codePointAt(0)));
  },

  validateClientSeed(clientSeed) {
    if (!this.isValidClientSeed(clientSeed)) {
      throw new Error("The client seed must contain 1 to 128 UTF-8 bytes and no control characters.");
    }
  },

  isValidServerSeed(serverSeed) {
    return typeof serverSeed === "string"
      && serverSeed.length === SERVER_SEED_BYTES * 2
      && HEX.test(serverSeed);
  },

  validateServerSeed(serverSeed) {
    if (!this.isValidServerSeed(serverSeed)) {
      throw new Error("The server seed must be a 64-character hexadecimal value.");
    }
  },

  validateNonce(nonce) {
    if (!Number.isInteger(nonce) || nonce < 0) {
      throw new Error("The nonce cannot be negative.");
    }
  },

  async hashServerSeed(serverSeed) {
    this.validateServerSeed(serverSeed);
    return this.toHex(await this.sha256(serverSeed));
  },

  async verifyServerSeed(serverSeed, expectedHash) {
    if (!this.isValidServerSeed(serverSeed) || expectedHash == null) {
      return false;
    }
    const actual = (await this.hashServerSeed(serverSeed)).toLowerCase();
    return actual === String(expectedHash).toLowerCase();
  },

  async verifyDiceRoll(serverSeed, clientSeed, nonce) {
    this.validateServerSeed(serverSeed);
    this.validateClientSeed(clientSeed);
    this.validateNonce(nonce);

    const digest = await this.sha256(`${clientSeed}:${serverSeed}:${nonce}`);
    const firstFourBytes = unsignedInt32(digest, 0);
    const rollBasisPoints = Number((firstFourBytes * DICE_OUTCOMES) / UINT_RANGE);
    return {
      roll: (rollBasisPoints / 100).toFixed(2),
      rollBasisPoints,
      serverSeedHash: await this.hashServerSeed(serverSeed),
      clientSeed,
      nonce,
      resultDigest: this.toHex(digest)
    };
  },

  async generateMineTiles(revealedServerSeed, clientSeed, nonce, mineCount) {
    this.validateServerSeed(revealedServerSeed);
    this.validateClientSeed(clientSeed);
    this.validateNonce(nonce);
    if (!Number.isInteger(mineCount) || mineCount < MIN_MINES || mineCount > MAX_MINES) {
      throw new Error("The mine count must be between 1 and 24.");
    }

    const tiles = Array.from({ length: MINES_TILE_COUNT }, (_, index) => index);
    const random = new Sha256ByteStream(this, revealedServerSeed, clientSeed, nonce);
    for (let index = tiles.length - 1; index > 0; index -= 1) {
      const swapIndex = await random.nextInt(index + 1);
      const tile = tiles[index];
      tiles[index] = tiles[swapIndex];
      tiles[swapIndex] = tile;
    }

    return tiles.slice(0, mineCount).sort((left, right) => left - right);
  }
};

class Sha256ByteStream {
  constructor(fairness, serverSeed, clientSeed, nonce) {
    this.fairness = fairness;
    this.serverSeed = serverSeed;
    this.clientSeed = clientSeed;
    this.nonce = nonce;
    this.block = new Uint8Array(0);
    this.offset = 0;
    this.blockIndex = 0;
  }

  async nextInt(bound) {
    const boundBig = BigInt(bound);
    const rejectionLimit = UINT_RANGE - (UINT_RANGE % boundBig);
    let value;
    do {
      value = await this.nextUnsignedInt();
    } while (value >= rejectionLimit);
    return Number(value % boundBig);
  }

  async nextUnsignedInt() {
    if (this.offset + 4 > this.block.length) {
      const message = `${this.clientSeed}:${this.serverSeed}:${this.nonce}:${this.blockIndex}`;
      this.blockIndex += 1;
      this.block = await this.fairness.sha256(message);
      this.offset = 0;
    }
    const value = unsignedInt32(this.block, this.offset);
    this.offset += 4;
    return value;
  }
}

function unsignedInt32(bytes, offset) {
  return BigInt(
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
  );
}

export default CasinoFairness;
