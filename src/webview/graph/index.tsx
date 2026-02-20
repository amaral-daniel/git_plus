import { createRoot } from 'react-dom/client';
import { GraphView } from './GraphView';
import { GitCommit } from '../types';

declare global {
    interface Window {
        __COMMITS__: GitCommit[];
    }
}

const root = document.getElementById('root')!;
createRoot(root).render(<GraphView commits={window.__COMMITS__} />);
