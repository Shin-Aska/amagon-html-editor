import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import {registerBlocks} from './registry/registerBlocks'
import {useAppSettingsStore} from './store/appSettingsStore'

registerBlocks();
useAppSettingsStore.getState().loadSettings();

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App/>
    </React.StrictMode>
);
