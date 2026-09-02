/** A single control in a component's visual style spec. Controls are labeled by
 *  what they visually DO in that component ("Focus ring"), not by the CSS
 *  variable they happen to drive — the variable is an implementation detail the
 *  person restyling a Button should not have to learn. */
export type ColorControl = { type: 'color'; label: string; token: string };
export type RadiusControl = { type: 'radius'; label: string };
export type StyleControl = ColorControl | RadiusControl;

/** A map of CSS custom property → value, as applied to the preview element. */
export type TokenMap = Record<string, string>;
