const test = require("node:test");
const assert = require("node:assert/strict");
const { serverStartedInLogs } = require("./check-extension-host.cjs");
const selected = "compiler with spaces/fidan";
const start = `[fidan] Starting language server: ${JSON.stringify(selected)} lsp`;
const ready = "[fidan] Language server started: fidan-lsp 1.0.16";

test("server restart evidence survives independent protocol-channel growth", () => {
  const before = new Map([["output", "old"], ["protocol", "x".repeat(10000)]]);
  const after = new Map([["output", "old\n" + start + "\n" + ready], ["protocol", "x".repeat(20000)]]);
  assert(serverStartedInLogs(before, after, selected));
  assert(serverStartedInLogs(before, new Map([...after].reverse()), selected));
});
test("old, unrelated and incomplete server starts cannot satisfy a restart", () => {
  const before = new Map([["output", start + "\n" + ready]]);
  assert(!serverStartedInLogs(before, before, selected));
  assert(!serverStartedInLogs(new Map(), new Map([["output", ready + "\n" + start]]), selected));
  assert(!serverStartedInLogs(new Map(), new Map([["output", start + "\n" + ready]]), "another compiler"));
});
test("new output channels are tracked separately from existing logs", () => {
  assert(serverStartedInLogs(new Map([["protocol", "trace"]]), new Map([["protocol", "trace++"], ["new-output", start + "\n" + ready]]), selected));
});

test("log replacement or rotation cannot hide a fresh server start", () => {
  const before = new Map([["output", "old protocol records\n".repeat(5000)]]);
  const after = new Map([["output", start + "\n" + ready + "\nnew protocol records"]]);
  assert(serverStartedInLogs(before, after, selected));
});