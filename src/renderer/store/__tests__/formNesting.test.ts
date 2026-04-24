import {beforeEach, describe, expect, it} from 'vitest'
import {useEditorStore} from '../editorStore'
import {createBlock} from '../types'

describe('form nesting prevention', () => {
    beforeEach(() => {
        // Reset the store before each test
        useEditorStore.getState().loadPageBlocks([])
    })

    it('allows adding a form block at the top level', () => {
        const form = createBlock('form')
        useEditorStore.getState().addBlock(form)

        const blocks = useEditorStore.getState().blocks
        expect(blocks.length).toBe(1)
        expect(blocks[0].type).toBe('form')
    })

    it('allows adding a container with isForm at the top level', () => {
        const container = createBlock('container', { props: { isForm: true } })
        useEditorStore.getState().addBlock(container)

        const blocks = useEditorStore.getState().blocks
        expect(blocks.length).toBe(1)
        expect(blocks[0].props.isForm).toBe(true)
    })

    it('allows adding a form inside a non-form container', () => {
        const container = createBlock('container')
        useEditorStore.getState().addBlock(container)

        const form = createBlock('form')
        useEditorStore.getState().addBlock(form, container.id)

        const blocks = useEditorStore.getState().blocks
        expect(blocks[0].children.length).toBe(1)
        expect(blocks[0].children[0].type).toBe('form')
    })

    it('prevents adding a form block inside another form block', () => {
        const outerForm = createBlock('form')
        useEditorStore.getState().addBlock(outerForm)

        const innerForm = createBlock('form')
        useEditorStore.getState().addBlock(innerForm, outerForm.id)

        const blocks = useEditorStore.getState().blocks
        expect(blocks[0].children.length).toBe(0)
    })

    it('prevents adding a form block inside a container with isForm', () => {
        const formContainer = createBlock('container', { props: { isForm: true } })
        useEditorStore.getState().addBlock(formContainer)

        const innerForm = createBlock('form')
        useEditorStore.getState().addBlock(innerForm, formContainer.id)

        const blocks = useEditorStore.getState().blocks
        expect(blocks[0].children.length).toBe(0)
    })

    it('prevents adding a container with isForm inside a form', () => {
        const outerForm = createBlock('form')
        useEditorStore.getState().addBlock(outerForm)

        const innerFormContainer = createBlock('container', { props: { isForm: true } })
        useEditorStore.getState().addBlock(innerFormContainer, outerForm.id)

        const blocks = useEditorStore.getState().blocks
        expect(blocks[0].children.length).toBe(0)
    })

    it('prevents adding a block containing a nested form inside a form', () => {
        const outerForm = createBlock('form')
        useEditorStore.getState().addBlock(outerForm)

        const wrapper = createBlock('container', {
            children: [createBlock('form')]
        })
        useEditorStore.getState().addBlock(wrapper, outerForm.id)

        const blocks = useEditorStore.getState().blocks
        expect(blocks[0].children.length).toBe(0)
    })

    it('prevents moving a form into a form (moveBlock)', () => {
        const outerForm = createBlock('form')
        useEditorStore.getState().addBlock(outerForm)

        const standAloneForm = createBlock('form')
        useEditorStore.getState().addBlock(standAloneForm)

        // Both should be at top level
        expect(useEditorStore.getState().blocks.length).toBe(2)

        // Try to move standalone form into outer form
        useEditorStore.getState().moveBlock(standAloneForm.id, outerForm.id, 0)

        const blocks = useEditorStore.getState().blocks
        // The move should have been prevented — outer form should still have no children
        expect(blocks[0].children.length).toBe(0)
        expect(blocks.length).toBe(2)
    })

    it('allows adding non-form elements inside a form', () => {
        const form = createBlock('form')
        useEditorStore.getState().addBlock(form)

        const input = createBlock('input', { props: { type: 'text', name: 'email' } })
        useEditorStore.getState().addBlock(input, form.id)

        const button = createBlock('button', { props: { text: 'Submit' } })
        useEditorStore.getState().addBlock(button, form.id)

        const blocks = useEditorStore.getState().blocks
        expect(blocks[0].children.length).toBe(2)
        expect(blocks[0].children[0].type).toBe('input')
        expect(blocks[0].children[1].type).toBe('button')
    })
})
