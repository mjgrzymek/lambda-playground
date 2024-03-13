/*
display:inline button because of cursed <button> behavior
see
  https://github.com/w3c/csswg-drafts/issues/3226
  https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/button_role
  https://www.w3.org/WAI/ARIA/apg/patterns/button/examples/button/
*/

function InlineButton(props: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <span
      className={props.className}
      role="button"
      tabIndex={0}
      onClick={props.onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          props.onClick();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " ") {
          event.preventDefault();
          props.onClick();
        }
      }}
    >
      {props.children}
    </span>
  );
}

export default InlineButton;
