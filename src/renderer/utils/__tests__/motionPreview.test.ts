import {describe, expect, it} from 'vitest'
import {isMotionPreviewMode, MOTION_PREVIEW_MODES} from '../motionPreview'

describe('motion preview modes', () => {
    it('exposes the three editor preview choices', () => {
        expect(MOTION_PREVIEW_MODES).toEqual(['system', 'full', 'reduced'])
    });

    it('accepts only supported persisted values', () => {
        for (const mode of MOTION_PREVIEW_MODES) {
            expect(isMotionPreviewMode(mode)).toBe(true)
        }

        expect(isMotionPreviewMode('always')).toBe(false);
        expect(isMotionPreviewMode(null)).toBe(false)
    })
})
