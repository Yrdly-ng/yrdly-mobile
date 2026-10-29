const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const source=fs.readFileSync('src/app/events/[id]/index.tsx','utf8');
const ast=ts.createSourceFile('event.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let callback;
function find(node){if(ts.isCallExpression(node)&&node.expression.getText(ast)==='useFocusEffect'&&node.getText(ast).includes('ownershipEpoch.current'))callback=node.arguments[0].arguments[0].getText(ast);ts.forEachChild(node,find);}find(ast);assert.ok(callback);
function fixture(rows){const listeners=[];let counts={},owned=false;const filters=[];const q={select:key=>{filters.push(['select',key]);return q;},eq:(key,value)=>{filters.push([key,value]);return q;},in:(key,value)=>{filters.push([key,value]);return q;},then:(resolve,reject)=>Promise.resolve({data:rows,error:null}).then(resolve,reject)};
 const context={user:{id:'buyer'},id:'event',ownershipEpoch:{current:0},setUserHasTickets:value=>owned=value,setOwnedTicketCounts:value=>counts=value,supabase:{from:()=>q},AppState:{currentState:'active',addEventListener:(_,fn)=>{listeners.push(fn);return{remove(){}}}},setInterval:()=>1,clearInterval(){}};
 const code=ts.transpileModule(`return ${callback}`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const effect=new Function(...Object.keys(context),code)(...Object.values(context));
 return {filters,async ready(){effect();await new Promise(setImmediate);},async foreground(){listeners.forEach(fn=>fn('active'));await new Promise(setImmediate);},get counts(){return counts;},get owned(){return owned;}};
}
test('mobile ownership counts only the bought tier and refreshes after another device changes it',async()=>{
 const rows=[{tier_id:'normal'}];const app=fixture(rows);await app.ready();
 assert.deepEqual(app.counts,{normal:1});assert.equal(app.counts.vip,undefined);assert.equal(app.owned,true);
 assert.ok(app.filters.some(([key,value])=>key==='status'&&value.join()==='PAID,USED'));
 rows.splice(0);await app.foreground();assert.deepEqual(app.counts,{});assert.equal(app.owned,false);
 rows.push({tier_id:'vip'},{tier_id:'vip'});await app.foreground();assert.deepEqual(app.counts,{vip:2});
});
