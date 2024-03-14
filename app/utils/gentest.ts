function* gen() {
  yield 1;
  yield 2;
  yield 3;
  yield 4;
  yield 5;
}

let a = gen();
for (let c of a) {
  console.log("c=", c);
  for (let d of a) {
    console.log("c,d =", c, d);
    break;
  }
}
