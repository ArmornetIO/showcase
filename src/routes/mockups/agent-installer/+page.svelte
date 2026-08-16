<script lang="ts">
	// ─────────────────────────────────────────────────────────────────────────
	// Mockup: the INSTALLER — the full-page UI the downloaded binary serves on
	// the host (http://localhost:7700). It owns the window: no drawer, no tabs.
	//
	// Model matches Agent Management: capability === agent mode. The catalog is
	// ALL registered modes (MODE_ICONS / agent.go), not just the proxies. The
	// supply-chain ecosystems (go/npm/pip/docker/git) are that mode's TOOLS —
	// they are not top-level concepts.
	//
	// Two inversions vs. the console's deploy drawer:
	//   1. It does NOT provision credentials — you paste the client_id/secret you
	//      already created in Agent Management.
	//   2. It adds THIS MACHINE — the step that only exists on a real host. One
	//      click writes the host config so traffic hits the agent before it ever
	//      reaches upstream, then VERIFIES it by reading it back. Only the modes
	//      that actually mutate the host appear there (supply_chain_proxy → CA +
	//      ecosystem config; dns_proxy → resolver). A pure `intelligence` agent
	//      needs nothing, so the step is empty and START is not gated on it.
	//
	// Right column is a live config mesh preview — a single multi-mode agent with
	// its modes fanned out as satellites, rendered by the same Canvas+MeshStudio
	// used in mesh studio. modeFlows drive the spokes once traffic is flowing.
	//
	// Local API stubs (served by the agent binary itself):
	//   GET  /installer/host            → { hostname, os, arch, version }
	//   POST /installer/config/validate → { valid, mode_count }
	//   POST /installer/env/apply       → { results[] }   ← mutates the host
	//   POST /installer/env/verify      → { results[] }   ← reads it back
	//   POST /installer/start           → { status, agent_id }
	// ─────────────────────────────────────────────────────────────────────────

	import Canvas from '$lib/primitives/Canvas.svelte';
	import MeshStudio from '$lib/mesh-studio/MeshStudio.svelte';
	import type { StudioNode, StudioEdge } from '$lib/mesh-studio/studio.types.js';
	import type { CanvasCamera } from '$lib/primitives/canvas-camera.js';
	import { DEFAULT_TUNING, cloneTuning } from '$lib/mesh-studio/layout/mesh-tuning.js';
	import {
		MODE_ICONS,
		TOOL_ICONS,
		glyphForMode,
		glyphForModes,
		labelForMode,
		TERMINAL_GLYPH
	} from '$lib/icons/mode-tool-icons.js';
	import { MESH_NODE_COLOR, MESH_NODE_LABEL } from '$lib/primitives/canvas.types.js';

	import SteppedProgress from '$lib/display/progress/SteppedProgress.svelte';
	import ConfigBlock from '$lib/display/code/ConfigBlock.svelte';
	import Input from '$lib/primitives/Input.svelte';
	import Button from '$lib/primitives/Button.svelte';
	import Icon from '$lib/icons/Icon.svelte';
	import type { IconName } from '$lib/icons/Icon.svelte';

	// ── Types ────────────────────────────────────────────────────────────────
	type OsKey = 'macos' | 'linux' | 'windows';
	type Source = 'ui' | 'file';
	type FileState = 'idle' | 'loading' | 'valid' | 'invalid';
	type StepState = 'idle' | 'working' | 'done';
	type RunState = 'idle' | 'starting' | 'running';

	/** Which host mutation a mode requires, if any. Most modes require none. */
	type EnvKind = 'ecosystems' | 'dns';

	type Eco = { type: string; name: string; description: string; port: number; icon: IconName };

	// ── Registry ─────────────────────────────────────────────────────────────
	// Capabilities come straight from the mode registry the mesh already uses, so
	// the catalog and the preview can never drift apart.
	const ENV_FOR_MODE: Record<string, EnvKind> = {
		supply_chain_proxy: 'ecosystems',
		dns_proxy: 'dns'
	};

	const MODES = MODE_ICONS.map((m) => ({
		key: m.key,
		name: labelForMode(m.key),
		desc: m.desc,
		color: m.color,
		env: ENV_FOR_MODE[m.key] as EnvKind | undefined
	}));

	/** The built-in tools each mode contributes (engine/registry.go). These are
	 *  what float around the agent on the mesh. supply_chain_proxy is the odd one
	 *  out — its tools are the ecosystems below, which are user-chosen. */
	const MODE_TOOLS: Record<string, string[]> = {
		hello_world: ['echo'],
		intelligence: ['feedfetch', 'httprequest', 'alert'],
		vendor_management: ['httprequest', 'alert'],
		dep_analysis: ['httprequest', 'alert'],
		github_runner: ['httprequest', 'alert'],
		dns_proxy: ['dnsproxy', 'dnsquery'],
		language: ['unicode_detect', 'unicode_inject', 'alert']
	};

	const TOOL_GLYPH: Record<string, string> = Object.fromEntries(TOOL_ICONS.map((t) => [t.key, t.svg]));

	/** Tools of supply_chain_proxy — mirrors the deploy drawer's registry. */
	const ECOSYSTEMS: Eco[] = [
		{ type: 'go', name: 'Go modules', description: 'proxy.golang.org', port: 4875, icon: 'git-branch' },
		{ type: 'npm', name: 'npm', description: 'registry.npmjs.org', port: 4873, icon: 'layers' },
		{ type: 'pip', name: 'pip', description: 'pypi.org/simple', port: 4874, icon: 'flask-conical' },
		{ type: 'docker', name: 'Docker', description: 'registry-1.docker.io', port: 4876, icon: 'package' },
		{ type: 'git', name: 'Git', description: 'github.com', port: 4877, icon: 'git-fork' }
	];

	const HOST = { hostname: 'edge-01', arch: 'arm64', version: 'v1.4.2' };
	const OS_LABEL: Record<OsKey, string> = { macos: 'macOS', linux: 'Linux', windows: 'Windows' };

	type Target = { file: string; cmd: string; verify: string; verifyOut: string };

	const ECO_ENV: Record<OsKey, Record<string, Target>> = {
		macos: {
			go: { file: '~/Library/Application Support/go/env', cmd: 'go env -w GOPROXY=http://127.0.0.1:4875,direct', verify: 'go env GOPROXY', verifyOut: 'http://127.0.0.1:4875,direct' },
			npm: { file: '~/.npmrc', cmd: 'npm config set registry http://127.0.0.1:4873', verify: 'npm config get registry', verifyOut: 'http://127.0.0.1:4873' },
			pip: { file: '~/Library/Application Support/pip/pip.conf', cmd: 'pip config set global.index-url http://127.0.0.1:4874/simple', verify: 'pip config get global.index-url', verifyOut: 'http://127.0.0.1:4874/simple' },
			docker: { file: '~/.docker/daemon.json', cmd: 'armornet env apply docker  # restarts Docker Desktop', verify: 'docker info --format "{{.RegistryConfig.Mirrors}}"', verifyOut: '[http://127.0.0.1:4876]' },
			git: { file: '~/.gitconfig', cmd: 'git config --global url."http://127.0.0.1:4877/".insteadOf https://github.com/', verify: 'git config --global --get-regexp insteadOf', verifyOut: 'http://127.0.0.1:4877/ → github.com' }
		},
		linux: {
			go: { file: '~/.config/go/env', cmd: 'go env -w GOPROXY=http://127.0.0.1:4875,direct', verify: 'go env GOPROXY', verifyOut: 'http://127.0.0.1:4875,direct' },
			npm: { file: '~/.npmrc', cmd: 'npm config set registry http://127.0.0.1:4873', verify: 'npm config get registry', verifyOut: 'http://127.0.0.1:4873' },
			pip: { file: '~/.config/pip/pip.conf', cmd: 'pip config set global.index-url http://127.0.0.1:4874/simple', verify: 'pip config get global.index-url', verifyOut: 'http://127.0.0.1:4874/simple' },
			docker: { file: '/etc/docker/daemon.json', cmd: 'sudo armornet env apply docker  # reloads dockerd', verify: 'docker info --format "{{.RegistryConfig.Mirrors}}"', verifyOut: '[http://127.0.0.1:4876]' },
			git: { file: '~/.gitconfig', cmd: 'git config --global url."http://127.0.0.1:4877/".insteadOf https://github.com/', verify: 'git config --global --get-regexp insteadOf', verifyOut: 'http://127.0.0.1:4877/ → github.com' }
		},
		windows: {
			go: { file: '%APPDATA%\\go\\env', cmd: 'go env -w GOPROXY=http://127.0.0.1:4875,direct', verify: 'go env GOPROXY', verifyOut: 'http://127.0.0.1:4875,direct' },
			npm: { file: '%USERPROFILE%\\.npmrc', cmd: 'npm config set registry http://127.0.0.1:4873', verify: 'npm config get registry', verifyOut: 'http://127.0.0.1:4873' },
			pip: { file: '%APPDATA%\\pip\\pip.ini', cmd: 'pip config set global.index-url http://127.0.0.1:4874/simple', verify: 'pip config get global.index-url', verifyOut: 'http://127.0.0.1:4874/simple' },
			docker: { file: '%USERPROFILE%\\.docker\\daemon.json', cmd: 'armornet env apply docker  # restarts Docker Desktop', verify: 'docker info --format "{{.RegistryConfig.Mirrors}}"', verifyOut: '[http://127.0.0.1:4876]' },
			git: { file: '%USERPROFILE%\\.gitconfig', cmd: 'git config --global url."http://127.0.0.1:4877/".insteadOf https://github.com/', verify: 'git config --global --get-regexp insteadOf', verifyOut: 'http://127.0.0.1:4877/ → github.com' }
		}
	};

	/** supply_chain_proxy terminates TLS — the host must trust the agent CA. */
	const CA: Record<OsKey, Target> = {
		macos: { file: 'System Keychain', cmd: 'sudo security add-trusted-cert -d -r trustRoot \\\n  -k /Library/Keychains/System.keychain ~/.armornet/ca.pem', verify: 'security verify-cert -c ~/.armornet/ca.pem', verifyOut: 'certificate verification successful' },
		linux: { file: '/usr/local/share/ca-certificates', cmd: 'sudo cp ~/.armornet/ca.pem /usr/local/share/ca-certificates/armornet.crt \\\n  && sudo update-ca-certificates', verify: 'trust list | grep -c armornet', verifyOut: '1' },
		windows: { file: 'Windows ROOT store', cmd: 'certutil -addstore -f ROOT %USERPROFILE%\\.armornet\\ca.crt', verify: 'certutil -verifystore ROOT armornet', verifyOut: 'armornet CA — OK' }
	};

	/** dns_proxy points the host resolver at the agent. */
	const DNS: Record<OsKey, Target> = {
		macos: { file: 'Wi-Fi · DNS servers', cmd: 'sudo networksetup -setdnsservers Wi-Fi 127.0.0.1', verify: 'scutil --dns | grep -m1 nameserver', verifyOut: 'nameserver[0] : 127.0.0.1' },
		linux: { file: '/etc/resolv.conf', cmd: 'sudo armornet env apply dns  # writes resolv.conf', verify: 'resolvectl status | grep -m1 "DNS Servers"', verifyOut: 'DNS Servers: 127.0.0.1' },
		windows: { file: 'Wi-Fi · DNS servers', cmd: 'netsh interface ip set dns "Wi-Fi" static 127.0.0.1', verify: 'ipconfig /all | findstr "DNS Servers"', verifyOut: 'DNS Servers . . . : 127.0.0.1' }
	};

	const SAMPLE_FILE_YAML = `# /etc/armornet/config.yaml
agent:
  name: edge-01
  modes:
    - supply_chain_proxy
    - dns_proxy
control_plane:
  endpoint: wss://opamp.armornet.io/v1/opamp
  auth:
    client_id: agent:org_demo:8f2a1c40
tools:
  - type: npm
    listen_addr: 0.0.0.0:4873
`;

	const DEPLOY_STEPS = ['Source', 'Agent', 'Capabilities', 'This machine', 'Start'];

	// ── State ────────────────────────────────────────────────────────────────
	let os = $state<OsKey>('macos');
	const detectedOs: OsKey = 'macos';

	let source = $state<Source>('ui');
	let configPath = $state('/etc/armornet/config.yaml');
	let fileState = $state<FileState>('idle');

	let agentName = $state('edge-01');
	let endpoint = $state('wss://opamp.armornet.io/v1/opamp');
	let clientId = $state('');
	let clientSecret = $state('');
	let secretRevealed = $state(false);

	// Capability === agent mode. Order drives the fan-out.
	let addedModes = $state<string[]>(['supply_chain_proxy', 'dns_proxy']);
	let enabledEcos = $state<Set<string>>(new Set(['go', 'npm']));
	let catalogOpen = $state(false);

	let envStatus = $state<Record<string, StepState>>({});
	let showCommands = $state(false);
	let showDetails = $state(false);
	let runState = $state<RunState>('idle');

	// mesh preview
	let camera = $state<CanvasCamera>();
	let meshNodes = $state<StudioNode[]>([]);
	let meshEdges = $state<StudioEdge[]>([]);
	let tuning = $state(cloneTuning(DEFAULT_TUNING));

	// ── Derived ──────────────────────────────────────────────────────────────
	const modeOf = (k: string) => MODES.find((m) => m.key === k)!;
	const credsOk = $derived(clientId.trim() !== '' && clientSecret.trim() !== '');
	const activeEcos = $derived(ECOSYSTEMS.filter((e) => enabledEcos.has(e.type)));
	const hasProxy = $derived(addedModes.includes('supply_chain_proxy'));
	const hasDns = $derived(addedModes.includes('dns_proxy'));

	/** Only the modes that actually mutate the host produce rows. */
	type EnvRow = Target & { id: string; name: string; icon?: IconName; glyph?: string; admin?: boolean };
	const envRows = $derived.by(() => {
		const rows: EnvRow[] = [];
		if (hasProxy) {
			rows.push({ id: 'ca', name: 'Trust the agent CA', glyph: glyphForMode('supply_chain_proxy'), admin: true, ...CA[os] });
			for (const e of activeEcos) rows.push({ id: e.type, name: e.name, icon: e.icon, ...ECO_ENV[os][e.type] });
		}
		if (hasDns) {
			rows.push({ id: 'dns', name: 'Host resolver', glyph: glyphForMode('dns_proxy'), admin: true, ...DNS[os] });
		}
		return rows;
	});

	const needsEnv = $derived(envRows.length > 0);
	const envBusy = $derived(Object.values(envStatus).some((s) => s === 'working'));
	const envDone = $derived(!needsEnv || envRows.every((r) => envStatus[r.id] === 'done'));

	const modesOk = $derived(addedModes.length > 0 && (!hasProxy || activeEcos.length > 0));
	const configReady = $derived(source === 'file' ? fileState === 'valid' : credsOk && modesOk);
	const canStart = $derived(configReady && envDone);

	const currentStep = $derived.by(() => {
		if (runState === 'running') return 5;
		if (configReady && envDone) return 4;
		if (configReady) return 3;
		if (source === 'file' || credsOk) return 2;
		return 1;
	});

	/** The "we're hit first" promise, named after what's actually intercepted. */
	const promise = $derived.by(() => {
		const bits: string[] = [];
		if (hasProxy) bits.push(...activeEcos.map((e) => e.name));
		if (hasDns) bits.push('DNS');
		if (bits.length === 0) return '';
		if (bits.length === 1) return bits[0];
		return bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1];
	});

	const nodeState = $derived(runState === 'running' ? 'healthy' : 'offline');
	const statusColor = $derived(runState === 'running' ? '#6EE7B7' : '#94A3B8');
	const statusBorder = $derived(runState === 'running' ? 'rgba(52,211,153,0.35)' : 'rgba(100,116,139,0.4)');
	const statusBg = $derived(runState === 'running' ? 'rgba(52,211,153,0.06)' : 'rgba(100,116,139,0.06)');

	const generatedYaml = $derived.by(() => {
		const l: string[] = [];
		l.push('# written by the installer → /etc/armornet/config.yaml');
		l.push('agent:');
		l.push(`  name: ${agentName || '<unnamed>'}`);
		l.push('  modes:');
		if (addedModes.length === 0) l.push('    [] # add a capability');
		else for (const m of addedModes) l.push(`    - ${m}`);
		l.push('control_plane:');
		l.push(`  endpoint: ${endpoint}`);
		l.push('  auth:');
		l.push('    method: oidc');
		l.push(`    client_id: ${clientId || '<paste client_id>'}`);
		l.push(`    client_secret: ${clientSecret ? (secretRevealed ? clientSecret : '••••••••••••') : '<paste client_secret>'}`);
		if (hasProxy) {
			l.push('tools:');
			for (const e of activeEcos) {
				l.push(`  - type: ${e.type}`);
				l.push(`    listen_addr: 0.0.0.0:${e.port}`);
			}
		}
		l.push('mesh:');
		l.push('  auto_register: true');
		return l.join('\n');
	});

	// ── Mesh preview ─────────────────────────────────────────────────────────
	// ONE node: this host's agent. Its modes fan out around it as satellites on
	// spokes — MeshStudio's built-in multi-mode fan-out, same as `edge-guard` in
	// mesh studio. There is exactly one agent here, so there are no other nodes
	// and no edges to draw.
	const CX = 300;
	const CY = 230;

	$effect(() => {
		const modes = addedModes;
		const running = runState === 'running';
		if (modes.length === 0) {
			meshNodes = [];
			return;
		}
		const multi = modes.length > 1;
		const color = MESH_NODE_COLOR['agentic'];
		meshNodes = [
			{
				id: 'this-host',
				type: 'agentic',
				mode: modes[0],
				// A preview of the config, not live status — painting it `offline`
				// makes an unstarted agent look broken. Liveness rides on the flows.
				state: 'healthy',
				label: agentName || 'this-host',
				x: CX,
				y: CY,
				r: 46,
				// >1 mode → the agent container plate, with the modes spread out.
				modes: multi ? modes : undefined,
				expanded: true,
				modeFlows: modes.map(() => (running ? 0.8 : 0)),
				flow: running ? 0.7 : 0,
				iconMarkup: multi ? glyphForModes(modes) : glyphForMode(modes[0]),
				iconKey: multi ? `agent-${modes.join('+')}` : `glyph-${modes[0]}`,
				strokeColor: color,
				fillColor: color + '1f'
			}
		];
	});

	// Centre on the agent — NOT fitAll. The satellites are drawn inside the one
	// node, so fitAll only sees a 92px disc and zooms until the fan-out spills
	// off-canvas. Centring at the default zoom keeps the whole fan in frame.
	$effect(() => {
		addedModes.length;
		if (!camera) return;
		const t = setTimeout(() => camera?.cut('this-host'), 90);
		return () => clearTimeout(t);
	});

	// ── Effects (simulated local API) ────────────────────────────────────────
	$effect(() => {
		if (fileState !== 'loading') return;
		const t = setTimeout(() => {
			fileState = /\.ya?ml$/.test(configPath.trim()) ? 'valid' : 'invalid';
		}, 650);
		return () => clearTimeout(t);
	});

	$effect(() => {
		if (runState !== 'starting') return;
		const t = setTimeout(() => (runState = 'running'), 1200);
		return () => clearTimeout(t);
	});

	// ── Handlers ─────────────────────────────────────────────────────────────
	function addMode(key: string) {
		if (addedModes.includes(key)) return;
		addedModes = [...addedModes, key];
		resetEnv();
	}
	function removeMode(key: string) {
		addedModes = addedModes.filter((k) => k !== key);
		resetEnv();
	}
	function toggleEco(type: string) {
		const next = new Set(enabledEcos);
		if (next.has(type)) next.delete(type);
		else next.add(type);
		enabledEcos = next;
		resetEnv();
	}
	function resetEnv() {
		envStatus = {};
		runState = 'idle';
	}

	/** The couple-of-clicks path: mutate the host, then read it back. */
	function configureMachine() {
		if (envBusy) return;
		envStatus = {};
		runState = 'idle';
		envRows.forEach((r, i) => {
			setTimeout(() => (envStatus = { ...envStatus, [r.id]: 'working' }), i * 300);
			setTimeout(() => (envStatus = { ...envStatus, [r.id]: 'done' }), i * 300 + 500);
		});
	}
</script>

<svelte:head><title>Agent Installer — Armornet</title></svelte:head>

{#snippet glyph(svg: string, size: number)}
	<svg
		width={size}
		height={size}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="1.6"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true">{@html svg}</svg
	>
{/snippet}

{#snippet secLabel(text: string)}
	<div class="text-[10px] text-[var(--fg-dim)] uppercase tracking-widest mb-2">{text}</div>
{/snippet}

<!-- Full-page installer shell. The binary owns the window: no drawer, no tabs. -->
<div class="inst relative w-full h-screen flex flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)]">
	<!-- ── Header (NodeDrawer chrome, laid out full-width) ─────────────────── -->
	<header class="flex items-center gap-4 px-6 py-3 shrink-0 border-b border-[var(--border)] bg-[linear-gradient(90deg,rgba(196,168,255,0.06),transparent)]">
		<div
			class="inst-icon w-[36px] h-[36px] shrink-0 flex items-center justify-center border-[1.5px] border-solid relative font-[var(--mono)] text-[0.625rem] font-bold tracking-[0.1em]"
			style:border-color="#C4A8FF"
			style:background="rgba(196,168,255,0.12)"
			style:color="#C4A8FF"
		>AG</div>

		<div class="min-w-0">
			<div class="font-[var(--mono)] text-[0.5625rem] tracking-[0.3em] text-[#C4A8FF]">AGENTIC · INSTALL</div>
			<div class="font-[var(--sans-brand,'Rajdhani',sans-serif)] text-[1.375rem] font-bold text-[var(--fg)] leading-[1.1] mt-[2px]">
				{HOST.hostname.toUpperCase()}
			</div>
			<div class="font-[var(--mono)] text-[0.625rem] text-[var(--fg-dim)] tracking-[0.1em] mt-[2px]">
				agent:this-host:pending
			</div>
		</div>

		<div class="ml-6 hidden md:flex items-center gap-2 font-[var(--mono)] text-[10px] text-[var(--fg-muted)]">
			<span class="w-[6px] h-[6px] rounded-full bg-emerald-400 shrink-0"></span>
			agent <span class="text-[var(--fg)]">{HOST.version}</span>
			<span class="text-[var(--fg-dim)]">·</span>
			{OS_LABEL[os].toLowerCase()}/{HOST.arch}
			<span class="text-[var(--fg-dim)]">·</span>
			<span class="text-[var(--fg-dim)]">localhost:7700</span>
		</div>

		<div class="flex-1"></div>

		<div class="font-[var(--mono)] text-[0.5rem] tracking-[0.2em] px-2 py-[3px] border rounded-[2px] shrink-0 border-white/10 text-white/30">
			{MESH_NODE_LABEL['agentic']}
		</div>

		<div
			class="flex items-center gap-2 px-3 py-[6px] border rounded-[3px] font-[var(--mono)] text-[0.625rem] tracking-[0.2em] shrink-0"
			style:border-color={statusBorder}
			style:background={statusBg}
			style:color={statusColor}
		>
			<span class="inline-block w-[6px] h-[6px] rounded-full bg-current shadow-[0_0_6px_currentColor] shrink-0"></span>
			{nodeState.toUpperCase()}
		</div>
	</header>

	<!-- ── Progress ────────────────────────────────────────────────────────── -->
	<div class="px-6 py-3 shrink-0 border-b border-[var(--border)] bg-[var(--bg-elev)]">
		<div class="max-w-[1240px] mx-auto">
			<SteppedProgress steps={DEPLOY_STEPS} current={currentStep} stepStyle="blocks" />
		</div>
	</div>

	<!-- ── Body: left = what you want · right = what it becomes / what changes ── -->
	<div class="flex-1 min-h-0 overflow-hidden">
		<div class="h-full max-w-[1240px] mx-auto flex gap-6 px-6 py-5">
			<!-- ── LEFT: configuration ─────────────────────────────────────── -->
			<main class="inst-scroll flex-1 min-w-0 overflow-y-auto pr-1">
				<!-- Source -->
				<section class="mb-6">
					{@render secLabel('Configuration')}
					<div class="inline-flex border border-[var(--border)] rounded-[4px] p-[2px] gap-[2px] bg-black/20">
						<button
							class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[0.7rem] tracking-[0.04em] rounded-[3px] border-none cursor-pointer transition-colors duration-150 {source ===
							'ui'
								? 'bg-teal-300/10 text-[var(--accent)]'
								: 'bg-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
							onclick={() => {
								source = 'ui';
								resetEnv();
							}}
						>
							<Icon name="settings-2" size={11} />Configure here
						</button>
						<button
							class="inline-flex items-center gap-1.5 px-3 py-1.5 font-mono text-[0.7rem] tracking-[0.04em] rounded-[3px] border-none cursor-pointer transition-colors duration-150 {source ===
							'file'
								? 'bg-teal-300/10 text-[var(--accent)]'
								: 'bg-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
							onclick={() => {
								source = 'file';
								resetEnv();
							}}
						>
							<Icon name="file-text" size={11} />Use a config file
						</button>
					</div>
				</section>

				{#if source === 'file'}
					<section class="mb-6">
						{@render secLabel('Config file')}
						<div class="flex items-center gap-2">
							<div class="flex-1">
								<Input
									bind:value={configPath}
									placeholder="/etc/armornet/config.yaml"
									size="sm"
									status={fileState === 'invalid' ? 'error' : fileState === 'valid' ? 'success' : 'default'}
									oninput={() => (fileState = 'idle')}
								/>
							</div>
							<Button variant="ghost" size="sm" loading={fileState === 'loading'} onclick={() => (fileState = 'loading')}>
								{#snippet children()}
									<Icon name="upload" size={11} />LOAD
								{/snippet}
							</Button>
						</div>

						{#if fileState === 'invalid'}
							<div class="mt-2 flex items-center gap-2 px-2.5 py-2 border border-amber-300/25 border-l-2 border-l-amber-300 rounded-[2px] bg-amber-300/[0.04] text-[11px] text-amber-300">
								<Icon name="alert-triangle" size={12} />
								<span>Not a YAML config — point at a <span class="font-mono">.yaml</span> file.</span>
							</div>
						{:else if fileState === 'valid'}
							<div class="mt-2 mb-2 flex items-center gap-2">
								<span class="font-mono text-[9px] text-emerald-300 bg-emerald-300/[0.08] border border-emerald-300/25 px-1.5 py-0.5 rounded-[2px] tracking-wider">VALID · 2 MODES</span>
								<button class="font-mono text-[10px] bg-transparent border-none cursor-pointer text-[var(--fg-dim)] hover:text-[var(--fg)] underline underline-offset-2" onclick={() => (fileState = 'idle')}>Choose another</button>
							</div>
							<ConfigBlock yaml={SAMPLE_FILE_YAML} />
						{/if}
					</section>
				{:else}
					<!-- Agent -->
					<section class="mb-6">
						{@render secLabel('Agent Name')}
						<Input id="agent-name" placeholder="e.g. prod-host-01" bind:value={agentName} />
					</section>

					<!-- Credentials (given, never minted) -->
					<section class="mb-6">
						{@render secLabel('Credentials')}
						<div class="flex items-start gap-2 px-2.5 py-2 mb-3 border border-[var(--border-accent)] border-l-2 rounded-[2px] bg-teal-300/[0.04]">
							<div class="text-[var(--accent)] mt-px"><Icon name="key" size={12} /></div>
							<p class="text-[10px] text-[var(--fg-muted)] leading-snug">
								From <span class="text-[var(--fg)]">Agent Management → your agent</span>. The installer never creates credentials.
							</p>
						</div>

						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-[10px] text-[var(--fg-dim)] mb-1" for="cid">Client ID</label>
								<Input id="cid" bind:value={clientId} placeholder="agent:org_demo:8f2a1c40" size="sm" />
							</div>
							<div>
								<label class="block text-[10px] text-[var(--fg-dim)] mb-1" for="csec">Client secret</label>
								<div class="flex items-center gap-1.5">
									<div class="flex-1 min-w-0">
										<Input id="csec" bind:value={clientSecret} placeholder="agt_sec_••••••••" size="sm" type={secretRevealed ? 'text' : 'password'} />
									</div>
									<button
										class="w-[30px] h-[30px] shrink-0 inline-flex items-center justify-center border border-[var(--border)] bg-transparent cursor-pointer rounded-[3px] text-[var(--fg-dim)] hover:text-[var(--accent)] transition-colors"
										onclick={() => (secretRevealed = !secretRevealed)}
										aria-label={secretRevealed ? 'Hide secret' : 'Show secret'}
									>
										<Icon name={secretRevealed ? 'eye-off' : 'eye'} size={13} />
									</button>
								</div>
							</div>
							<div class="col-span-2">
								<label class="block text-[10px] text-[var(--fg-dim)] mb-1" for="ep">Control plane</label>
								<Input id="ep" bind:value={endpoint} size="sm" type="url" />
							</div>
						</div>
					</section>

					<!-- Capabilities — every registered agent mode, not just proxies -->
					<section class="mb-6">
						<div class="flex items-center justify-between mb-2">
							<div class="text-[10px] text-[var(--fg-dim)] uppercase tracking-widest">
								Capabilities <span class="text-[var(--fg-muted)]">· {addedModes.length}</span>
							</div>
							<button
								class="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider px-2 py-1 rounded-[3px] border border-[var(--border-accent)] bg-transparent cursor-pointer text-[var(--accent)] hover:bg-teal-300/10 transition-colors"
								onclick={() => (catalogOpen = !catalogOpen)}
							>
								<Icon name={catalogOpen ? 'chevron-up' : 'arrow-down'} size={10} />ADD CAPABILITY
							</button>
						</div>

						{#if catalogOpen}
							<div class="mb-2.5 border border-[var(--border-accent)] rounded-sm bg-black/20 divide-y divide-[var(--border)]">
								{#each MODES.filter((m) => !addedModes.includes(m.key)) as m (m.key)}
									<button class="w-full flex items-start gap-2.5 px-3 py-2 text-left bg-transparent border-none cursor-pointer hover:bg-teal-300/[0.06] transition-colors" onclick={() => addMode(m.key)}>
										<span class="mt-px" style:color={m.color}>{@render glyph(glyphForMode(m.key), 14)}</span>
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2">
												<span class="text-[11px] text-[var(--fg)]">{m.name}</span>
												<span class="font-mono text-[9px] text-teal-300/70 bg-teal-300/[0.06] border border-teal-300/15 px-1 py-px">{m.key}</span>
											</div>
											<div class="text-[10px] text-[var(--fg-dim)] mt-0.5">{m.desc}</div>
										</div>
										{#if m.env}
											<span class="font-mono text-[8px] text-amber-400/70 tracking-wide mt-1 shrink-0">HOST CONFIG</span>
										{/if}
										<span class="text-[var(--fg-dim)] mt-0.5">+</span>
									</button>
								{/each}
								{#if MODES.every((m) => addedModes.includes(m.key))}
									<p class="text-[10px] text-[var(--fg-muted)] italic px-3 py-2">Every capability added.</p>
								{/if}
							</div>
						{/if}

						{#if addedModes.length === 0}
							<div class="border border-dashed border-[var(--border)] rounded-sm px-3 py-6 text-center">
								<p class="text-[11px] text-[var(--fg-dim)]">No capabilities yet.</p>
								<p class="text-[10px] text-[var(--fg-muted)] mt-1">Add one — it becomes a mode this agent runs.</p>
							</div>
						{:else}
							<div class="space-y-1.5">
								{#each addedModes as key (key)}
									{@const m = modeOf(key)}
									<div class="border border-[var(--border)] rounded-sm overflow-hidden">
										<div class="flex items-center gap-2 px-2.5 py-2">
											<span style:color={m.color}>{@render glyph(glyphForMode(key), 14)}</span>
											<span class="text-[11px] text-[var(--fg)]">{m.name}</span>
											<span class="font-mono text-[9px] text-teal-300/70 bg-teal-300/[0.06] border border-teal-300/15 px-1 py-px">{key}</span>
											<span class="flex-1"></span>
											{#if m.env}
												<span class="font-mono text-[8px] text-amber-400/70 tracking-wide">HOST CONFIG</span>
											{/if}
											<button class="bg-transparent border-none cursor-pointer text-[var(--fg-dim)] hover:text-rose-400 transition-colors p-0.5" aria-label="Remove {m.name}" onclick={() => removeMode(key)}>
												<Icon name="trash-2" size={11} />
											</button>
										</div>

										<!-- Ecosystems are TOOLS of supply_chain_proxy, not top-level -->
										{#if key === 'supply_chain_proxy'}
											<div class="px-2.5 pb-2.5 pt-0.5 border-t border-[var(--border)] bg-white/[0.015]">
												<div class="text-[9px] text-[var(--fg-dim)] uppercase tracking-widest my-1.5">
													Ecosystems <span class="text-[var(--fg-muted)] normal-case tracking-normal">· permitted by {key}</span>
												</div>
												<div class="flex flex-wrap gap-1.5">
													{#each ECOSYSTEMS as e (e.type)}
														<button
															class="inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] rounded-[3px] border cursor-pointer transition-colors {enabledEcos.has(e.type)
																? 'border-teal-300/45 bg-teal-300/[0.08] text-[var(--accent)]'
																: 'border-[var(--border)] bg-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
															onclick={() => toggleEco(e.type)}
														>
															<Icon name={e.icon} size={11} strokeWidth={1.6} />{e.name}
															<span class="text-[8px] opacity-70">:{e.port}</span>
														</button>
													{/each}
												</div>
												{#if activeEcos.length === 0}
													<p class="text-[10px] text-amber-400/80 mt-1.5">Pick at least one ecosystem.</p>
												{/if}
											</div>
										{:else if (MODE_TOOLS[key] ?? []).length}
											<!-- Intrinsic tools — included with the mode, not add/remove -->
											<div class="px-2.5 pb-2.5 pt-0.5 border-t border-[var(--border)] bg-white/[0.015]">
												<div class="text-[9px] text-[var(--fg-dim)] uppercase tracking-widest my-1.5">
													Tools <span class="text-[var(--fg-muted)] normal-case tracking-normal">· included with {key}</span>
												</div>
												<div class="flex flex-wrap gap-1.5">
													{#each MODE_TOOLS[key] as t (t)}
														<span class="inline-flex items-center gap-1.5 px-2 py-1 font-mono text-[10px] rounded-[3px] border border-[var(--border)] text-[var(--fg-muted)]">
															<span style:color={m.color}>{@render glyph(TOOL_GLYPH[t] ?? TERMINAL_GLYPH, 11)}</span>{t}
														</span>
													{/each}
												</div>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</section>

					<!-- Generated config -->
					<section class="mb-2">
						{@render secLabel('agent.yaml')}
						<ConfigBlock yaml={generatedYaml} />
					</section>
				{/if}
			</main>

			<!-- ── RIGHT: config mesh preview + what changes on this host ───── -->
			<aside class="w-[470px] shrink-0 flex flex-col border-l border-[var(--border)] pl-6">
				<div class="flex items-center justify-between mb-2 shrink-0">
					<div class="text-[10px] text-[var(--fg-dim)] uppercase tracking-widest">
						Config preview
						<span class="text-[var(--fg-muted)] normal-case tracking-normal">
							· {addedModes.length > 1 ? 'multi-mode agent' : 'single-mode agent'}
						</span>
					</div>
					<span class="font-mono text-[9px] text-[var(--fg-muted)] tracking-wide">
						{runState === 'running' ? 'LIVE' : 'PENDING'}
					</span>
				</div>

				<!-- the mesh: one agent, modes fanned out as satellites -->
				<div class="relative flex-1 min-h-[260px] border border-[var(--border)] rounded-sm bg-black/20 overflow-hidden">
					{#if addedModes.length === 0}
						<div class="absolute inset-0 flex items-center justify-center">
							<p class="text-[10px] text-[var(--fg-muted)] italic">Add a capability to see the agent.</p>
						</div>
					{:else}
						<Canvas bind:camera>
							<MeshStudio concept="instrument" {tuning} edgeCurve="bow" bind:nodes={meshNodes} bind:edges={meshEdges} />
						</Canvas>
					{/if}
				</div>

				<!-- what changes on this host -->
				<div class="shrink-0 pt-3 mt-3 border-t border-[var(--border)]">
					<div class="flex items-center justify-between mb-1">
						<div class="text-[10px] text-[var(--fg-dim)] uppercase tracking-widest">
							This machine <span class="text-[var(--fg-muted)] normal-case tracking-normal">· {OS_LABEL[os]}</span>
						</div>
						{#if os === detectedOs}
							<span class="font-mono text-[9px] text-[var(--fg-muted)] tracking-wide">DETECTED</span>
						{/if}
					</div>

					<p class="text-[11px] text-[var(--fg-muted)] leading-snug mb-2.5">
						{#if !needsEnv && addedModes.length}
							Nothing to change here — these capabilities don't touch the host.
						{:else if needsEnv}
							Points <span class="text-[var(--fg)]">{promise}</span> at the agent so nothing reaches upstream first.
						{:else}
							Add a capability to see what changes.
						{/if}
					</p>

					{#if needsEnv}
						<div class="flex items-center gap-2 flex-wrap">
							{#if envDone}
								<span class="inline-flex items-center gap-1.5 font-mono text-[10px] text-emerald-300 bg-emerald-300/[0.08] border border-emerald-300/25 rounded-[3px] px-2 py-1 tracking-wide">
									<Icon name="shield-check" size={11} />{promise} → armornet
								</span>
								<button class="font-mono text-[10px] bg-transparent border-none cursor-pointer text-[var(--fg-dim)] hover:text-[var(--fg)] underline underline-offset-2" onclick={resetEnv}>Re-run</button>
							{:else}
								<Button variant="primary" size="sm" loading={envBusy} onclick={configureMachine}>
									{#snippet children()}
										<Icon name="zap" size={11} />CONFIGURE THIS MACHINE
									{/snippet}
								</Button>
								<span class="font-mono text-[9px] text-amber-400/80 tracking-wide">{envRows.filter((r) => r.admin).length} NEED ADMIN</span>
							{/if}
							<span class="flex-1"></span>
							<button
								class="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-2 py-1 rounded-[3px] border cursor-pointer transition-colors {showDetails
									? 'border-[var(--border-accent)] text-[var(--accent)] bg-teal-300/10'
									: 'border-[var(--border)] bg-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
								onclick={() => (showDetails = !showDetails)}
							>
								<Icon name={showDetails ? 'chevron-up' : 'chevron-down'} size={10} />{envRows.length} CHANGES
							</button>
							<button
								class="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider px-2 py-1 rounded-[3px] border cursor-pointer transition-colors {showCommands
									? 'border-[var(--border-accent)] text-[var(--accent)] bg-teal-300/10'
									: 'border-[var(--border)] bg-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
								onclick={() => (showCommands = !showCommands)}
							>
								{@render glyph(TERMINAL_GLYPH, 11)}
							</button>
						</div>

						{#if showDetails || showCommands}
							<div class="inst-scroll mt-2 max-h-[210px] overflow-y-auto space-y-1.5 pr-1">
								{#each envRows as r (r.id)}
									{@const st = envStatus[r.id] ?? 'idle'}
									<div class="border rounded-sm transition-colors {st === 'done' ? 'border-emerald-300/25 bg-emerald-300/[0.04]' : 'border-[var(--border)]'}">
										<div class="flex items-center gap-2 px-2.5 py-1.5">
											<span class="{st === 'done' ? 'text-emerald-300' : 'text-[var(--fg-dim)]'}">
												{#if r.glyph}{@render glyph(r.glyph, 13)}{:else if r.icon}<Icon name={r.icon} size={13} strokeWidth={1.6} />{/if}
											</span>
											<div class="flex-1 min-w-0">
												<div class="text-[11px] text-[var(--fg)]">{r.name}</div>
												<div class="font-mono text-[9px] text-[var(--fg-dim)] truncate" title={r.file}>{r.file}</div>
											</div>
											{#if st === 'working'}
												<span class="font-mono text-[9px] text-amber-300 tracking-wide">WRITING…</span>
											{:else if st === 'done'}
												<span class="inline-flex items-center gap-1 font-mono text-[9px] text-emerald-300 tracking-wide">
													<Icon name="check" size={10} strokeWidth={2.5} />VERIFIED
												</span>
											{:else if r.admin}
												<span class="font-mono text-[9px] text-amber-400/80 tracking-wide">NEEDS ADMIN</span>
											{:else}
												<span class="font-mono text-[9px] text-[var(--fg-muted)] tracking-wide">NOT SET</span>
											{/if}
										</div>

										{#if st === 'done'}
											<div class="px-2.5 pb-1.5 pt-0 font-mono text-[9px] leading-relaxed">
												<div class="text-[var(--fg-dim)]">$ {r.verify}</div>
												<div class="text-emerald-300">{r.verifyOut}</div>
											</div>
										{:else if showCommands}
											<div class="px-2.5 pb-1.5 pt-0">
												<div class="font-mono text-[9px] text-[var(--fg-muted)] bg-black/30 border border-[var(--border)] rounded-[2px] px-2 py-1.5 overflow-x-auto whitespace-pre">{r.cmd}</div>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			</aside>
		</div>
	</div>

	<!-- ── Footer ──────────────────────────────────────────────────────────── -->
	<footer class="shrink-0 border-t border-[var(--border)] bg-[var(--bg-elev)] px-6 py-3">
		<div class="max-w-[1240px] mx-auto flex items-center gap-4">
			<div class="flex items-center gap-1.5">
				<span class="font-mono text-[9px] text-[var(--fg-dim)] tracking-widest">DEMO OS</span>
				{#each Object.keys(OS_LABEL) as k}
					<button
						class="px-2 py-1 border rounded-[3px] font-mono text-[9px] tracking-wider cursor-pointer transition-colors {os === k
							? 'border-[var(--border-accent)] text-[var(--accent)] bg-teal-300/10'
							: 'border-[var(--border)] bg-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]'}"
						onclick={() => {
							os = k as OsKey;
							resetEnv();
						}}>{OS_LABEL[k as OsKey].toUpperCase()}</button
					>
				{/each}
			</div>

			<div class="flex-1"></div>

			{#if runState === 'running'}
				<span class="inline-flex items-center gap-1.5 font-mono text-[10px] text-emerald-300 tracking-wide">
					<span class="w-[6px] h-[6px] rounded-full bg-emerald-400"></span>RUNNING · JOINED THE MESH
				</span>
				<Button variant="ghost" size="sm" onclick={() => (runState = 'idle')}>STOP</Button>
			{:else}
				<span class="font-mono text-[10px] text-[var(--fg-muted)]">
					{#if !configReady}
						{source === 'file' ? 'Load a config file' : 'Add credentials + a capability'}
					{:else if !envDone}
						Configure the machine to continue
					{:else}
						Ready
					{/if}
				</span>
				<Button variant="primary" size="md" loading={runState === 'starting'} disabled={!canStart} onclick={() => (runState = 'starting')}>
					{#snippet children()}
						<Icon name="play" size={12} />START AGENT
					{/snippet}
				</Button>
			{/if}
		</div>
	</footer>
</div>

<style>
	/* Icon inner inset — matches NodeDrawer's .dc-icon */
	.inst-icon::after {
		content: '';
		position: absolute;
		inset: 3px;
		border: 1px solid var(--border-strong);
	}

	/* Scrollbar — matches NodeDrawer's .dc-content */
	.inst-scroll {
		scrollbar-width: thin;
		scrollbar-color: var(--border-accent) transparent;
	}
	.inst-scroll::-webkit-scrollbar {
		width: 6px;
	}
	.inst-scroll::-webkit-scrollbar-thumb {
		background: var(--border-accent);
		border-radius: 3px;
	}
	.inst-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.inst {
		animation: inst-in 0.3s ease both;
	}
	@keyframes inst-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@media (max-width: 1180px) {
		.inst aside {
			width: 380px;
		}
	}
</style>
