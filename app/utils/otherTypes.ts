import { Term } from "./term";

export type TermInfo = {
  term: Term;
  targetPath?: string;
  reducedFuncPath?: string;
  reducedBodyPaths?: Set<string>;
};

export type NonEmptyList<T> = [T, ...T[]];
