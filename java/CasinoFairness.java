// Public copy of the game-server algorithm for independent audit.
// Keep this file in lockstep with com.near_reality.content.fairness.CasinoFairness.
package com.near_reality.content.fairness;

import java.math.BigDecimal;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.HexFormat;

public final class CasinoFairness {

    private static final MessageDigest DIGEST;
    private static final int SERVER_SEED_BYTES = 32;
    private static final int CLIENT_SEED_BYTES = 16;
    private static final int MAX_CLIENT_SEED_BYTES = 128;
    private static final int MINES_TILE_COUNT = 25;
    private static final int MIN_MINES = 1;
    private static final int MAX_MINES = 24;
    private static final long UINT_RANGE = 1L << 32;
    private static final long DICE_OUTCOMES = 10_001L;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final HexFormat HEX = HexFormat.of();

    static {
        try {
            DIGEST = MessageDigest.getInstance("SHA-256");
        } catch (final NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is not available.", exception);
        }
    }

    private CasinoFairness() {
    }

    public static String randomServerSeed() {
        return randomHex(SERVER_SEED_BYTES);
    }

    public static String randomClientSeed() {
        return randomHex(CLIENT_SEED_BYTES);
    }

    public static int[] generateMineTiles(
            final String revealedServerSeed,
            final String clientSeed,
            final long nonce,
            final int mineCount
    ) {
        validateServerSeed(revealedServerSeed);
        validateClientSeed(clientSeed);
        if (mineCount < MIN_MINES || mineCount > MAX_MINES) {
            throw new IllegalArgumentException("The mine count must be between 1 and 24.");
        }
        if (nonce < 0L) {
            throw new IllegalArgumentException("The nonce cannot be negative.");
        }

        final int[] tiles = new int[MINES_TILE_COUNT];
        for (int index = 0; index < tiles.length; index++) {
            tiles[index] = index;
        }

        final Sha256ByteStream random = new Sha256ByteStream(
                revealedServerSeed,
                clientSeed,
                nonce
        );
        for (int index = tiles.length - 1; index > 0; index--) {
            final int swapIndex = random.nextInt(index + 1);
            final int tile = tiles[index];
            tiles[index] = tiles[swapIndex];
            tiles[swapIndex] = tile;
        }

        final int[] mineTiles = Arrays.copyOf(tiles, mineCount);
        Arrays.sort(mineTiles);
        return mineTiles;
    }

    public static DiceRollProof verifyDiceRoll(
            final String serverSeed,
            final String clientSeed,
            final long nonce
    ) {
        validateServerSeed(serverSeed);
        validateClientSeed(clientSeed);
        if (nonce < 0L) {
            throw new IllegalArgumentException("The nonce cannot be negative.");
        }

        final byte[] digest = sha256((clientSeed + ':' + serverSeed + ':' + nonce).getBytes(StandardCharsets.UTF_8));
        final long firstFourBytes = Integer.toUnsignedLong(ByteBuffer.wrap(digest, 0, Integer.BYTES).getInt());
        final int rollBasisPoints = (int) ((firstFourBytes * DICE_OUTCOMES) / UINT_RANGE);
        return new DiceRollProof(
                BigDecimal.valueOf(rollBasisPoints, 2),
                rollBasisPoints,
                hashServerSeed(serverSeed),
                clientSeed,
                nonce,
                HEX.formatHex(digest)
        );
    }

    public static String hashServerSeed(final String serverSeed) {
        validateServerSeed(serverSeed);
        return HEX.formatHex(sha256(serverSeed.getBytes(StandardCharsets.UTF_8)));
    }

    public static boolean verifyServerSeed(
            final String serverSeed,
            final String expectedHash
    ) {
        if (!isValidServerSeed(serverSeed) || expectedHash == null) {
            return false;
        }
        final byte[] actual = hashServerSeed(serverSeed).getBytes(StandardCharsets.US_ASCII);
        final byte[] expected = expectedHash.toLowerCase().getBytes(StandardCharsets.US_ASCII);
        return MessageDigest.isEqual(actual, expected);
    }

    public static void validateClientSeed(final String clientSeed) {
        if (!isValidClientSeed(clientSeed)) {
            throw new IllegalArgumentException(
                    "The client seed must contain 1 to 128 UTF-8 bytes and no control characters."
            );
        }
    }

    public static boolean isValidClientSeed(final String clientSeed) {
        return clientSeed != null
                && !clientSeed.isBlank()
                && clientSeed.getBytes(StandardCharsets.UTF_8).length <= MAX_CLIENT_SEED_BYTES
                && clientSeed.codePoints().noneMatch(Character::isISOControl);
    }

    public static void validateServerSeed(final String serverSeed) {
        if (!isValidServerSeed(serverSeed)) {
            throw new IllegalArgumentException("The server seed must be a 64-character hexadecimal value.");
        }
    }

    public static boolean isValidServerSeed(final String serverSeed) {
        if (serverSeed == null || serverSeed.length() != SERVER_SEED_BYTES * 2) {
            return false;
        }
        try {
            HEX.parseHex(serverSeed);
            return true;
        } catch (final IllegalArgumentException ignored) {
            return false;
        }
    }

    private static byte[] sha256(final byte[] input) {
        return DIGEST.digest(input);
    }

    private static String randomHex(final int byteCount) {
        final byte[] bytes = new byte[byteCount];
        SECURE_RANDOM.nextBytes(bytes);
        return HEX.formatHex(bytes);
    }

    public record DiceRollProof(
            BigDecimal roll,
            int rollBasisPoints,
            String serverSeedHash,
            String clientSeed,
            long nonce,
            String resultDigest
    ) {
    }

    private static final class Sha256ByteStream {

        private final String serverSeed;
        private final String clientSeed;
        private final long nonce;
        private byte[] block = new byte[0];
        private int offset;
        private int blockIndex;

        private Sha256ByteStream(final String serverSeed, final String clientSeed, final long nonce) {
            this.serverSeed = serverSeed;
            this.clientSeed = clientSeed;
            this.nonce = nonce;
        }

        private int nextInt(final int bound) {
            final long rejectionLimit = UINT_RANGE - UINT_RANGE % bound;
            long value;
            do {
                value = nextUnsignedInt();
            } while (value >= rejectionLimit);
            return (int) (value % bound);
        }

        private long nextUnsignedInt() {
            if (offset + Integer.BYTES > block.length) {
                final String message = clientSeed + ':' + serverSeed + ':' + nonce + ':' + blockIndex++;
                block = sha256(message.getBytes(StandardCharsets.UTF_8));
                offset = 0;
            }
            final long value = Integer.toUnsignedLong(ByteBuffer.wrap(block, offset, Integer.BYTES).getInt());
            offset += Integer.BYTES;
            return value;
        }
    }

}