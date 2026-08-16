<script lang="ts">
	import ShowcaseBlock from '$lib/dev/ShowcaseBlock.svelte';
	import Card from '$lib/primitives/cards/Card.svelte';
	import CardStack from '$lib/primitives/chrome/CardStack.svelte';
	import type { CardType, DataInputField, DataInputInfoRow, SummaryItem } from '$lib/primitives/cards/Card.svelte';

	let cardType = $state<CardType>('composite');
	let cardShowStack = $state(false);

	const cardContactFields: DataInputField[] = [
		{ type: 'text', label: 'Name', name: 'name', placeholder: 'Your name', required: true },
		{ type: 'email', label: 'Work email', name: 'email', placeholder: 'name@company.com', required: true },
		{ type: 'text', label: 'Company', name: 'company', placeholder: 'Company name' },
		{
			type: 'select',
			label: 'Stage',
			name: 'stage',
			options: ['Pre-seed / Seed', 'Series A', 'Series B', 'Series C+', 'Other']
		},
		{
			type: 'textarea',
			label: 'What triggered the conversation?',
			name: 'trigger',
			placeholder: 'SOC 2 deadline, enterprise diligence, pen test request…',
			span: 2,
			rows: 3
		}
	];

	const cardInfoRows: DataInputInfoRow[] = [
		{ icon: '@', sublabel: 'Direct', value: 'engage@armornet.io', variant: 'accent' },
		{ icon: '⌖', sublabel: 'Response window', value: 'Same-day, every weekday', variant: 'cyan' },
		{ icon: '⏚', sublabel: 'Starting point', value: 'A 30-minute exposure brief', variant: 'emerald' }
	];

	const summaryItems: SummaryItem[] = [
		{ label: 'Total', value: 24, variant: 'default' },
		{ label: 'Healthy', value: 19, variant: 'success' },
		{ label: 'Degraded', value: 3, variant: 'warn' },
		{ label: 'Offline', value: 2, variant: 'error', highlight: true }
	];
</script>

<svelte:head>
	<title>Cards — UI Lib</title>
</svelte:head>

<div class="px-3 sm:px-6 py-4 sm:py-5">
	<ShowcaseBlock component="Card CardStack">
		<h3 class="component-name">Card · CardStack</h3>
		<p class="component-desc">Seven card types from a single <code class="demo-code">Card</code> component: <strong>composite</strong> (marketing feature card), <strong>article</strong> (blog/content), <strong>data-input</strong> (form or info rows), <strong>profile</strong> (team member), <strong>stat</strong> (metric with corner brackets), <strong>doc</strong> (document index card), <strong>summary</strong> (mini-stat row). Wrap multiple cards in <code class="demo-code">CardStack</code> for vertical list layout. Use the TYPE and LAYOUT controls below to explore all variants.</p>

		<div class="blade-ctrl">
			<div class="bc-group">
				<span class="bc-label">TYPE</span>
				<div class="bc-btns">
					<button
						class="bc-btn bc-btn--icon"
						class:bc-active={cardType === 'composite'}
						title="Composite"
						onclick={() => (cardType = 'composite')}
					>
						<svg width="32" height="22" viewBox="0 0 32 22" fill="none" stroke="currentColor" aria-hidden="true">
							<rect x="0.5" y="0.5" width="31" height="21" rx="1" stroke-width="0.75"/>
							<line x1="3" y1="4.5" x2="13" y2="4.5" stroke-width="1.5"/>
							<line x1="3" y1="8" x2="14" y2="8" stroke-width="0.75"/>
							<line x1="3" y1="11" x2="12" y2="11" stroke-width="0.75"/>
							<line x1="3" y1="14" x2="13" y2="14" stroke-width="0.75"/>
							<line x1="18" y1="2" x2="18" y2="20" stroke-width="0.5" stroke-dasharray="1.5 1.5"/>
							<rect x="20" y="3.5" width="9" height="4" rx="0.5" stroke-width="0.75"/>
							<rect x="20" y="9" width="9" height="4" rx="0.5" stroke-width="0.75"/>
							<rect x="20" y="14.5" width="9" height="4" rx="0.5" stroke-width="0.75"/>
						</svg>
					</button>
					<button
						class="bc-btn bc-btn--icon bc-btn--tall"
						class:bc-active={cardType === 'article'}
						title="Article"
						onclick={() => (cardType = 'article')}
					>
						<svg width="18" height="26" viewBox="0 0 18 26" fill="none" stroke="currentColor" aria-hidden="true">
							<rect x="0.5" y="0.5" width="17" height="25" rx="1" stroke-width="0.75"/>
							<rect x="0.5" y="0.5" width="17" height="9" rx="1" fill="currentColor" fill-opacity="0.12" stroke-width="0"/>
							<line x1="0.5" y1="9.5" x2="17.5" y2="9.5" stroke-width="0.5"/>
							<line x1="2.5" y1="12" x2="9" y2="12" stroke-width="0.6"/>
							<line x1="2.5" y1="15" x2="15.5" y2="15" stroke-width="1.25"/>
							<line x1="2.5" y1="17.5" x2="13" y2="17.5" stroke-width="1.25"/>
							<line x1="2.5" y1="20" x2="15.5" y2="20" stroke-width="0.6"/>
							<rect x="2.5" y="22.5" width="3.5" height="2" rx="0.3" stroke-width="0.5"/>
							<line x1="7.5" y1="23.5" x2="13" y2="23.5" stroke-width="0.6"/>
						</svg>
					</button>
					<button
						class="bc-btn bc-btn--icon"
						class:bc-active={cardType === 'data-input'}
						title="Data Input"
						onclick={() => (cardType = 'data-input')}
					>
						<svg width="28" height="24" viewBox="0 0 28 24" fill="none" stroke="currentColor" aria-hidden="true">
							<rect x="0.5" y="0.5" width="27" height="23" rx="1" stroke-width="0.75"/>
							<line x1="3" y1="4" x2="8" y2="4" stroke-width="0.6"/>
							<line x1="3" y1="6.5" x2="15" y2="6.5" stroke-width="1.25"/>
							<rect x="3" y="9.5" width="9" height="3" rx="0.4" stroke-width="0.7"/>
							<rect x="14" y="9.5" width="11" height="3" rx="0.4" stroke-width="0.7"/>
							<rect x="3" y="14" width="9" height="3" rx="0.4" stroke-width="0.7"/>
							<rect x="14" y="14" width="11" height="3" rx="0.4" stroke-width="0.7"/>
							<rect x="3" y="18.5" width="22" height="3" rx="0.4" fill="currentColor" fill-opacity="0.2" stroke-width="0.7"/>
						</svg>
					</button>
					<button
						class="bc-btn bc-btn--icon"
						class:bc-active={cardType === 'profile'}
						title="Profile"
						onclick={() => (cardType = 'profile')}
					>
						<svg width="32" height="22" viewBox="0 0 32 22" fill="none" stroke="currentColor" aria-hidden="true">
							<rect x="0.5" y="0.5" width="31" height="21" rx="1" stroke-width="0.75"/>
							<rect x="3" y="4" width="8" height="8" rx="0.5" stroke-width="0.75"/>
							<line x1="14" y1="5.5" x2="28" y2="5.5" stroke-width="1.25"/>
							<line x1="14" y1="8.5" x2="24" y2="8.5" stroke-width="0.7"/>
							<line x1="14" y1="11.5" x2="27" y2="11.5" stroke-width="0.5"/>
							<rect x="3" y="14.5" width="5" height="2.5" rx="0.4" stroke-width="0.5"/>
							<rect x="9.5" y="14.5" width="5" height="2.5" rx="0.4" stroke-width="0.5"/>
							<rect x="16" y="14.5" width="5" height="2.5" rx="0.4" stroke-width="0.5"/>
						</svg>
					</button>
					<button
						class="bc-btn bc-btn--icon"
						class:bc-active={cardType === 'stat'}
						title="Stat"
						onclick={() => (cardType = 'stat')}
					>
						<svg width="32" height="22" viewBox="0 0 32 22" fill="none" stroke="currentColor" aria-hidden="true">
							<rect x="0.5" y="0.5" width="31" height="21" rx="1" stroke-width="0.75"/>
							<line x1="2.5" y1="4.5" x2="2.5" y2="2.5" stroke-width="0.75"/>
							<line x1="2.5" y1="2.5" x2="5.5" y2="2.5" stroke-width="0.75"/>
							<line x1="29.5" y1="17.5" x2="29.5" y2="19.5" stroke-width="0.75"/>
							<line x1="29.5" y1="19.5" x2="26.5" y2="19.5" stroke-width="0.75"/>
							<line x1="8" y1="10" x2="24" y2="10" stroke-width="3.5"/>
							<line x1="11" y1="14.5" x2="21" y2="14.5" stroke-width="0.75"/>
						</svg>
					</button>
					<button
						class="bc-btn bc-btn--icon bc-btn--tall"
						class:bc-active={cardType === 'doc'}
						title="Doc"
						onclick={() => (cardType = 'doc')}
					>
						<svg width="18" height="26" viewBox="0 0 18 26" fill="none" stroke="currentColor" aria-hidden="true">
							<rect x="0.5" y="0.5" width="17" height="25" rx="1" stroke-width="0.75"/>
							<rect x="0.5" y="0.5" width="2" height="25" fill="currentColor" fill-opacity="0.25" stroke-width="0"/>
							<line x1="15.5" y1="3" x2="15.5" y2="4.5" stroke-width="0.75"/>
							<line x1="14" y1="3" x2="15.5" y2="3" stroke-width="0.75"/>
							<line x1="4" y1="6" x2="12" y2="6" stroke-width="0.6"/>
							<line x1="4" y1="11" x2="15.5" y2="11" stroke-width="1.25"/>
							<line x1="4" y1="14" x2="13" y2="14" stroke-width="1.25"/>
							<circle cx="5" cy="21.5" r="1" fill="currentColor" stroke-width="0"/>
							<line x1="7.5" y1="21.5" x2="14" y2="21.5" stroke-width="0.6"/>
						</svg>
					</button>
					<button
						class="bc-btn bc-btn--icon"
						class:bc-active={cardType === 'summary'}
						title="Summary"
						onclick={() => (cardType = 'summary')}
					>
						<svg width="36" height="20" viewBox="0 0 36 20" fill="none" stroke="currentColor" aria-hidden="true">
							<rect x="0.5" y="0.5" width="7" height="19" rx="0.75" stroke-width="0.75"/>
							<line x1="3" y1="9" x2="6" y2="9" stroke-width="2"/>
							<line x1="2.5" y1="13" x2="5.5" y2="13" stroke-width="0.6"/>
							<rect x="10.5" y="0.5" width="7" height="19" rx="0.75" stroke-width="0.75"/>
							<line x1="13" y1="9" x2="16" y2="9" stroke-width="2"/>
							<line x1="12.5" y1="13" x2="15.5" y2="13" stroke-width="0.6"/>
							<rect x="20.5" y="0.5" width="7" height="19" rx="0.75" stroke-width="0.75"/>
							<line x1="23" y1="9" x2="26" y2="9" stroke-width="2"/>
							<line x1="22.5" y1="13" x2="25.5" y2="13" stroke-width="0.6"/>
							<rect x="30.5" y="0.5" width="5" height="19" rx="0.75" stroke-width="0.75"/>
							<line x1="32" y1="9" x2="34" y2="9" stroke-width="2"/>
							<line x1="31.5" y1="13" x2="33.5" y2="13" stroke-width="0.6"/>
						</svg>
					</button>
				</div>
			</div>

			<span class="bc-sep"></span>

			<div class="bc-group">
				<span class="bc-label">LAYOUT</span>
				<div class="bc-btns">
					<button
						class="bc-btn bc-btn--icon"
						class:bc-active={!cardShowStack}
						title="Grid"
						onclick={() => (cardShowStack = false)}
					>
						<svg width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="currentColor" aria-hidden="true">
							<rect x="0.5" y="0.5" width="9" height="7" rx="0.75" stroke-width="0.75"/>
							<rect x="12.5" y="0.5" width="9" height="7" rx="0.75" stroke-width="0.75"/>
							<rect x="0.5" y="10.5" width="9" height="7" rx="0.75" stroke-width="0.75"/>
							<rect x="12.5" y="10.5" width="9" height="7" rx="0.75" stroke-width="0.75"/>
						</svg>
					</button>
					<button
						class="bc-btn bc-btn--icon"
						class:bc-active={cardShowStack}
						title="Stack"
						onclick={() => (cardShowStack = true)}
					>
						<svg width="22" height="18" viewBox="0 0 22 18" fill="none" stroke="currentColor" aria-hidden="true">
							<rect x="0.5" y="0.5" width="21" height="4.5" rx="0.75" stroke-width="0.75"/>
							<rect x="0.5" y="6.75" width="21" height="4.5" rx="0.75" stroke-width="0.75"/>
							<rect x="0.5" y="13" width="21" height="4.5" rx="0.75" stroke-width="0.75"/>
						</svg>
					</button>
				</div>
			</div>

			<div class="card-type-subhead">
				{#if cardType === 'composite'}
					composite — main content + stacked action links · <code>split</code> controls column ratio
				{:else if cardType === 'article'}
					article — thumbnail zone + body · <code>thumbHeight</code> sets the media split · <code>href</code> makes it a link
				{:else if cardType === 'data-input'}
					data-input — <code>mode="form"</code> renders a dynamic field schema · <code>mode="info"</code> renders icon rows
				{:else if cardType === 'profile'}
					profile — avatar + bio + tag chips · composes into a <code>CardStack</code>
				{:else if cardType === 'stat'}
					stat — metric display with <code>statVariant</code> and <code>size</code> · TL/BR corner brackets
				{:else if cardType === 'doc'}
					doc — document card with left edge bar · <code>onclick</code> makes it interactive · <code>docStatus</code> controls the meta dot
				{:else if cardType === 'summary'}
					summary — full-width grid of metric mini-cards from <code>summaryItems</code> · <code>summaryColumns</code> overrides the auto count
				{/if}
			</div>
		</div>

		{#if cardType === 'composite'}
			{#if cardShowStack}
				<CardStack gap="16px">
					<Card
						type="composite"
						variant="cyan"
						eyebrow="CONSULTING ENGAGEMENTS"
						title="Compliance, gap assessments, and pen testing — priced per engagement."
						description="SOC 2, ISO 27001/17/18, risk assessments, and penetration tests are scoped per engagement — not bundled into platform tiers."
						body="Every engagement begins with a 30-minute conversation. Fixed-scope written proposal with a fixed price inside 48 hours."
						items={[
							{ label: '→ COMPLIANCE', headline: 'SOC 2 · ISO 27001/17/18', variant: 'cyan' },
							{ label: '→ ASSESSMENT', headline: 'Two-week gap readout', variant: 'emerald' },
							{ label: '→ OFFENSIVE', headline: 'Risk & pen testing', variant: 'blue' }
						]}
					/>
					<Card
						type="composite"
						variant="emerald"
						eyebrow="PLATFORM SERVICES"
						title="Continuous coverage across every layer of your security posture."
						description="Compliance is the through-line. Email, awareness, and DNS are where most programs go dark."
						items={[
							{ label: '→ EMAIL', headline: 'SPF · DKIM · DMARC', variant: 'accent' },
							{ label: '→ DNS', headline: 'Threat filtering', variant: 'blue' }
						]}
						split={[8, 4]}
					/>
				</CardStack>
			{:else}
				<div class="card-demo-stack">
					<Card
						type="composite"
						variant="cyan"
						eyebrow="CONSULTING ENGAGEMENTS"
						title="Compliance, gap assessments, and pen testing — priced per engagement."
						description="SOC 2, ISO 27001/17/18, risk assessments, and penetration tests are scoped per engagement — not bundled into platform tiers."
						body="Every engagement begins with a 30-minute conversation. Fixed-scope written proposal with a fixed price inside 48 hours."
						items={[
							{ label: '→ COMPLIANCE', headline: 'SOC 2 · ISO 27001/17/18', variant: 'cyan' },
							{ label: '→ ASSESSMENT', headline: 'Two-week gap readout', variant: 'emerald' },
							{ label: '→ OFFENSIVE', headline: 'Risk & pen testing', variant: 'blue' }
						]}
					/>
					<Card
						type="composite"
						variant="emerald"
						eyebrow="PLATFORM SERVICES"
						title="Continuous coverage across every layer of your security posture."
						description="Compliance is the through-line. Email, awareness, and DNS are where most programs go dark."
						items={[
							{ label: '→ EMAIL', headline: 'SPF · DKIM · DMARC', variant: 'accent' },
							{ label: '→ DNS', headline: 'Threat filtering', variant: 'blue' }
						]}
						split={[8, 4]}
					/>
				</div>
			{/if}
		{:else if cardType === 'article'}
			{#if cardShowStack}
				<CardStack gap="16px">
					<Card type="article" variant="cyan" index={1} category="COMPLIANCE" readTime="8 MIN READ"
						title="Why your SOC 2 Type I won't survive enterprise diligence."
						excerpt="Type I tells procurement you exist. Type II tells them you operate. Here's why the gap matters more than the certificate."
						author={{ initials: 'AK', name: 'Operator 01', date: '2026-05-01' }} href="#" />
					<Card type="article" variant="emerald" index={2} category="EMAIL SECURITY" readTime="6 MIN READ"
						title="DMARC at p=reject: the 90-day path most companies skip."
						excerpt="Parked at p=none for two years isn't policy — it's procrastination. A practical migration plan with the gotchas we hit in the field."
						author={{ initials: 'SP', name: 'Operator 03', date: '2026-04-18' }} href="#" />
					<Card type="article" variant="blue" index={3} category="PENETRATION TESTING" readTime="12 MIN READ"
						title="Five IAM misconfigurations we find on every cloud pen test."
						excerpt="Anonymized findings from the last twelve engagements. The same five patterns show up."
						author={{ initials: 'MR', name: 'Operator 02', date: '2026-03-30' }} href="#" />
				</CardStack>
			{:else}
				<div class="card-grid-3">
					<Card type="article" variant="cyan" index={1} category="COMPLIANCE" readTime="8 MIN READ"
						title="Why your SOC 2 Type I won't survive enterprise diligence."
						excerpt="Type I tells procurement you exist. Type II tells them you operate. Here's why the gap matters more than the certificate."
						author={{ initials: 'AK', name: 'Operator 01', date: '2026-05-01' }} href="#" />
					<Card type="article" variant="emerald" index={2} category="EMAIL SECURITY" readTime="6 MIN READ"
						title="DMARC at p=reject: the 90-day path most companies skip."
						excerpt="Parked at p=none for two years isn't policy — it's procrastination. A practical migration plan with the gotchas we hit in the field."
						author={{ initials: 'SP', name: 'Operator 03', date: '2026-04-18' }} href="#" />
					<Card type="article" variant="blue" index={3} category="PENETRATION TESTING" readTime="12 MIN READ"
						title="Five IAM misconfigurations we find on every cloud pen test."
						excerpt="Anonymized findings from the last twelve engagements. The same five patterns show up."
						author={{ initials: 'MR', name: 'Operator 02', date: '2026-03-30' }} href="#" />
				</div>
			{/if}
		{:else if cardType === 'data-input'}
			{#if cardShowStack}
				<CardStack gap="16px">
					<Card type="data-input" mode="form" variant="accent"
						eyebrow="INTAKE — SECURE CHANNEL" title="Start the conversation." status="LIVE"
						fields={cardContactFields} submitLabel="Transmit · Talk to Armornet" />
					<Card type="data-input" mode="info" variant="cyan"
						eyebrow="CONTACT" title="Reach us directly." rows={cardInfoRows} />
				</CardStack>
			{:else}
				<div class="card-grid-2">
					<Card type="data-input" mode="form" variant="accent"
						eyebrow="INTAKE — SECURE CHANNEL" title="Start the conversation." status="LIVE"
						fields={cardContactFields} submitLabel="Transmit · Talk to Armornet" />
					<Card type="data-input" mode="info" variant="cyan"
						eyebrow="CONTACT" title="Reach us directly." rows={cardInfoRows} />
				</div>
			{/if}
		{:else if cardType === 'profile'}
			{#if cardShowStack}
				<CardStack gap="12px">
					<Card type="profile" variant="emerald" initials="SP" name="Operator 03" role="Platform Engineer"
						bio="Eight years building email security and DNS infrastructure at scale. Built the BEC detection pipeline at a previous unicorn SaaS."
						tags={['EMAIL · DNS', 'AWS SECURITY', 'CCSP']} />
					<Card type="profile" variant="cyan" initials="AK" name="Operator 01" role="Compliance Lead"
						bio="Led SOC 2 and ISO 27001 engagements across fintech and healthcare. Former Big 4 auditor with a practitioner's mentality."
						tags={['SOC 2', 'ISO 27001', 'CISA']} />
					<Card type="profile" variant="blue" initials="MR" name="Operator 02" role="Offensive Security"
						bio="Ten years in red team ops and cloud pen testing. OSCP, cloud security certs, and a pattern library of IAM misconfigs a mile long."
						tags={['RED TEAM', 'CLOUD PEN TEST', 'OSCP']} />
					<Card type="profile" variant="accent" initials="JL" name="Operator 04" role="Risk & Governance"
						bio="GRC practitioner focused on ISO and NIST alignment for Series A–C companies entering regulated markets."
						tags={['NIST', 'ISO 27001', 'CRISC']} />
				</CardStack>
			{:else}
				<div class="card-grid-2">
					<Card type="profile" variant="emerald" initials="SP" name="Operator 03" role="Platform Engineer"
						bio="Eight years building email security and DNS infrastructure at scale. Built the BEC detection pipeline at a previous unicorn SaaS."
						tags={['EMAIL · DNS', 'AWS SECURITY', 'CCSP']} />
					<Card type="profile" variant="cyan" initials="AK" name="Operator 01" role="Compliance Lead"
						bio="Led SOC 2 and ISO 27001 engagements across fintech and healthcare. Former Big 4 auditor with a practitioner's mentality."
						tags={['SOC 2', 'ISO 27001', 'CISA']} />
					<Card type="profile" variant="blue" initials="MR" name="Operator 02" role="Offensive Security"
						bio="Ten years in red team ops and cloud pen testing. OSCP, cloud security certs, and a pattern library of IAM misconfigs a mile long."
						tags={['RED TEAM', 'CLOUD PEN TEST', 'OSCP']} />
					<Card type="profile" variant="accent" initials="JL" name="Operator 04" role="Risk & Governance"
						bio="GRC practitioner focused on ISO and NIST alignment for Series A–C companies entering regulated markets."
						tags={['NIST', 'ISO 27001', 'CRISC']} />
				</div>
			{/if}
		{:else if cardType === 'stat'}
			{#if cardShowStack}
				<CardStack gap="8px">
					<Card type="stat" statVariant="default" label="Vendors" value="14" size="md" />
					<Card type="stat" statVariant="accent" label="Compliant" value="9" size="md" />
					<Card type="stat" statVariant="warn" label="Due Soon" value="3" size="md" />
					<Card type="stat" statVariant="error" label="Critical" value="2" size="md" />
					<Card type="stat" statVariant="dim" label="No Assessment" value="5" size="md" />
				</CardStack>
			{:else}
				<div class="stat-demo-grid">
					<div class="stat-row">
						<Card type="stat" statVariant="default" label="Vendors" value="14" size="sm" />
						<Card type="stat" statVariant="accent" label="Compliant" value="9" size="sm" />
						<Card type="stat" statVariant="warn" label="Due Soon" value="3" size="sm" />
						<Card type="stat" statVariant="error" label="Critical" value="2" size="sm" />
						<Card type="stat" statVariant="dim" label="No Assessment" value="5" size="sm" />
					</div>
					<div class="stat-row">
						<Card type="stat" statVariant="default" label="Vendors" value="14" size="md" />
						<Card type="stat" statVariant="error" label="Critical" value="2" size="md" />
						<Card type="stat" statVariant="accent" label="Uptime" value="99.9%" size="md" />
					</div>
					<div class="stat-row" style="flex-direction: column; align-items: flex-start; gap: 0.5rem">
						<Card type="stat" statVariant="default" label="Vendors" value="14" size="md-long" />
						<Card type="stat" statVariant="warn" label="Due Soon" value="3" size="md-long" />
						<Card type="stat" statVariant="error" label="Critical" value="2" size="md-long" />
					</div>
					<div class="stat-row">
						<Card type="stat" statVariant="default" label="Vendors" value="14" size="lg" />
						<Card type="stat" statVariant="error" label="Critical" value="2" size="lg" />
						<Card type="stat" statVariant="warn" label="Due Soon" value="3" size="lg" />
					</div>
					<div class="stat-row">
						<Card type="stat" statVariant="accent" label="Uptime" value="99.9%" size="xl" />
						<Card type="stat" statVariant="error" label="Offline" value="2" size="xl" />
					</div>
					<div class="stat-row">
						<Card type="stat" statVariant="dim" label="Custom" value="7" size="md"
							bracketColor="#c084fc" valueColor="#c084fc" labelColor="#c084fc" />
						<Card type="stat" statVariant="dim" label="Split" value="12" size="md"
							bracketColor="#60a5fa" valueColor="#f0f0f0" labelColor="#6c777e" />
						<Card type="stat" statVariant="dim" label="Brand" value="∞" size="md"
							bracketColor="var(--accent)" valueColor="#fff" labelColor="var(--fg-dim)" />
					</div>
				</div>
			{/if}
		{:else if cardType === 'doc'}
			{#if cardShowStack}
				<CardStack gap="12px">
					<Card type="doc" variant="accent" tag="ENG · 01" title="Agent Mesh Architecture"
						meta="DRAFT · 2026-05-13" docStatus="draft" />
					<Card type="doc" variant="cyan" tag="ENG · 02" title="Identity Broker Design"
						meta="ACTIVE · 2026-04-22" docStatus="active" />
					<Card type="doc" variant="emerald" tag="SEC · 01" title="Incident Response Plan"
						meta="APPROVED · 2026-03-10" docStatus="approved" />
					<Card type="doc" variant="blue" tag="ENG · 03" title="Web Application Firewall"
						meta="DRAFT · 2026-05-01" docStatus="draft" />
					<Card type="doc" variant="accent" tag="MKT · 01" title="Quickstart Guide"
						meta="ACTIVE · 2026-05-16" docStatus="active"
						onclick={() => alert('clicked: quickstart')} />
					<Card type="doc" variant="emerald" tag="RISK · 04" title="Third-Party Risk Management"
						meta="APPROVED · 2026-02-28" docStatus="approved"
						onclick={() => alert('clicked: tprm')} />
				</CardStack>
			{:else}
				<div class="card-grid-3" style="grid-template-columns: repeat(4, 1fr)">
					<Card type="doc" variant="accent" tag="ENG · 01" title="Agent Mesh Architecture"
						meta="DRAFT · 2026-05-13" docStatus="draft" />
					<Card type="doc" variant="cyan" tag="ENG · 02" title="Identity Broker Design"
						meta="ACTIVE · 2026-04-22" docStatus="active" />
					<Card type="doc" variant="emerald" tag="SEC · 01" title="Incident Response Plan"
						meta="APPROVED · 2026-03-10" docStatus="approved" />
					<Card type="doc" variant="blue" tag="ENG · 03" title="Web Application Firewall"
						meta="DRAFT · 2026-05-01" docStatus="draft" />
				</div>
				<div class="card-grid-2" style="margin-top: 12px">
					<Card type="doc" variant="accent" tag="MKT · 01" title="Quickstart Guide"
						meta="ACTIVE · 2026-05-16" docStatus="active"
						onclick={() => alert('clicked: quickstart')} />
					<Card type="doc" variant="emerald" tag="RISK · 04" title="Third-Party Risk Management"
						meta="APPROVED · 2026-02-28" docStatus="approved"
						onclick={() => alert('clicked: tprm')} />
				</div>
			{/if}
		{:else if cardType === 'summary'}
			<Card type="summary" summaryItems={summaryItems} />
			<div class="demo-spacer"></div>
			<Card type="summary" summaryColumns={3}
				summaryItems={[
					{ label: 'Warm', value: 12, variant: 'success' },
					{ label: 'Cold', value: 4, variant: 'default' },
					{ label: 'Failed', value: 1, variant: 'error', highlight: true }
				]} />
		{/if}
	</ShowcaseBlock>
</div>

<style>
	.demo-code {
		font-family: var(--mono);
		font-size: 0.78em;
		background: var(--surface-strong);
		border: 1px solid var(--border);
		padding: 0.1rem 0.35rem;
		border-radius: 3px;
		color: var(--fg-muted);
	}

	.demo-spacer {
		height: 0.75rem;
	}

	.blade-ctrl {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 12px;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.25);
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 3px;
	}
	.bc-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bc-label {
		font-family: var(--mono);
		font-size: 0.5rem;
		letter-spacing: 0.2em;
		color: var(--fg-muted, rgba(156, 163, 175, 0.45));
	}
	.bc-btns {
		display: flex;
		gap: 4px;
	}
	.bc-sep {
		width: 1px;
		height: 44px;
		background: rgba(255, 255, 255, 0.07);
		flex-shrink: 0;
		align-self: center;
	}
	.bc-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 2px;
		background: transparent;
		color: var(--fg-dim);
		cursor: pointer;
		padding: 0;
		transition:
			color 0.15s,
			border-color 0.15s,
			background 0.15s;
	}
	.bc-btn:hover {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.4);
		background: rgba(94, 234, 212, 0.06);
	}
	.bc-btn.bc-active {
		color: var(--accent);
		border-color: rgba(94, 234, 212, 0.5);
		background: rgba(94, 234, 212, 0.1);
	}
	.bc-btn--icon {
		width: auto;
		min-width: 44px;
		height: 36px;
		padding: 0 8px;
	}
	.bc-btn--tall {
		height: 42px;
	}
	.card-type-subhead {
		font-family: var(--mono);
		font-size: 0.625rem;
		letter-spacing: 0.08em;
		color: var(--fg-dim);
		margin-left: 8px;
		align-self: center;
		line-height: 1.6;
	}
	.card-type-subhead code {
		font-family: var(--mono);
		color: var(--accent);
		background: rgba(94, 234, 212, 0.08);
		padding: 0.05em 0.3em;
		border-radius: 2px;
	}

	.card-grid-3 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
		align-items: start;
	}
	.card-grid-2 {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 16px;
		align-items: start;
	}
	.card-demo-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.stat-demo-grid {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}
	.stat-row {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: flex-start;
	}
</style>
