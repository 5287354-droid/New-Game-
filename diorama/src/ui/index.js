// UI の入口。main.js は ここから import する。
// 使う前に css/ui.css を <link> で読むこと。
export { uiRoot, setArea, setSfx, AREAS, h } from './dom.js';
export { press, setFallback, hasLayer, KEYMAP } from './input.js';
export * as fx from './fx.js';
export { setMaterials } from './widgets.js';
export { createDialog } from './dialog.js';
export { createPad } from './pad.js';
export { openMenu } from './menu.js';
export { createBattleUI } from './battle.js';
export { openBreed } from './breed.js';
export { openDex } from './dex.js';
export { openShop, openInn, openStorage } from './shop.js';
export { openTitle, openNameEntry } from './title.js';
export { showAreaPlate, showGot } from './toast.js';
