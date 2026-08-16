/**
 * One selectable option, shared by the choice controls (`RadioList`,
 * `CheckboxList`, `SegmentGroup`).
 *
 * These controls previously typed their options as `AssessmentLookupOption`,
 * which tied three generic form widgets to the vendor-assessment domain. The
 * shape was never assessment-specific — it is a label, a value and an optional
 * description — so it lives here and the domain keeps its own alias.
 */
export interface ChoiceOption {
	label: string;
	value: string;
	/** Secondary line under the label, for options that need a gloss. */
	description?: string;
}
