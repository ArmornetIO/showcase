/**
 * Parks a floating panel on <body>. A `position: fixed` panel is still clipped
 * by an `overflow` ancestor that is transformed or filtered (that ancestor
 * becomes its containing block), which is how a rail's Filter menu opened
 * half-hidden behind the rail. On <body>, viewport coordinates mean what they say.
 *
 * Inside an open modal <dialog> it parks on the dialog instead: showModal()
 * puts the dialog in the top layer and makes the rest of the page inert, so a
 * panel on <body> opens behind it and cannot be clicked. That is why every
 * Select in a Modal was dead. The dialog must stay untransformed at rest
 * (Modal's entry animation fills `backwards`) for the coordinates to hold.
 */
export function portal(node: HTMLElement) {
  (node.parentElement?.closest('dialog[open]') ?? document.body).appendChild(node);
  return {
    destroy() {
      node.remove();
    },
  };
}
