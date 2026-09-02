class ShowcaseState {
	activeComponent = $state<string | null>(null);
	selectedCode = $state<string | null>(null);
	sidebarOpen = $state(false);
}

export const showcaseState = new ShowcaseState();
