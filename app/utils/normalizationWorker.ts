import { Term, normalNormalization } from "./term";

addEventListener("message", async (event) => {
  const term: Term = event.data;

  const result = [];

  for (const step of normalNormalization(term)) {
    result.push(step);
  }

  postMessage(result);
  close();
});
