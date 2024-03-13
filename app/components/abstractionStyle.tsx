export function abstractionStyle(variableName: string) {
  const x = variableName;
  // #0284c7 = sky-600
  return (
    <style jsx global>
      {`
        .abstr-${x}:is(:has(.var-${x}:hover):not(:has(.abstr-${x}:hover)),:has(>.abstraction-handle:hover))
          .var-${x}:not(.abstr-${x}:not(:hover) .var-${x}) {
          color: #0284c7;
          &.bind {
            border-bottom: 1px solid #0284c7;
          }
        }
      `}
    </style>
  );
}
