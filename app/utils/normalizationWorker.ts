import { Term, normalNormalization } from "./term";

async function handleEvent(event: MessageEvent) {
  const term: Term = event.data;

  const result = [];

  for (const step of normalNormalization(term)) {
    result.push(step);
  }

  postMessage(result);
  close();
}

addEventListener("message", handleEvent);
