<script lang="ts">
	export interface FaqItem {
		q: string;
		a: string;
	}

	interface Props {
		items: FaqItem[];
		class?: string;
	}

	let { items, class: cls = '' }: Props = $props();

	let openIndex = $state<number | null>(null);

	function toggle(i: number) {
		openIndex = openIndex === i ? null : i;
	}
</script>

<div class="flex flex-col border border-[rgba(94,234,212,0.12)] r-inset overflow-hidden {cls}">
	{#each items as item, i}
		{@const isOpen = openIndex === i}
		<div class="border-b border-[rgba(94,234,212,0.08)] last:border-b-0">
			<button
				class="flex items-center justify-between w-full px-6 py-5 bg-transparent border-0 cursor-pointer text-left gap-4 transition-colors duration-200 hover:bg-[rgba(94,234,212,0.04)] {isOpen ? 'bg-[rgba(94,234,212,0.04)]' : ''}"
				type="button"
				aria-expanded={isOpen}
				onclick={() => toggle(i)}
			>
				<span class="font-[var(--sans-brand)] text-base font-semibold text-[var(--fg)] leading-[1.4]">{item.q}</span>
				<span class="font-[var(--mono)] text-xl text-[var(--accent)] shrink-0 leading-none" aria-hidden="true">{isOpen ? '−' : '+'}</span>
			</button>
			<div
				class="grid transition-[grid-template-rows] duration-[250ms] ease-in-out"
				style:grid-template-rows={isOpen ? '1fr' : '0fr'}
			>
				<div class="overflow-hidden">
					<div class="px-6 pb-5 text-[0.9375rem] text-[var(--fg-dim)] leading-[1.65]">{item.a}</div>
				</div>
			</div>
		</div>
	{/each}
</div>
