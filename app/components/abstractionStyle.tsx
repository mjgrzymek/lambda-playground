export function abstractionStyle(variableName: string) {
  const x = variableName;
  // <div className="bg-lime-600"> </div>;
  return (
    <style jsx global>
      {`
        .abstr-${x}:is(:has(.var-${x}:hover):not(:has(.abstr-${x}:hover)),:has(>.abstraction-handle:hover))
          .var-${x}:not(.abstr-${x}:not(:hover) .var-${x}) {
          color: rgb(101 163 13);
          &.bind {
            border-bottom: 1px solid rgb(101 163 13);
          }
        }
      `}
    </style>
  );
}
