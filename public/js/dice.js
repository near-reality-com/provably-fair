import { CasinoFairness } from "./casino-fairness.js";
import { $, bindLiveForm, copyShareUrl, fillFromQuery, setStatus } from "./app.js";

fillFromQuery({
  client_seed: "client",
  server_seed: "server",
  nonce: "nonce",
  hash: "hash"
});

bindLiveForm($("dice-form"), render);

$("copy-link").addEventListener("click", async () => {
  await copyShareUrl({
    client_seed: $("client").value.trim(),
    server_seed: $("server").value.trim(),
    nonce: $("nonce").value.trim(),
    hash: $("hash").value.trim()
  });
  setStatus("status", "Share link copied.", "success");
});

async function render() {
  const clientSeed = $("client").value;
  const serverSeed = $("server").value.trim();
  const nonceValue = $("nonce").value.trim();
  const expectedHash = $("hash").value.trim();

  $("result").hidden = true;
  if (!clientSeed.trim() || !serverSeed || nonceValue === "") {
    setStatus("status", "");
    return;
  }

  const nonce = Number(nonceValue);
  try {
    const proof = await CasinoFairness.verifyDiceRoll(serverSeed, clientSeed, nonce);
    const commitmentOk = expectedHash
      ? await CasinoFairness.verifyServerSeed(serverSeed, expectedHash)
      : null;

    $("roll").textContent = `${proof.roll}%`;
    $("digest").textContent = proof.resultDigest;
    $("server-hash").textContent = proof.serverSeedHash;
    $("result").hidden = false;

    if (commitmentOk === true) {
      setStatus("status", "Verified: the revealed server seed matches the published hash.", "success");
    } else if (commitmentOk === false) {
      setStatus("status", "The revealed server seed does not match the published hash.", "error");
    } else {
      setStatus("status", "Roll calculated from the seeds below. Paste the published hash to check the commitment.", "neutral");
    }
  } catch (error) {
    setStatus("status", error.message, "error");
  }
}
