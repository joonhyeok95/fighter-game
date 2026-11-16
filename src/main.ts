import { runViewer } from './viewer';
const q = new URLSearchParams(location.search);
if (q.get('view') === 'anims') runViewer();
else import('./game').then((m) => m.boot());
