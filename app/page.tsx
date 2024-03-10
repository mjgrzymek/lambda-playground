"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import {
  Term,
  tapply,
  tvar,
  tlambda,
  lambdaTerm,
  termElim,
  reduceAt,
  varTerm,
  splitNumberSubscript,
  naiveBetaNormalize,
  normalStrategyRedex,
} from "./term";

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
const alphaBug = tapply(tapply(alphaClosed, tvar("a")), tvar("b"));

enum Style {
  Math = "Math",
  Code = "Code",
}

const displayVariable = (name: string, style: Style, className = "") => {
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
};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      math: any;
      mi: any;
      mo: any;
      msub: any;
      mn: any;
    }
  }
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

const textSymbolLambda = "λ";
const mathItalicSymbolLambda = "𝜆";

const parenthesizeIf = (b: boolean, t: JSX.Element) =>
  b ? (
    <span className="paren-container">
      <span className="p-[0.07rem] [.paren-container:has(>&:hover)>&]:text-red-600">
        (
      </span>
      {t}
      <span className="p-[0.07rem] [.paren-container:has(>&:hover)>&]:text-red-600">
        )
      </span>
    </span>
  ) : (
    // for :has()
    <span className="paren-container">{t}</span>
  );

enum Lang {
  Python = "Python",
  JavaScript = "JavaScript",
  Tex = "Tex",
}

type LangInfo = {
  lambdaSymbol: string;
  connector: string;
  multiArg: boolean;
  style: Style;
  image: string;
  parenthesizeArg: boolean;
  abstractionHandle: "lambda-symbol" | "connector";
};

const langData: { [key in Lang]: LangInfo } = {
  [Lang.Python]: {
    lambdaSymbol: "lambda ",
    connector: ": ",
    multiArg: false,
    style: Style.Code,
    image: "/python-logo-only.png",
    parenthesizeArg: true,
    abstractionHandle: "lambda-symbol",
  },
  [Lang.JavaScript]: {
    lambdaSymbol: "",
    connector: " => ",
    multiArg: false,
    style: Style.Code,
    image: "/js.png",
    parenthesizeArg: true,
    abstractionHandle: "connector",
  },
  [Lang.Tex]: {
    lambdaSymbol: mathItalicSymbolLambda,
    connector: ".",
    multiArg: true,
    style: Style.Math,
    image: "/TeX_logo.svg.png",
    parenthesizeArg: false,
    abstractionHandle: "lambda-symbol",
  },
};

function abstractionStyle(variable: string) {
  return (
    <style jsx global>
      {`
        .abstr-${variable}:has(.var-${variable}:hover):not(
            :has(.abstr-${variable}:hover)
          )
          .var-${variable}:not(.abstr-${variable}:hover .abstr-${variable}:not(:hover) .var-${variable}) {
          color: green;
          &.bind {
            border-bottom: 1px solid green;
          }
        }
      `}
    </style>
  );
}

type Stuff = { langInfo: LangInfo; pushReduce: (id: symbol) => void };

const toDisplay = (
  t: Term,
  interactive: boolean,
  context: (
    | { type: "lambda"; onClick?: undefined }
    | { type: "redex"; onClick: () => void }
    | { type: "other"; onClick?: undefined }
  ) & { stuff: Stuff },
): JSX.Element => {
  const { langInfo, pushReduce } = context.stuff;
  return termElim(
    t,
    (t) => displayVariable(t.name, langInfo.style),
    (t) => {
      const hideLambda = context.type === "lambda" && langInfo.multiArg;
      const hideConnector = t.body.type === "lambda" && langInfo.multiArg;

      const lambdaIsHandle = langInfo.abstractionHandle === "lambda-symbol";
      const interactiveLambda = lambdaIsHandle && context.type === "redex";

      const connectorIsHandle = langInfo.abstractionHandle === "connector";
      const interactiveConnector =
        connectorIsHandle && context.type === "redex";

      console.assert(!(hideLambda && interactiveLambda));
      console.assert(!(hideConnector && interactiveConnector));

      return (
        <span
          className={`abstr-${t.variable} abstraction-container [&:has(>.abstraction-handle:hover)]:bg-pink-700`}
        >
          {abstractionStyle(t.variable)}
          {hideLambda ? null : interactiveLambda ? (
            <button
              onClick={context.onClick}
              className="abstraction-handle cursor-pointer whitespace-pre-wrap text-blue-400 hover:text-blue-600"
            >
              {langInfo.lambdaSymbol.trim()}
            </button>
          ) : (
            <span
              className={`${lambdaIsHandle ? "abstraction-handle" : ""} whitespace-pre-wrap`}
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
            <button
              onClick={context.onClick}
              className="abstraction-handle whitespace-pre-wrap text-blue-400 hover:text-blue-600"
            >
              {langInfo.connector.trim()}
            </button>
          ) : (
            <span
              className={`${connectorIsHandle ? "abstraction-handle" : ""} whitespace-pre-wrap`}
            >
              {langInfo.connector.trim()}
            </span>
          )}
          {langInfo.connector !== "" &&
            langInfo.connector.slice(-1) === " " && <span> </span>}
          {toDisplay(t.body, interactive, {
            stuff: context.stuff,
            type: "lambda",
          })}
        </span>
      );
    },
    (t) => {
      return (
        <span className="application-container ">
          <span className="abstraction-outer-container [&:has(>.paren-container>.abstraction-container>.abstraction-handle:hover)]:bg-pink-700">
            {parenthesizeIf(
              t.func.type === "lambda",
              interactive && t.func.type === "lambda"
                ? toDisplay(t.func, interactive, {
                    stuff: context.stuff,
                    type: "redex",
                    onClick: () => {
                      pushReduce(t.id);
                    },
                  })
                : toDisplay(t.func, interactive, {
                    type: "other",
                    stuff: context.stuff,
                  }),
            )}
          </span>
          <span className="[.application-container:has(>.abstraction-outer-container>.paren-container>.abstraction-container>.abstraction-handle:hover)>&]:ring">
            {parenthesizeIf(
              t.arg.type === "apply" ||
                t.arg.type === "lambda" ||
                langInfo.parenthesizeArg,
              toDisplay(t.arg, interactive, {
                type: "other",
                stuff: context.stuff,
              }),
            )}
          </span>
        </span>
      );
    },
  );
};

const ShowTerm = memo(
  function ShowTerm({
    t,
    interactive,
    stuff,
  }: {
    t: Term;
    interactive: boolean;
    stuff: Stuff;
  }) {
    const { langInfo } = stuff;
    return (
      <span
        className={`select-none ${langInfo.style === Style.Math ? "font-maths" : "font-mono"}`}
      >
        {toDisplay(t, interactive, { type: "other", stuff })}
      </span>
    );
  },
  (prev, next) =>
    prev.interactive === false &&
    next.interactive === false &&
    prev.t === next.t &&
    prev.stuff.langInfo === next.stuff.langInfo,
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
];

export default function Home() {
  const [focusedTerm, setFocusedTerm] = useState<Term>(identitySquared);
  const [history, setHistory] = useState<Term[]>([]);
  const [activeTerm, setActiveTerm] = useState<Term>(focusedTerm);
  const [lang, setLang] = useState<Lang>(Lang.Python);
  const [auto, setAuto] = useState(false);

  const langInfo = langData[lang];
  const terms = useMemo(
    () => [
      ...history.map((t) => ({ t, interactive: false })),
      { t: activeTerm, interactive: true },
    ],
    [activeTerm, history],
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  function toggleAuto() {
    setAuto(!auto);
  }
  const pushAst = useCallback(
    (term: Term) => {
      setHistory([...history, activeTerm]);
      setActiveTerm(term);
    },
    [history, activeTerm],
  );
  const pushReduce = useCallback(
    (id: symbol) => pushAst(reduceAt(activeTerm, id)),
    [activeTerm, pushAst],
  );
  function reset() {
    setHistory([]);
    setActiveTerm(focusedTerm);
    setAuto(false);
  }
  function changeCurrentTerm(term: Term) {
    setFocusedTerm(term);
    setHistory([]);
    setActiveTerm(term);
    setAuto(false);
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "instant",
    });
  }, [terms]);
  useEffect(() => {
    if (auto) {
      const redexId = normalStrategyRedex(activeTerm);
      if (redexId !== null) {
        pushReduce(redexId);
      } else {
        setAuto(false);
      }
    }
  }, [auto, activeTerm, pushReduce]);

  return (
    <div className="flex h-screen">
      <nav className="flex w-64 flex-col justify-center bg-zinc-800">
        {examples.map(({ name, term }) => (
          <button
            key={name}
            onClick={() => changeCurrentTerm(term)}
            className="rounded-md p-2 hover:bg-gray-500"
          >
            {name}
          </button>
        ))}
      </nav>
      <main className="flex flex-1 flex-col items-center gap-4 p-12 text-xl">
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
          className="flex w-full flex-col gap-3 overflow-auto bg-zinc-900 p-2 ring-2 ring-rose-800"
          ref={scrollRef}
        >
          {terms.map(({ t, interactive }, i) => (
            <div className="flex select-none items-center" key={i}>
              <div className=" w-20"> {i}. </div>
              <ShowTerm
                t={t}
                interactive={interactive}
                stuff={{ langInfo, pushReduce }}
              />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
