/**
 * The contract every renderer in this folder speaks.
 *
 * A renderer turns one canvas item — a registry id plus an untyped prop bag —
 * into the real component. It never reaches into the builder store, so the same
 * renderers drive the builder canvas, the scene stage, the palette thumbnails
 * and the theme studio preview.
 */
export interface RendererProps {
	/** Registry id of the component to render (`ComponentMeta.id`). */
	componentId: string;
	/** Raw prop bag as edited in the builder — values are unvalidated. */
	props: Record<string, unknown>;
	/** Laid-out width in px. `0` when the caller lets the component size itself. */
	w: number;
	/** Laid-out height in px. `0` when the caller lets the component size itself. */
	h: number;
}
