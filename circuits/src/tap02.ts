/**
 * Minimal TAP-02-inspired NAND netlist evaluator for local reference vectors.
 * Signal 0 = false, signal 1 = true. Inputs start at signal index 2.
 * Element encoding (simplified):
 *   NAND: [0, a, b]  -> append NOT(a AND b)
 * Netlist is a list of gate descriptors; last nOut signals are outputs.
 */

export type Gate = { op: "NAND"; a: number; b: number };

export type Circuit = {
  nIn: number;
  nOut: number;
  gates: Gate[];
};

export function evalCircuit(circuit: Circuit, inputs: boolean[]): boolean[] {
  if (inputs.length !== circuit.nIn) {
    throw new Error(`Expected ${circuit.nIn} inputs, got ${inputs.length}`);
  }
  const signals: boolean[] = [false, true, ...inputs];
  for (const g of circuit.gates) {
    if (g.a >= signals.length || g.b >= signals.length) {
      throw new Error("Malformed netlist: signal out of range");
    }
    signals.push(!(signals[g.a]! && signals[g.b]!));
  }
  if (signals.length < 2 + circuit.nIn + circuit.nOut) {
    throw new Error("Malformed netlist: insufficient outputs");
  }
  return signals.slice(signals.length - circuit.nOut);
}

/** PaymentLimitCircuit: pass if amountOk AND budgetOk (built from NANDs = AND). */
export function paymentLimitCircuit(): Circuit {
  // AND(x,y) = NAND(NAND(x,y), NAND(x,y))
  // inputs: amountOk (2), budgetOk (3)
  // gate0: nand(2,3) -> 4
  // gate1: nand(4,4) -> 5 = AND
  return {
    nIn: 2,
    nOut: 1,
    gates: [
      { op: "NAND", a: 2, b: 3 },
      { op: "NAND", a: 4, b: 4 },
    ],
  };
}

export function evalPaymentLimitBits(amountOk: boolean, budgetOk: boolean): boolean {
  return evalCircuit(paymentLimitCircuit(), [amountOk, budgetOk])[0]!;
}
