"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import {
  Term,
  tapply,
  tvar,
  tlambda,
  termElim,
  reduceAt,
  splitNumberSubscript,
  naiveBetaNormalize,
  normalStrategyRedex,
} from "./term";

import { Style, LangInfo, Lang, langData } from "./languages";

/*
classes for rules:
  .paren-container
  .abstraction-container
  .abstraction-outer-container
  .application-container
  .abstraction-handle
  .output-row-container
  .used-handle
  .result-container

also .var-${name} , .abstr-${name} for each variable name
*/

const I: Term = {
  type: "lambda",
  variable: "x",
  body: { type: "variable", name: "x" },
};

const selfApply: Term = {
  type: "lambda",
  variable: "x",
  body: tapply(tvar("x"), tvar("x")),
};

const omega = tapply(selfApply, selfApply);

const optionalOmega = tapply(tlambda("x", I), tapply(selfApply, selfApply));

const selfDoubleApply = tlambda(
  "x",
  tapply(tvar("x"), tapply(tvar("x"), tvar("x"))),
);

const selfDoubleApplyReverse = tlambda(
  "x",
  tapply(tapply(tvar("x"), tvar("x")), tvar("x")),
);

const bigOmega = tapply(selfDoubleApply, selfDoubleApply);
const bigOmegaReverse = tapply(selfDoubleApplyReverse, selfDoubleApplyReverse);
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
const one = naiveBetaNormalize(tapply(succ, zero));
const two = naiveBetaNormalize(tapply(succ, one));
const three = naiveBetaNormalize(tapply(succ, two));
const add = tlambda(
  "a",
  tlambda(
    "b",
    tlambda(
      "f",
      tlambda(
        "x",
        tapply(
          tapply(tvar("b"), tvar("f")),
          tapply(tapply(tvar("a"), tvar("f")), tvar("x")),
        ),
      ),
    ),
  ),
);

const mul = tlambda(
  "a",
  tlambda(
    "b",
    tlambda(
      "f",
      tlambda(
        "x",
        tapply(tapply(tvar("b"), tapply(tvar("a"), tvar("f"))), tvar("x")),
      ),
    ),
  ),
);

const threePlusTwo = tapply(tapply(add, three), two);
const threeTimesTwo = tapply(tapply(mul, three), two);
const threeToThree = tapply(three, three);

const eta = tlambda("x", tlambda("y", tapply(tvar("x"), tvar("y")))); // just the identity
const alpha = tapply(tlambda("x", tlambda("y", tvar("x"))), tvar("y"));
const alphaClosed = tlambda("y", alpha);

function displayVariable(name: string, style: Style, className = "") {
  if (style === Style.Code) {
    return <span className={`var-${name} ${className}`}>{name}</span>;
  }
  style satisfies Style.Math;
  const [base, sub] = splitNumberSubscript(name);
  const subscripts = "₀₁₂₃₄₅₆₇₈₉";
  return (
    <span className={`var-${name} ${className} p-[0.05rem]`}>
      {toMathematicalItalic(base)}
      {[...sub].map((d) => subscripts[Number(d)]).join("")}
    </span>
  );
}

function toMathematicalItalic(text: string): string {
  return Array.from(text)
    .map((char) => {
      // h is a special case.... okayy
      if (char === "h") return "ℎ";
      if (char >= "a" && char <= "z") {
        // Unicode range for italic lowercase letters starts at U+1D44E
        const codePoint = 0x1d44e + char.charCodeAt(0) - "a".charCodeAt(0);
        return String.fromCodePoint(codePoint);
      } else if (char >= "A" && char <= "Z") {
        // Unicode range for italic uppercase letters starts at U+1D434
        const codePoint = 0x1d434 + char.charCodeAt(0) - "A".charCodeAt(0);
        return String.fromCodePoint(codePoint);
      } else {
        // Return the original character if it's not a letter
        return char;
      }
    })
    .join("");
}

function parenthesizeIf(b: boolean, t: JSX.Element, langInfo: LangInfo) {
  return b ? (
    <span className="paren-container">
      <span
        className={`${langInfo.style === Style.Math ? "p-[0.07rem]" : ""} [.paren-container:has(>&:hover)>&]:text-red-600`}
      >
        (
      </span>
      {t}
      <span
        className={`${langInfo.style === Style.Math ? "p-[0.07rem]" : ""} [.paren-container:has(>&:hover)>&]:text-red-600`}
      >
        )
      </span>
    </span>
  ) : (
    // for :has()
    <span className="paren-container">{t}</span>
  );
}

/**
 * @argument x the variable name
 */
function abstractionStyle(x: string) {
  return (
    <style jsx global>
      {`
        :is(
            .abstr-${x}:has(.var-${x}:hover):not(:has(.abstr-${x}:hover)),
            .abstr-${x}:has(>.abstraction-handle:hover)
          )
          .var-${x}:not(.abstr-${x}:not(:hover) .var-${x}) {
          color: green;
          &.bind {
            border-bottom: 1px solid green;
          }
        }
      `}
    </style>
  );
}

type Stuff = {
  langInfo: LangInfo;
  pushReduce: (path: string) => void;
  targetPath: string | null;
  interactive: boolean;
};

function toDisplay(
  t: Term,
  context: (
    | { type: "lambda"; onClick?: undefined }
    | { type: "redex"; onClick: () => void }
    | { type: "other"; onClick?: undefined }
  ) & { used?: boolean },
  stuff: Stuff,
  currentPath: string,
): JSX.Element {
  const { langInfo, pushReduce, interactive } = stuff;
  const result = termElim(
    t,
    (t) => displayVariable(t.name, langInfo.style),
    (t) => {
      const hideLambda = context.type === "lambda" && langInfo.multiArg;
      const hideConnector = t.body.type === "lambda" && langInfo.multiArg;

      const used = context.used;

      const lambdaIsHandle = langInfo.abstractionHandle === "lambda-symbol";
      const interactiveLambda = lambdaIsHandle && context.type === "redex";
      const usedLambda = lambdaIsHandle && used;

      const connectorIsHandle = langInfo.abstractionHandle === "connector";
      const interactiveConnector =
        connectorIsHandle && context.type === "redex";
      const usedConnector = connectorIsHandle && used;

      console.assert(!(hideLambda && interactiveLambda));
      console.assert(!(hideLambda && usedLambda));
      console.assert(!(hideConnector && interactiveConnector));
      console.assert(!(hideConnector && usedConnector));

      return (
        <span
          className={`abstr-${t.variable} abstraction-container TODO[&:has(>.abstraction-handle:hover)]:bg-pink-700`}
        >
          {abstractionStyle(t.variable)}
          {hideLambda ? null : interactiveLambda ? (
            <span
              onClick={context.onClick}
              className="abstraction-handle cursor-pointer whitespace-pre-wrap text-blue-400 hover:text-blue-600"
            >
              {langInfo.lambdaSymbol.trim()}
            </span>
          ) : (
            <span
              className={`${lambdaIsHandle ? "abstraction-handle" : ""} ${usedLambda ? "used-handle text-rose-300" : ""} whitespace-pre-wrap`}
            >
              {langInfo.lambdaSymbol.trim()}
            </span>
          )}
          {langInfo.lambdaSymbol !== "" &&
            langInfo.lambdaSymbol.slice(-1) === " " && <span> </span>}
          {displayVariable(t.variable, langInfo.style, "bind")}
          {langInfo.connector !== "" && langInfo.connector[0] === " " && (
            <span> </span>
          )}
          {hideConnector ? null : interactiveConnector ? (
            <span
              onClick={context.onClick}
              className="abstraction-handle cursor-pointer whitespace-pre-wrap text-blue-400 hover:text-blue-600"
            >
              {langInfo.connector.trim()}
            </span>
          ) : (
            <span
              className={`${connectorIsHandle ? "abstraction-handle" : ""} ${usedConnector ? "used-handle text-rose-300" : ""} whitespace-pre-wrap`}
            >
              {langInfo.connector.trim()}
            </span>
          )}
          {langInfo.connector !== "" &&
            langInfo.connector.slice(-1) === " " && <span> </span>}

          <span className="outline-2 outline-rose-500 [.abstraction-container:has(>.abstraction-handle:hover)>&]:outline">
            {toDisplay(
              t.body,
              {
                type: "lambda",
              },
              stuff,
              currentPath + "d",
            )}
          </span>
        </span>
      );
    },
    (t) => {
      return (
        <span className="application-container ">
          <span className="abstraction-outer-container TODO[&:has(>.paren-container>.result-container>.abstraction-container>.abstraction-handle:hover)]:bg-pink-700">
            {parenthesizeIf(
              t.func.type === "lambda",
              interactive && t.func.type === "lambda"
                ? toDisplay(
                    t.func,
                    {
                      type: "redex",
                      onClick: () => {
                        pushReduce(currentPath);
                      },
                    },
                    stuff,
                    currentPath + "l",
                  )
                : toDisplay(
                    t.func,
                    {
                      type: "other",
                      used: currentPath === stuff.targetPath,
                    },
                    stuff,
                    currentPath + "l",
                  ),
              langInfo,
            )}
          </span>
          <span className="outline-2 outline-sky-600 [.application-container:has(>.abstraction-outer-container>.paren-container>.result-container>.abstraction-container>.abstraction-handle:hover)>&]:outline">
            {parenthesizeIf(
              t.arg.type === "apply" ||
                t.arg.type === "lambda" ||
                langInfo.parenthesizeArg,
              toDisplay(
                t.arg,
                {
                  type: "other",
                },
                stuff,
                currentPath + "r",
              ),
              langInfo,
            )}
          </span>
        </span>
      );
    },
  );
  return (
    // todo double span for double outline?
    <span
      className={`result-container ${t.marker === "used-body" ? "outline-2 outline-offset-4 outline-rose-500 " : ""}
      ${t.marker === "used-argument" ? "outline-2 outline-sky-600" : ""}
      ${t.marker !== undefined ? "[.output-row-container:has(.used-handle:hover)+.output-row-container_&]:outline" : ""} `}
    >
      {result}
    </span>
  );
}

const ShowTerm = memo(
  function ShowTerm({ t, stuff }: { t: Term; stuff: Stuff }) {
    const { langInfo } = stuff;
    return (
      <span
        className={` ${langInfo.style === Style.Math ? "font-maths" : "font-mono"}`}
      >
        {toDisplay(t, { type: "other" }, stuff, "")}
      </span>
    );
  },
  (prev, next) =>
    prev.stuff.interactive === false &&
    next.stuff.interactive === false &&
    prev.t === next.t &&
    prev.stuff.langInfo === next.stuff.langInfo &&
    prev.stuff.targetPath === next.stuff.targetPath,
);

const identitySquared = tapply(I, I);
const examples: { name: string; term: Term }[] = [
  { name: "identity squared", term: identitySquared },
  { name: "infinite loop", term: omega },
  { name: "optional infinite loop", term: optionalOmega },
  { name: "infinite growth", term: bigOmegaReverse },
  { name: "infinite growth 2", term: bigOmega },
  { name: "renaming", term: alphaClosed },
  { name: "succ(0)", term: tapply(succ, zero) },
  { name: "1 + 1", term: tapply(tapply(add, one), one) },
  { name: "2 + 2", term: tapply(tapply(add, two), two) },
  { name: "3 * 2", term: threeTimesTwo },
  { name: "3 ^ 3", term: threeToThree },
  //TODO: add Y comb
];

function* normalNormalization(term: Term) {
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

export default function Home() {
  const [focusedTerm, setFocusedTerm] = useState<Term>(identitySquared);
  const [history, setHistory] = useState<{ term: Term; targetPath: string }[]>(
    [],
  );
  const [activeTerm, setActiveTerm] = useState<Term>(focusedTerm);
  const [lang, setLang] = useState<Lang>(Lang.Python);
  const [auto, setAuto] = useState(false);

  const langInfo = langData[lang];
  const terms: { t: Term; targetPath: string | null; interactive: boolean }[] =
    useMemo(
      () => [
        ...history.map(({ term, targetPath }) => ({
          t: term,
          targetPath,
          interactive: false,
        })),
        { t: activeTerm, targetPath: null, interactive: true },
      ],
      [activeTerm, history],
    );

  const scrollRef = useRef<HTMLDivElement>(null);

  function toggleAuto() {
    autoRef.current = !auto;
    setAuto(!auto);
    if (!auto) {
      launchAuto();
    }
  }
  const pushReduce = useCallback(
    (targetPath: string) => {
      const reduced = reduceAt(activeTerm, targetPath);
      setHistory((history) => [...history, { term: activeTerm, targetPath }]);
      setActiveTerm(reduced);
    },
    [activeTerm],
  );
  function reset() {
    setHistory([]);
    setActiveTerm(focusedTerm);
    setAuto(false);
  }
  function changeFocusedTerm(term: Term) {
    setFocusedTerm(term);
    setHistory([]);
    setActiveTerm(term);
    setAuto(false);
  }

  const autoRef = useRef(auto);
  autoRef.current = auto;

  async function launchAuto() {
    let prevTerm = activeTerm;
    for (const { reduced, targetPath } of normalNormalization(activeTerm)) {
      if (!autoRef.current) return;
      let prevTerm2 = prevTerm; // we love closures
      setHistory((history) => [...history, { term: prevTerm2, targetPath }]);
      setActiveTerm(reduced);
      prevTerm = reduced;

      // we want to go on the macrotask queue so React can ever render
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    setAuto(false);
  }

  useEffect(
    function scrollToEnd() {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "instant",
      });
    },
    [terms],
  );

  return (
    <div className="flex h-screen">
      <nav className="flex w-64 flex-col justify-center bg-zinc-800">
        {examples.map(({ name, term }) => (
          <button
            key={name}
            onClick={() => changeFocusedTerm(term)}
            className="rounded-md p-2 hover:bg-gray-500"
          >
            {name}
          </button>
        ))}
      </nav>
      <main className="flex flex-1 flex-col items-center gap-4 p-12 text-xl">
        <span className="animate-spin bg-black p-2"> I </span>
        <div className="flex w-full items-center justify-center ">
          <div className="flex flex-1 justify-center gap-2">
            <button className="rounded-md bg-rose-400 p-2" onClick={reset}>
              Reset
            </button>
            <button className="rounded-md bg-teal-600 p-2" onClick={toggleAuto}>
              {auto ? "Stop" : "Auto"}
            </button>
          </div>
          <div className="flex gap-1 ">
            {Object.values(Lang).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`rounded-md ${lang == l ? "bg-gray-400" : "bg-gray-500"} p-2 hover:bg-gray-400`}
              >
                <Image src={langData[l].image} alt={l} width={50} height={50} />
              </button>
            ))}
          </div>
        </div>

        <div
          className="flex w-full flex-col overflow-auto bg-zinc-900 outline outline-2 outline-rose-800"
          ref={scrollRef}
        >
          {terms.map(({ t, interactive, targetPath }, i) => (
            <div
              className="output-row-container flex  items-center px-2 py-1 [&:nth-child(even)]:bg-zinc-800"
              key={i}
            >
              <div className=" w-20"> {i}. </div>
              <ShowTerm
                t={t}
                stuff={{
                  langInfo,
                  pushReduce,
                  targetPath,
                  interactive: !auto && interactive,
                }}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
