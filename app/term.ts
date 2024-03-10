type vName = string;
export type varTerm = { type: "variable"; name: vName };
export const tvar = (name: vName): varTerm => ({ type: "variable", name });
export type lambdaTerm = { type: "lambda"; variable: vName; body: Term };
export const tlambda = (variable: vName, body: Term): lambdaTerm => ({
  type: "lambda",
  variable,
  body,
});
type applyTerm = { type: "apply"; func: Term; arg: Term; id: symbol };
export const tapply = (func: Term, arg: Term): applyTerm => ({
  type: "apply",
  func,
  arg,
  id: Symbol(),
});
export type Term = varTerm | lambdaTerm | applyTerm;
export const termElim = <T>(
  t: Term,
  fv: (t: varTerm) => T,
  fl: (t: lambdaTerm) => T,
  fa: (t: applyTerm) => T,
): T => {
  switch (t.type) {
    case "variable":
      return fv(t);
    case "lambda":
      return fl(t);
    case "apply":
      return fa(t);
    default:
      const _exhaustiveCheck: never = t;
      throw new Error("exhaustive check failed", _exhaustiveCheck);
  }
};
const freeVariables = (t: Term): vName[] =>
  termElim(
    t,
    (t) => [t.name],
    (t) => freeVariables(t.body).filter((v) => v !== t.variable),
    (t) => [...freeVariables(t.func), ...freeVariables(t.arg)],
  );
const bad = (s: string) => {
  throw new Error(s);
};
const rewrite = (t: Term, from: vName, to: Term): Term =>
  termElim(
    t,
    (t) => (t.name === from ? to : t),
    (t) => {
      if (t.variable === from) return t;
      if (!freeVariables(to).includes(t.variable))
        return tlambda(t.variable, rewrite(t.body, from, to));
      const newArg = newVar(t.variable, [
        ...freeVariables(to),
        ...freeVariables(t.body),
      ]);
      return tlambda(
        newArg,
        rewrite(rewrite(t.body, t.variable, tvar(newArg)), from, to),
      );
    },
    (t) => tapply(rewrite(t.func, from, to), rewrite(t.arg, from, to)),
  );

const isRedex = (t: Term): boolean =>
  t.type === "apply" && t.func.type === "lambda";

const reduce = (t: Term): Term =>
  !(t.type === "apply" && t.func.type === "lambda")
    ? bad("reduce at invalid point")
    : rewrite(t.func.body, t.func.variable, t.arg);

export const reduceAt = (term: Term, id: symbol): Term =>
  termElim(
    term,
    (t) => t,
    (t) => tlambda(t.variable, reduceAt(t.body, id)),
    (t) =>
      t.id === id
        ? reduce(t)
        : tapply(reduceAt(t.func, id), reduceAt(t.arg, id)),
  );

export const normalStrategyRedex = (t: Term): symbol | null => {
  return termElim(
    t,
    (t) => null,
    (t) => normalStrategyRedex(t.body),
    (t) =>
      isRedex(t)
        ? t.id
        : normalStrategyRedex(t.func) ?? normalStrategyRedex(t.arg),
  );
};

export const splitNumberSubscript = (s: string): [string, string] => {
  const match = s.match(/^(.+?)(([1-9][0-9]*|0)?)$/);
  if (match === null) {
    return ["", ""];
  }
  return [match[1], match[2]];
};

const newVar = (base: vName, exclude: vName[]): vName => {
  for (let i = 1; ; i++) {
    const name = base + i;
    if (!exclude.includes(name)) {
      return name;
    }
  }
};

export const alphaNormalizeTerm = (t: Term, bound: vName[] = []): Term =>
  termElim<Term>(
    t,
    (t) => t,
    (t) => {
      const newArg = newVar("x", bound);
      return tlambda(
        newArg,
        alphaNormalizeTerm(rewrite(t.body, t.variable, tvar(newArg)), [
          ...bound,
          newArg,
        ]),
      );
    },
    (t) =>
      tapply(
        alphaNormalizeTerm(t.func, bound),
        alphaNormalizeTerm(t.arg, bound),
      ),
  );

const betaChildren = (t: Term): Term[] =>
  termElim<Term[]>(
    t,
    (t) => [],
    (t) => betaChildren(t.body).map((c) => tlambda(t.variable, c)),
    (t) => [
      ...betaChildren(t.func).map((c) => tapply(c, t.arg)),
      ...betaChildren(t.arg).map((c) => tapply(t.func, c)),
      ...(t.func.type === "lambda" ? [reduce(t)] : []),
    ],
  );

type graph = Map<string, Term[]>;

const buildGraph = (t: Term): graph => {
  const g: graph = new Map();
  const stack = [t];
  while (stack.length > 0) {
    if (g.size % 500 === 0) console.log(g.size, stack.length);
    const t = stack.pop()!;
    if (g.has(JSON.stringify(t))) {
      continue;
    }
    const kids = betaChildren(t).map((t) => alphaNormalizeTerm(t));
    g.set(JSON.stringify(t), kids);
    stack.push(...kids);
  }
  return g;
};

const getDistances = (g: graph, t: Term): Map<Term, number> => {
  const distances = new Map<Term, number>();
  const queue = [t];
  distances.set(t, 0);
  while (queue.length > 0) {
    const t = queue.shift()!;
    const d = distances.get(t)!;
    for (const c of g.get(JSON.stringify(t))!) {
      if (!distances.has(c)) {
        distances.set(c, d + 1);
        queue.push(c);
      }
    }
  }
  return distances;
};

export const naiveBetaNormalForms = (t: Term, depth: number): Term[] => {
  if (isBetaNormal(t)) {
    return [t];
  }
  if (depth === 0) {
    return [];
  }
  return betaChildren(t).flatMap((c) => naiveBetaNormalForms(c, depth - 1));
};

export const isBetaNormal = (t: Term): boolean => betaChildren(t).length === 0;

export const naiveBetaNormalize = (t: Term): Term => {
  for (let i = 0; i < 30; i++) {
    if (isBetaNormal(t)) {
      return t;
    }
    t = betaChildren(t)[0];
  }
  throw new Error("couldnt normalize");
};

const zero = tlambda("f", tlambda("x", tvar("x")));
const succ = tlambda(
  "n",
  tlambda(
    "f",
    tlambda(
      "x",
      tapply(tvar("f"), tapply(tapply(tvar("n"), tvar("f")), tvar("x"))),
    ),
  ),
);
//  \n \f \x (f(nfx))
/*
const one = naiveBetaNormalize(tapply(succ, zero));
const two = naiveBetaNormalize(tapply(succ, one));
const three = naiveBetaNormalize(tapply(succ, two));
const threeToThree = tapply(three, three);

const t = alphaNormalizeTerm(tapply(three, three));
const g = buildGraph(t);
const d = getDistances(g, t);

function uglyPrint(t: term): string {
  return termElim(
    t,
    (t) => t.name,
    (t) => `(λ${t.variable}.${uglyPrint(t.body)})`,
    (t) => `(${uglyPrint(t.func)} ${uglyPrint(t.arg)})`,
  );
}

for (const [k, v] of d.entries()) {
  console.log(v, isBetaNormal(k), uglyPrint(k));
}
*/
