<script lang="ts">
	// ── Assess step, noise pass ───────────────────────────────────────────────
	// The step reads as "a fancy form" because the Assessment card spends most of
	// its pixels on chrome rather than on the five judgements it actually asks
	// for. Toggle between the shipped rendering and the trimmed one to see what
	// each change buys. No API — this reads the real risk-model so the numbers
	// and the derivation chain are the live ones.
	import Icon from '$lib/icons/Icon.svelte';
	import ActionsMenu, { type ActionMenuItem } from '$lib/primitives/ActionsMenu.svelte';
	import Avatar from '$lib/display/Avatar.svelte';
	import SteppedProgress from '$lib/display/progress/SteppedProgress.svelte';
	import {
		ASSETS,
		CIA_META,
		DATA_CLASSES,
		DATA_MAP,
		LEVELS,
		LEVEL_ABBR,
		LEVEL_HUE,
		LEVEL_LABEL,
		SCOPES,
		STATUS_META,
		TIER_HUE,
		appetiteVerdict,
		assess,
		idx,
		suggestImpact,
		type AppetiteView,
		type AssetCategory,
		type CIA,
		type DataClass,
		type Level,
		type Scope
	} from '$lib/risk/risk-model.js';

	// The org's appetite, as the register hands it to the editor.
	const appetite: AppetiteView = {
		global_max_residual: 'very_high',
		tolerance_max_residual: 'very_high',
		acceptance_expiry_days: 90,
		review_cadence_days: { very_low: 365, low: 180, moderate: 90, high: 30, very_high: 14 },
		overrides: []
	};

	let mode = $state<'shipped' | 'trimmed'>('trimmed');

	let fAssets = $state<AssetCategory[]>(['network']);
	let fDataClasses = $state<DataClass[]>(['confidential', 'pii', 'pci', 'phi']);
	let fScope = $state<Scope>('estate');
	let fCia = $state<CIA[]>(['confidentiality', 'availability']);
	let fInitiation = $state<Level>('high');
	let fSuccess = $state<Level>('moderate');
	let fImpact = $state<Level>('high');
	let fPreventive = $state<Level>('low');
	let fRecovery = $state<Level>('moderate');

	const preview = $derived(
		assess({
			likelihood_initiation: fInitiation,
			likelihood_success: fSuccess,
			impact: fImpact,
			preventive_effectiveness: fPreventive,
			recovery_effectiveness: fRecovery
		})
	);
	const verdict = $derived(appetiteVerdict(appetite, fAssets, preview.residual));
	const suggested = $derived(suggestImpact(fDataClasses, fScope));
	const impactMatches = $derived(fImpact === suggested.level);
	const suggestedReason = $derived(
		`${DATA_MAP[suggested.driver].label} at ${SCOPES.find((s) => s.value === fScope)?.label.toLowerCase()} scope`
	);
	// What the controls actually bought. Zero is the interesting answer — the
	// shipped card renders two more scales and never says they changed nothing.
	const absorbed = $derived(idx(preview.inherent) - idx(preview.residual));

	/** Move a level one stop along the ordinal scale, clamped at both ends. */
	const bump = (l: Level, d: number): Level =>
		LEVELS[Math.max(0, Math.min(LEVELS.length - 1, idx(l) + d))];

	const toggle = <T,>(list: T[], v: T): T[] =>
		list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

	const impactItems = $derived<ActionMenuItem[]>(
		LEVELS.map((l) => ({
			label: LEVEL_LABEL[l],
			selected: fImpact === l,
			color: `rgb(${LEVEL_HUE[l]})`,
			onclick: () => (fImpact = l)
		}))
	);
	const dataClassItems = $derived<ActionMenuItem[]>(
		DATA_CLASSES.map((d) => ({
			label: d.label,
			selected: fDataClasses.includes(d.value),
			color: `rgb(${TIER_HUE[d.tier]})`,
			onclick: () => (fDataClasses = toggle(fDataClasses, d.value))
		}))
	);
	const dataClassSummary = $derived(
		fDataClasses.length === 0
			? 'None'
			: fDataClasses.length === 1
				? DATA_MAP[fDataClasses[0]].label
				: `${DATA_MAP[fDataClasses[0]].label} +${fDataClasses.length - 1}`
	);

	const CHANGES = [
		['Scales become steppers', 'The level is ordinal, so it is one value you move — not five lettered buttons you pick from. 25 boxes and the VL/L/M/H/VH alphabet repeated five times both disappear; the word states the level and its hue states the severity.'],
		['One tab stop per judgement', 'The stepper is a spinbutton: focus it, ←/→ to move. The arrows are the mouse affordance, not the keyboard path.'],
		['Label moves inline', 'Each scale is one row instead of three. Five scales lose ten rows.'],
		['Outputs ride the band header', 'Three full-width “→ OVERALL LIKELIHOOD” ladders collapse into the band labels.'],
		['Citations stop shouting', 'G-5 / I-2 / org policy are provenance, not controls — dimmed off the accent.'],
		['One caption per band', 'Five permanent help sentences → three, phrased as the pair they describe.'],
		['Controls report their delta', '“absorbed 0 levels” is the one thing the controls band never said.']
	];
</script>

{#snippet lvlChip(l: Level)}
	<span class="lvl" style={`--h:${LEVEL_HUE[l]}`}>{LEVEL_LABEL[l]}</span>
{/snippet}

<!-- Shipped: label, five bordered buttons, a help sentence. Three rows each. -->
{#snippet scaleV1(label: string, help: string, value: Level, onpick: (l: Level) => void)}
	<div class="scale">
		<span class="field-label">{label}</span>
		<div class="scale-btns">
			{#each LEVELS as l (l)}
				<button
					type="button"
					class="scale-btn"
					class:scale-on={value === l}
					style={`--h:${LEVEL_HUE[l]}`}
					title={LEVEL_LABEL[l]}
					onclick={() => onpick(l)}>{LEVEL_ABBR[l]}</button
				>
			{/each}
		</div>
		<span class="scale-help">{help}</span>
	</div>
{/snippet}

<!-- Trimmed: a stepper, not a scale. Five rows of VL/L/M/H/VH is the same
     alphabet printed twenty-five times; the level is ordinal, so the control
     that fits it is one value you move up and down. The word replaces the
     letter, and the level's hue carries the severity the bar used to.
     One tab stop per judgement, ←/→ to move it — the arrows are the mouse
     affordance, not the keyboard path. -->
{#snippet stepper(label: string, hint: string, value: Level, onpick: (l: Level) => void)}
	{@const i = idx(value)}
	<div class="srow">
		<span class="srow-k" title={hint}>{label}</span>
		<div
			class="step"
			style={`--h:${LEVEL_HUE[value]}`}
			role="spinbutton"
			tabindex="0"
			aria-label={label}
			aria-valuemin={1}
			aria-valuemax={LEVELS.length}
			aria-valuenow={i + 1}
			aria-valuetext={LEVEL_LABEL[value]}
			title={hint}
			onkeydown={(e) => {
				const d =
					e.key === 'ArrowRight' || e.key === 'ArrowUp'
						? 1
						: e.key === 'ArrowLeft' || e.key === 'ArrowDown'
							? -1
							: 0;
				if (!d) return;
				e.preventDefault();
				onpick(bump(value, d));
			}}
		>
			<button
				type="button"
				class="step-b"
				disabled={i === 0}
				tabindex="-1"
				aria-hidden="true"
				onclick={() => onpick(bump(value, -1))}
			>
				<Icon name="chevron-left" size={12} />
			</button>
			<span class="step-v">{LEVEL_LABEL[value]}</span>
			<button
				type="button"
				class="step-b"
				disabled={i === LEVELS.length - 1}
				tabindex="-1"
				aria-hidden="true"
				onclick={() => onpick(bump(value, 1))}
			>
				<Icon name="chevron-right" size={12} />
			</button>
		</div>
	</div>
{/snippet}

<div class="page">
	<div class="modebar">
		<span class="mode-k">Assessment card</span>
		<div class="mode-seg">
			<button type="button" class:mode-on={mode === 'shipped'} onclick={() => (mode = 'shipped')}
				>Shipped</button
			>
			<button type="button" class:mode-on={mode === 'trimmed'} onclick={() => (mode = 'trimmed')}
				>Trimmed</button
			>
		</div>
		<span class="mode-note">
			{mode === 'shipped'
				? 'Five scales, five captions, three derived ladders, three accent citations.'
				: 'Same five judgements, same click targets — the chrome around them halved.'}
		</span>
	</div>

	<div class="wiz">
		<div class="stepbar">
			<SteppedProgress
				steps={['Define', 'Assess', 'Review', 'Treat']}
				current={4}
				active={1}
				stepVariants={['success', 'success', 'success', 'success']}
				onstep={() => {}}
				stepStyle="blocks"
				labelSize="sm"
				labelTone="bright"
				animate={false}
			/>
			<span class="step-hint">step 2 of 4</span>
		</div>

		<div class="cols">
			<main class="wiz-main">
				<!-- Unchanged — the blast radius card is not the noisy one. -->
				<section class="edit-card">
					<header class="edit-card-head">
						<Icon name="zap" size={14} /><span>Blast radius</span>
						<span class="edit-card-count"
							>{fAssets.length} asset · {SCOPES.find((s) => s.value === fScope)?.label.toLowerCase()}</span
						>
					</header>
					<div class="field mb-3">
						<span class="field-label"
							><Icon name="layers" size={11} /> What is exposed — asset categories</span
						>
						<div class="asset-grid">
							{#each ASSETS as a (a.value)}
								{@const on = fAssets.includes(a.value)}
								<button
									type="button"
									class="asset-btn"
									class:asset-on={on}
									onclick={() => (fAssets = toggle(fAssets, a.value))}
								>
									<span class="asset-icon" class:asset-icon-on={on}
										><Icon name={on ? 'check' : a.icon} size={15} /></span
									>
									<span class="asset-label">{a.label}</span>
									<span class="asset-blurb">appetite VH</span>
								</button>
							{/each}
						</div>
					</div>
					<div class="field">
						<span class="field-label"
							><Icon name="maximize" size={11} /> How much of the estate</span
						>
						<div class="scope-row">
							{#each SCOPES as s (s.value)}
								<button
									type="button"
									class="scope-btn"
									class:scope-on={fScope === s.value}
									onclick={() => (fScope = s.value)}
								>
									<Icon name={s.icon} size={13} />
									<span class="scope-l">{s.label}</span>
									<span class="scope-b">{s.blurb}</span>
								</button>
							{/each}
						</div>
					</div>
				</section>

				{#if mode === 'shipped'}
					<section class="edit-card" style={`--h:${LEVEL_HUE[preview.residual]}`}>
						<header class="edit-card-head">
							<Icon name="activity" size={14} /><span>Assessment</span>
							<span class="edit-card-count">NIST SP 800-30</span>
						</header>
						<div class="band-group">
							<span class="band-k"
								><Icon name="activity" size={10} /> Likelihood <i>Table G-5</i></span
							>
							<div class="scale-row">
								{@render scaleV1(
									'Likelihood of initiation',
									'How likely a threat starts down this path.',
									fInitiation,
									(l) => (fInitiation = l)
								)}
								{@render scaleV1(
									'Likelihood of success',
									'Given it starts, how likely it lands.',
									fSuccess,
									(l) => (fSuccess = l)
								)}
							</div>
							<div class="band-out">
								<Icon name="arrow-right" size={11} /><span class="derive-k">Overall likelihood</span
								>{@render lvlChip(preview.overall_likelihood)}
							</div>
						</div>
						<div class="band-group">
							<span class="band-k"><Icon name="zap" size={10} /> Impact <i>Table I-2</i></span>
							<div class="scale-row">
								{@render scaleV1(
									'Impact if successful',
									'The damage if the threat lands.',
									fImpact,
									(l) => (fImpact = l)
								)}
							</div>
							<div class="band-out">
								<Icon name="arrow-right" size={11} /><span class="derive-k">Inherent risk</span
								>{@render lvlChip(preview.inherent)}<span class="derive-note"
									>{LEVEL_ABBR[preview.overall_likelihood]} likelihood × {LEVEL_ABBR[fImpact]} impact
									— before controls</span
								>
							</div>
						</div>
						<div class="band-group">
							<span class="band-k"
								><Icon name="shield-check" size={10} /> Controls <i>org policy</i></span
							>
							<div class="scale-row">
								{@render scaleV1(
									'Preventive effectiveness',
									'Controls that stop it starting/succeeding.',
									fPreventive,
									(l) => (fPreventive = l)
								)}
								{@render scaleV1(
									'Recovery effectiveness',
									'Controls that limit the damage.',
									fRecovery,
									(l) => (fRecovery = l)
								)}
							</div>
							<div
								class="band-out band-final"
								style={`--h:${LEVEL_HUE[preview.residual]}`}
							>
								<Icon name="arrow-right" size={11} /><span class="derive-k">Residual risk</span
								>{@render lvlChip(preview.residual)}<span class="derive-note"
									>vs appetite {LEVEL_LABEL[verdict.limit]} · within appetite</span
								>
							</div>
						</div>
					</section>
				{:else}
					<!-- Same three bands, same five inputs. What changed is that the band
					     announces its own result in its own header instead of spending a
					     full-width ladder row on it, the scales stopped being 25 boxes,
					     and the citations stopped competing with the values. -->
					<section class="edit-card" style={`--h:${LEVEL_HUE[preview.residual]}`}>
						<header class="edit-card-head">
							<Icon name="activity" size={14} /><span>Assessment</span>
							<span class="edit-card-count">NIST SP 800-30</span>
						</header>

						<!-- The bands go side by side, not stacked. A stepper is ~225px of a
						     ~1480px row, so stacking three bands spent nine rows to render
						     five controls and left two thirds of every row empty. As columns
						     the same content is three rows tall, and the chain still reads
						     left to right: likelihood → impact → controls → residual. -->
						<div class="bands">
							<div class="bcol">
								<div class="bhead">
									<span class="b2-k">Likelihood</span><span class="b2-cite">G-5</span>
								</div>
								<div class="bctl">
									{@render stepper(
										'Initiation',
										'How likely a threat starts down this path.',
										fInitiation,
										(l) => (fInitiation = l)
									)}
									{@render stepper(
										'Success',
										'Given it starts, how likely it lands.',
										fSuccess,
										(l) => (fSuccess = l)
									)}
								</div>
								<div class="bout">
									<Icon name="arrow-right" size={10} />
									{@render lvlChip(preview.overall_likelihood)}
								</div>
							</div>

							<div class="bcol">
								<div class="bhead">
									<span class="b2-k">Impact</span><span class="b2-cite">I-2</span>
								</div>
								<div class="bctl">
									{@render stepper(
										'Severity',
										'The damage if the threat lands — NIST “impact if successful”.',
										fImpact,
										(l) => (fImpact = l)
									)}
									<!-- Impact is one scale where the others are a pair, so the row
									     the pair would occupy carries the recommendation instead. -->
									{#if !impactMatches}
										<button
											type="button"
											class="adopt"
											title={`Adopt ${LEVEL_LABEL[suggested.level]} — ${suggestedReason}`}
											onclick={() => (fImpact = suggested.level)}
										>
											<Icon name="arrow-right" size={10} />
											<span>suggests <b>{LEVEL_LABEL[suggested.level]}</b></span>
											<span class="adopt-go">adopt</span>
										</button>
									{/if}
								</div>
								<div class="bout">
									<Icon name="arrow-right" size={10} />
									<span class="b2-out-k">inherent</span>
									{@render lvlChip(preview.inherent)}
								</div>
							</div>

							<div class="bcol">
								<div class="bhead">
									<span class="b2-k">Controls</span><span class="b2-cite">org policy</span>
								</div>
								<div class="bctl">
									{@render stepper(
										'Preventive',
										'Controls that stop it starting or succeeding.',
										fPreventive,
										(l) => (fPreventive = l)
									)}
									{@render stepper(
										'Recovery',
										'Controls that limit the damage.',
										fRecovery,
										(l) => (fRecovery = l)
									)}
								</div>
								<!-- The delta is the point of this band and the shipped card never
								     states it: two scales that absorb nothing look like work. -->
								<div class="bout" class:bout-flat={absorbed === 0}>
									{#if absorbed === 0}
										absorbs nothing
									{:else}
										absorbs {absorbed} level{absorbed === 1 ? '' : 's'}
									{/if}
								</div>
							</div>
						</div>

						<!-- One emphasised line, not three. The verdict is the punchline the
						     rail can't carry, because the rail has no room for the reason. -->
						<div class="verdict" style={`--h:${LEVEL_HUE[preview.residual]}`}>
							<span class="verdict-k">Residual</span>
							{@render lvlChip(preview.residual)}
							<span class="verdict-n"
								>vs appetite {LEVEL_LABEL[verdict.limit].toLowerCase()} ({verdict.source}) ·
								{#if verdict.overTolerance}above tolerance{:else if verdict.overAppetite}over
									appetite{:else}within appetite{/if}</span
							>
						</div>
					</section>
				{/if}
			</main>

			<aside class="rail">
				<section class="edit-card">
					<header class="edit-card-head">
						<Icon name="settings-2" size={13} /><span>Properties</span>
						<span class="edit-card-count">residual {LEVEL_LABEL[preview.residual].toLowerCase()}</span>
					</header>
					<div class="props">
						<div class="prop-zone prop-zone-first">Tracking</div>
						<div class="prop">
							<span class="prop-k"><Icon name="activity" size={11} /> Progress</span>
							<span
								class="prop-chip prop-hue prop-fixed"
								style={`--h:${STATUS_META['in_progress'].hue}`}
							>
								<span class="prop-dot"></span>
								<span class="prop-v">{STATUS_META['in_progress'].label}</span>
							</span>
						</div>
						<div class="prop">
							<span class="prop-k"><Icon name="user" size={11} /> Owner</span>
							<span class="prop-chip prop-fixed">
								<Avatar initials="JS" size={16} />
								<span class="prop-v">jsmith</span>
							</span>
						</div>
						<div class="prop">
							<span class="prop-k"><Icon name="bell" size={11} /> Reminders</span>
							<span class="prop-chip prop-fixed prop-empty">
								<Icon name="bell" size={11} />
								<span class="prop-v">Off</span>
							</span>
						</div>

						<div class="prop-zone">Classification</div>
						<div class="prop">
							<span class="prop-k"><Icon name="shield" size={11} /> CIA</span>
							<div class="cia-mini-row">
								{#each CIA_META as c (c.value)}
									{@const on = fCia.includes(c.value)}
									<button
										type="button"
										class="cia-mini"
										class:cia-mini-on={on}
										title={c.label}
										onclick={() => (fCia = toggle(fCia, c.value))}>{c.letter}</button
									>
								{/each}
							</div>
						</div>
						<div class="prop">
							<span class="prop-k"><Icon name="table" size={11} /> Data</span>
							<ActionsMenu items={dataClassItems} placement="bottom-end" closeOnSelect={false}>
								{#snippet trigger({ open, toggle: t })}
									<button
										type="button"
										class="prop-chip prop-hue"
										class:prop-open={open}
										style={`--h:${TIER_HUE[DATA_MAP[suggested.driver].tier]}`}
										onclick={t}
									>
										<span class="prop-v">{dataClassSummary}</span>
										<Icon name="chevron-down" size={10} />
									</button>
								{/snippet}
							</ActionsMenu>
						</div>

						<div class="prop-zone">Assessment</div>
						<div class="prop">
							<span class="prop-k"><Icon name="activity" size={11} /> Likelihood</span>
							<span class="prop-chip prop-fixed"
								><span class="prop-v">{LEVEL_LABEL[preview.overall_likelihood]}</span></span
							>
						</div>
						<div class="prop">
							<span class="prop-k"><Icon name="zap" size={11} /> Impact</span>
							<ActionsMenu items={impactItems} placement="bottom-end">
								{#snippet trigger({ open, toggle: t })}
									<button
										type="button"
										class="prop-chip prop-hue"
										class:prop-open={open}
										style={`--h:${LEVEL_HUE[fImpact]}`}
										onclick={t}
									>
										<span class="prop-v">{LEVEL_LABEL[fImpact]}</span>
										<Icon name="chevron-down" size={10} />
									</button>
								{/snippet}
							</ActionsMenu>
							{#if !impactMatches}
								<button
									type="button"
									class="prop-sug prop-sug-btn"
									title={`Adopt — ${suggestedReason}`}
									onclick={() => (fImpact = suggested.level)}
								>
									<Icon name="arrow-right" size={9} />
									<span class="prop-v">{LEVEL_LABEL[suggested.level]}</span>
								</button>
							{/if}
						</div>
						<div class="prop">
							<span class="prop-k"><Icon name="arrow-right" size={11} /> Inherent</span>
							<span class="prop-chip prop-fixed"
								><span class="prop-v">{LEVEL_LABEL[preview.inherent]}</span></span
							>
						</div>
						<div class="prop">
							<span class="prop-k"><Icon name="shield-check" size={11} /> Residual</span>
							<span
								class="prop-chip prop-hue prop-fixed"
								style={`--h:${LEVEL_HUE[preview.residual]}`}
							>
								<span class="prop-dot"></span>
								<span class="prop-v">{LEVEL_LABEL[preview.residual]}</span>
							</span>
						</div>

						<div class="prop-zone">Appetite</div>
						<div class="prop">
							<span class="prop-k"><Icon name="shield" size={11} /> Limit</span>
							<span
								class="prop-chip prop-hue prop-fixed"
								style={`--h:${LEVEL_HUE[verdict.limit]}`}
							>
								<span class="prop-v">{LEVEL_LABEL[verdict.limit]}</span>
								<span class="prop-src">{verdict.source}</span>
							</span>
						</div>
					</div>
				</section>
			</aside>
		</div>
	</div>

	<section class="notes">
		<span class="notes-k">What the trim changes</span>
		<ol class="notes-list">
			{#each CHANGES as [k, v] (k)}
				<li><b>{k}.</b> {v}</li>
			{/each}
		</ol>
	</section>
</div>

<style>
	.page { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 0 3rem; }
	/* ── mode switch (mockup chrome, not part of the design) ─────────────── */
	.modebar { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding-bottom: 0.5rem; }
	.mode-k { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-dim); }
	.mode-seg { display: flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
	.mode-seg button { padding: 0.25rem 0.7rem; border: 0; border-left: 1px solid var(--border); background: var(--bg); color: var(--fg-dim); font-family: var(--mono); font-size: 0.64rem; cursor: pointer; }
	.mode-seg button:first-child { border-left: 0; }
	.mode-seg button:hover { color: var(--fg-muted); }
	.mode-seg .mode-on { background: var(--accent-faint); color: var(--accent); }
	.mode-note { font-family: var(--mono); font-size: 0.6rem; color: var(--fg-dim); }

	/* ── shared card vocabulary (lifted from RiskEditor) ─────────────────── */
	.edit-card { border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--fg) 2%, transparent); padding: 0.75rem 0.9rem 0.85rem; }
	.edit-card-head { display: flex; align-items: center; gap: 0.45rem; font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-dim); margin-bottom: 0.6rem; }
	.edit-card-count { margin-left: auto; color: var(--accent); letter-spacing: 0.04em; text-transform: none; }
	.field { display: flex; flex-direction: column; gap: 0.3rem; }
	.mb-3 { margin-bottom: 0.75rem; }
	.field-label { display: inline-flex; align-items: center; gap: 0.3rem; font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-dim); }
	.lvl { display: inline-flex; align-items: center; padding: 0.15rem 0.5rem; border-radius: 999px; border: 1px solid rgb(var(--h) / 0.55); background: rgb(var(--h) / 0.12); color: rgb(var(--h)); font-family: var(--mono); font-size: 0.62rem; white-space: nowrap; }
	.asset-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.35rem; }
	.asset-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; padding: 0.4rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); cursor: pointer; text-align: left; transition: border-color 0.12s, background 0.12s; }
	.asset-btn:hover { border-color: var(--border-strong); }
	.asset-on { border-color: var(--accent); background: var(--accent-faint); }
	.asset-icon { display: grid; place-items: center; width: 20px; height: 20px; border-radius: 5px; color: var(--fg-dim); background: var(--surface-strong); }
	.asset-icon-on { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
	.asset-label { font-size: 0.72rem; font-weight: 600; color: var(--fg-muted); }
	.asset-on .asset-label { color: var(--fg); }
	.asset-blurb { font-family: var(--mono); font-size: 0.52rem; color: var(--fg-dim); line-height: 1.2; }
	.scope-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.35rem; }
	.scope-btn { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.15rem 0.45rem; padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--fg-dim); cursor: pointer; text-align: left; transition: all 0.12s; }
	.scope-btn:hover { border-color: var(--border-strong); }
	.scope-on { border-color: var(--accent); background: var(--accent-faint); color: var(--accent); }
	.scope-l { font-size: 0.72rem; font-weight: 600; color: var(--fg-muted); }
	.scope-on .scope-l { color: var(--fg); }
	.scope-b { font-family: var(--mono); font-size: 0.52rem; color: var(--fg-dim); }

	/* ── SHIPPED assessment card ─────────────────────────────────────────── */
	.scale-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
	.scale { display: flex; flex-direction: column; gap: 0.4rem; }
	.scale-btns { display: flex; gap: 0.3rem; }
	.scale-btn { flex: 1; padding: 0.35rem 0; border: 1px solid var(--border); border-radius: 5px; background: var(--bg); color: var(--fg-muted); font-family: var(--mono); font-size: 0.7rem; cursor: pointer; transition: all 0.12s; }
	.scale-btn:hover { border-color: var(--border-strong); color: var(--fg); }
	.scale-on { border-color: rgb(var(--h)); background: rgb(var(--h) / 0.14); color: rgb(var(--h)); }
	.scale-help { font-family: var(--mono); font-size: 0.58rem; line-height: 1.35; color: var(--fg-dim); }
	.band-group { padding-top: 0.7rem; }
	.band-group + .band-group { margin-top: 0.7rem; border-top: 1px solid var(--border); }
	.band-group:first-of-type { padding-top: 0; }
	.band-k { display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.5rem; font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fg-muted); }
	.band-k i { margin-left: auto; font-style: normal; letter-spacing: 0.04em; text-transform: none; color: var(--accent); }
	.band-out { display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; color: var(--fg-dim); }
	.band-final { padding-top: 0.5rem; border-top: 1px dashed rgb(var(--h) / 0.5); }
	.derive-k { font-family: var(--mono); font-size: 0.64rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-dim); }
	.derive-note { font-family: var(--mono); font-size: 0.58rem; color: var(--fg-dim); }

	/* ── TRIMMED assessment card ─────────────────────────────────────────── */
	/* The band still exists — it just stops costing a header row, a caption per
	   scale and a full-width output ladder to say what it is. */
	/* Three bands across, divided by a rule rather than stacked behind one. */
	.bands { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 1.1rem; }
	.bcol { display: flex; flex-direction: column; gap: 0.4rem; padding-left: 1.1rem; border-left: 1px solid var(--border); }
	.bcol:first-child { padding-left: 0; border-left: 0; }
	@media (max-width: 1000px) {
		.bands { grid-template-columns: 1fr; gap: 0.65rem 0; }
		.bcol { padding-left: 0; border-left: 0; padding-top: 0.65rem; border-top: 1px solid var(--border); }
		.bcol:first-child { padding-top: 0; border-top: 0; }
	}
	.bhead { display: flex; align-items: baseline; gap: 0.4rem; }
	.bctl { display: flex; flex-direction: column; gap: 0.3rem; }
	/* margin-top:auto pins the three outputs to a common baseline even though
	   Impact holds one stepper where its neighbours hold two. */
	.bout { display: flex; align-items: center; gap: 0.3rem; margin-top: auto; padding-top: 0.15rem; color: var(--fg-dim); font-family: var(--mono); font-size: 0.58rem; }
	.bout-flat { color: var(--palette-amber); opacity: 0.85; }
	.b2-k { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--fg-muted); }
	/* Provenance, not a control: it earns a slot, not the accent. */
	.b2-cite { font-family: var(--mono); font-size: 0.52rem; letter-spacing: 0.06em; color: var(--fg-dim); opacity: 0.65; }
	.b2-out-k { font-family: var(--mono); font-size: 0.55rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-dim); }
	/* Accent, not the level's hue: an offer, not an error being reported. */
	.adopt { display: inline-flex; align-items: center; justify-self: start; gap: 0.35rem; padding: 0.25rem 0.5rem; border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 6px; background: var(--accent-faint); color: var(--accent); font-family: var(--mono); font-size: 0.58rem; cursor: pointer; transition: border-color 0.12s, background 0.12s; }
	.adopt:hover { border-style: solid; border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
	.adopt b { font-weight: 600; }
	.adopt-go { padding-left: 0.35rem; border-left: 1px solid color-mix(in srgb, var(--accent) 30%, transparent); text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.5rem; opacity: 0.8; }
	/* One row per judgement: a fixed label gutter, then a stepper that does NOT
	   stretch — a control sized to its longest value ("Very high") instead of to
	   the column, which is what made five scales read as five banks of buttons. */
	.srow { display: grid; grid-template-columns: 74px auto; align-items: center; gap: 0.55rem; }
	.srow-k { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-dim); cursor: help; }
	.step { display: inline-grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; width: 150px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); transition: border-color 0.12s; }
	.step:hover { border-color: var(--border-strong); }
	/* The whole stepper is one tab stop; ←/→ move it. */
	.step:focus-visible { outline: none; border-color: rgb(var(--h)); box-shadow: 0 0 0 1px rgb(var(--h) / 0.45); }
	.step-b { display: grid; place-items: center; width: 22px; height: 24px; border: 0; background: transparent; color: var(--fg-dim); cursor: pointer; transition: color 0.12s; }
	.step-b:hover:not(:disabled) { color: var(--fg); }
	.step-b:disabled { opacity: 0.22; cursor: default; }
	/* The word carries the level; its hue carries the severity the letters and
	   the fill bars used to. */
	.step-v { text-align: center; font-family: var(--mono); font-size: 0.68rem; color: rgb(var(--h)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	/* The card's single emphasised line — the one thing the rail cannot say,
	   because the rail has no room for the reason beside the value. */
	.verdict { display: flex; align-items: center; flex-wrap: wrap; gap: 0.45rem; margin-top: 0.7rem; padding-top: 0.55rem; border-top: 1px dashed rgb(var(--h) / 0.5); }
	.verdict-k { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--fg-muted); }
	.verdict-n { font-family: var(--mono); font-size: 0.58rem; color: var(--fg-dim); }

	/* ── page frame + rail (unchanged from RiskEditor) ───────────────────── */
	.wiz { display: flex; flex-direction: column; gap: 0.75rem; }
	.stepbar { display: flex; align-items: center; gap: 1rem; padding: 0.6rem 0 0.75rem; border-bottom: 1px solid var(--border); }
	.stepbar > :global(:first-child) { flex: 1; min-width: 0; }
	.step-hint { flex: none; font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.06em; color: var(--fg-dim); }
	.cols { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 0.85rem; align-items: start; }
	@media (max-width: 1100px) { .cols { grid-template-columns: 1fr; } }
	.wiz-main { display: flex; flex-direction: column; gap: 0.75rem; min-width: 0; }
	.rail { display: flex; flex-direction: column; gap: 0.6rem; }
	.props { display: flex; flex-direction: column; gap: 0.35rem; }
	.prop { display: flex; align-items: center; flex-wrap: wrap; gap: 0.35rem 0.5rem; min-height: 26px; }
	.prop-k { display: inline-flex; align-items: center; gap: 0.3rem; flex: none; width: 84px; font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fg-dim); }
	.prop-chip { display: inline-flex; align-items: center; gap: 0.35rem; min-width: 0; max-width: 100%; padding: 0.2rem 0.4rem; border: 1px solid transparent; border-radius: 5px; background: transparent; color: var(--fg-muted); font-size: 0.72rem; cursor: pointer; transition: border-color 0.12s, background 0.12s; }
	.prop-chip.prop-hue { color: rgb(var(--h)); }
	.prop-chip:hover, .prop-chip.prop-open { border-color: var(--border-strong); background: var(--surface-strong); }
	.prop-chip.prop-empty { color: var(--fg-dim); }
	.prop-chip.prop-fixed { cursor: default; }
	.prop-chip.prop-fixed:hover { border-color: transparent; background: transparent; }
	.prop-chip :global(svg) { flex-shrink: 0; opacity: 0.7; }
	.prop-v { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.prop-dot { flex: none; width: 7px; height: 7px; border-radius: 999px; background: rgb(var(--h)); box-shadow: 0 0 0 2px rgb(var(--h) / 0.18); }
	.prop-zone { margin-top: 0.7rem; padding-top: 0.55rem; border-top: 1px solid var(--border); font-family: var(--mono); font-size: 0.55rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--fg-dim); }
	.prop-zone-first { margin-top: 0; padding-top: 0; border-top: 0; }
	.prop-sug { display: inline-flex; align-items: center; gap: 0.2rem; min-width: 0; padding: 0.15rem 0.4rem; border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent); border-radius: 5px; background: var(--accent-faint); color: var(--accent); font-size: 0.66rem; }
	.prop-sug-btn { cursor: pointer; }
	.prop-sug-btn:hover { border-style: solid; border-color: var(--accent); }
	.prop-src { font-family: var(--mono); font-size: 0.5rem; letter-spacing: 0.04em; text-transform: uppercase; opacity: 0.7; }
	.cia-mini-row { display: flex; gap: 0.25rem; }
	.cia-mini { display: grid; place-items: center; width: 22px; height: 22px; border: 1px solid var(--border); border-radius: 5px; background: var(--bg); font-family: var(--mono); font-size: 0.7rem; font-weight: 600; color: var(--fg-dim); cursor: pointer; transition: border-color 0.12s, background 0.12s, color 0.12s; }
	.cia-mini:hover { border-color: var(--border-strong); color: var(--fg-muted); }
	.cia-mini-on { border-color: var(--accent); background: var(--accent-faint); color: var(--accent); }

	/* ── change log ──────────────────────────────────────────────────────── */
	.notes { border: 1px solid var(--border); border-radius: 8px; padding: 0.8rem 1rem; }
	.notes-k { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--fg-dim); }
	.notes-list { display: flex; flex-direction: column; gap: 0.35rem; margin: 0.6rem 0 0; padding-left: 1.1rem; list-style: decimal; }
	.notes-list li { font-size: 0.74rem; line-height: 1.5; color: var(--fg-muted); }
	.notes-list b { color: var(--fg); }
</style>
