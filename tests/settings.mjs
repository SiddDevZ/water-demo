import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,PRESETS,normalizeSettings,loadSettings,saveSettings} from '../src/settings.js';
assert.deepEqual(normalizeSettings(),DEFAULT_SETTINGS);
assert.equal(normalizeSettings({waveSpeed:99}).waveSpeed,1.6);
assert.equal(normalizeSettings({stirChoppiness:-1}).stirChoppiness,0);
assert.equal(normalizeSettings({stirChoppiness:9}).stirChoppiness,1.5);
assert.equal(normalizeSettings({stirChoppiness:NaN}).stirChoppiness,1);
assert.equal(normalizeSettings({waterSunlight:-1}).waterSunlight,0);
assert.equal(normalizeSettings({waterSunlight:9}).waterSunlight,6);
assert.equal(normalizeSettings({sunIntensity:12}).sunIntensity,10);
assert.equal(normalizeSettings({sunIntensity:7}).sunIntensity,7);
assert.deepEqual(Object.values(PRESETS).map(p=>p.stirChoppiness),[1,.25,1.15,1.4]);
assert.deepEqual(Object.values(PRESETS).map(p=>p.waterSunlight),[2.2,1.1,2.8,2.4]);
assert.equal(normalizeSettings({throwDuration:-1}).throwDuration,.1);
assert.equal(normalizeSettings({sunIntensity:NaN}).sunIntensity,3.4);
assert.equal(normalizeSettings({fishResponse:Infinity}).fishResponse,1);
for(const [name,preset]of Object.entries(PRESETS)){assert.equal(normalizeSettings(preset).preset,name);assert.deepEqual(normalizeSettings(preset),preset);}
const data=new Map();globalThis.localStorage={getItem:key=>data.get(key),setItem:(key,v)=>data.set(key,v)};
saveSettings({...PRESETS.playful,stirStrength:1.1});assert.equal(loadSettings().stirStrength,1.1);assert.equal(loadSettings().preset,'playful');
saveSettings({...PRESETS.natural,preset:'custom',stirChoppiness:1.37,waterSunlight:4.2});
assert.equal(loadSettings().stirChoppiness,1.37);assert.equal(loadSettings().waterSunlight,4.2);
// Existing saved settings acquire new controls without changing their old palette.
data.set('komorebi.settings.v1',JSON.stringify({preset:'custom',waterBlue:.83,sunIntensity:3.2}));
assert.equal(loadSettings().stirChoppiness,1);assert.equal(loadSettings().waterSunlight,2.2);
assert.equal(loadSettings().waterBlue,.83);assert.equal(loadSettings().sunIntensity,3.2);
data.set('komorebi.settings.v1','bad json');assert.deepEqual(loadSettings(),DEFAULT_SETTINGS);
globalThis.localStorage={getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}};
assert.deepEqual(loadSettings(),DEFAULT_SETTINGS);assert.doesNotThrow(()=>saveSettings(PRESETS.glass));
console.log('PASS settings defaults,bounds,presets,persistence,invalid storage');
