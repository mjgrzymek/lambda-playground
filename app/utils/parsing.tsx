import { Term } from "./term";

function mkLambda(vars: string[], body: Term): Term {
  let res = body;
  for (let v of vars.toReversed()) {
    res = { type: "lambda", variable: v, body: res };
  }
  return res;
}

function mkApply(terms: Term[]): Term {
  if (terms[0] === undefined) {
    throw new Error("Empty term list in apply");
  }
  let res = terms[0];
  for (let t of terms.slice(1)) {
    res = { type: "apply", func: res, arg: t };
  }
  return res;
}

export function parseTerm(term: string): Term {
  term += ")";
  term = term.replaceAll("=>", ".");
  term = term.replaceAll(":", ".");

  // js doesn't have lambda
  term = term.replaceAll("lambda", " ");
  term = term.replaceAll("\\", " ");

  const gen = (function* () {
    for (const char of term) {
      yield char;
    }
  })();

  function parse(): Term {
    let termAcc: Term[] = [];
    let charAcc: string[] = [];

    function dropAcc() {
      if (charAcc.length > 0) {
        const word = charAcc.join("");
        charAcc = [];
        termAcc.push({ type: "variable", name: word });
      }
    }

    while (true) {
      const { value: c, done } = gen.next();
      if (done) break;

      if (c == "(") {
        termAcc.push(parse());
      } else if (c === " ") {
        dropAcc();
      } else if (c === ".") {
        dropAcc();
        let vars = termAcc.map((t) => {
          if (t.type !== "variable") {
            throw new Error("Expected variable name before connector");
          }
          return t.name;
        });

        return mkLambda(vars, parse());
      } else if (c === ")") {
        dropAcc();
        return mkApply(termAcc);
      } else {
        charAcc.push(c);
      }
    }

    throw new Error("Unexpected end of input");
  }

  return parse();
}
