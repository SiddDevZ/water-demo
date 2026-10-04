import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,PRESETS,normalizeSettings,loadSettings,saveSettings} from '../src/settings.js';
assert.deepEqual(normalizeSettings(),DEFAULT_SETTINGS);
assert.equal(normalizeSettings({waveSpeed:99}).waveSpeed,1.6);
assert.equal(normalizeSettings({throwDuration:-1}).throwDuration,.1);
assert.equal(normalizeSettings({sunIntensity:NaN}).sunIntensity,3.4);
assert.equal(normalizeSettings({fishResponse:Infinity}).fishResponse,1);
for(const [name,preset]of Object.entries(PRESETS)){assert.equal(normalizeSettings(preset).preset,name);assert.deepEqual(normalizeSettings(preset),preset);}
const data=new Map();globalThis.localStorage={getItem:key=>data.get(key),setItem:(key,v)=>data.set(key,v)};
saveSettings({...PRESETS.playful,stirStrength:1.1});assert.equal(loadSettings().stirStrength,1.1);assert.equal(loadSettings().preset,'playful');
data.set('komorebi.settings.v1','bad json');assert.deepEqual(loadSettings(),DEFAULT_SETTINGS);
globalThis.localStorage={getItem(){throw Error('disabled');},setItem(){throw Error('disabled');}};
assert.deepEqual(loadSettings(),DEFAULT_SETTINGS);assert.doesNotThrow(()=>saveSettings(PRESETS.glass));
console.log('PASS settings defaults,bounds,presets,persistence,invalid storage');
