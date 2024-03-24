import { parseTerm } from "./parsing";

type vName = string;

export type varTerm = { type: "variable"; name: vName };
export const tvar = (name: vName): varTerm => ({ type: "variable", name });
export type lambdaTerm = { type: "lambda"; variable: vName; body: Term };
export const tlambda = (variable: vName, body: Term): lambdaTerm => ({
  type: "lambda",
  variable,
  body,
});
type applyTerm = { type: "apply"; func: Term; arg: Term };
export const tapply = (func: Term, arg: Term): applyTerm => ({
  type: "apply",
  func,
  arg,
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
const rewrite = (t: Term, from: vName, to: Term): Term =>
  termElim(
    t,
    (t) => (t.name === from ? to : t),
    (t) => {
      if (t.variable === from) return t;
      if (!freeVariables(to).includes(t.variable)) {
        return tlambda(t.variable, rewrite(t.body, from, to));
      }
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

function reduce(t: Term): Term {
  if (t.type !== "apply" || t.func.type !== "lambda") {
    throw new Error("reduce at invalid point");
  } else {
    //TODO here was marker
    const rw = rewrite(t.func.body, t.func.variable, t.arg);
    return rw;
  }
}

export function reduceAt(
  term: Term,
  targetPath: string,
  currentPath: string = "",
): Term {
  if (!targetPath.startsWith(currentPath)) {
    return term;
  }
  return termElim<Term>(
    term,
    (t) => t,
    (t) => tlambda(t.variable, reduceAt(t.body, targetPath, currentPath + "d")),
    (t) =>
      currentPath === targetPath
        ? reduce(t)
        : tapply(
            reduceAt(t.func, targetPath, currentPath + "l"),
            reduceAt(t.arg, targetPath, currentPath + "r"),
          ),
  );
}

export const normalStrategyRedex = (
  t: Term,
  path: string = "",
): string | null => {
  return termElim(
    t,
    (_) => null,
    (t) => normalStrategyRedex(t.body, path + "d"),
    (t) =>
      isRedex(t)
        ? path
        : normalStrategyRedex(t.func, path + "l") ??
          normalStrategyRedex(t.arg, path + "r"),
  );
};

export const splitNumberSubscript = (s: string): [string, string] => {
  const match = s.match(/^(.+?)(([1-9][0-9]*|0)?)$/);
  if (match === null) {
    return ["", ""];
  }
  return [match[1]!, match[2]!];
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
    (_) => [],
    (t) => betaChildren(t.body).map((c) => tlambda(t.variable, c)),
    (t) => [
      ...betaChildren(t.func).map((c) => tapply(c, t.arg)),
      ...betaChildren(t.arg).map((c) => tapply(t.func, c)),
      ...(t.func.type === "lambda" ? [reduce(t)] : []),
    ],
  );

export const naiveBetaNormalForms = (t: Term, depth: number): Term[] => {
  if (isBetaNormal(t)) {
    return [t];
  }
  if (depth === 0) {
    return [];
  }
  return betaChildren(t).flatMap((c) => naiveBetaNormalForms(c, depth - 1));
};

export const isBetaNormal = (t: Term): boolean =>
  normalStrategyRedex(t) === null;

export const naiveBetaNormalize = (t: Term): Term => {
  for (let i = 0; i < 30; i++) {
    if (isBetaNormal(t)) {
      return t;
    }
    t = betaChildren(t)[0]!;
  }
  throw new Error("couldnt normalize");
};

export function getNormalForm(t: Term) {
  while (true) {
    const targetPath = normalStrategyRedex(t);
    if (targetPath === null) {
      return t;
    }
    t = reduceAt(t, targetPath);
  }
}

export type NormalizationStep = {
  reduced: Term;
  targetPath: string;
};

export function* normalNormalization(term: Term): Generator<NormalizationStep> {
  while (true) {
    const targetPath = normalStrategyRedex(term);
    if (targetPath === null) {
      return;
    }
    const reduced = reduceAt(term, targetPath);
    yield { reduced, targetPath };

    term = reduced;
  }
}

const Y = "(f => (x => f(x x))(x => f(x x)))";
const pred = "(n.f.x. n(g.h. h(g f))(u. x)(u. u))";
const str_mul = "(a.b.f.x. a(b f) x)";
const str_false = "(x.y. y)";
const str_true = "(x.y. x)";
const iszero = `(n. n(x. ${str_false}) ${str_true})`;
const sone = `(f x . f x)`;
const szero = `(f x . x)`;
const stwo = `(f x . f (f x))`;
const sthree = `(f x . f (f (f x)))`;
const sfour = `(f x . f (f (f (f x))))`;
export const factorial4 = parseTerm(
  `${Y}(f x . ${iszero} x  ${sone} (${str_mul} x (f (${pred} x)) ) )${sfour}`,
);
