import repl from 'repl';
import { Util } from '../common/util';
import { WebSocketService } from '../server/routes/ws';
global['Util'] = Util;
global['WebSocketService'] = WebSocketService;

// import * as common from '../common';
// Object.keys(common).forEach(m => (global[m] = common[m]));

const replServer = repl.start({
  prompt: 'repl > ',
});
