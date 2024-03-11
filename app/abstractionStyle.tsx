/**
 * @argument x the variable name
 */
export function abstractionStyle(x: string) {
  return (
    <style jsx global>
      {`
        .abstr-${x}:is(:has(.var-${x}:hover):not(:has(.abstr-${x}:hover)),:has(>.abstraction-handle:hover))
          .var-${x}:not(.abstr-${x}:not(:hover) .var-${x}) {
          color: green;
          &.bind {
            border-bottom: 1px solid green;
          }
        }
      `}
    </style>
  );
}
