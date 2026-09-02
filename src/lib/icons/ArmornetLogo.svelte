<script lang="ts" module>
	import { CREST_MESH_GEOMETRY, type CrestMeshShape } from './ArmornetCrestMesh.svelte';

	/**
	 * WHICH shield is the brand, as a value rather than as a string typed at a
	 * call site.
	 *
	 * Anything that needs the mark's actual OUTLINE — the pipeline scene lands
	 * its rails on the crest's wall — has to read the same silhouette this
	 * component renders, and `CREST_MESH_GEOMETRY.crestkey` written out there
	 * would be a second vote on the logo. Import these instead.
	 */
	export const LOGO_SHAPE: CrestMeshShape = 'crestkey';
	export const LOGO_GEOMETRY = CREST_MESH_GEOMETRY[LOGO_SHAPE];
</script>

<script lang="ts">
	/**
	 * THE Armornet logo. Header, footer, hero, favicon — everything that means
	 * "this product" renders this component and nothing else.
	 *
	 * It is deliberately thin: `ArmornetCrestMesh` owns all the geometry and can
	 * draw twenty-six shields, and this file's whole job is to say WHICH ONE is
	 * the brand. That choice was made once and it does not belong at the call
	 * site — `shape="crestkey"` copied into the header, the footer and the hero
	 * is three votes on the logo, and the next tweak only wins two of them.
	 *
	 * So: never write `<ArmornetCrestMesh shape="crestkey">` in an app. Import
	 * this. `ArmornetCrestMesh` stays what it is — the studio for choosing a
	 * shield — and this is the decision that came out of it.
	 */
	import ArmornetCrestMesh from './ArmornetCrestMesh.svelte';

	interface ArmornetLogoProps {
		size?: number;
		/** The whole mark. Monochrome by design — one colour, one weight. */
		color?: string;
		/**
		 * 'filled' inverts it: a solid shield with the figure punched through to
		 * whatever is behind, so a dark-on-light lockup needs no second asset.
		 */
		variant?: 'outline' | 'filled';
		/** The hairline inside the shield wall. Drop it below ~32px — it silts up. */
		innerWall?: boolean;
		/** Blurred underlay. Atmosphere; off for anything that has to reproduce flat. */
		glow?: boolean;
		title?: string;
		class?: string;
		style?: string;
	}

	let {
		size = 64,
		color = 'var(--accent)',
		variant = 'outline',
		innerWall = true,
		glow = true,
		title = 'Armornet',
		class: cls = '',
		style = ''
	}: ArmornetLogoProps = $props();
</script>

<ArmornetCrestMesh
	shape={LOGO_SHAPE}
	{size}
	{color}
	{variant}
	{innerWall}
	{glow}
	{title}
	class={cls}
	{style}
/>
