/* Pacific Command Enhanced — independent companion, v0.3
   Import shape verified against Type37/WarLore builder source (Nov 2026).
   Game values are playtest house rules; original game remains authoritative for published rules.
   No third-party code used. Runs without external scripts or services.
*/
'use strict';
const CLASSES = {
  'fleet-carrier':  {short:'CV', name:'Fleet carrier',  guns:0,aa:1,capacity:15,ko:8, carrier:true},
  'light-carrier':  {short:'CVL',name:'Light carrier',  guns:0,aa:1,capacity:6, ko:6, carrier:true},
  'seaplane-tender':{short:'AV', name:'Seaplane tender',guns:0,aa:1,capacity:0, ko:2},
  'battleship':     {short:'BB', name:'Battleship',     guns:8,aa:1,capacity:0, ko:12},
  'heavy-cruiser':  {short:'CA', name:'Heavy cruiser',  guns:4,aa:1,capacity:0, ko:6},
  'light-cruiser':  {short:'CL', name:'Light cruiser',  guns:2,aa:1,capacity:0, ko:4},
  'destroyer':      {short:'DD', name:'Destroyers',     guns:1,aa:1,capacity:0, ko:2,screen:true},
  'submarine':      {short:'SS', name:'Submarines',     guns:1,aa:0,capacity:0, ko:2,screen:true},
  'auxiliary':      {short:'AUX',name:'Auxiliaries',   guns:0,aa:0,capacity:0, ko:2,screen:true},
  'fighter-sqn':    {short:'F',  name:'Fighter squadron', aircraft:true},
  'bomber-sqn':     {short:'B',  name:'Bomber squadron', aircraft:true}
};
const GROUPS = ['cap','escort','strike'];
const LABELS = {cap:'CAP',escort:'Escort',strike:'Strike'};
const MODE = ['original','aircraft','experimental'].includes(window.PCE_MODE)?window.PCE_MODE:'experimental';
const IS_EXPERIMENTAL = MODE==='experimental';
const ENHANCED_AIR = MODE!=='original';
const CUMULATIVE_ARMOUR = MODE==='aircraft'; // House rule only; published mode remains untouched.
const MODE_INFO = {
  original:{title:'Original Rules',tag:'Published ship and aircraft mechanics'},
  aircraft:{title:'Enhanced Aircraft',tag:'Original hit allocation + cumulative armour + enhanced carrier operations'},
  experimental:{title:'Experimental',tag:'Cumulative ship damage and enhanced air operations'}
};
const STORAGE_KEY=`pce-companion-${MODE}-v04`;
const LEGACY_EXPERIMENTAL_KEYS=['pce-companion-v03','pce-companion-v02','pce-companion-v01'];
const FORMAT='pce-battle-v04';
const SPECIALS = {
 'fleet-carrier':['High Value','Armoured (2)'], 'light-carrier':['High Value'],
 'seaplane-tender':['Catapult'], 'battleship':['High Value','Armoured (3)'],
 'heavy-cruiser':['Catapult','Armoured (2)'], 'light-cruiser':['Catapult'],
 'destroyer':['Depth Charges'], 'submarine':['Submarine','Weak AA Defences'],
 'auxiliary':['Weak AA Defences']
};
const MOD_NAMES={
 'increased-aircraft':'Increased Aircraft Capacity (+3)', 'aircraft-shortage':'Aircraft Shortage (½ capacity)',
 'ineffective-aa':'Ineffective AA', 'seasoned-pilots':'Seasoned Pilots',
 'superior-fighters':'Superior Fighters', 'rookie-pilots':'Rookie Pilots',
 'unreliable-torpedoes':'Unreliable Torpedoes', 'extended-craft-range':'Extended Aircraft Range',
 'improved-armour':'Improved Armour', 'torpedo-belts':'Torpedo Belts',
 'mobile-force-doctrine':'Mobile Force Doctrine', 'coordinated-strikes':'Coordinated Strikes',
 'overwhelming-air-patrols':'Overwhelming Air Patrols', 'enemy-codes':'Enemy Codes',
 'enemy-plans':'Enemy Plans', 'long-range-radar':'Long-Range Radar',
 'near-range-radar':'Near-Range Radar', 'unrefined-fuel':'Unrefined Fuel',
 'escort-carriers':'Escort Carriers', 'daring-commander':'Daring Commander',
 'false-codes':'False Codes', 'overconfident-commander':'Overconfident Commander',
 'overcomplicated-plans':'Overcomplicated Plans', 'wily-commander':'Wily Commander'
};
let battle=null, undoStack=[], tab='builder', modal=null, notice='', storageOk=true;
const clone=(v)=>JSON.parse(JSON.stringify(v));
const escapeHtml=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeId=(s)=>String(s).replace(/[^a-zA-Z0-9_-]/g,'');
const number=(v,min=0,max=999)=>Math.max(min,Math.min(max,Number.parseInt(v,10)||0));
const cls=(s)=>CLASSES[s.classId];
const isKo=(s)=>IS_EXPERIMENTAL?s.damage>=s.ko:!!s.sunk;
const carriers=(tf)=>tf.ships.filter(s=>s.air);
const currentCarriers=(tf)=>carriers(tf).filter(c=>!isKo(c));
const allCarriers=()=>battle?battle.tfs.flatMap((tf,ti)=>carriers(tf).map(s=>({tf,ti,s}))):[];
function pickId(ti,ui,index){return `tf${ti}-u${ui}-${index}`;}
function effectiveCapacity(classId,mods){
  let n=CLASSES[classId].capacity||0;
  if(n && CLASSES[classId].carrier && mods.includes('increased-aircraft')) n+=3;
  if(n && mods.includes('aircraft-shortage')) n=Math.ceil(n/2);
  return n;
}
function makeBattle(fleet){
  if(!fleet || !Array.isArray(fleet.taskForces) || fleet.taskForces.length<1 || fleet.taskForces.length>30) throw Error('Not a valid Pacific Command builder export (taskForces not found).');
  const mods=Array.isArray(fleet.mods)?fleet.mods.filter(x=>typeof x==='string'):[];
  const b={format:FORMAT,mode:MODE,name:String(fleet.name||'Untitled Fleet'),faction:fleet.faction||'',era:fleet.era||'',mods,round:1,started:false,sourceFleet:clone(fleet),tfs:[],log:[]};
  fleet.taskForces.forEach((sourceTF,ti)=>{
    const tf={id:`TF${String(ti+1).padStart(2,'0')}`,name:String(sourceTF.callSign||`Task Force ${ti+1}`),commander:String(sourceTF.commander||''),ships:[],screens:[],pool:{fighters:0,bombers:0},pending:{confirmed:0,unconfirmed:0}};
    if(!Array.isArray(sourceTF.units))throw Error(`Task force ${ti+1} has no units.`);
    const screens={};
    sourceTF.units.forEach((u,ui)=>{
      const c=CLASSES[u.classId];
      if(!c)throw Error(`Unsupported class: ${u.classId}`);
      const qty=number(u.qty||1,1,200);
      if(u.classId==='fighter-sqn'){tf.pool.fighters+=qty;return;}
      if(u.classId==='bomber-sqn'){tf.pool.bombers+=qty;return;}
      if(c.screen){
        const old=screens[u.classId]||{id:`${ti}-scr-${safeId(u.classId)}`,classId:u.classId,initial:0,remaining:0,partial:0,ko:IS_EXPERIMENTAL?c.ko:1,historicalClass:String(u.historicalClass||u.shipClass||''),modelCode:''};
        old.initial+=qty;old.remaining+=qty;screens[u.classId]=old;return;
      }
      for(let si=0;si<qty;si++){
        const prefix=String(u.pennant||'').trim();
        const name=prefix?(qty>1?`${prefix} ${si+1}`:prefix):`${c.short} ${tf.ships.filter(s=>s.classId===u.classId).length+1}`;
        const s={id:pickId(ti,ui,si),classId:u.classId,name,damage:0,sunk:false,armourHits:0,ko:c.ko,capacity:effectiveCapacity(u.classId,mods),historicalClass:String(u.historicalClass||u.shipClass||''),modelCode:''};
        if(c.carrier) s.air={fighters:0,bombers:0,deck:{usedRound:0,operation:''},groups:{cap:{count:0,status:'ready'},escort:{count:0,status:'ready'},strike:{count:0,status:'ready'}}};
        tf.ships.push(s);
      }
    });
    tf.screens=Object.values(screens);
    const cs=carriers(tf);
    // Export pools aircraft at TF level. Assign to carriers proportionally, never exceeding capacity.
    for(const key of ['fighters','bombers']){
      let remaining=tf.pool[key];
      while(remaining>0){
        const options=cs.filter(s=>s.air.fighters+s.air.bombers<s.capacity);
        if(!options.length)break;
        options.sort((a,b)=>((a.air.fighters+a.air.bombers)/Math.max(1,a.capacity))-((b.air.fighters+b.air.bombers)/Math.max(1,b.capacity)));
        options[0].air[key]++;remaining--;
      }
      tf.pool[key]=remaining;
    }
    for(const s of cs){s.air.groups.cap.count=s.air.fighters;s.air.groups.strike.count=s.air.bombers;}
    b.tfs.push(tf);
  });
  b.log.push({round:1,text:`Battle created from ${b.name}. Check squadron distribution before launching.`});
  return b;
}
function demoFleet(){
  return {name:'First Carrier Division · Demo',faction:'IJN',era:'Early War',scale:3,budget:300,mods:[],taskForces:[
    {callSign:'Carrier Force',commander:'Vice Admiral Nagumo',units:[
      {classId:'fleet-carrier',qty:1,pennant:'Akagi'},{classId:'fleet-carrier',qty:1,pennant:'Kaga'},
      {classId:'heavy-cruiser',qty:1,pennant:'Tone'},{classId:'heavy-cruiser',qty:1,pennant:'Chikuma'},
      {classId:'destroyer',qty:6},{classId:'fighter-sqn',qty:12},{classId:'bomber-sqn',qty:16}]},
    {callSign:'Surface Support',commander:'',units:[
      {classId:'battleship',qty:1,pennant:'Haruna'},{classId:'light-cruiser',qty:1,pennant:'Nagara'},
      {classId:'destroyer',qty:4}]}
  ]};
}
function tfTotals(tf){
  let guns=0,aa=0,cap=0,capStation=0,capLow=0,readyStrike=0,readyEscort=0,airStrike=0,airEscort=0,active=0;
  for(const s of tf.ships){
    if(isKo(s))continue;
    active++;
    guns+=cls(s).guns;aa+=cls(s).aa;
    if(s.air){
      const g=s.air.groups;
      if(g.cap.status==='air1'){cap+=g.cap.count;capStation+=g.cap.count;}
      if(g.cap.status==='air2'){cap+=g.cap.count;capLow+=g.cap.count;}
      if(g.strike.status==='ready')readyStrike+=g.strike.count;
      if(g.escort.status==='ready')readyEscort+=g.escort.count;
      if(g.strike.status==='air1')airStrike+=g.strike.count;
      if(g.escort.status==='air1')airEscort+=g.escort.count;
    }
  }
  for(const sc of tf.screens){guns+=CLASSES[sc.classId].guns*sc.remaining;aa+=CLASSES[sc.classId].aa*sc.remaining;}
  if(!ENHANCED_AIR){
    // Published-game view: squadrons are not subject to new readiness/attrition mechanics.
    cap=0;airStrike=0;
    for(const s of currentCarriers(tf)){cap+=s.air.fighters;airStrike+=s.air.bombers;}
  }
  return {guns,aa,cap,capStation,capLow,readyStrike,readyEscort,airStrike,airEscort,strike:airStrike,escort:airEscort,active};
}
function grandTotals(){
  let guns=0,aa=0,cap=0,strike=0,ships=0,remaining=0;
  if(!battle)return {guns,aa,cap,strike,ships,remaining};
  for(const tf of battle.tfs){const t=tfTotals(tf);guns+=t.guns;aa+=t.aa;cap+=t.cap;strike+=t.airStrike;ships+=tf.ships.length;remaining+=t.active;}
  return {guns,aa,cap,strike,ships,remaining};
}
function log(text){battle.log.unshift({round:battle.round,text});battle.log=battle.log.slice(0,160);}
function persist(){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({battle,undoStack}));storageOk=true;}
  catch(e){storageOk=false;console.warn('Saving disabled by browser',e);}
}
function normalizeBattle(data){
  if(!data||!Array.isArray(data.tfs))throw Error('Not a Pacific Command Enhanced battle backup.');
  const legacy=['pce-battle-v01','pce-battle-v02','pce-battle-v03'].includes(data.format);
  if(legacy && !IS_EXPERIMENTAL)throw Error('Older v0.3 backups belong to Experimental mode. Open Experimental and restore there first.');
  if(!legacy && (data.format!==FORMAT || data.mode!==MODE))throw Error('This backup belongs to a different game mode. Open the matching mode to restore it.');
  for(let ti=0;ti<data.tfs.length;ti++){
    const tf=data.tfs[ti];
    tf.id=`TF${String(ti+1).padStart(2,'0')}`;
    tf.name=String(tf.name||tf.id);
    if(!tf.pending)tf.pending={confirmed:0,unconfirmed:0};
    tf.pending.attackKind=tf.pending.attackKind||'air';
    for(const ship of tf.ships||[]){
      ship.historicalClass=String(ship.historicalClass||'');
      ship.modelCode=String(ship.modelCode||'');
      if(typeof ship.sunk!=='boolean')ship.sunk=false;
      if(CUMULATIVE_ARMOUR)ship.armourHits=number(ship.armourHits,0,baseArmour(ship.classId));
      if(!ship.air)continue;
      for(const key of GROUPS){
        const g=ship.air.groups?.[key];if(!g)continue;
        if(g.status==='rearm'&&!Number.isFinite(g.readyAtRound))g.readyAtRound=Number(data.round)+1;
        else if(g.status!=='rearm')delete g.readyAtRound;
      }
    }
    for(const screen of tf.screens||[]){
      screen.historicalClass=String(screen.historicalClass||'');
      screen.modelCode=String(screen.modelCode||'');
      if(!IS_EXPERIMENTAL){screen.ko=1;screen.partial=0;}
    }
  }
  data.format=FORMAT;data.mode=MODE;
  return data;
}
function restore(){
  try{
    let raw=localStorage.getItem(STORAGE_KEY);
    if(!raw&&IS_EXPERIMENTAL)for(const key of LEGACY_EXPERIMENTAL_KEYS){raw=localStorage.getItem(key);if(raw)break;}
    const data=JSON.parse(raw||'null');
    if(data?.battle){
      battle=normalizeBattle(data.battle);
      undoStack=Array.isArray(data.undoStack)?data.undoStack.slice(-40):[];
      tab='fleet';persist();
    }
  }catch(e){console.warn('Could not restore saved game',e);}
}
function commit(action,fn){if(!battle)return;const before=clone(battle);const msg=fn();if(msg===false)return;undoStack.push(before);undoStack=undoStack.slice(-40);if(typeof msg==='string')log(msg);notice='';persist();render();}
function undo(){if(!undoStack.length)return;battle=undoStack.pop();notice='Last change undone';persist();render();}
function importFleet(fleet){
  try{
    const next=makeBattle(fleet);
    if(battle && !confirm('Start a new battle? Your current battle will be replaced. Export it first if you want to keep a backup.'))return;
    battle=next;undoStack=[];tab='fleet';notice='Fleet imported. Check carrier squadron assignments before beginning.';persist();render();
  }catch(e){alert('Import failed: '+e.message);}
}
function importBattle(data){
  const upgraded=normalizeBattle(clone(data));
  if(battle&&!confirm('Replace the current battle with this saved battle?'))return;
  battle=upgraded;undoStack=[];tab='fleet';notice='Battle backup restored';persist();render();
}
function backupName(){return `PCE_${MODE}_${battle.name}_round_${battle.round}.json`.replace(/[^A-Za-z0-9_.-]+/g,'_');}
function download(data,filename){const a=document.createElement('a');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);a.href=url;a.download=filename.replace(/[^A-Za-z0-9_.-]+/g,'_');document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
async function shareBackup(){
  if(!battle)return;
  const filename=backupName();
  const file=new File([JSON.stringify(battle,null,2)],filename,{type:'application/json'});
  try{
    if(navigator.share && (!navigator.canShare||navigator.canShare({files:[file]}))){
      await navigator.share({files:[file],title:'Pacific Command Enhanced battle backup'});
    }else download(battle,filename);
  }catch(err){if(err?.name!=='AbortError')download(battle,filename);}
}
function getTF(i){return battle?.tfs[Number(i)];}
function getShip(i,j){return getTF(i)?.ships[Number(j)];}
function getScreen(i,j){return getTF(i)?.screens[Number(j)];}
function findCarrier(ti,si){const s=getShip(ti,si);return s&&s.air?s:null;}
function modifyPool(ti,si,key,diff){
  const s=findCarrier(ti,si),tf=getTF(ti);if(!s||!tf||isKo(s))return;
  if(battle.started){notice='Aircraft can only be transferred between carriers during pre-battle setup.';render();return;}
  const air=s.air;
  const statuses=Object.values(air.groups).map(g=>g.status);
  if(statuses.some(st=>st!=='ready')){notice='Aircraft transfers require all groups to be Ready.';render();return;}
  if(diff>0){if(tf.pool[key]<=0||air.fighters+air.bombers>=s.capacity)return;}
  else {if(air[key]<=0)return;}
  commit('assignment',()=>{
    air[key]+=diff;tf.pool[key]-=diff;
    if(key==='fighters'){
      if(diff>0)air.groups.cap.count++;
      else if(air.groups.cap.count>0)air.groups.cap.count--;
      else if(air.groups.escort.count>0)air.groups.escort.count--;
    }
    else air.groups.strike.count=Math.max(0,Math.min(air.groups.strike.count+diff,air.bombers));
    return `${s.name}: ${key} assigned ${diff>0?'+1':'−1'} (${air[key]}).`;
  });
}
function adjustGroup(ti,si,group,diff){
  const s=findCarrier(ti,si);if(!s||isKo(s))return;
  const g=s.air.groups[group];if(g.status!=='ready'){notice='Group allocations can be changed only while Ready.';render();return;}
  const max=group==='strike'?s.air.bombers:s.air.fighters-s.air.groups[group==='cap'?'escort':'cap'].count;
  if(g.count+diff<0||g.count+diff>max)return;
  commit('allocation',()=>{g.count+=diff;return `${s.name} ${LABELS[group]} allocation ${g.count}.`;});
}
function statusLabel(status,group=''){
  if(status==='ready')return 'Ready';
  if(status==='rearm')return 'Refuel/Rearm';
  if(status==='air1')return group==='cap'?'On Station':'Airborne';
  if(status==='air2')return 'Low Fuel';
  return status;
}
function launchGroup(ti,si,group){
  const s=findCarrier(ti,si);if(!s||isKo(s)||!['cap','escort','strike'].includes(group))return;
  const g=s.air.groups;
  if(g[group].status!=='ready'||g[group].count===0){notice='This air group must be Ready and contain aircraft before launching.';render();return;}
  // One sortie per group until its own Refuel/Rearm completes. CAP, Escort and Strike
  // may launch within the same round; Low Fuel CAP does not block other groups.
  commit('launch',()=>{
    g[group].status='air1';delete g[group].readyAtRound;
    const together=group==='strike' && g.escort.status==='ready' && g.escort.count>0;
    if(together){g.escort.status='air1';delete g.escort.readyAtRound;}
    battle.started=true;
    return `${s.name} launched ${LABELS[group]} (${g[group].count})${together?` + Escort (${g.escort.count})`:''}.`;
  });
}
function recoverCapEarly(ti,si){
  const s=findCarrier(ti,si);if(!s||isKo(s))return;
  const cap=s.air.groups.cap;
  if(cap.status!=='air1'||cap.count===0){notice='CAP can be recovered early only while On Station.';render();return;}
  if(!confirm(`Recover ${s.name} CAP early at the end of Round ${battle.round}? It will be unavailable in Round ${battle.round+1} while refuelling, and Ready at the start of Round ${battle.round+2}.`))return;
  commit('recover-cap',()=>{
    cap.status='rearm';
    cap.readyAtRound=battle.round+2;
    battle.started=true;
    return `${s.name} recalled CAP early (${cap.count}). Refuel/Rearm in R${battle.round+1}; Ready R${cap.readyAtRound}.`;
  });
}
function changeStatus(ti,si,group,status){
  const s=findCarrier(ti,si);if(!s||isKo(s)||!GROUPS.includes(group))return;
  const g=s.air.groups[group];
  if(!['ready','air1','air2','rearm'].includes(status)||(status==='air2'&&group!=='cap'))return;
  if(status==='air1'&&g.status==='ready'){launchGroup(ti,si,group);return;}
  if(status==='air1'&&g.count===0){notice='Assign aircraft to this group before launching.';render();return;}
  if(g.status===status)return;
  if(!confirm(`Manual status correction: change ${s.name} ${LABELS[group]} to ${statusLabel(status,group)}?`))return;
  commit('status',()=>{
    g.status=status;
    if(status==='rearm')g.readyAtRound=battle.round+2;
    else delete g.readyAtRound;
    return `${s.name} ${LABELS[group]} corrected to ${statusLabel(status,group)}.`;
  });
}
function advanceRound(){
  if(!ENHANCED_AIR){commit('round',()=>{battle.round++;battle.started=true;return `Round ${battle.round} begins (original rules).`;});return;}
  commit('round',()=>{
    const incoming=battle.round+1;
    const changed=[];
    for(const tf of battle.tfs)for(const s of carriers(tf))if(!isKo(s))for(const type of GROUPS){
      const g=s.air.groups[type],old=g.status;
      if(old==='air1'&&type==='cap')g.status='air2';
      else if(old==='air1'||old==='air2'){
        g.status='rearm';
        g.readyAtRound=incoming+1; // Complete ONE full following round of servicing.
      }else if(old==='rearm'&&incoming>=Number(g.readyAtRound||incoming)){
        g.status='ready';delete g.readyAtRound;
      }
      if(old!==g.status)changed.push(`${s.name} ${LABELS[type]} → ${statusLabel(g.status,type)}`);
    }
    battle.round=incoming;battle.started=true;
    return `Round ${incoming} begins. ${changed.length?changed.join('; '):'No aircraft status changes.'}`;
  });
}
function loseSquadron(ti,si,group){
  const s=findCarrier(ti,si);if(!s||isKo(s))return;
  const g=s.air.groups[group];if(g.count<=0)return;
  commit('loss',()=>{g.count--;if(group==='strike')s.air.bombers--;else s.air.fighters--;battle.started=true;return `${s.name}: 1 ${group==='strike'?'bomber':'fighter'} squadron permanently lost from ${LABELS[group]}.`;});
}
function loseReserve(ti,si,kind){
  const s=findCarrier(ti,si);if(!s||isKo(s))return;
  const a=s.air;
  const unused=kind==='fighters'?a.fighters-a.groups.cap.count-a.groups.escort.count:a.bombers-a.groups.strike.count;
  if(unused<1)return;
  commit('loss',()=>{a[kind]--;battle.started=true;return `${s.name}: 1 unassigned ${kind==='fighters'?'fighter':'bomber'} squadron permanently lost.`;});
}
function openHitPool(ti){
  const tf=getTF(ti);if(!tf)return;
  if(tf.pending.confirmed+tf.pending.unconfirmed){notice='Resolve or clear existing hits before starting the next attack.';render();return;}
  modal={type:'hit-pool',ti:Number(ti)};render();
}
function recordHitPool(ti,confirmed,unconfirmed,kind){
  const tf=getTF(ti);if(!tf||IS_EXPERIMENTAL)return;
  confirmed=number(confirmed,0,100);unconfirmed=number(unconfirmed,0,100);
  if(!confirmed&&!unconfirmed)return;
  commit('hit-pool',()=>{
    tf.pending={confirmed,unconfirmed,attackKind:kind==='gun'?'gun':'air'};
    modal=null;battle.started=true;
    return `${tf.name}: ${confirmed} confirmed (attacker) and ${unconfirmed} unconfirmed (defender) hits to assign.`;
  });
}
function baseArmour(classId){return classId==='fleet-carrier'||classId==='heavy-cruiser'?2:classId==='battleship'?3:1;}
function requiredConfirmed(ship,tf){
  // Some fleet modifications are class-selected. The original builder export doesn't reliably
  // identify the selected class, so its value is not guessed here; see warning on screen.
  return baseArmour(ship.classId);
}
function allocateOriginalHit(ti,kind,idx,hitType){
  if(IS_EXPERIMENTAL)return;
  const tf=getTF(ti);if(!tf||!['confirmed','unconfirmed'].includes(hitType)||!tf.pending[hitType])return;
  const screen=kind==='screen'?getScreen(ti,idx):null;
  const ship=kind==='ship'?getShip(ti,idx):null;
  if(screen ? screen.remaining<=0 : !ship||isKo(ship))return;
  const need=hitType==='confirmed' && ship && !CUMULATIVE_ARMOUR?requiredConfirmed(ship,tf):1;
  if(tf.pending[hitType]<need){notice=`${ship.name} needs ${need} confirmed hits in this attack under its published Armoured rule.`;render();return;}
  commit('allocate',()=>{
    tf.pending[hitType]-=need;
    let result='sunk';
    if(screen){screen.remaining--;screen.partial=0;}
    else if(CUMULATIVE_ARMOUR && hitType==='confirmed'){
      // One confirmed six = one persistent armour hit; a second confirmed six may finish the ship later.
      ship.armourHits=number(ship.armourHits,0,requiredConfirmed(ship,tf))+1;
      if(ship.armourHits>=requiredConfirmed(ship,tf)){
        ship.armourHits=requiredConfirmed(ship,tf);
        ship.sunk=true;ship.damage=ship.ko;
      }else{result=`damaged — ${requiredConfirmed(ship,tf)-ship.armourHits}/${requiredConfirmed(ship,tf)} armour remaining`;}
    }else {ship.sunk=true;ship.damage=ship.ko;}
    battle.started=true;
    const name=screen?CLASSES[screen.classId].name:ship.name;
    return `${tf.id} ${name}: ${result} by ${need} ${hitType} hit${need===1?'':'s'}. ${tf.pending.confirmed+tf.pending.unconfirmed?'More hits to assign.':'All hits assigned.'}`;
  });
}
function applyAttack(target,confirmed,unconfirmed){
  confirmed=number(confirmed,0,1000);unconfirmed=number(unconfirmed,0,1000);
  if(confirmed+unconfirmed===0)return null;
  const hits=[...Array(confirmed).fill(2),...Array(unconfirmed).fill(1)]; // confirmed first (playtest convention)
  let consumed=0,points=0,bonus=0,sunk=0;
  for(const hit of hits){
    if(target.isScreen){if(target.screen.remaining<=0)break;}
    else if(isKo(target.ship))break;
    const rearm=!target.isScreen && !!target.ship.air && target.ship.air.groups.strike.status==='rearm';
    let dmg=hit;
    if(hit===2&&rearm&&!bonus){bonus=2;dmg+=2;}
    if(target.isScreen){
      const sc=target.screen;
      let left=dmg;
      while(left>0 && sc.remaining>0){
        const canTake=sc.ko-sc.partial;
        const take=Math.min(left,canTake);
        sc.partial+=take;left-=take;
        if(sc.partial>=sc.ko){sc.remaining--;sc.partial=0;sunk++;}
      }
    }else{
      const s=target.ship;
      s.damage=Math.min(s.ko,s.damage+dmg);
      if(isKo(s))sunk=1;
    }
    points+=dmg;consumed++;
  }
  const cfUsed=Math.min(confirmed,consumed);
  const ucUsed=Math.max(0,consumed-confirmed);
  return {left:{confirmed:confirmed-cfUsed,unconfirmed:unconfirmed-ucUsed},points,bonus,sunk,consumed};
}
function targetLabel(target){return target.isScreen?CLASSES[target.screen.classId].name:target.ship.name;}
function attack(ti,kind,idx,confirmed,unconfirmed,pending=false){
  if(!IS_EXPERIMENTAL)return;
  const tf=getTF(ti);if(!tf)return;
  if(pending){confirmed=tf.pending.confirmed;unconfirmed=tf.pending.unconfirmed;}
  else if(tf.pending.confirmed+tf.pending.unconfirmed>0){notice=`Resolve or clear the ${tf.name} pending hits before a new attack.`;modal=null;render();return;}
  const target=kind==='screen'?{isScreen:true,screen:getScreen(ti,idx)}:{isScreen:false,ship:getShip(ti,idx)};
  if(target.isScreen?!target.screen:!target.ship)return;
  const name=targetLabel(target);
  if(!number(confirmed,0,1000)&&!number(unconfirmed,0,1000))return;
  commit('attack',()=>{
    const result=applyAttack(target,confirmed,unconfirmed);
    tf.pending=result.left;
    battle.started=true;
    modal=null;
    return `${tf.name}: ${name} took ${result.points} damage from ${result.consumed} hit(s)${result.bonus?' (includes +2 Hangar Fire)':''}.${result.sunk?' Knockout(s): '+result.sunk+'.':''} ${tf.pending.confirmed+tf.pending.unconfirmed?'Unallocated hits remain.':''}`;
  });
}
function clearPending(ti){const tf=getTF(ti);if(!tf)return;commit('discard',()=>{const n=tf.pending.confirmed+tf.pending.unconfirmed;tf.pending={confirmed:0,unconfirmed:0};return `${tf.name}: ${n} unallocated hit(s) cleared.`;});}
function reverseDamage(ti,si){
 const s=getShip(ti,si);if(!s||(!isKo(s)&&s.damage===0&&!(CUMULATIVE_ARMOUR&&s.armourHits>0)))return;
 commit('repair',()=>{
  if(IS_EXPERIMENTAL)s.damage=Math.max(0,s.damage-1);
  else if(CUMULATIVE_ARMOUR){
    if(s.sunk){s.sunk=false;s.damage=0;if(s.armourHits>=requiredConfirmed(s))s.armourHits=Math.max(0,s.armourHits-1);}
    else{s.armourHits=Math.max(0,s.armourHits-1);}
  }else{s.sunk=false;s.damage=0;}
  return `${s.name}: ${IS_EXPERIMENTAL?'corrected damage −1':CUMULATIVE_ARMOUR?'corrected armour / sunk status':'restored to afloat (correction)'}.`;
 });
}
function editModel(ti,si,screen=false){
 const s=screen?getScreen(ti,si):getShip(ti,si);if(!s)return;
 const className=prompt('Historical class / miniature type (e.g. Yorktown-class, Takao-class):',s.historicalClass||'');
 if(className===null)return;
 const modelCode=prompt('Model/base reference (optional, e.g. CV-02 or Blue Base 3):',s.modelCode||'');
 if(modelCode===null)return;
 if(String(className).trim()===String(s.historicalClass||'')&&String(modelCode).trim()===String(s.modelCode||''))return;
 commit('model-match',()=>{s.historicalClass=String(className).trim().slice(0,90);s.modelCode=String(modelCode).trim().slice(0,90);return `${screen?CLASSES[s.classId].name:s.name}: model matched — ${s.historicalClass||'unspecified class'}${s.modelCode?' / '+s.modelCode:''}.`;});
}
function specialChips(classId){const specials=SPECIALS[classId]||[];
 return specials.length?`<div class="specials">${specials.map(x=>`<span class="special-chip ${IS_EXPERIMENTAL&&x.startsWith('Armoured')?'muted-special':''}" title="${IS_EXPERIMENTAL&&x.startsWith('Armoured')?'Superseded by cumulative hull damage in Experimental mode':CUMULATIVE_ARMOUR&&x.startsWith('Armoured')?'House rule: confirmed hits accumulate across attacks; one unconfirmed hit still sinks':escapeHtml(x)}">${escapeHtml(x)}${IS_EXPERIMENTAL&&x.startsWith('Armoured')?' (replaced)':CUMULATIVE_ARMOUR&&x.startsWith('Armoured')?' · cumulative':''}</span>`).join('')}</div>`:'';
}
function modelLabel(s){return `<div class="shipmeta model-line">Historical class: <b>${escapeHtml(s.historicalClass||'Not set')}</b>${s.modelCode?` · Model: <b>${escapeHtml(s.modelCode)}</b>`:''}</div>`;}

function changeName(ti,si){const s=getShip(ti,si);if(!s)return;const name=prompt('Ship name',s.name);if(!name||!name.trim()||name.trim()===s.name)return;commit('rename',()=>{const old=s.name;s.name=name.trim().slice(0,80);return `${old} renamed ${s.name}.`;});}
function renameTaskForce(ti){
  const tf=getTF(ti);if(!tf)return;
  const name=prompt(`Name for ${tf.id} (identifier stays unchanged):`,tf.name);
  if(!name||!name.trim()||name.trim()===tf.name)return;
  commit('rename-tf',()=>{const old=tf.name;tf.name=name.trim().slice(0,90);return `${tf.id} renamed from ${old} to ${tf.name}.`;});
}
function editScreenCount(ti,scidx,dir){
  const sc=getScreen(ti,scidx);if(!sc)return;
  if(dir<0&&sc.remaining===0)return;if(dir>0&&sc.remaining===sc.initial)return;
  commit('screen',()=>{sc.remaining+=dir;sc.partial=0;battle.started=true;return `${CLASSES[sc.classId].name}: ${sc.remaining} remaining (manual correction).`;});
}
function dismiss(){modal=null;render();}
function vText(v){return escapeHtml(v);}
function btn(label,action,attr='',type=''){return `<button class="btn ${type}" data-action="${action}" ${attr}>${label}</button>`;}
function renderHeader(){return `<div class="topbar"><div class="topinner"><div class="brand"><div class="roundel">✦</div><div><div class="brandline">PACIFIC <span>COMMAND</span></div><div class="brand-sub">${escapeHtml(MODE_INFO[MODE].title)} · Battle Companion v0.4.1</div></div></div><div class="header-side"><span class="round">ROUND <b id="round-badge">${battle?.round||'—'}</b></span>${battle?btn('↶ Undo','undo',undoStack.length?'':'disabled','sm quiet'):''}</div></div></div>`;}
function renderControls(){return `<div class="top-content"><div><div class="eyebrow">${battle?`${vText(battle.faction||'Fleet')} / ${vText(battle.era||'Battle')}`:'Build · Command · Record'}</div><h1>${battle?vText(battle.name):'Your fleet. One battle dashboard.'}</h1><p>${battle?`${battle.tfs.length} task forces · aircraft and ship losses tracked in one place`:'Import an existing fleet, then manage ships, aircraft and carrier states.'}</p></div><div class="tools">${battle?`${btn('↶ Undo','undo',undoStack.length?'':'disabled','sm')}${btn('⇧ Advance round','advance-round','','primary')}${btn('↓ Battle backup','export-battle','','sm')}${btn('Share / Save backup','share-battle','','sm')}`:''}</div></div><div class="modes-switch"><a href="../" class="btn sm quiet">← Game modes</a><span class="muted small">${escapeHtml(MODE_INFO[MODE].tag)}</span></div><div class="tabs">${[['builder','01  Fleet Builder'],['fleet','02  Fleet Overview'],['carriers',ENHANCED_AIR?'03  Carrier Operations':'03  Fleet Aviation'],['log','Battle Log']].map(([key,label])=>`<button class="tab ${tab===key?'active':''}" data-action="tab" data-value="${key}">${label}</button>`).join('')}</div>${notice?`<div class="callout warning" role="status">${vText(notice)} ${btn('Dismiss','dismiss-notice','','xs quiet')}</div>`:''}${!storageOk?'<div class="callout warning">Your browser is blocking local saving. Export a battle backup to preserve your changes.</div>':''}`;}
function builderPage(){return `<div class="hero"><div class="panel"><div class="eyebrow">Step 1 / Build</div><h2>Use the existing Fleet Builder</h2><p class="muted">Keep building and validating fleets in WarLore/Type37's existing tool. Download its JSON export, then load it here as a new battle.</p><div class="flowline"><div class="stage"><b>Build</b><span>Original builder</span></div><span class="arrow">→</span><div class="stage"><b>Export JSON</b><span>Fleets menu</span></div><span class="arrow">→</span><div class="stage"><b>Import here</b><span>Start battle</span></div></div><div class="builder-actions"><a class="btn primary" target="_blank" rel="noopener noreferrer" href="https://type37.github.io/pacific-command-builder/">Open Fleet Builder ↗</a>${btn('↑ Import fleet JSON','open-fleet-file','','')}${btn('Try sample fleet','demo','','quiet')}</div><p class="note">Builder instructions: open <b>Fleet</b> → <b>Export file</b>, then choose that .json file here. This does not change the original builder.</p></div><div class="panel"><div class="eyebrow">Step 2 / Configure</div><h2>Assign aircraft to carriers</h2><p class="muted">The builder pools fighter and bomber squadrons by task force. This companion spreads them across individual carriers automatically. In enhanced modes, you can adjust those allocations before combat.</p><div class="callout">${ENHANCED_AIR?'Each carrier has fixed <b>CAP</b>, <b>Escort</b> and <b>Strike</b> groups. CAP flies for two rounds; Escort and Strike fly for one. All then refuel/rearm for one round.':'Original game aircraft mechanics remain unchanged; no new CAP/Strike cycles or permanent-loss tracking.'}</div><h3>Continue a previous game</h3><div class="builder-actions">${btn('↑ Import battle backup','open-battle-file','','')}${battle?btn('Share / Save backup','share-battle','','quiet'):''}${battle?btn('Reset from original fleet','reset-battle','','quiet'):''}</div></div></div><div class="panel" style="margin-top:16px"><div class="sectionhead"><h2>Implementation path</h2><span class="badge gray">Prototype v0.4.1 · ${MODE_INFO[MODE].title}</span></div><div class="guide"><div class="card"><span class="num">01 / FLEET</span><strong>Ship losses and guns / AA</strong><p>${IS_EXPERIMENTAL?'Cumulative experimental damage tracks for capital ships; destroyers are targetable.':CUMULATIVE_ARMOUR?'Cumulative confirmed hits against armour; original confirmed/unconfirmed allocation and destroyer screening.':'Original hit allocation and sinking rules; destroyers remain targetable.'}</p></div><div class="card"><span class="num">02 / AVIATION</span><strong>${ENHANCED_AIR?'Carrier readiness and losses':'Published air combat'}</strong><p>${ENHANCED_AIR?'Set aircraft allocations, launch groups, advance rounds and record permanent losses.':'Reference original CAP and Strike strength without new readiness or losses.'}</p></div><div class="card"><span class="num">03 / PROTECT</span><strong>Save / undo</strong><p>Changes auto-save in the browser where allowed; export a JSON battle backup for safety.</p></div></div></div>`;}
function miniStat(k,v,detail=''){return `<div class="mini-stat metric-${k.toLowerCase().replace(/[^a-z0-9]+/g,'-')}"><div class="k">${k}</div><div class="v">${v}</div>${detail?`<div class="small muted">${detail}</div>`:''}</div>`;}
function statsStrip(){const st=grandTotals();return `<div class="statgrid"><div class="stat emph"><div class="k">Round</div><div class="v">${battle.round}</div><div class="s">Active battle</div></div>${[['Guns',st.guns,'All task forces'],['AA',st.aa,'All task forces'],['Major ships afloat',st.remaining,`of ${st.ships} tracked`],ENHANCED_AIR?['CAP aloft',st.cap,'On station / low fuel']:['CAP',st.cap,'Original fleet value']].map(([k,v,s])=>`<div class="stat metric-${k.toLowerCase().replace(/[^a-z0-9]+/g,'-')}"><div class="k">${k}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('')}</div>`;}
function damagePips(n,max){return `<div class="track" aria-label="Damage ${n} of ${max}">${Array.from({length:Math.min(20,max)},(_,i)=>`<span class="pip ${i<n?'hit':''}"></span>`).join('')}</div>`;}
function targetAttrs(ti,kind,idx){return `data-tf="${ti}" data-kind="${kind}" data-idx="${idx}"`;}
function renderShipRow(s,ti,si){
  const c=cls(s),ko=isKo(s),tf=getTF(ti);const can=!!tf.pending.confirmed||!!tf.pending.unconfirmed;
  const req=requiredConfirmed(s,tf),armourTaken=number(s.armourHits,0,req),hpLeft=Math.max(0,req-armourTaken);
  const confirmsNeeded=CUMULATIVE_ARMOUR?1:req;
  const allocation=!IS_EXPERIMENTAL&&can&&!ko?`<div class="hit-buttons">
    ${btn(CUMULATIVE_ARMOUR?'6 (attacker) · −1 armour':`6 ×${req} (attacker)`,'assign-original',`data-tf="${ti}" data-idx="${si}" data-kind="ship" data-value="confirmed" ${tf.pending.confirmed<confirmsNeeded?'disabled':''}`,'xs hit-confirm')}
    ${btn('4–5 (defender)','assign-original',`data-tf="${ti}" data-idx="${si}" data-kind="ship" data-value="unconfirmed" ${tf.pending.unconfirmed<1?'disabled':''}`,'xs hit-unconfirm')}
  </div>`:'';
  const status=IS_EXPERIMENTAL?`${damagePips(s.damage,s.ko)}<span class="progressText">${s.damage} / ${s.ko} ${ko?'— OUT OF ACTION':''}</span>`:
    CUMULATIVE_ARMOUR?`<span class="${ko?'sunk-mark':armourTaken>0?'armour-damaged':'afloat-mark'}">${ko?'SUNK':armourTaken?'DAMAGED':'Afloat'}</span><div class="progressText">Armour ${ko?0:hpLeft} / ${req} HP${armourTaken>0&&!ko?` · ${armourTaken} confirmed hit${armourTaken===1?'':'s'}`:''}</div>`:
    `<span class="${ko?'sunk-mark':'afloat-mark'}">${ko?'SUNK':'Afloat'}</span>`;
  const canCorrect=ko||s.damage>0||(CUMULATIVE_ARMOUR&&armourTaken>0);
  return `<tr class="${ko?'ko':s.damage>0||(CUMULATIVE_ARMOUR&&armourTaken>0)?'damaged':''}"><td>
    <div class="shipname">${vText(s.name)} <span class="muted small">${c.short}</span></div>
    <div class="shipmeta">${vText(c.name)}</div>${modelLabel(s)}${specialChips(s.classId)}
  </td><td>${c.guns}</td><td>${c.aa}</td><td style="min-width:125px">${status}</td>
  <td><div class="damagecontrols">${IS_EXPERIMENTAL?btn('Target / hits','attack-modal',targetAttrs(ti,'ship',si)+(ko?' disabled':''),'xs action-attack'):allocation}
    ${btn(IS_EXPERIMENTAL?'−1 damage':CUMULATIVE_ARMOUR?'Undo armour hit':'Undo sinking','repair',`data-tf="${ti}" data-idx="${si}" ${!canCorrect?'disabled':''}`,'xs quiet')}
    ${btn('Match model','match-model',`data-tf="${ti}" data-idx="${si}"`,'xs')}
    ${btn('Rename','rename',`data-tf="${ti}" data-idx="${si}"`,'xs quiet')}</div></td></tr>`;
}
function renderScreenRow(sc,ti,si){const c=cls(sc),tf=getTF(ti),can=tf.pending.confirmed+tf.pending.unconfirmed;
 const allocation=!IS_EXPERIMENTAL&&sc.remaining>0&&can?`<div class="hit-buttons">${btn('6 (attacker)','assign-original',`data-tf="${ti}" data-idx="${si}" data-kind="screen" data-value="confirmed" ${tf.pending.confirmed<1?'disabled':''}`,'xs hit-confirm')}${btn('4–5 (defender)','assign-original',`data-tf="${ti}" data-idx="${si}" data-kind="screen" data-value="unconfirmed" ${tf.pending.unconfirmed<1?'disabled':''}`,'xs hit-unconfirm')}</div>`:'';
 return `<tr><td><div class="shipname">${c.name} <span class="muted small">${c.short}</span></div><div class="shipmeta">Aggregated screen · ${sc.ko} hit${sc.ko===1?'':'s'} / vessel</div>${modelLabel(sc)}${specialChips(sc.classId)}</td><td>${c.guns} × ${sc.remaining}</td><td>${c.aa} × ${sc.remaining}</td><td><span class="progressText"><b>${sc.remaining}</b> / ${sc.initial} remaining${IS_EXPERIMENTAL&&sc.partial?` · ${sc.partial} partial damage`:''}</span></td><td><div class="damagecontrols">${IS_EXPERIMENTAL?btn('Target / hits','attack-modal',targetAttrs(ti,'screen',si)+(sc.remaining===0?' disabled':''),'xs action-attack'):allocation}${btn('−1 vessel','screen-count',`data-tf="${ti}" data-idx="${si}" data-dir="-1" ${sc.remaining===0?'disabled':''}`,'xs')}${btn('Undo loss','screen-count',`data-tf="${ti}" data-idx="${si}" data-dir="1" ${sc.remaining===sc.initial?'disabled':''}`,'xs quiet')}${btn('Match model','match-model',`data-tf="${ti}" data-idx="${si}" data-kind="screen"`,'xs')}</div></td></tr>`;
}
function fleetPage(){
  if(!battle)return emptyPage();
  const modBlock=battle.mods.length?`<div class="panel mods-panel"><span class="eyebrow">Fleet modifications</span><div class="specials">${battle.mods.map(m=>`<span class="special-chip">${escapeHtml(MOD_NAMES[m]||m)}</span>`).join('')}</div>${!IS_EXPERIMENTAL&&(battle.mods.includes('improved-armour')||battle.mods.includes('torpedo-belts'))?'<div class="note">Class-specific armour modifiers: verify the selected ship class in the original builder and apply any increase manually; the companion does not guess which class was selected.</div>':''}</div>`:'';
  return `${statsStrip()}${modBlock}${battle.tfs.map((tf,ti)=>{
    const t=tfTotals(tf),pending=tf.pending.confirmed+tf.pending.unconfirmed;
    return `<section class="panel tf tf-${ti%3}"><div class="tf-head"><div><div class="eyebrow">${vText(tf.id)}</div><h2>${vText(tf.name)} ${btn('Rename','rename-tf',`data-tf="${ti}"`,'xs quiet')}</h2>${tf.commander?`<div class="note">${vText(tf.commander)}</div>`:''}</div><div class="tf-stats">${miniStat('Guns',t.guns)}${miniStat('AA',t.aa)}${ENHANCED_AIR?miniStat('CAP aloft',t.cap):miniStat('CAP',t.cap)}${ENHANCED_AIR?miniStat('Strike airborne',t.strike):miniStat('Strike',t.strike)}</div></div>
    ${!IS_EXPERIMENTAL?`<div class="hit-pool-panel"><div><b>${CUMULATIVE_ARMOUR?'Cumulative armour · house rule':'Published ship hit allocation'}</b><div class="note">6 = confirmed, allocated by attacker. 4–5 = unconfirmed, allocated by defender. One unconfirmed hit sinks any ship, including armoured ships. ${CUMULATIVE_ARMOUR?'Each confirmed hit removes one point of armour and persists across attacks.':'An Armoured ship needs its full confirmed-hit threshold within one attack.'}</div></div>${btn('Record attack hits','open-hit-pool',`data-tf="${ti}" ${pending?'disabled':''}`,'sm primary')}</div>`:''}
    ${pending?`<div class="callout warning"><b>${pending} unallocated hits:</b> ${tf.pending.confirmed} confirmed (attacker) + ${tf.pending.unconfirmed} unconfirmed (defender). ${IS_EXPERIMENTAL?'Assign to another declared target with Target / hits.':'Assign each hit below using the corresponding button. Destroyers are eligible for unconfirmed hits.'} ${btn('Discard unallocated hits','clear-pending',`data-tf="${ti}"`,'xs')}</div>`:''}
    <table class="fleettable"><thead><tr><th>Ship / miniature</th><th>Guns</th><th>AA</th><th>${IS_EXPERIMENTAL?'Damage / survivors':CUMULATIVE_ARMOUR?'Armour / survivors':'Status / survivors'}</th><th>Record action</th></tr></thead><tbody>${tf.ships.map((s,si)=>renderShipRow(s,ti,si)).join('')}${tf.screens.map((sc,si)=>renderScreenRow(sc,ti,si)).join('')}</tbody></table></section>`;
  }).join('')}<div class="callout">${IS_EXPERIMENTAL?'<b>Experimental:</b> confirmed (6) = 2 damage; unconfirmed (4–5) = 1; cumulative ship hull points and hangar fire +2 on the first confirmed hit while Strike is Refuel/Rearm.':CUMULATIVE_ARMOUR?'<b>Enhanced armour house rule:</b> Each confirmed hit (6) removes 1 armour point, accumulating across attacks. Confirmed hits go to the attacker for allocation; unconfirmed hits (4–5) go to the defender and may sink any vessel, including destroyers. Guns and AA update only when a ship sinks.':'<b>Original ship combat:</b> Keep published sinking and Armoured thresholds within each attack. Confirmed hits go to the attacker; unconfirmed hits go to the defender, including destroyers. Guns and AA update when sunk.'} Historical class and model labels are for matching physical miniatures; they do not alter combat statistics.</div>`;
}
function availableAircraft(a,group){const g=a.groups;return group==='strike'?a.bombers-g.strike.count:a.fighters-g.cap.count-g.escort.count;}
function renderGroupRow(s,ti,si,group){const g=s.air.groups[group],cap=group==='cap';const states=cap?['ready','air1','air2','rearm']:['ready','air1','rearm'];return `<div class="squadronrow group-${group}"><div><div class="group-type">${LABELS[group]}</div><small>${group==='cap'?'Defensive fighters · 2 rounds':group==='escort'?'Fighter escort · 1 round':'Bombers · 1 round'}</small></div><div class="count">${btn('−','group-count',`data-tf="${ti}" data-idx="${si}" data-group="${group}" data-dir="-1" ${g.count===0||g.status!=='ready'?'disabled':''}`,'sm') }<b>${g.count}</b>${btn('+','group-count',`data-tf="${ti}" data-idx="${si}" data-group="${group}" data-dir="1" ${availableAircraft(s.air,group)<=0||g.status!=='ready'?'disabled':''}`,'sm')}</div><div class="states">${states.map(st=>`<button class="state status-${st} group-${group} ${g.status===st?'active':''}" data-action="status" data-tf="${ti}" data-idx="${si}" data-group="${group}" data-value="${st}">${statusLabel(st,group)}</button>`).join('')}</div><div class="lossbox">${btn('−1 lost','lose-squadron',`data-tf="${ti}" data-idx="${si}" data-group="${group}" ${g.count<=0?'disabled':''}`,'xs danger')}</div></div>`;}
function airSummary(tf){
  const t=tfTotals(tf);
  return `<div class="airsummary">
   <div class="summary-label"><b>${vText(tf.id)} · ${vText(tf.name)}</b><span class="muted small">Combined task force aircraft strength</span></div>
   ${miniStat('Ready Strike',t.readyStrike,'Can launch')}${miniStat('Ready Escort',t.readyEscort,'Can launch')}
   ${miniStat('Airborne Strike',t.airStrike,'Committed dice')}${miniStat('Airborne Escort',t.airEscort,'Committed dice')}
   ${miniStat('CAP aloft',t.cap,`${t.capStation} on station · ${t.capLow} low fuel`)}
  </div>`;
}
function carrierPage(){
  if(!battle)return emptyPage();
  if(!ENHANCED_AIR){
    return `<div class="panel"><div class="sectionhead"><h2>Original aircraft rules</h2><span class="badge gray">Published mechanics · no new readiness cycle</span></div><p class="muted">Aircraft are shown for reference only. Resolve CAP, reconnaissance and Strike using the original game rules. There are no Escort, Refuel/Rearm, early recovery or permanent-loss controls in this mode.</p></div>`+
      battle.tfs.filter(tf=>carriers(tf).length).map(tf=>{
        const t=tfTotals(tf);
        return `<section class="panel"><div class="sectionhead"><h2>${escapeHtml(tf.id)} · ${escapeHtml(tf.name)}</h2><div class="tf-stats">${miniStat('CAP',t.cap)}${miniStat('Strike',t.strike)}</div></div><table class="fleettable"><thead><tr><th>Carrier</th><th>Class</th><th>Fighters</th><th>Bombers</th><th>Aircraft capacity</th><th>Status</th></tr></thead><tbody>${carriers(tf).map(s=>`<tr class="${isKo(s)?'ko':''}"><td>${escapeHtml(s.name)}</td><td>${escapeHtml(s.historicalClass||CLASSES[s.classId].name)}</td><td>${s.air.fighters}</td><td>${s.air.bombers}</td><td>${s.capacity}</td><td>${isKo(s)?'Sunk':'Active'}</td></tr>`).join('')}</tbody></table></section>`;
      }).join('');
  }
 const cs=allCarriers();if(!cs.length)return '<div class="panel empty">This fleet has no aircraft carriers.</div>';
 return `<div class="sectionhead"><div><h2>Hidden carrier operations</h2><span class="note">Keep this screen private. Aircraft totals reflect surviving, ready and committed squadrons.</span></div>${btn('⇧ Advance round','advance-round','','primary')}</div>
 <div class="callout"><b>Enhanced air combat sequence:</b> CAP intercepts on <b>5–6</b> → Escorts cancel CAP successes on <b>5–6</b> → AA neutralises Strike on <b>6</b> → remaining Strike scores ship hits on <b>4–6</b>. For each aircraft neutralised, roll for a permanent loss on <b>5–6</b> (33%). Record losses against the owning carrier below. Scenario modifiers still apply.</div>
 ${battle.tfs.map((tf,ti)=>{
  const found=tf.ships.map((s,si)=>({s,si})).filter(({s})=>s.air);
  if(!found.length)return '';
  return `${airSummary(tf)}<div class="note" style="margin:5px 0 10px">Unassigned fighter squadrons: ${tf.pool.fighters} · bombers: ${tf.pool.bombers}</div>${found.map(({s,si})=>{
    const a=s.air,ko=isKo(s),reservedF=a.fighters-a.groups.cap.count-a.groups.escort.count,reservedB=a.bombers-a.groups.strike.count;
    const capStatus=statusLabel(a.groups.cap.status,'cap');
    const capRecovery=a.groups.cap.status==='air1';
    return `<section class="panel carrier-card ${ko?'low':''}"><div class="carrierhead"><div><div class="eyebrow">${vText(CLASSES[s.classId].short)} · ${s.capacity} squadron capacity</div><h3>${vText(s.name)}</h3><span class="note">${IS_EXPERIMENTAL?`${s.damage}/${s.ko} ship damage · `:''}${ko?'Out of action — air groups unavailable':'Operational'}${s.historicalClass?` · ${vText(s.historicalClass)}`:''}</span></div><div class="carrier-stats"><div class="chip fighter-chip"><b>${a.fighters}</b><span>Fighters surviving</span></div><div class="chip bomber-chip"><b>${a.bombers}</b><span>Bombers surviving</span></div><div class="chip reserve-chip"><b>${reservedF}</b><span>Reserve fighters</span></div><div class="chip reserve-chip"><b>${reservedB}</b><span>Reserve bombers</span></div></div></div>${ko?'<div class="callout warning">Carrier knocked out. Its Guns, AA and aircraft strength no longer contribute.</div>':`
      <div class="deckbox deck-free"><div><b>Flight Operations</b><div class="note">CAP: ${vText(capStatus)}. Each Ready group may launch this round, even alongside other groups. Low Fuel CAP does not block strikes.</div></div><div class="launch-actions">${btn('Launch CAP','launch-group',`data-tf="${ti}" data-idx="${si}" data-group="cap" ${a.groups.cap.status!=='ready'||a.groups.cap.count===0?'disabled':''}`,'xs')}${btn('Launch Strike + Escort','launch-group',`data-tf="${ti}" data-idx="${si}" data-group="strike" ${a.groups.strike.status!=='ready'||a.groups.strike.count===0?'disabled':''}`,'xs primary')}${btn('Launch Escort only','launch-group',`data-tf="${ti}" data-idx="${si}" data-group="escort" ${a.groups.escort.status!=='ready'||a.groups.escort.count===0?'disabled':''}`,'xs')}${capRecovery?btn('Recover CAP early','recover-cap',`data-tf="${ti}" data-idx="${si}"`,'xs caution'):''}</div></div>
      <div class="squadron-table">${GROUPS.map(g=>renderGroupRow(s,ti,si,g)).join('')}</div><div class="builder-actions"><span class="small muted" style="align-self:center">${battle.started?'Aircraft transfers between carriers are locked after battle starts.':'Pre-battle carrier squadron assignment:'}</span>${btn('− Fighter','pool-change',`data-tf="${ti}" data-idx="${si}" data-kind="fighters" data-dir="-1" ${battle.started||a.fighters===0?'disabled':''}`,'xs')}${btn('+ Fighter','pool-change',`data-tf="${ti}" data-idx="${si}" data-kind="fighters" data-dir="1" ${battle.started||tf.pool.fighters===0||a.fighters+a.bombers>=s.capacity?'disabled':''}`,'xs')}${btn('− Bomber','pool-change',`data-tf="${ti}" data-idx="${si}" data-kind="bombers" data-dir="-1" ${battle.started||a.bombers===0?'disabled':''}`,'xs')}${btn('+ Bomber','pool-change',`data-tf="${ti}" data-idx="${si}" data-kind="bombers" data-dir="1" ${battle.started||tf.pool.bombers===0||a.fighters+a.bombers>=s.capacity?'disabled':''}`,'xs')}${reservedF?btn('Lose reserve fighter','lose-reserve',`data-tf="${ti}" data-idx="${si}" data-kind="fighters"`,'xs danger'):''}${reservedB?btn('Lose reserve bomber','lose-reserve',`data-tf="${ti}" data-idx="${si}" data-kind="bombers"`,'xs danger'):''}</div>`}</section>`;
  }).join('')}`;
 }).join('')}
 <div class="callout"><b>CAP:</b> Ready → On Station → Low Fuel → Refuel/Rearm → Ready. <b>Escort / Strike:</b> Ready → Airborne → Refuel/Rearm → Ready. <b>Launches:</b> CAP, Strike and Escort can launch in the same round, even with Low Fuel CAP. <b>Early CAP recovery:</b> choose Recover CAP early while On Station, after resolving that round’s CAP; CAP spends the next round refuelling and is Ready the round after. No deck-congestion restrictions. Manually changing a status is a correction, not a new mission. <b>Loss check:</b> neutralised bombers and engaged fighters are permanently lost on 5–6.</div>`;
}
function logPage(){if(!battle)return emptyPage();return `<div class="panel"><div class="sectionhead"><h2>Battle log</h2>${btn('↓ Save battle backup','export-battle','','sm')}</div><p class="muted small">Changes are recorded automatically. Undo restores the complete previous state, including all calculated totals.</p><ul class="log">${battle.log.map(e=>`<li><time>R${e.round}</time>${vText(e.text)}</li>`).join('')}</ul></div>`;}
function emptyPage(){return `<div class="panel empty"><h2>No fleet imported yet</h2><p>Open Fleet Builder, export its JSON file and import it here, or try the sample fleet.</p>${btn('Go to Fleet Builder','tab',`data-value="builder"`,'primary')}</div>`;}
function modalHtml(){if(!modal)return '';
 if(modal.type==='hit-pool'){
   const tf=getTF(modal.ti);if(!tf)return '';
   return `<div class="modal-wrap" role="dialog" aria-modal="true" aria-label="Record hit roll"><div class="modal"><div class="modal-head"><div><div class="eyebrow">${escapeHtml(tf.id)} · ${escapeHtml(tf.name)}</div><h2>Record an attack's hits</h2></div>${btn('✕','close-modal','','sm quiet')}</div><p class="note">Enter the final successful hit results after CAP and AA. Allocate confirmed hits (6) as attacker and unconfirmed hits (4–5) as defender. Destroyers are eligible.</p><div class="form-row"><label>Confirmed hits (6) · attacker assigns</label><input id="pool-conf" class="input" type="number" value="0" min="0" max="100" inputmode="numeric"></div><div class="form-row"><label>Unconfirmed hits (4–5) · defender assigns</label><input id="pool-unconf" class="input" type="number" value="0" min="0" max="100" inputmode="numeric"></div><div class="form-row"><label>Attack type</label><select class="input" id="pool-kind"><option value="air">Aircraft strike</option><option value="gun">Gun battle</option></select></div>${btn('Create hit pool','apply-hit-pool',`data-tf="${modal.ti}"`,'primary')} ${btn('Cancel','close-modal','','quiet')}</div></div>`;
 }
 if(modal.type==='attack'){
  const tf=getTF(modal.ti),target=modal.kind==='ship'?getShip(modal.ti,modal.idx):getScreen(modal.ti,modal.idx);if(!tf||!target)return '';
  const name=modal.kind==='ship'?target.name:CLASSES[target.classId].name;
  const hangar=modal.kind==='ship'&&target.air?.groups?.strike?.status==='rearm';
  const pending=tf.pending.confirmed+tf.pending.unconfirmed;
  return `<div class="modal-wrap" role="dialog" aria-modal="true" aria-label="Record attack"><div class="modal"><div class="modal-head"><div><div class="eyebrow">${vText(tf.name)}</div><h2>Record attack on ${vText(name)}</h2></div>${btn('✕','close-modal','','sm quiet')}</div><p class="note">Enter the rolled hits to allocate to this target. Confirmed hits (2 damage each) are resolved before unconfirmed hits (1 damage each). Whole unused hits remain available for another declared target.</p>${hangar?'<div class="callout warning"><b>Hangar fire:</b> Strike aircraft are Refuel/Rearm. First confirmed hit this attack causes an extra +2 damage.</div>':''}${pending?`<div class="callout"><b>Pending hit pool:</b> ${tf.pending.confirmed} confirmed + ${tf.pending.unconfirmed} unconfirmed.${btn('Apply pending hits','apply-pending',targetAttrs(modal.ti,modal.kind,modal.idx),'sm primary')}</div>`:`<div class="form-row"><label>Confirmed hits (6) · 2 damage each</label><input id="attack-conf" class="input" type="number" value="1" min="0" max="100" inputmode="numeric"></div><div class="form-row"><label>Unconfirmed hits (4–5) · 1 damage each</label><input id="attack-unconf" class="input" type="number" value="0" min="0" max="100" inputmode="numeric"></div>${btn('Apply attack','apply-attack',targetAttrs(modal.ti,modal.kind,modal.idx),'primary')}`}<div class="builder-actions">${btn('Cancel','close-modal','','quiet')}</div></div></div>`;
 }return '';
}
function render(){const root=document.querySelector('#app');if(!root)return;root.innerHTML=renderHeader()+`<main class="shell">${renderControls()}${tab==='builder'?builderPage():tab==='fleet'?fleetPage():tab==='carriers'?carrierPage():logPage()}<div class="footer"><span>Pacific Command Enhanced · ${escapeHtml(MODE_INFO[MODE].title)} · Unofficial playtest companion · Not affiliated with Osprey Games or WarLore</span><span>Built to import Type37 fleet JSON · Data remains on this device</span></div></main>`+modalHtml();}
function data(el,k){return el.getAttribute('data-'+k);}
function dispatch(el){const action=data(el,'action');if(!action)return;
  const ti=data(el,'tf'),idx=data(el,'idx'),group=data(el,'group'),v=data(el,'value');
  switch(action){
    case 'tab':tab=v;notice='';render();break;
    case 'open-fleet-file':document.querySelector('#fleet-file').click();break;
    case 'open-battle-file':document.querySelector('#battle-file').click();break;
    case 'demo':importFleet(demoFleet());break;
    case 'advance-round':advanceRound();break;
    case 'undo':undo();break;
    case 'dismiss-notice':notice='';render();break;
    case 'export-battle':if(battle)download(battle,backupName());break;
    case 'share-battle':shareBackup();break;
    case 'reset-battle':if(battle?.sourceFleet&&confirm('Reset this game to the original exported fleet? All damage, losses and aircraft states will be cleared.'))importFleetWithoutPrompt(battle.sourceFleet);break;
    case 'attack-modal':modal={type:'attack',ti:Number(ti),kind:data(el,'kind'),idx:Number(idx)};render();break;
    case 'close-modal':dismiss();break;
    case 'apply-attack':attack(ti,data(el,'kind'),idx,document.querySelector('#attack-conf')?.value,document.querySelector('#attack-unconf')?.value,false);break;
    case 'apply-pending':attack(ti,data(el,'kind'),idx,0,0,true);break;
    case 'open-hit-pool':openHitPool(ti);break;
    case 'apply-hit-pool':recordHitPool(ti,document.querySelector('#pool-conf')?.value,document.querySelector('#pool-unconf')?.value,document.querySelector('#pool-kind')?.value);break;
    case 'assign-original':allocateOriginalHit(ti,data(el,'kind'),idx,v);break;
    case 'match-model':editModel(ti,idx,data(el,'kind')==='screen');break;
    case 'clear-pending':clearPending(ti);break;
    case 'repair':reverseDamage(ti,idx);break;
    case 'rename':changeName(ti,idx);break;
    case 'rename-tf':renameTaskForce(ti);break;
    case 'launch-group':launchGroup(ti,idx,group);break;
    case 'recover-cap':recoverCapEarly(ti,idx);break;
    case 'screen-count':editScreenCount(ti,idx,Number(data(el,'dir')));break;
    case 'pool-change':modifyPool(ti,idx,data(el,'kind'),Number(data(el,'dir')));break;
    case 'group-count':adjustGroup(ti,idx,group,Number(data(el,'dir')));break;
    case 'status':changeStatus(ti,idx,group,v);break;
    case 'lose-squadron':loseSquadron(ti,idx,group);break;
    case 'lose-reserve':loseReserve(ti,idx,data(el,'kind'));break;
  }
}
function importFleetWithoutPrompt(raw){try{battle=makeBattle(raw);undoStack=[];tab='fleet';notice='Battle reset to original fleet.';persist();render();}catch(e){alert('Reset failed: '+e.message);}}
document.addEventListener('click',(ev)=>{
  if(ev.target.classList.contains('modal-wrap')){dismiss();return;}
  const button=ev.target.closest('[data-action]');if(!button||button.disabled)return;ev.preventDefault();dispatch(button);
});
document.querySelector('#fleet-file').addEventListener('change',async(e)=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{importFleet(JSON.parse(await f.text()));}catch(err){alert('Could not load fleet JSON: '+err.message);}});
document.querySelector('#battle-file').addEventListener('change',async(e)=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{importBattle(JSON.parse(await f.text()));}catch(err){alert('Could not load battle backup: '+err.message);}});
restore();render();
