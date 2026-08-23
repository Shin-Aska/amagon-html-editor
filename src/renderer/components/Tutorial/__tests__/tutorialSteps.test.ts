import {describe, expect, it} from 'vitest'
import {tutorialSteps} from '../tutorialSteps'

describe('main tutorial toolbar coverage', () => {
    it('introduces export before the preview controls', () => {
        const stepIds = tutorialSteps.map((step) => step.id);
        const exportIndex = stepIds.indexOf('toolbar-export');
        const viewportIndex = stepIds.indexOf('toolbar-viewport');

        expect(exportIndex).toBeGreaterThan(stepIds.indexOf('sidebar-layers'));
        expect(exportIndex).toBeLessThan(viewportIndex);
        expect(tutorialSteps[exportIndex]).toMatchObject({
            target: '[data-tutorial="toolbar-export"]',
            title: 'Export your site',
            action: {type: 'none'},
            autoAdvance: false
        })
    });

    it('explains the editor-only motion preference after responsive preview', () => {
        const stepIds = tutorialSteps.map((step) => step.id);
        const motionIndex = stepIds.indexOf('toolbar-motion-preview');

        expect(motionIndex).toBeGreaterThan(stepIds.indexOf('toolbar-viewport'));
        expect(motionIndex).toBeLessThan(stepIds.indexOf('toolbar-undo-redo'));
        expect(tutorialSteps[motionIndex]).toMatchObject({
            target: '[data-tutorial="toolbar-motion-preview"]',
            title: 'Motion preview',
            action: {type: 'none'},
            autoAdvance: false
        });
        expect(tutorialSteps[motionIndex]?.body).toContain('System, Full, or Reduced');
        expect(tutorialSteps[motionIndex]?.body).toContain('exported sites')
    })
});
