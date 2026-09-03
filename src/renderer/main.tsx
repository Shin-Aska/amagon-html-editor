import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import {registerBlocks} from './registry/registerBlocks'
import {useAppSettingsStore} from './store/appSettingsStore'

const shouldEnableReactDevTools =
    import.meta.env.DEV && import.meta.env.VITE_DISABLE_REACT_DEVTOOLS !== '1'

const reactDevToolsReady = shouldEnableReactDevTools
    ? Promise.allSettled([
        import('react-grab'),
        import('react-scan').then(({scan}) => scan())
    ])
    : Promise.resolve()

void reactDevToolsReady.then(() => {
    registerBlocks();
    useAppSettingsStore.getState().loadSettings();

    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App/>
        </React.StrictMode>
    );
});
