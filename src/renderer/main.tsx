import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import {registerBlocks} from './registry/registerBlocks'
import {useAppSettingsStore} from './store/appSettingsStore'
import {preloadAiModels} from './aiBootstrap'

registerBlocks();
useAppSettingsStore.getState().loadSettings();
void preloadAiModels()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
);
