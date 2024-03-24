"use client";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { StopIcon, PlayIcon } from "@radix-ui/react-icons";
import { parseTerm } from "./utils/parsing";

import {
  Term,
  tapply,
  tvar,
  tlambda,
  reduceAt,
  splitNumberSubscript,
  naiveBetaNormalize,
  normalStrategyRedex,
  normalNormalization,
  NormalizationStep,
  isBetaNormal,
  factorial4,
} from "./utils/term";

import { Style, Lang, langData } from "./utils/languages";

import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ShowTerm, termToString } from "./components/ShowTerm";

/*
classes for rules:
  .paren-container
  .abstraction-container
  .application-container
  .abstraction-handle
  .output-row-container
  .used-handle
  .result-container-outer
  .result-container-inner

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

const identitySquared = tapply(I, I);
const examples: { name: string; term: Term }[] = [
  { name: "Hello", term: parseTerm("(x . h e x x o)(l)") },
  { name: "identity squared", term: identitySquared },
  { name: "infinite loop", term: omega },
  { name: "optional infinite loop", term: optionalOmega },
  { name: "infinite growth", term: bigOmegaReverse },
  { name: "infinite growth 2", term: bigOmega },
  { name: "renaming", term: alphaClosed },
  { name: "2 + 2", term: tapply(tapply(add, two), two) },
  { name: "3 * 2", term: threeTimesTwo },
  { name: "3 ^ 3", term: threeToThree },
  {
    name: "Y Combinator",
    term: parseTerm("(f => (x => f(x x))(x => f(x x)))"),
  },
  {
    name: "4 factorial",
    term: factorial4,
  },
];

export default function Home() {
  const [inputTerm, setInputTerm] = useState("(x => x)y");
  const [history, setHistory] = useState<{ term: Term; targetPath: string }[]>(
    [],
  );
  const [activeTerm, setActiveTerm] = useState<Term>(() =>
    parseTerm(inputTerm),
  );
  const done = useMemo(() => isBetaNormal(activeTerm), [activeTerm]);
  const [lang, setLang] = useState<Lang>(Lang.Python);
  const [auto, setAuto] = useState(false);

  const inputPlaceholder = useMemo(
    () =>
      termToString(
        tapply(tlambda("x", tapply(tvar("x"), tvar("x"))), tvar("y")),
        langData[lang],
      ),
    [lang],
  );

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

  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: terms.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // ??
    overscan: 0,
  });

  const parsedInputTerm = useMemo(() => {
    try {
      return parseTerm(inputTerm);
    } catch (e) {
      return null;
    }
  }, [inputTerm]);

  const parseError = parsedInputTerm === null;

  function changeLang(l: Lang) {
    setLang(l);
    if (parsedInputTerm !== null) {
      setInputTerm(termToString(parsedInputTerm, langData[l]));
    }
  }

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
    setAuto(false);
    if (parsedInputTerm !== null) {
      setActiveTerm(parsedInputTerm);
      setInputTerm(termToString(parsedInputTerm, langData[lang]));
    }
  }

  function changeFocusedTerm(term: Term) {
    setInputTerm(termToString(term, langData[lang]));
    setHistory([]);
    setActiveTerm(term);
    setAuto(false);
  }

  // to signal on/off to the async function
  const autoRef = useRef(auto);
  autoRef.current = auto;

  // to prevent double run
  const autoCounterRef = useRef(0);

  async function launchAuto() {
    autoCounterRef.current += 1;
    const myCounter = autoCounterRef.current;

    const term = activeTerm;

    const worker = new Worker(
      new URL("./utils/normalizationWorker.ts", import.meta.url),
      { type: "module" },
    );
    let result: null | NormalizationStep[] = null;
    worker.onmessage = (event: any) => {
      result = event.data;
    };
    worker.postMessage(term);
    const normalizationTimeout = 3 * 1000;
    setTimeout(() => {
      worker.terminate();
    }, normalizationTimeout);

    let prevTerm = term;
    for (const { reduced, targetPath } of normalNormalization(activeTerm)) {
      // we want to go on the macrotask queue so React can ever render
      // at the beginning to prevent double call to launchAuto from bypassing it
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (!autoRef.current || myCounter !== autoCounterRef.current) {
        worker.terminate();
        return;
      }

      if (result !== null) {
        result = result as NormalizationStep[];
        const last = result.pop()!.reduced;
        setActiveTerm(last);
        setHistory(
          result.map(({ reduced, targetPath }) => ({
            term: reduced,
            targetPath,
          })),
        );
        break;
      }
      let prevTerm2 = prevTerm; // we love closures
      setHistory((history) => [...history, { term: prevTerm2, targetPath }]);
      setActiveTerm(reduced);
      prevTerm = reduced;
    }
    worker.terminate();
    setAuto(false);
  }

  useEffect(() => {
    rowVirtualizer.scrollToIndex(terms.length - 1);
  }, [terms.length, rowVirtualizer]);

  const items = rowVirtualizer.getVirtualItems();

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
        <div className="flex w-full items-center justify-center ">
          <div className="flex flex-1 justify-center gap-2">
            <Input
              type="text"
              className={` font-mono ${parseError ? "ring-2 ring-red-600" : ""} w-96`}
              value={inputTerm}
              onChange={(e) => setInputTerm(e.target.value)}
              placeholder={inputPlaceholder}
            />
            <Button onClick={reset}>Reset</Button>
            <Button
              className="flex w-20 gap-1"
              onClick={toggleAuto}
              disabled={done}
            >
              {auto ? (
                <>
                  <StopIcon /> Stop
                </>
              ) : done ? (
                <> Done </>
              ) : (
                <>
                  <PlayIcon /> Auto
                </>
              )}
            </Button>
          </div>
          <ToggleGroup
            type="single"
            variant={"outline"}
            size={"huge"}
            value={lang}
            onValueChange={(x) => {
              if (x) {
                changeLang(x as Lang);
              } else {
                changeLang(lang);
              }
            }}
          >
            {Object.values(Lang).map((l) => (
              <ToggleGroupItem value={l} aria-label={`Choose ${l}`} key={l}>
                <Image
                  src={langData[l].image}
                  alt={l}
                  width={70}
                  height={70}
                  priority={true}
                  className="h-full w-auto"
                />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div
          style={{ overflow: "auto" }}
          ref={parentRef}
          className=" h-full  w-full overflow-y-auto bg-zinc-900 outline outline-2 outline-rose-800 [contain:strict]"
        >
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${items[0]?.start ?? 0}px)`,
              }}
            >
              {items.map((virtualRow) => {
                const { t, interactive, targetPath } = terms[virtualRow.index]!;
                return (
                  <div
                    key={virtualRow.key}
                    className={`output-row-container flex  cursor-default px-2 py-1 ${virtualRow.index % 2 == 1 ? "bg-zinc-800" : ""}`}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualRow.index}
                  >
                    <div className=" w-20 flex-shrink-0">
                      {virtualRow.index}.
                    </div>
                    <ShowTerm
                      t={t}
                      stuff={{
                        langInfo,
                        pushReduce,
                        targetPath,
                        interactive: !auto && interactive,
                        returnString: false,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
