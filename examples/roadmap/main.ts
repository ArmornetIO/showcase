import { mount } from 'svelte';
import './app.css';
import Roadmap from './Roadmap.svelte';
import { buildRoadmap, type RoadmapDoc } from './model.js';
import doc from './roadmap.gen.json';

const todayISO = new Date().toISOString().slice(0, 10);

export default mount(Roadmap, {
	target: document.getElementById('app')!,
	props: { rm: buildRoadmap(doc as RoadmapDoc, todayISO), todayISO }
});
