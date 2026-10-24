const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve=yes; reject=no; });
  return {promise,resolve,reject};
};
test('mobile availability ignores old responses and clears stale slots after a failed refresh', async () => {
  const first=deferred(), second=deferred(), refresh=deferred();
  let calls=0;
  const module={exports:{}};
  const code=ts.transpileModule(fs.readFileSync('src/hooks/bookings/use-bookings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','module','exports',code)(name=>name==='react'?React:{BookingService:{getAvailableSlots:()=>[first,second,refresh][calls++].promise}},module,module.exports);
  let result, root;
  function Probe({day}) { result=module.exports.useAvailableSlots('biz','service',day); return null; }
  try {
    await act(async()=>{ root=create(React.createElement(Probe,{day:'2030-01-01'})); });
    await act(async()=>{ root.update(React.createElement(Probe,{day:'2030-01-02'})); });
    await act(async()=>second.resolve([{time:'second-day',available:true}]));
    await act(async()=>first.resolve([{time:'old-day',available:true}]));
    assert.equal(result.slots[0].time,'second-day');
    let pending;
    await act(async()=>{ pending=result.refresh(); });
    assert.deepEqual(result.slots,[]);
    await act(async()=>{ refresh.reject(new Error('Offline')); await pending; });
    assert.deepEqual(result.slots,[]);
    assert.equal(result.error,'Offline');
    assert.equal(result.loading,false);
  } finally { if(root) await act(async()=>root.unmount()); }
});
