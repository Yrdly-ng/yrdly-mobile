const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const ts=require('typescript');
const exportsMock={};new Function('exports',ts.transpileModule(fs.readFileSync('src/lib/payments/booking-payments.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exportsMock);
const quote={bookingId:'booking',transactionId:'tx',reference:'ref',paylukPaymentToken:'token',buyerPaylukId:'buyer',amount:3000,commission:90,paymentFee:150,staged:true,totalAmount:3150};
const initialize=response=>exportsMock.createBookingPayments({post:async()=>response}).initialize('booking');
test('staged quote charges provider fee once including merchant commission',async()=>{
 const q=await initialize(quote);assert.equal(q.totalAmount,3150);assert.equal(q.paymentFee,150);
});
test('missing, hidden or mismatched staged fees cannot open checkout',async()=>{
 for(const changed of [{paymentFee:undefined},{paymentFee:NaN},{paymentFee:149},{totalAmount:3090}])await assert.rejects(initialize({...quote,...changed}),/valid payment quote/);
});
test('legacy quote keeps the original amount plus commission contract',async()=>{
 const q=await initialize({...quote,staged:false,paymentFee:undefined,totalAmount:3090});assert.equal(q.totalAmount,3090);
 await assert.rejects(initialize({...quote,staged:false}),/valid payment quote/);
});
test('checkout response for another booking never opens payment',async()=>{
 await assert.rejects(initialize({...quote,bookingId:'other'}),/needs review/);
});
