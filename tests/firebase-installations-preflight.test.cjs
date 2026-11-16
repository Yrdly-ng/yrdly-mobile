const {test}=require('node:test');
const assert=require('node:assert/strict');
const {verifyFirebaseInstallations:verify}=require('../scripts/verify-firebase-installations.cjs');
const fixture=()=>({project_info:{project_id:'yrdly-470221',project_number:'399225255875'},client:[{client_info:{android_client_info:{package_name:'com.yrdly'},mobilesdk_app_id:'1:399225255875:android:fixture'},api_key:[{current_key:'AIza'+'a'.repeat(35)}]}]});
test('revoked or invalid keys fail before an APK can be compiled without exposing provider details',async()=>{
 await assert.rejects(verify(fixture(),async()=>({status:400,json:async()=>({error:{message:'private-provider-detail',details:[{reason:'API_KEY_INVALID'}]}})})),error=>/API_KEY_INVALID/.test(error.message)&&!error.message.includes('private-provider-detail'));
});
test('valid configuration exercises installation auth and always deletes the synthetic installation',async()=>{
 const methods=[];let fid;
 await verify(fixture(),async(url,options)=>{
  methods.push(options.method);
  if(methods.length===1){fid=JSON.parse(options.body).fid;return {status:200,json:async()=>({fid,refreshToken:'private-refresh'})}}
  if(options.method==='DELETE')return {status:204,json:async()=>{throw Error('empty')}};
  return {status:200,json:async()=>({token:'private-auth'})};
 });assert.deepEqual(methods,['POST','POST','DELETE']);
});
test('failed authentication still cleans up and is not reported as a successful preflight',async()=>{
 const calls=[];await assert.rejects(verify(fixture(),async(url,options)=>{
  calls.push(options.method);if(calls.length===1)return {status:200,json:async()=>({fid:JSON.parse(options.body).fid,refreshToken:'private'})};
  return {status:options.method==='DELETE'?200:401,json:async()=>({})};
 }),/installation authentication failed/);assert.deepEqual(calls,['POST','POST','DELETE']);
});
