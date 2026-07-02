import { test } from "node:test";
import assert from "node:assert/strict";
import { fromGross, fromNet, compute } from "./payroll";

test("net est inférieur au brut pour un employé", () => {
  const r = fromGross(3000, "employe");
  assert.ok(r.net < r.brut);
  assert.ok(r.net > 0);
  assert.ok(r.employerCost > r.brut);
});

test("fromNet est l'inverse de fromGross (employé)", () => {
  const gross = 2500;
  const net = fromGross(gross, "employe").net;
  const back = fromNet(net, "employe");
  assert.ok(Math.abs(back.brut - gross) < 1, `attendu ~${gross}, obtenu ${back.brut}`);
});

test("flexi-job : net = brut, coût employeur majoré", () => {
  const r = fromGross(1000, "flexi");
  assert.equal(r.net, 1000);
  assert.equal(r.onssWorker, 0);
  assert.ok(r.employerCost > 1000);
});

test("étudiant : cotisation de solidarité ~2,71%", () => {
  const r = fromGross(1000, "etudiant");
  assert.ok(Math.abs(r.onssWorker - 27.1) < 0.5);
  assert.equal(r.precompte, 0);
});

test("indépendant : montant facturé = coût, pas de cotisation", () => {
  const r = fromNet(2000, "independant");
  assert.ok(Math.abs(r.employerCost - 2000) < 0.05);
});

test("compute respecte la base net/brut", () => {
  const net = compute(2000, "employe", "net");
  assert.ok(Math.abs(net.net - 2000) < 1);
  const brut = compute(2000, "employe", "brut");
  assert.equal(brut.brut, 2000);
});

test("net=0 -> tout à zéro", () => {
  const r = fromNet(0, "employe");
  assert.equal(r.brut, 0);
  assert.equal(r.net, 0);
});
