import type {Plugin} from 'vite'

export function frameworkFontCors(): Plugin {
    return {
        name: 'framework-font-cors',
        configureServer(server) {
            server.middlewares.use((request, response, next) => {
                const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
                // Opaque preview frames can read bundled fonts, but not development source files.
                if (pathname.startsWith('/frameworks/') && /\.(woff2?|ttf|otf)$/.test(pathname)) {
                    response.setHeader('Access-Control-Allow-Origin', '*')
                }
                next()
            })
        }
    }
}
