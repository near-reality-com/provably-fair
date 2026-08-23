import { CasinoFairness } from "./casino-fairness.js";
import { $, bindLiveForm, copyShareUrl, fillFromQuery, setStatus } from "./app.js";

const GEM = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 3 9l9 13 9-13-9-7zm0 3.2 5.2 4.1L12 18.6 6.8 9.3 12 5.2z"/></svg>`;
const MINE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0-5 .9 3.1L16 4l-1.2 3H18l-2.6 1.8L17 11l-3.1-.2L12 14l-1.9-3.2L7 11l1.6-2.2L6 7h3.2L8 4l3.1 1.1L12 2z"/></svg>`;

fillFromQuery({
  client_seed: "client",
  server_seed: "server",
  nonce: "nonce",
  mines: "mines",
  hash: "hash"
});

bindLiveForm($("mines-form"), render);

$("copy-link").addEventListener("click", async () => {
  await copyShareUrl({
    client_seed: $("client").value.trim(),
    server_seed: $("server").value.trim(),
    nonce: $("nonce").value.trim(),
    mines: $("mines").value.trim(),
    hash: $("hash").value.trim()
  });
  setStatus("status", "Share link copied.", "success");
});

async function render() {
  const clientSeed = $("client").value;
  const serverSeed = $("server").value.trim();
  const nonceValue = $("nonce").value.trim();
  const mineCount = Number($("mines").value);
  const expectedHash = $("hash").value.trim();

  if (!clientSeed.trim() || !serverSeed || nonceValue === "") {
    setStatus("status", "");
    return;
  }

  const nonce = Number(nonceValue);
  try {
    const tiles = await CasinoFairness.generateMineTiles(serverSeed, clientSeed, nonce, mineCount);
    const mines = new Set(tiles);
    const board = $("board");
    board.innerHTML = "";
    for (let index = 0; index < CasinoFairness.MINES_TILE_COUNT; index += 1) {
      const tile = document.createElement("div");
      const isMine = mines.has(index);
      tile.className = `tile ${isMine ? "mine" : "gem"}`;
      tile.innerHTML = isMine ? MINE : GEM;
      tile.title = isMine ? `Mine on tile ${index}` : `Safe tile ${index}`;
      board.appendChild(tile);
    }

    $("server-hash").textContent = await CasinoFairness.hashServerSeed(serverSeed);
    $("mine-list").textContent = tiles.join(", ");
    $("result").hidden = false;

    const commitmentOk = expectedHash
      ? await CasinoFairness.verifyServerSeed(serverSeed, expectedHash)
      : null;
    if (commitmentOk === true) {
      setStatus("status", "Verified: the revealed server seed matches the published hash.", "success");
    } else if (commitmentOk === false) {
      setStatus("status", "The revealed server seed does not match the published hash.", "error");
    } else {
      setStatus("status", "Layout calculated from the seeds below. Paste the published hash to check the commitment.", "neutral");
    }
  } catch (error) {
    $("result").hidden = true;
    setStatus("status", error.message, "error");
  }
}
