import path from "path";
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
const freeVariables = (t: Term): vName[] => {
  switch (t.type) {
    case "variable":
      return [t.name];
    case "lambda":
      return freeVariables(t.body).filter((v) => v !== t.variable);
    case "apply":
      return [...freeVariables(t.func), ...freeVariables(t.arg)];
  }
};

const rewrite_ = (
  t: Term,
  from: vName,
  to: Term,
  toFreeVars: Set<vName>,
  currentPath: string,
  pathsOutput?: Set<string>,
): Term => {
  switch (t.type) {
    case "variable": {
      if (t.name === from) {
        if (pathsOutput) {
          pathsOutput.add(currentPath);
        }
        return to;
      }
      return t;
    }
    case "lambda": {
      if (t.variable === from) return t;
      if (!toFreeVars.has(t.variable)) {
        return tlambda(
          t.variable,
          rewrite_(
            t.body,
            from,
            to,
            toFreeVars,
            currentPath + "d",
            pathsOutput,
          ),
        );
      }
      const newArg = newVar(t.variable, [
        ...freeVariables(to),
        ...freeVariables(t.body),
      ]);
      return tlambda(
        newArg,
        rewrite_(
          rewrite_(
            t.body,
            t.variable,
            tvar(newArg),
            new Set([newArg]),
            currentPath + "d",
          ),
          from,
          to,
          toFreeVars,
          currentPath + "d",
          pathsOutput,
        ),
      );
    }
    case "apply":
      return tapply(
        rewrite_(t.func, from, to, toFreeVars, currentPath + "l", pathsOutput),
        rewrite_(t.arg, from, to, toFreeVars, currentPath + "r", pathsOutput),
      );
  }
};

function rewrite(
  t: Term,
  from: vName,
  to: Term,
  currentPath?: string,
  pathsOutput?: Set<string>,
): Term {
  const toFreeVars = new Set(freeVariables(to));
  return rewrite_(t, from, to, toFreeVars, currentPath ?? "", pathsOutput);
}

const isRedex = (t: Term): boolean =>
  t.type === "apply" && t.func.type === "lambda";

function reduce(
  t: Term,
  currentPath?: string,
  pathsOutput?: Set<string>,
): Term {
  if (t.type !== "apply" || t.func.type !== "lambda") {
    throw new Error("reduce at invalid point");
  } else {
    const rw = rewrite(
      t.func.body,
      t.func.variable,
      t.arg,
      currentPath,
      pathsOutput,
    );
    return rw;
  }
}

export function reduceAt(
  t: Term,
  targetPath: string,
  currentPath: string = "",
  pathsOutput?: Set<string>,
): Term {
  if (!targetPath.startsWith(currentPath)) {
    return t;
  }
  switch (t.type) {
    case "variable":
      return t;
    case "lambda":
      return tlambda(
        t.variable,
        reduceAt(t.body, targetPath, currentPath + "d", pathsOutput),
      );
    case "apply":
      return currentPath === targetPath
        ? reduce(t, currentPath, pathsOutput)
        : tapply(
            reduceAt(t.func, targetPath, currentPath + "l", pathsOutput),
            reduceAt(t.arg, targetPath, currentPath + "r", pathsOutput),
          );
  }
}

export function reduceAtInfo(t: Term, targetPath: string) {
  const pathsOutput = new Set<string>();
  const result = reduceAt(t, targetPath, "", pathsOutput);
  return { term: result, reducedBodyPaths: pathsOutput };
}

export const normalStrategyRedex = (
  t: Term,
  path: string = "",
): string | null => {
  switch (t.type) {
    case "variable":
      return null;
    case "lambda":
      return normalStrategyRedex(t.body, path + "d");
    case "apply":
      return isRedex(t)
        ? path
        : normalStrategyRedex(t.func, path + "l") ??
            normalStrategyRedex(t.arg, path + "r");
  }
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

export function alphaNormalizeTerm(t: Term, bound: vName[] = []): Term {
  switch (t.type) {
    case "variable":
      return t;

    case "lambda": {
      const newArg = newVar("x", bound);
      return tlambda(
        newArg,
        alphaNormalizeTerm(rewrite(t.body, t.variable, tvar(newArg)), [
          ...bound,
          newArg,
        ]),
      );
    }

    case "apply":
      return tapply(
        alphaNormalizeTerm(t.func, bound),
        alphaNormalizeTerm(t.arg, bound),
      );
  }
}

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
  reducedBodyPaths: Set<string>;
};

export function* normalNormalization(term: Term): Generator<NormalizationStep> {
  while (true) {
    const targetPath = normalStrategyRedex(term);
    if (targetPath === null) {
      return;
    }
    const { term: reduced, reducedBodyPaths } = reduceAtInfo(term, targetPath);
    yield {
      reduced,
      targetPath,
      reducedBodyPaths,
    };

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
