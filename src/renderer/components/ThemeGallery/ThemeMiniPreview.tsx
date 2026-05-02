import {useMemo} from 'react'
import {blockToHtml} from '../../utils/blockToHtml'
import {createBlock, themeToCSS, type Block, type ProjectTheme} from '../../store/types'

interface ThemeMiniPreviewProps {
    theme: ProjectTheme
    title: string
}

export const previewSampleBlocks: Block[] = [
    createBlock('section', {
        styles: {
            padding: '18px',
            minHeight: '100%',
            background: 'linear-gradient(180deg, color-mix(in srgb, var(--theme-primary) 12%, transparent) 0%, transparent 48%)'
        },
        children: [
            createBlock('container', {
                styles: {display: 'flex', flexDirection: 'column', gap: '10px'},
                children: [
                    createBlock('paragraph', {
                        props: {text: 'AMAGON'},
                        styles: {margin: '0', color: 'var(--theme-primary)', fontSize: '10px', letterSpacing: '0.16em', fontWeight: '700'}
                    }),
                    createBlock('heading', {
                        props: {text: 'Theme Preview', level: 2},
                        styles: {margin: '0', fontSize: '24px'}
                    }),
                    createBlock('paragraph', {
                        props: {text: 'A quick look at hierarchy, contrast, and CTA styling.'},
                        styles: {margin: '0', color: 'var(--theme-text-muted)', fontSize: '12px'}
                    }),
                    createBlock('container', {
                        styles: {display: 'flex', gap: '8px', marginTop: '2px'},
                        children: [
                            createBlock('button', {
                                props: {text: 'Apply'},
                                styles: {background: 'var(--theme-primary)', color: '#fff', border: 'none', padding: '9px 12px', borderRadius: 'var(--theme-border-radius)'}
                            }),
                            createBlock('button', {
                                props: {text: 'Preview'},
                                styles: {background: 'var(--theme-surface)', color: 'var(--theme-text)', border: '1px solid var(--theme-border)', padding: '9px 12px', borderRadius: 'var(--theme-border-radius)'}
                            })
                        ]
                    }),
                    createBlock('container', {
                        styles: {display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginTop: '4px'},
                        children: [
                            ['Primary', '82'],
                            ['Accent', '14'],
                            ['Cards', '06']
                        ].map(([label, value]) =>
                            createBlock('container', {
                                styles: {padding: '10px', borderRadius: 'var(--theme-border-radius)', border: '1px solid var(--theme-border)', background: 'var(--theme-surface)'},
                                children: [
                                    createBlock('paragraph', {props: {text: label}, styles: {margin: '0 0 4px', fontSize: '10px', color: 'var(--theme-text-muted)'}}),
                                    createBlock('heading', {props: {text: value, level: 3}, styles: {margin: '0', fontSize: '16px'}})
                                ]
                            })
                        )
                    })
                ]
            })
        ]
    })
]

export default function ThemeMiniPreview({theme, title}: ThemeMiniPreviewProps): JSX.Element {
    const srcDoc = useMemo(() => {
        const css = themeToCSS(theme);
        const html = blockToHtml(previewSampleBlocks, {framework: 'vanilla'});

        return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${css}</style>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; min-height: 100%; background: var(--theme-bg); }
      body { overflow: hidden; }
      .theme-gallery-preview-root {
        min-height: 100vh;
        color: var(--theme-text);
        background: var(--theme-bg);
      }
      button {
        font: inherit;
      }
    </style>
  </head>
  <body>
    <div class="theme-gallery-preview-root">${html}</div>
  </body>
</html>`
    }, [theme]);

    return (
        <iframe
            className="theme-gallery-preview-frame"
            title={`${title} preview`}
            srcDoc={srcDoc}
            loading="lazy"
            sandbox="allow-scripts"
        />
    )
}
