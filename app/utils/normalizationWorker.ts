import { TermInfo } from "./otherTypes";
import { Term, normalNormalization } from "./term";

async function handleEvent(event: MessageEvent) {
  const term: Term = event.data;

  const result: TermInfo[] = [{ term }];

  for (const { reduced, targetPath } of normalNormalization(term)) {
    result[result.length - 1]!.targetPath = targetPath;
    result.push({ term: reduced });
  }

  postMessage(result);
  close();
}

addEventListener("message", handleEvent);
