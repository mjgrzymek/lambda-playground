const mathItalicSymbolLambda = "𝜆";

export enum Style {
  Math = "Math",
  Code = "Code",
}

export enum Lang {
  Python = "Python",
  JavaScript = "JavaScript",
  Tex = "Tex",
}

export type LangInfo = {
  lambdaSymbol: string;
  connector: string;
  multiArg: boolean;
  style: Style;
  image: string;
  parenthesizeArg: boolean;
  abstractionHandle: "lambda-symbol" | "connector";
};

export const langData: {
  [key in Lang]: LangInfo;
} = {
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
