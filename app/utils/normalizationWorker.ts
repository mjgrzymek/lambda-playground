import { TermInfo } from "./otherTypes";
import { Term, normalNormalization } from "./term";

async function handleEvent(event: MessageEvent<TermInfo>) {
  const termInfo = event.data;

  const result: TermInfo[] = [termInfo];

  for (const { reduced, targetPath, reducedBodyPaths } of normalNormalization(
    termInfo.term,
  )) {
    result[result.length - 1]!.targetPath = targetPath;
    result.push({
      term: reduced,
      reducedFuncPath: targetPath,
      reducedBodyPaths,
    });
  }

  postMessage(result);
  close();
}

addEventListener("message", handleEvent);
