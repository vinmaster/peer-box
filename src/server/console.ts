import repl from 'repl';
import { Util } from '../common/util';
global['Util'] = Util;

// import * as common from '../common';
// Object.keys(common).forEach(m => (global[m] = common[m]));

const replServer = repl.start({
  prompt: 'repl > ',
});
