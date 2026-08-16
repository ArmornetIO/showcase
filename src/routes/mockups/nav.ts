import type { IconName } from '$lib/icons/Icon.svelte';

/**
 * Sidebar labels for local mockups.
 *
 * This file is gitignored along with the mockups it describes — a mockup only
 * exists on the machine that made it, and so does its label. The layout reads
 * this map when it is present and falls back to a slug-derived title when it is
 * not, so a fresh clone lists whatever mockups that clone happens to have (which
 * is normally just the Realtime Refinement example) with no dead links.
 *
 * A slug listed here that has no folder is simply skipped, so pruning this map
 * after deleting a mockup is tidiness rather than maintenance.
 */
export interface MockupMeta {
	label: string;
	icon: IconName;
	/** Sidebar section. Anything without one lands under "Mockups". */
	section?: string;
}

export const MOCKUP_NAV: Record<string, MockupMeta> = {
	'breach-arena': { label: 'BREACH · Arena', icon: 'shapes' },
	'risk-assess-density': { label: 'Risk · Assess Density', icon: 'activity' },
	'about-us': { label: 'About Us', icon: 'users' },
	'mesh-line': { label: 'The Line', icon: 'globe' },
	'mesh-shield': { label: 'Mesh Shield', icon: 'crestlink' },
	'scene-builder': { label: 'Scene Builder', icon: 'layers' },
	'scene-player': { label: 'Scene Player', icon: 'play' },
	'org-onboarding-flow': { label: 'Org Onboarding · Flow', icon: 'share-2' },
	'onboarding-wizard': { label: 'Org Onboarding · Wizard', icon: 'clipboard-check' },
	'onboarding-risk-mapping': { label: 'Risk Import · GenAI', icon: 'zap' },
	'policy-authoring': { label: 'Policy Authoring · Evidence', icon: 'file-text' },
	'nav-chrome': { label: 'Nav Chrome · Linear sidebar', icon: 'menu' },
	'mesh-nav-tree': { label: 'Mesh Nav · Adaptive tree', icon: 'mesh' },
	'command-bar': { label: 'Command Bar · Linear', icon: 'search' },
	'sidenav-motion': { label: 'Side Nav · Motion', icon: 'zap' },
	'ecosystems-posture': { label: 'Ecosystems · Posture', icon: 'package' },
	'posture-cis': { label: 'Posture · CIS', icon: 'shield-check' },
	'codebase-analysis': { label: 'Codebase Analysis', icon: 'package' },
	'risk-register': { label: 'Risk Register', icon: 'shield-alert' },
	'vendor-assessment-split-rich': { label: 'Vendor Assessment', icon: 'clipboard-check' },
	'vendors-mesh-hero': { label: 'Vendors · Mesh Hero', icon: 'network' },
	'agent-clients': { label: 'Agent Clients · Credentials', icon: 'key' },
	'download-agent': { label: 'Download Agent', icon: 'download' },
	'agent-installer': { label: 'Agent Installer', icon: 'settings-2' },
	'agent-install': { label: 'Install Agent', icon: 'download' },
	'agent-install-flow': { label: 'Agent Install Flow', icon: 'git-branch' },
	'codeowners-tree': { label: 'CODEOWNERS (tree)', icon: 'git-branch' },
	'codeowners-rules': { label: 'CODEOWNERS (rules)', icon: 'file-text' },
	'trust-center': { label: 'Trust Center', icon: 'shield' },

	'settings-identity': { label: 'Identity', icon: 'fingerprint', section: 'Settings & Admin' },
	'settings-org': { label: 'Org Settings', icon: 'settings', section: 'Settings & Admin' },
	'admin-users': { label: 'Admin Users', icon: 'users', section: 'Settings & Admin' },
	'admin-quotas': { label: 'Org Quotas', icon: 'settings-2', section: 'Settings & Admin' }
};
