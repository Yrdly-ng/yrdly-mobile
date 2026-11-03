import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ttf':'font/ttf','.json':'application/json','.mp4':'video/mp4','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 const relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'review/index.html';
 const target=path.resolve(root,relative);
 if(!target.startsWith(root+path.sep)||relative.split('/').some(x=>x.startsWith('.'))){res.writeHead(403);return res.end();}
 try {
  const size=fs.statSync(target).size;
  const headers={'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store','Accept-Ranges':'bytes'};
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),size-1):size-1;
   if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});return res.end();}
   res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});fs.createReadStream(target,{start,end}).pipe(res);
  }else{res.writeHead(200,{...headers,'Content-Length':size});fs.createReadStream(target).pipe(res);}
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(4388,'127.0.0.1',()=>console.log('Review: http://127.0.0.1:4388'));
