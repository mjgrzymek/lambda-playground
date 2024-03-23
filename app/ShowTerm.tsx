"use client";
import React, { memo } from "react";
import { Term, splitNumberSubscript, termElim } from "./utils/term";
import { Style, LangInfo } from "./utils/languages";
import { abstractionStyle } from "./components/abstractionStyle";
import InlineButton from "./components/InlineButton";

export function displayVariable(name: string, style: Style, className = "") {
  if (style === Style.Code) {
    return <span className={`var-${name} ${className}`}>{name}</span>;
  }
  style satisfies Style.Math;

  const [base, sub] = splitNumberSubscript(name);
  console.assert(base.length > 0);
  const oneLetter = base.length === 1;
  const displayBase = oneLetter ? toMathematicalItalic(base) : base;

  const subscripts = "₀₁₂₃₄₅₆₇₈₉";

  return (
    <>
      <wbr />
      <span
        className={`var-${name} ${className} ${oneLetter ? "p-[0.05rem]" : "p-1"} `}
      >
        {displayBase}
        {[...sub].map((d) => subscripts[Number(d)]).join("")}
      </span>
      <wbr />
    </>
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

function parenthesizeIf(
  b: boolean,
  t: React.ReactNode,
  displayInfo: DisplayInfo,
) {
  if (displayInfo.returnString) {
    return b ? `(${t})` : t;
  }
  const langInfo = displayInfo.langInfo;
  return b ? (
    <>
      <wbr />
      <span className="paren-container">
        <span
          className={`${langInfo.style === Style.Math ? "p-[0.07rem]" : ""} [.paren-container:has(>&:hover)>&]:text-red-600`}
        >
          (
        </span>
        <wbr />
        {t}
        <wbr />
        <span
          className={`${langInfo.style === Style.Math ? "p-[0.07rem]" : ""} [.paren-container:has(>&:hover)>&]:text-red-600`}
        >
          )
        </span>
      </span>
      <wbr />
    </>
  ) : (
    // for :has()
    <span className="paren-container">{t}</span>
  );
}
type DisplayInfo = {
  langInfo: LangInfo;
  pushReduce?: (path: string) => void;
  targetPath?: string | null;
  interactive?: boolean;
  returnString: boolean;
};
function toDisplay(
  t: Term,
  context: (
    | { type: "lambda"; onClick?: undefined }
    | { type: "redex"; onClick: () => void }
    | { type: "other"; onClick?: undefined }
  ) & { used?: boolean },
  displayInfo: DisplayInfo,
  currentPath: string,
): React.ReactNode {
  const { langInfo, pushReduce, interactive } = displayInfo;
  if (!langInfo) {
    throw new Error("langInfo is undefined");
  }
  const result = termElim(
    t,
    (t) => {
      if (displayInfo.returnString) {
        return ` ${t.name} `;
      }
      return displayVariable(t.name, langInfo.style);
    },
    (t) => {
      const body = toDisplay(
        t.body,
        {
          type: "lambda",
        },
        displayInfo,
        currentPath + "d",
      );

      if (displayInfo.returnString) {
        return `${langInfo.stringLambdaSymbol}${t.variable}${langInfo.connector}${body}`;
      }

      const hideLambda = context.type === "lambda" && langInfo.multiArg;
      const hideConnector = t.body.type === "lambda" && langInfo.multiArg;

      const used = context.used;

      const lambdaIsHandle = langInfo.abstractionHandle === "lambda-symbol";
      const connectorIsHandle = langInfo.abstractionHandle === "connector";

      const usedLambda = lambdaIsHandle && used;
      const usedConnector = connectorIsHandle && used;

      const interactiveLambda = lambdaIsHandle && context.type === "redex";
      const interactiveConnector =
        connectorIsHandle && context.type === "redex";

      console.assert(!(hideLambda && interactiveLambda));
      console.assert(!(hideLambda && usedLambda));
      console.assert(!(hideConnector && interactiveConnector));
      console.assert(!(hideConnector && usedConnector));

      return (
        <span className={`abstr-${t.variable} abstraction-container `}>
          {abstractionStyle(t.variable)}
          {hideLambda ? null : interactiveLambda ? (
            <InlineButton
              onClick={context.onClick}
              className="abstraction-handle inline cursor-pointer whitespace-pre-wrap text-blue-400 hover:text-blue-600"
            >
              {langInfo.lambdaSymbol.trim()}
            </InlineButton>
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
            <InlineButton
              onClick={context.onClick}
              className="abstraction-handle inline cursor-pointer whitespace-pre-wrap text-blue-400 hover:text-blue-600"
            >
              {langInfo.connector.trim()}
            </InlineButton>
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
            {body}
          </span>
        </span>
      );
    },
    (t) => {
      const func = parenthesizeIf(
        t.func.type === "lambda",
        interactive && t.func.type === "lambda"
          ? toDisplay(
              t.func,
              {
                type: "redex",
                onClick: () => {
                  pushReduce!(currentPath);
                },
              },
              displayInfo,
              currentPath + "l",
            )
          : toDisplay(
              t.func,
              {
                type: "other",
                used: currentPath === displayInfo.targetPath,
              },
              displayInfo,
              currentPath + "l",
            ),
        displayInfo,
      );

      let inBody = toDisplay(
        t.arg,
        {
          type: "other",
        },
        displayInfo,
        currentPath + "r",
      );

      if (!displayInfo.returnString) {
        inBody = (
          <span className="outline-2 outline-sky-600 [.application-container:has(>.paren-container>.result-container-outer>.result-container-inner>.abstraction-container>.abstraction-handle:hover)>.paren-container>&]:outline">
            {inBody}
          </span>
        );
      }

      const body = parenthesizeIf(
        t.arg.type === "apply" ||
          t.arg.type === "lambda" ||
          langInfo.parenthesizeArg,
        inBody,
        displayInfo,
      );

      if (displayInfo.returnString) {
        return `${func} ${body}`;
      }
      return (
        <span className="application-container ">
          {func}
          {body}
        </span>
      );
    },
  );
  if (displayInfo.returnString) {
    if (typeof result !== "string") {
      throw new Error("Expected string");
    }
    return result;
  }
  return (
    <span
      className={`result-container-outer
        ${t.marker?.usedBody ? " outline-2 outline-offset-4 outline-rose-500  [.output-row-container:has(.used-handle:hover)+.output-row-container_&]:outline" : ""}
        `}
    >
      <span
        className={`result-container-inner 
          ${t.marker?.usedArgument ? "outline-2 outline-sky-600 [.output-row-container:has(.used-handle:hover)+.output-row-container_&]:outline " : ""}
          `}
      >
        {result}
      </span>
    </span>
  );
}
export function termToString(t: Term, langInfo: LangInfo): string {
  let result = toDisplay(
    t,
    { type: "other" },
    { langInfo, returnString: true },
    "",
  ) as string;
  if (typeof result !== "string") throw new Error("Expected string");

  result = result.trim();
  for (let i = 0; i < 3; i++) {
    result = result.replaceAll("  ", " ");
    result = result.replaceAll(" )", ")");
    result = result.replaceAll(") ", ")");
    result = result.replaceAll("( ", "(");
    result = result.replaceAll(" (", "(");
  }
  return result as unknown as string;
}
export const ShowTerm = memo(
  function ShowTerm({ t, stuff }: { t: Term; stuff: DisplayInfo }) {
    const { langInfo } = stuff;
    return (
      <span
        className={` ${langInfo.style === Style.Math ? "font-maths" : "font-mono"}  `}
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
