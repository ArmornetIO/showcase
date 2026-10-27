import { describe, it, expect } from 'vitest';
import { builder } from './store.svelte.js';
import { storyboard } from './storyboard.svelte.js';

// The two verbs the filmstrip is built on, against the real canvas store: what
// "next screen" puts on the canvas, and where each kind of add lands in order.

describe('storyboard', () => {
	it('next screen adds the source and a copy beside it, carrying its contents', () => {
		const frame = builder.addFrame('mobile-390', 0, 0);
		builder.addItem('Button', 40, 40);
		builder.selectFrame(frame.id);

		storyboard.create('Flow');
		storyboard.nextScreen();

		const stages = storyboard.active!.stages;
		expect(stages).toHaveLength(2);
		expect(stages[0].target).toBe(frame.id);
		const copy = builder.frames.find((f) => f.id === stages[1].target)!;
		expect(copy.x).toBeGreaterThan(frame.x + frame.w);
		expect(builder.frameMembers(copy.id)).toHaveLength(1);
		expect(storyboard.currentStageId).toBe(stages[1].id);
		expect(storyboard.steps.get(`${builder.activePageId}:${copy.id}`)).toEqual([2]);

		// A second "next" from the same source steps past the first copy and
		// inserts right after the source's stage.
		builder.selectFrame(frame.id);
		storyboard.nextScreen();
		const again = storyboard.active!.stages;
		expect(again).toHaveLength(3);
		const second = builder.frames.find((f) => f.id === again[1].target)!;
		expect(second.x).toBeGreaterThan(copy.x + copy.w);
	});

	it('a deleted target resolves to missing, and reorder moves a stage', () => {
		const stages = storyboard.active!.stages;
		builder.deleteFrame(stages[2].target, true);
		expect(storyboard.resolve(stages[2])).toBeNull();
		expect(storyboard.resolve(stages[0])?.kind).toBe('frame');

		storyboard.moveStage(stages[2].id, 0);
		expect(storyboard.active!.stages[0].id).toBe(stages[2].id);
	});
});
