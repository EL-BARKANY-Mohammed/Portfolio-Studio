export type Asset = { id: string; name: string; group: string; expectedReturn: number };
export type Market = { name: string; assets: Asset[]; covariance: number[][]; simulated?: boolean };
export type Config = { mode: "return" | "risk"; maxVol: number; tolerance: boolean; minReturn: number; feeRate: number; maxWeight: number };
export type Metrics = { gross: number; net: number; vol: number; cost: number; turnover: number };
export type Point = Metrics & { weights: number[] };
export type Client = { id: string; firstName: string; lastName: string; age: number; wealth: number; address: string; initial: number[]; market: Market; demo?: boolean };
export type Strategy = { id: string; clientId: string; name: string; createdAt: string; config: Config; market: Market; initial: number[]; weights: number[]; wealth: number; metrics: Metrics };
export const defaultConfig: Config = { mode: "return", maxVol: .10, tolerance: true, minReturn: .065, feeRate: .001, maxWeight: .20 };
export const sum = (v: number[]) => v.reduce((a,b) => a+b,0);
export const dot = (a: number[],b: number[]) => a.reduce((s,x,i) => s+x*b[i],0);
export function multiply(a: number[][], x: number[]) { return a.map(row => dot(row,x)); }
export function metrics(w: number[], initial: number[], market: Market, fee: number): Metrics {
  const gross = dot(w, market.assets.map(a=>a.expectedReturn));
  const traded = sum(w.map((x,i)=>Math.abs(x-initial[i])));
  const cost = fee*traded;
  return {gross,net:gross-cost,vol:Math.sqrt(Math.max(0,dot(w,multiply(market.covariance,w)))),cost,turnover:traded/2};
}
export function rng(seed=19) { return () => { seed = (Math.imul(seed,1664525)+1013904223)|0; return (seed>>>0)/4294967296; }; }
export function demoMarket(): Market {
  const groups = ["Obligations EUR","Crédit diversifié","Actions Europe","Actions monde","Actifs diversifiants"];
  const r=rng(63), loadings:number[][]=[];
  const assets=Array.from({length:50},(_,i)=>{
    const g=Math.floor(i/10), z=r();
    loadings.push([ [.01,.035,.14,.17,.07][g]*(.8+.4*z), g<2?.024: .012, g===2?.07:0, g===3?.075:0, g===4?.08:0]);
    return {id:`AZ${String(i+1).padStart(2,"0")}`,name:`${groups[g]} ${String(i%10+1).padStart(2,"0")}`,group:groups[g],expectedReturn:[.027,.045,.085,.103,.065][g]+(r()-.5)*.024};
  });
  const covariance=assets.map((_,i)=>assets.map((__,j)=>dot(loadings[i],loadings[j])+(i===j?([.025,.045,.11,.12,.09][Math.floor(i/10)]**2):0)));
  return {name:"Univers Azur · 50 titres simulés",assets,covariance,simulated:true};
}
export function demoClient(): Client { const market=demoMarket();return {id:"demo-camille",firstName:"Camille",lastName:"Martin",age:42,wealth:250000,address:"Adresse de démonstration",initial:Array(50).fill(.02),market,demo:true}; }
export function validateMarket(m: Market) {
  if(!m || !Array.isArray(m.assets) || !Array.isArray(m.covariance)) throw Error("Le fichier doit contenir assets et covariance.");
  const n=m.assets.length;
  if(n<2 || n>100 || m.covariance.length!==n) throw Error("L’univers doit contenir de 2 à 100 actifs et une covariance de même dimension.");
  const ids=new Set<string>();
  for(const a of m.assets) { if(!a || typeof a.id!=="string" || !a.id.trim() || typeof a.name!=="string" || !a.name.trim() || !Number.isFinite(a.expectedReturn) || a.expectedReturn < -1 || a.expectedReturn>10 || ids.has(a.id)) throw Error("Identifiants uniques, noms et rendements décimaux valides requis.");ids.add(a.id); }
  if(m.covariance.some(row=>!Array.isArray(row)||row.length!==n||row.some(x=>!Number.isFinite(x)))) throw Error("La matrice de covariance doit être carrée et numérique.");
  const scale=Math.max(...m.covariance.map((r,i)=>Math.abs(r[i])),1e-9), tol=scale*1e-8;
  const l=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++) for(let j=0;j<=i;j++) {
    if(Math.abs(m.covariance[i][j]-m.covariance[j][i])>tol) throw Error("La matrice de covariance doit être symétrique.");
    let s=m.covariance[i][j];for(let k=0;k<j;k++) s-=l[i][k]*l[j][k];
    if(i===j){if(s < -tol) throw Error("La covariance n’est pas positive semi-définie.");l[i][j]=Math.sqrt(Math.max(0,s));}
    else if(l[j][j]>Math.sqrt(tol)*.01) l[i][j]=s/l[j][j];
    else if(Math.abs(s)>tol) throw Error("La covariance n’est pas positive semi-définie.");
  }
}
export function validWeights(w: number[],n: number) { return Array.isArray(w)&&w.length===n&&w.every(x=>Number.isFinite(x)&&x>=-1e-10&&x<=1+1e-10)&&Math.abs(sum(w)-1)<1e-6; }
export function validConfig(c: Config,n:number) { return c && ["return","risk"].includes(c.mode) && typeof c.tolerance==="boolean" && Number.isFinite(c.maxVol)&&c.maxVol>=0&&c.maxVol<=2&&Number.isFinite(c.minReturn)&&c.minReturn>=-1&&c.minReturn<=10&&Number.isFinite(c.feeRate)&&c.feeRate>=0&&c.feeRate<=.1&&Number.isFinite(c.maxWeight)&&c.maxWeight>=1/n-1e-9&&c.maxWeight<=1; }
// Exact proximal map of fee*||w-w0||_1 + capped simplex indicator.
function prox(v:number[], initial:number[], threshold:number, cap:number) {
  let lo=Math.min(...v)-cap-threshold, hi=Math.max(...v)+threshold;
  const at=(t:number,i:number)=>{const d=v[i]-initial[i]-t;return Math.min(cap,Math.max(0,initial[i]+Math.sign(d)*Math.max(0,Math.abs(d)-threshold)));};
  for(let iter=0;iter<45;iter++){const mid=(lo+hi)/2;let s=0;for(let i=0;i<v.length;i++)s+=at(mid,i);if(s>1)lo=mid;else hi=mid;}
  return v.map((_,i)=>at((lo+hi)/2,i));
}
function maxReturn(mu:number[], initial:number[], fee:number,cap:number) {
  const segments=mu.flatMap((x,i)=>[{i,size:Math.min(cap,initial[i]),slope:x+fee},{i,size:Math.max(0,cap-initial[i]),slope:x-fee}]).sort((a,b)=>b.slope-a.slope);
  const w=Array(mu.length).fill(0);let remaining=1;
  for(const s of segments){const add=Math.min(remaining,s.size);w[s.i]+=add;remaining-=add;if(remaining<1e-13)break;}return w;
}
// Convex accelerated proximal-gradient solver, independent of the random cloud.
export function solveUtility(m:Market,initial:number[],fee:number,cap:number,lambda:number,start?:number[],minimumVariance=false) {
  const n=initial.length, mu=minimumVariance?Array(n).fill(0):m.assets.map(a=>a.expectedReturn);
  if(!minimumVariance && lambda===0) return maxReturn(mu,initial,fee,cap);
  const rowBound=Math.max(...m.covariance.map(row=>sum(row.map(Math.abs))));
  const step=1/Math.max(lambda*rowBound,1e-10);
  let x=prox(start??initial,initial,0,cap), y=x.slice(), t=1;
  for(let k=0;k<2400;k++) {
    const grad=multiply(m.covariance,y).map((v,i)=>lambda*v-mu[i]);
    const next=prox(y.map((v,i)=>v-step*grad[i]),initial,step*(minimumVariance?0:fee),cap);
    const distance=sum(next.map((v,i)=>(v-x[i])**2));
    if(distance<1e-20 && k>25){x=next;break;}
    const tn=(1+Math.sqrt(1+4*t*t))/2;
    const restart=dot(y.map((v,i)=>v-next[i]),next.map((v,i)=>v-x[i]))>0;
    y=restart?next.slice():next.map((v,i)=>v+(t-1)/tn*(v-x[i]));t=restart?1:tn;x=next;
  }
  return x;
}
export function point(w:number[],m:Market,initial:number[],fee:number):Point { return {weights:w,...metrics(w,initial,m,fee)}; }
export function optimize(m:Market,initial:number[],c:Config): Point {
  if(!validWeights(initial,m.assets.length)||!validConfig(c,m.assets.length))throw Error("Vérifiez l’allocation initiale et les contraintes.");
  const min=point(solveUtility(m,initial,0,c.maxWeight,1,undefined,true),m,initial,c.feeRate);
  const max=point(solveUtility(m,initial,c.feeRate,c.maxWeight,0),m,initial,c.feeRate);
  const limit=c.maxVol+(c.tolerance?.01:0);
  if(min.vol>limit+1e-6)throw Error(`Contraintes incompatibles : la volatilité minimale est ${(min.vol*100).toFixed(2)} %, au-dessus du plafond autorisé.`);
  if(c.mode==="risk" && c.minReturn>max.net+1e-7)throw Error(`Rendement inaccessible : le maximum net est ${(max.net*100).toFixed(2)} % avec ces contraintes.`);
  if(c.mode==="return" && max.vol<=limit+1e-8)return max;
  if(c.mode==="risk" && min.net>=c.minReturn-1e-8)return min;
  let lo=0,hi=1,best=c.mode==="return"?min:max;
  const isLow=(p:Point)=>c.mode==="return"?p.vol>limit:p.net>=c.minReturn;
  for(let k=0;k<32;k++){const p=point(solveUtility(m,initial,c.feeRate,c.maxWeight,hi),m,initial,c.feeRate);if(!isLow(p)){if(c.mode==="return")best=p;break;}hi*=2;}
  for(let k=0;k<32;k++){const mid=(lo+hi)/2,p=point(solveUtility(m,initial,c.feeRate,c.maxWeight,mid),m,initial,c.feeRate);if(isLow(p)){lo=mid;if(c.mode==="risk")best=p;}else{hi=mid;if(c.mode==="return")best=p;}}
  if(best.vol>limit+1e-6)throw Error("Le rendement minimum demandé impose une volatilité supérieure au plafond autorisé.");
  return best;
}
export async function frontier(m:Market,initial:number[],c:Config,signal?:AbortSignal) {
  const points:Point[]=[];let w=solveUtility(m,initial,0,c.maxWeight,1,undefined,true);
  points.push(point(w,m,initial,c.feeRate));
  for(let k=0;k<44;k++){
    if(signal?.aborted)throw Error("cancelled");
    const lambda=10**(3.5-k*.13);w=solveUtility(m,initial,c.feeRate,c.maxWeight,lambda,w);points.push(point(w,m,initial,c.feeRate));
    if(k%3===0)await new Promise(r=>setTimeout(r,0));
  }
  points.push(point(solveUtility(m,initial,c.feeRate,c.maxWeight,0),m,initial,c.feeRate));
  return points.sort((a,b)=>a.vol-b.vol).filter((p,i,a)=>i===0||p.net>=a[i-1].net-1e-6);
}
export function randomWeights(n:number, cap=1, random=Math.random) {
  const count=Math.max(Math.ceil(1/cap),Math.floor(random()*(n-1))+2);
  const selected=Array.from({length:n},(_,i)=>i);
  for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[selected[i],selected[j]]=[selected[j],selected[i]];}
  const raw=Array(n).fill(0);for(const i of selected.slice(0,count))raw[i]=-Math.log(Math.max(random(),1e-9));
  const total=sum(raw);return prox(raw.map(x=>x/total),Array(n).fill(0),0,cap);
}
export function cloud(m:Market,initial:number[],c:Config,count=1000) { const random=rng(347);return Array.from({length:count},()=>point(randomWeights(initial.length,c.maxWeight,random),m,initial,c.feeRate)); }
