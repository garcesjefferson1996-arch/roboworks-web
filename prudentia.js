/* ================================================================
   VIRTUS: PRUDENTIA — Motor de juego
   ================================================================ */
(function(){
"use strict";

/* ---------- CONSTANTES ---------- */
const STORAGE_INDEX='vp_games_index';
const STORAGE_GAME_PREFIX='vp_game_';
const STORAGE_CURRENT='vp_current_game_id';
const STORAGE_SOUND='vp_sound_on';
const MAX_SNAPSHOTS=25;

const AVATARS=['🚀','🦊','🐯','🦁','🐼','🐨','🐸','🦄','🐙','🦅','🐺','🦉','🐢','🐬','🦋','🐝','🐲','🌟'];
const PLAYER_COLORS=['#2f6bff','#ff7a3d','#f6b93c','#22c55e','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#0ea5e9','#a855f7'];
const PIP_MAP={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};

const REFLECTION_QUESTIONS=[
  '¿Cuándo decidiste detenerte?',
  '¿Alguna vez continuaste y perdiste tus puntos?',
  '¿Qué sentiste cuando tenías muchos puntos en riesgo?',
  '¿Tus compañeros influyeron en alguna decisión?',
  '¿Siempre arriesgar más fue la mejor decisión?',
  '¿Dónde podemos practicar la prudencia en nuestra vida?'
];

/* ---------- ESTADO EN MEMORIA ---------- */
let game=null;
let lastRollSnapshot=null;    // snapshot justo antes de la última tirada (para "corregir tirada")
let pendingDice={d1:null,d2:null};
let soundOn=true;
let editingPlayerId=null;
let confirmCallback=null;

/* ============================================================
   UTIL
============================================================ */
function uid(){return 'x'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function clone(o){return JSON.parse(JSON.stringify(o));}
function fmtDate(d){return d.toLocaleDateString('es-EC',{day:'2-digit',month:'long',year:'numeric'});}
function $(sel){return document.querySelector(sel);}
function $all(sel){return Array.from(document.querySelectorAll(sel));}
function esc(s){return (s||'').toString().replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function toast(msg,type){
  const region=$('#toast-region');
  const el=document.createElement('div');
  el.className='toast'+(type?(' '+type):'');
  el.innerHTML=msg;
  region.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';el.style.transition='opacity .3s';setTimeout(()=>el.remove(),300);},2600);
}

function showConfirm(title,msg,onOk){
  $('#confirm-title').textContent=title;
  $('#confirm-msg').textContent=msg;
  confirmCallback=onOk;
  openModal('modal-confirm');
}

function openModal(id){$('#'+id).classList.add('open');}
function closeModal(id){$('#'+id).classList.remove('open');}

/* ============================================================
   SONIDO (WebAudio, opcional)
============================================================ */
let actx=null;
function ensureAudio(){if(!actx){try{actx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){}}}
function playTone(freq,dur,type,vol){
  if(!soundOn||!actx)return;
  try{
    const o=actx.createOscillator(),g=actx.createGain();
    o.type=type||'sine';o.frequency.value=freq;
    g.gain.value=vol!==undefined?vol:0.06;
    o.connect(g);g.connect(actx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001,actx.currentTime+dur);
    o.stop(actx.currentTime+dur);
  }catch(e){}
}
function sfx(name){
  ensureAudio();
  if(!soundOn)return;
  switch(name){
    case 'normal': playTone(520,.18,'sine'); break;
    case 'single_one': playTone(300,.35,'sawtooth',.05); break;
    case 'double_one': [260,200,140].forEach((f,i)=>setTimeout(()=>playTone(f,.4,'sawtooth',.07),i*140)); break;
    case 'double_six': [660,880,1046].forEach((f,i)=>setTimeout(()=>playTone(f,.25,'triangle',.06),i*110)); break;
    case 'secure': [520,660].forEach((f,i)=>setTimeout(()=>playTone(f,.2,'sine'),i*110)); break;
    case 'victory': [520,660,880,1046].forEach((f,i)=>setTimeout(()=>playTone(f,.3,'triangle',.07),i*150)); break;
    case 'click': playTone(700,.05,'square',.03); break;
  }
}
function updateSoundBtn(){
  const btn=$('#btn-sound');
  btn.innerHTML=soundOn?'<i class="fas fa-volume-high"></i>':'<i class="fas fa-volume-xmark"></i>';
  btn.classList.toggle('active',!soundOn);
  btn.title=soundOn?'Silenciar sonido':'Activar sonido';
}

/* ============================================================
   MOTOR DE REGLAS — EXACTO SEGÚN ESPECIFICACIÓN
============================================================ */
function processRoll(die1,die2,player){
  if(die1===1&&die2===1){
    player.totalScore=0;player.turnScore=0;
    return {type:'DOUBLE_ONE',endTurn:true};
  }
  if(die1===1||die2===1){
    player.turnScore=0;
    return {type:'SINGLE_ONE',endTurn:true};
  }
  if(die1===6&&die2===6){
    player.turnScore+=20;
    return {type:'DOUBLE_SIX',points:20,endTurn:false};
  }
  const points=die1+die2;
  player.turnScore+=points;
  return {type:'NORMAL',points:points,endTurn:false};
}
function securePlayer(player){
  player.totalScore+=player.turnScore;
  player.turnScore=0;
}

/* ============================================================
   PERSISTENCIA
============================================================ */
function pushSnapshot(){
  if(!game)return;
  if(!game.snapshots)game.snapshots=[];
  const {snapshots,...rest}=game;
  game.snapshots.push(JSON.stringify(rest));
  if(game.snapshots.length>MAX_SNAPSHOTS)game.snapshots.shift();
}
function saveGame(){
  if(!game)return;
  localStorage.setItem(STORAGE_GAME_PREFIX+game.id,JSON.stringify(game));
  localStorage.setItem(STORAGE_CURRENT,game.id);
  let idx=getGamesIndex();
  const i=idx.findIndex(g=>g.id===game.id);
  const entry={id:game.id,name:game.name,institution:game.institution,group:game.group,facilitator:game.facilitator,createdAt:game.createdAt,status:game.status,targetScore:game.targetScore};
  if(i>=0)idx[i]=entry;else idx.unshift(entry);
  localStorage.setItem(STORAGE_INDEX,JSON.stringify(idx));
}
function getGamesIndex(){
  try{return JSON.parse(localStorage.getItem(STORAGE_INDEX))||[];}catch(e){return [];}
}
function loadGame(id){
  try{return JSON.parse(localStorage.getItem(STORAGE_GAME_PREFIX+id));}catch(e){return null;}
}
function deleteGame(id){
  localStorage.removeItem(STORAGE_GAME_PREFIX+id);
  let idx=getGamesIndex().filter(g=>g.id!==id);
  localStorage.setItem(STORAGE_INDEX,JSON.stringify(idx));
  if(localStorage.getItem(STORAGE_CURRENT)===id)localStorage.removeItem(STORAGE_CURRENT);
}

/* ============================================================
   ROUTER DE VISTAS
============================================================ */
function showView(id){
  $all('.view').forEach(v=>v.classList.remove('active'));
  $('#'+id).classList.add('active');
  window.scrollTo(0,0);
}

/* ============================================================
   HERO
============================================================ */
function dieHTML(container,value){
  container.innerHTML='';
  for(let i=1;i<=9;i++){
    const p=document.createElement('div');
    p.className='pip'+((PIP_MAP[value]||[]).includes(i)?' on':'');
    container.appendChild(p);
  }
}

function spawnParticles(){
  const bg=$('#fx-bg');
  for(let i=0;i<26;i++){
    const p=document.createElement('div');
    const isSpark=Math.random()>0.65;
    p.className=isSpark?'fx-spark':'fx-particle';
    const size=isSpark?3:(2+Math.random()*3);
    p.style.left=Math.random()*100+'%';
    p.style.top=Math.random()*100+'%';
    if(!isSpark){
      p.style.width=size+'px';p.style.height=size+'px';
      p.style.animationDuration=(14+Math.random()*18)+'s';
      p.style.animationDelay=(Math.random()*10)+'s';
    } else {
      p.style.animationDelay=(Math.random()*3)+'s';
    }
    bg.appendChild(p);
  }
}

function renderPreviousGames(){
  const list=getGamesIndex();
  const el=$('#previous-games-list');
  if(!list.length){el.innerHTML='<p class="modal-sub">Aún no hay partidas guardadas. ¡Crea tu primera aventura!</p>';return;}
  el.innerHTML=list.map(g=>{
    const statusLabel={setup:'En preparación',playing:'En curso',paused:'Pausada',finished:'Finalizada'}[g.status]||g.status;
    return `<div class="prev-game-card">
      <div class="prev-game-info">
        <div class="prev-game-name">${esc(g.name||'Partida sin nombre')}</div>
        <div class="prev-game-meta">${esc(g.institution||'—')} · ${esc(g.group||'—')} · ${g.targetScore?('Meta '+g.targetScore+' pts'):'Libre'}</div>
      </div>
      <span class="prev-status status-${g.status}">${statusLabel}</span>
      <div style="display:flex;gap:.4rem">
        ${g.status!=='finished'?`<button class="btn btn-primary btn-sm" data-resume="${g.id}">Retomar</button>`:`<button class="btn btn-outline btn-sm" data-view="${g.id}">Ver cierre</button>`}
        <button class="btn btn-outline btn-sm" data-del="${g.id}" style="color:#b91c1c;border-color:#fecaca"><i class="fas fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-resume]').forEach(b=>b.addEventListener('click',()=>{closeModal('modal-previous');resumeGame(b.dataset.resume);}));
  el.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{closeModal('modal-previous');resumeGame(b.dataset.view,true);}));
  el.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{
    showConfirm('Eliminar partida','Esta acción no se puede deshacer. ¿Eliminar esta partida guardada?',()=>{deleteGame(b.dataset.del);renderPreviousGames();});
  }));
}
function resumeGame(id,forceFinished){
  const g=loadGame(id);
  if(!g){toast('No se pudo cargar la partida','warn');return;}
  game=g;
  localStorage.setItem(STORAGE_CURRENT,id);
  toast('<i class="fas fa-circle-check"></i> Partida recuperada','good');
  if(game.status==='finished'||forceFinished){renderPodium();showView('view-podium');}
  else{game.status='playing';saveGame();renderBoard();showView('view-board');}
}

/* ============================================================
   WIZARD — NUEVA PARTIDA
============================================================ */
let wizardDraft={};
function startNewAdventureFlow(){
  wizardDraft={name:'',institution:'',group:'',facilitator:'',goal:100,customGoal:null,timeGoal:null,endMode:'B'};
  $('#w-name').value='';$('#w-inst').value='';$('#w-group').value='';$('#w-facil').value='';
  $('#w-date').value=fmtDate(new Date());
  showView('view-wizard1');
  setTimeout(()=>$('#w-name').focus(),50);
}

/* ============================================================
   INSCRIPCIÓN DE JUGADORES
============================================================ */
let draftPlayers=[];
let playersScreenMode='new'; // 'new' | 'editMidGame'
function makePlayer(name){
  const n=draftPlayers.length;
  return {
    id:uid(),name:name,nickname:'',team:'',
    avatar:AVATARS[n%AVATARS.length],
    color:PLAYER_COLORS[n%PLAYER_COLORS.length],
    totalScore:0,turnScore:0,position:n+1,
    rollsCount:0,continueCount:0,secureCount:0,doubleOneCount:0,doubleSixCount:0,turnsPlayed:0,
    rollsThisTurn:0
  };
}
function renderPlayersGrid(){
  const grid=$('#players-grid');
  const empty=$('#empty-players-msg');
  if(!draftPlayers.length){grid.innerHTML='';empty.style.display='block';}
  else{
    empty.style.display='none';
    grid.innerHTML=draftPlayers.map((p,i)=>`
      <div class="player-card">
        <div class="pc-actions">
          <button class="pc-btn" data-edit="${p.id}" aria-label="Editar jugador"><i class="fas fa-pen"></i></button>
          <button class="pc-btn danger" data-del="${p.id}" aria-label="Eliminar jugador"><i class="fas fa-xmark"></i></button>
        </div>
        <div class="pc-top">
          <div class="pc-avatar" style="background:${p.color}">${p.avatar}</div>
          <div>
            <div class="pc-num">Jugador ${String(i+1).padStart(2,'0')}</div>
            <div class="pc-name">${esc((p.nickname||p.name).toUpperCase())}</div>
          </div>
        </div>
      </div>`).join('');
    grid.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',()=>openEditPlayer(b.dataset.edit)));
    grid.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{
      draftPlayers=draftPlayers.filter(p=>p.id!==b.dataset.del);
      draftPlayers.forEach((p,i)=>p.position=i+1);
      renderPlayersGrid();
    }));
  }
  $('#player-count-text').textContent=draftPlayers.length+' aventurero'+(draftPlayers.length===1?'':'s')+' listo'+(draftPlayers.length===1?'':'s');
  $('#pl-start').disabled=draftPlayers.length<2;
}
function addPlayerFromInput(){
  const input=$('#p-name-input');
  const name=input.value.trim();
  if(!name)return;
  if(draftPlayers.some(p=>p.name.toLowerCase()===name.toLowerCase())){
    toast('Ese nombre ya está en la lista','warn');return;
  }
  draftPlayers.push(makePlayer(name));
  renderPlayersGrid();
  input.value='';
  input.focus();
}

function openEditPlayer(id){
  editingPlayerId=id;
  const p=draftPlayers.find(x=>x.id===id);
  if(!p)return;
  $('#ep-name').value=p.name;$('#ep-nick').value=p.nickname||'';$('#ep-team').value=p.team||'';
  const avWrap=$('#ep-avatars');avWrap.innerHTML='';
  AVATARS.forEach(a=>{
    const b=document.createElement('button');
    b.type='button';b.textContent=a;b.style.cssText='font-size:1.3rem;width:42px;height:42px;border-radius:12px;border:2px solid '+(a===p.avatar?'var(--blue)':'var(--line)')+';background:#fff';
    b.addEventListener('click',()=>{p.avatar=a;openEditPlayer(id);});
    avWrap.appendChild(b);
  });
  const colWrap=$('#ep-colors');colWrap.innerHTML='';
  PLAYER_COLORS.forEach(c=>{
    const b=document.createElement('button');
    b.type='button';b.style.cssText='width:32px;height:32px;border-radius:50%;background:'+c+';border:3px solid '+(c===p.color?'var(--ink)':'transparent');
    b.addEventListener('click',()=>{p.color=c;openEditPlayer(id);});
    colWrap.appendChild(b);
  });
  openModal('modal-edit-player');
}

/* ============================================================
   TABLERO — RENDER
============================================================ */
function currentPlayer(){return game.players[game.currentPlayerIndex];}

function goalChipText(){
  if(game.targetScore)return 'META: '+game.targetScore+' PUNTOS';
  if(game.timeGoal)return 'PARTIDA POR TIEMPO: '+game.timeGoal+' MIN';
  return 'PARTIDA LIBRE';
}

function renderBoard(){
  if(!game)return;
  $('#board-goal-chip').textContent=goalChipText();
  const p=currentPlayer();
  $('#cp-avatar').style.background=p.color;
  $('#cp-avatar').textContent=p.avatar;
  $('#cp-name').textContent=(p.nickname||p.name).toUpperCase();
  const rank=rankingOf().findIndex(r=>r.id===p.id)+1;
  $('#cp-position').textContent='Posición '+rank+' de '+game.players.length+' · Ronda '+game.roundNumber;
  $('#cp-safe').textContent=p.totalScore;
  $('#cp-risk').textContent=p.turnScore;
  $('#cp-risk-note').textContent=p.turnScore>0?('Si continúas, estos '+p.turnScore+' puntos están en riesgo.'):'Aún no hay puntos en riesgo este turno.';
  if(game.lastRoll&&game.lastRoll.playerId===p.id){
    $('#last-roll-row').style.display='flex';
    dieHTML($('#lr-die1'),game.lastRoll.die1);
    dieHTML($('#lr-die2'),game.lastRoll.die2);
    $('#lr-text').textContent=game.lastRoll.label;
  } else {
    $('#last-roll-row').style.display='none';
  }
  renderRanking();
  renderHistoryMini();
  document.title='VIRTUS: PRUDENTIA — Turno de '+(p.nickname||p.name);
}

function rankingOf(){
  return [...game.players].sort((a,b)=>b.totalScore-a.totalScore);
}
function renderRanking(){
  const list=rankingOf();
  const max=Math.max(1,...(game.targetScore?[game.targetScore]:list.map(p=>p.totalScore||1)));
  const medals=['🥇','🥈','🥉'];
  $('#ranking-list').innerHTML=list.map((p,i)=>`
    <div class="rank-row ${i===0&&p.totalScore>0?'leader':''}">
      <div class="rank-medal">${medals[i]||(i+1)}</div>
      <div class="rank-avatar" style="background:${p.color}">${p.avatar}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;gap:.4rem">
          <span class="rank-name">${esc(p.nickname||p.name)}</span>
          <span class="rank-pts">${p.totalScore} pts</span>
        </div>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.min(100,(p.totalScore/max)*100)}%"></div></div>
      </div>
    </div>`).join('');
}
function renderHistoryMini(){
  const recent=[...game.history].slice(-6).reverse();
  $('#history-mini-list').innerHTML=recent.length?recent.map(ev=>historyRowHTML(ev)).join(''):'<p style="color:var(--muted-2);font-size:.8rem">Aún no hay jugadas registradas.</p>';
}
function historyRowHTML(ev){
  let resultText='',cls='';
  if(ev.type==='NORMAL'){resultText='+'+ev.points+' pts';cls='hm-pos';}
  else if(ev.type==='DOUBLE_SIX'){resultText='+20 pts (¡Doble 6!)';cls='hm-pos';}
  else if(ev.type==='SINGLE_ONE'){resultText='Perdió '+ev.turnScoreBefore+' pts del turno';cls='hm-neg';}
  else if(ev.type==='DOUBLE_ONE'){resultText='Total '+ev.totalScoreBefore+' → 0';cls='hm-neg';}
  else if(ev.type==='SECURE'){resultText='Aseguró +'+ev.points+' pts';cls='hm-pos';}
  return `<div class="history-mini-row"><b>${esc(ev.playerName)}</b> ${ev.die1?('· '+ev.die1+' + '+ev.die2):''} <span class="hm-pts ${cls}">${resultText}</span></div>`;
}

/* ============================================================
   REGISTRO DE LANZAMIENTO
============================================================ */
function buildDieOptions(container,dieKey){
  container.innerHTML='';
  for(let v=1;v<=6;v++){
    const btn=document.createElement('button');
    btn.type='button';btn.className='die-opt';btn.setAttribute('aria-label','Dado valor '+v);
    btn.dataset.val=v;
    const face=document.createElement('div');face.className='die-face';
    for(let i=1;i<=9;i++){const p=document.createElement('div');p.className='pip'+((PIP_MAP[v]).includes(i)?' on':'');face.appendChild(p);}
    btn.appendChild(face);
    const lbl=document.createElement('div');lbl.className='die-opt-val';lbl.textContent=v;btn.appendChild(lbl);
    btn.addEventListener('click',()=>{
      pendingDice[dieKey]=v;
      container.querySelectorAll('.die-opt').forEach(o=>o.classList.remove('selected'));
      btn.classList.add('selected');
      sfx('click');
      $('#btn-confirm-roll').disabled=!(pendingDice.d1&&pendingDice.d2);
    });
    container.appendChild(btn);
  }
}
function openDiceModal(){
  pendingDice={d1:null,d2:null};
  buildDieOptions($('#die1-options'),'d1');
  buildDieOptions($('#die2-options'),'d2');
  $('#btn-confirm-roll').disabled=true;
  openModal('modal-dice');
}

function commitRoll(d1,d2){
  const p=currentPlayer();
  lastRollSnapshot=JSON.stringify((({snapshots,...rest})=>rest)(game));
  pushSnapshot();
  const turnScoreBefore=p.turnScore, totalScoreBefore=p.totalScore;
  const result=processRoll(d1,d2,p);
  p.rollsCount++;
  const ev={
    id:uid(),date:new Date().toISOString(),
    playerId:p.id,playerName:(p.nickname||p.name),
    round:game.roundNumber,turnNumber:p.turnsPlayed+1,
    die1:d1,die2:d2,type:result.type,points:result.points||0,
    turnScoreBefore,turnScoreAfter:p.turnScore,
    totalScoreBefore,totalScoreAfter:p.totalScore,
    decision:null
  };
  game.history.push(ev);
  game.lastRoll={playerId:p.id,die1:d1,die2:d2,label:(d1+' + '+d2)};
  if(result.type==='DOUBLE_ONE')p.doubleOneCount++;
  if(result.type==='DOUBLE_SIX')p.doubleSixCount++;
  saveGame();
  renderBoard();

  if(result.type==='DOUBLE_ONE'){
    sfx('double_one');
    $('#d1-before').textContent=totalScoreBefore;
    openModal('modal-double-one');
  } else if(result.type==='SINGLE_ONE'){
    sfx('single_one');
    $('#s1-before').textContent=turnScoreBefore;
    $('#s1-total').textContent=p.totalScore;
    openModal('modal-single-one');
  } else if(result.type==='DOUBLE_SIX'){
    sfx('double_six');
    $('#d6-newtotal').textContent=p.turnScore;
    openModal('modal-double-six');
  } else {
    sfx('normal');
    toast('+'+result.points+' puntos en riesgo');
    openDecisionPanel();
  }
}

/* ============================================================
   PANEL DE DECISIÓN
============================================================ */
function openDecisionPanel(){
  const p=currentPlayer();
  $('#dec-safe').textContent=p.totalScore;
  $('#dec-risk').textContent=p.turnScore;
  $('#secure-btn-title').textContent='ASEGURAR '+p.turnScore+' PUNTOS';
  openModal('modal-decision');
}

function checkGoalReached(p){
  if(game.targetScore&&p.totalScore>=game.targetScore&&!game.pendingFinish){
    game.pendingFinish=true;
    if(game.endMode==='A'){
      game.finishNow=true;
      saveGame();
      toast('<i class="fas fa-flag-checkered"></i> ¡META ALCANZADA por '+esc(p.nickname||p.name)+'! Victoria inmediata.','good');
    } else {
      game.finishRound=game.roundNumber;
      saveGame();
      toast('<i class="fas fa-flag-checkered"></i> ¡META ALCANZADA por '+esc(p.nickname||p.name)+'! Se completará la ronda.','good');
    }
  }
}

/* ============================================================
   AVANCE DE TURNO / RONDA / FIN DE PARTIDA
============================================================ */
function endTurnAdvance(){
  const p=currentPlayer();
  p.turnsPlayed++;
  game.currentPlayerIndex=(game.currentPlayerIndex+1)%game.players.length;
  if(game.currentPlayerIndex===0){
    // se completó una ronda
    if(game.pendingFinish&&game.roundNumber>=game.finishRound){
      finishGame();
      return;
    }
    game.roundNumber++;
  }
  game.lastRoll=null;
  saveGame();
  renderBoard();
  announceTurn();
}
function announceTurn(){
  const p=currentPlayer();
  toast('<i class="fas fa-dice"></i> Ahora juega '+esc(p.nickname||p.name));
}

/* ============================================================
   DESHACER / CORREGIR
============================================================ */
function doUndo(){
  if(!game.snapshots||!game.snapshots.length){toast('No hay acciones para deshacer','warn');return;}
  const snap=game.snapshots.pop();
  const keepSnapshots=game.snapshots;
  game=JSON.parse(snap);
  game.snapshots=keepSnapshots;
  saveGame();
  renderBoard();
  toast('Última jugada deshecha');
}

/* ============================================================
   FACILITADOR — DRAWER
============================================================ */
function openDrawer(){$('#facilitator-drawer').classList.add('open');$('#facilitator-overlay').classList.add('open');}
function closeDrawer(){$('#facilitator-drawer').classList.remove('open');$('#facilitator-overlay').classList.remove('open');}

function updatePauseLabel(){$('#fp-pause-label').textContent=game&&game.status==='paused'?'Reanudar partida':'Pausar partida';}

function renderFullHistory(){
  const rev=[...game.history].reverse();
  $('#full-history-list').innerHTML=rev.length?rev.map(ev=>`
    <div class="hist-entry">
      <div class="he-top"><span>${esc(ev.playerName)}</span><span>Ronda ${ev.round} · Turno ${ev.turnNumber}</span></div>
      <div class="he-meta">${new Date(ev.date).toLocaleString('es-EC')} ${ev.die1?('· 🎲 '+ev.die1+' + '+ev.die2):''}</div>
      <div class="he-result ${['NORMAL','DOUBLE_SIX','SECURE'].includes(ev.type)?'he-pos':'he-neg'}">${historyLongText(ev)}</div>
    </div>`).join(''):'<p style="color:var(--muted)">Sin jugadas registradas todavía.</p>';
}
function historyLongText(ev){
  if(ev.type==='NORMAL')return 'Suma normal: +'+ev.points+' puntos en riesgo'+(ev.decision?(' · Decisión: '+ev.decision):'');
  if(ev.type==='DOUBLE_SIX')return '¡Doble 6! +20 puntos en riesgo'+(ev.decision?(' · Decisión: '+ev.decision):'');
  if(ev.type==='SINGLE_ONE')return 'Un solo 1: perdió '+ev.turnScoreBefore+' puntos del turno';
  if(ev.type==='DOUBLE_ONE')return '¡Doble 1! Puntaje total: '+ev.totalScoreBefore+' → 0';
  if(ev.type==='SECURE')return 'Aseguró +'+ev.points+' puntos. Nuevo total: '+ev.totalScoreAfter;
  return '';
}

/* ============================================================
   ESTADÍSTICAS PEDAGÓGICAS
============================================================ */
function computeStats(){
  const players=game.players;
  const hist=game.history;
  const byId=Object.fromEntries(players.map(p=>[p.id,p]));
  const stats={
    doubleOnes:hist.filter(e=>e.type==='DOUBLE_ONE').length,
    doubleSixes:hist.filter(e=>e.type==='DOUBLE_SIX').length,
    biggestLoss:{name:'—',value:0},
    mostRisked:{name:'—',value:0},
    avgRollsBeforeSecure:{name:'—',value:0},
    comeback:{name:'—',value:0}
  };
  hist.forEach(e=>{
    if((e.type==='SINGLE_ONE'||e.type==='DOUBLE_ONE')){
      const lost=e.type==='DOUBLE_ONE'?e.totalScoreBefore:e.turnScoreBefore;
      if(lost>stats.biggestLoss.value){stats.biggestLoss={name:e.playerName,value:lost};}
    }
  });
  const risked={};
  hist.forEach(e=>{if(e.points&&e.type!=='SECURE'){risked[e.playerId]=(risked[e.playerId]||0)+e.points;}});
  Object.keys(risked).forEach(pid=>{if(risked[pid]>stats.mostRisked.value){stats.mostRisked={name:(byId[pid]?(byId[pid].nickname||byId[pid].name):'—'),value:risked[pid]};}});
  let rollsSinceSecure={},secureSamples=[];
  hist.forEach(e=>{
    if(e.die1){rollsSinceSecure[e.playerId]=(rollsSinceSecure[e.playerId]||0)+1;}
    if(e.type==='SECURE'){secureSamples.push(rollsSinceSecure[e.playerId]||0);rollsSinceSecure[e.playerId]=0;}
    if(e.type==='SINGLE_ONE'||e.type==='DOUBLE_ONE'){rollsSinceSecure[e.playerId]=0;}
  });
  if(secureSamples.length)stats.avgRollsBeforeSecure={name:'Promedio general',value:(secureSamples.reduce((a,b)=>a+b,0)/secureSamples.length).toFixed(1)};
  const scoreboard={};players.forEach(p=>scoreboard[p.id]=0);
  const worstRank={};players.forEach(p=>worstRank[p.id]=1);
  function ranksNow(){
    const arr=players.map(p=>({id:p.id,score:scoreboard[p.id]})).sort((a,b)=>b.score-a.score);
    const ranks={};arr.forEach((r,i)=>ranks[r.id]=i+1);return ranks;
  }
  hist.forEach(e=>{
    if(e.totalScoreAfter!==undefined)scoreboard[e.playerId]=e.totalScoreAfter;
    const ranks=ranksNow();
    players.forEach(p=>{if(ranks[p.id]>worstRank[p.id])worstRank[p.id]=ranks[p.id];});
  });
  const finalRanks=ranksNow();
  let bestDelta=0,bestName='—';
  players.forEach(p=>{
    const delta=worstRank[p.id]-finalRanks[p.id];
    if(delta>bestDelta){bestDelta=delta;bestName=(p.nickname||p.name);}
  });
  if(bestDelta>0)stats.comeback={name:bestName,value:bestDelta};

  let mostContinue={name:'—',value:-1},mostSecure={name:'—',value:-1},topScore={name:'—',value:-1};
  players.forEach(p=>{
    if(p.continueCount>mostContinue.value)mostContinue={name:(p.nickname||p.name),value:p.continueCount};
    if(p.secureCount>mostSecure.value)mostSecure={name:(p.nickname||p.name),value:p.secureCount};
    if(p.totalScore>topScore.value)topScore={name:(p.nickname||p.name),value:p.totalScore};
  });
  stats.topScore=topScore;stats.mostContinue=mostContinue;stats.mostSecure=mostSecure;
  return stats;
}
function renderStatsModal(){
  const s=computeStats();
  $('#stats-content').innerHTML=`
    <div class="stats-grid" style="color:var(--ink)">
      ${statCardHTML('fa-trophy','Mayor puntaje',s.topScore.name,s.topScore.value+' pts')}
      ${statCardHTML('fa-shield-halved','Gran Estratega (más veces aseguró)',s.mostSecure.name,s.mostSecure.value+' veces')}
      ${statCardHTML('fa-dice','Valiente Pensador (más veces continuó)',s.mostContinue.name,s.mostContinue.value+' veces')}
      ${statCardHTML('fa-fire','Mayor riesgo total asumido',s.mostRisked.name,s.mostRisked.value+' pts')}
      ${statCardHTML('fa-star','Gran Remontada',s.comeback.name,s.comeback.value>0?('subió '+s.comeback.value+' posición(es)'):'—')}
      ${statCardHTML('fa-scale-balanced','Promedio de lanzamientos antes de asegurar',s.avgRollsBeforeSecure.name,String(s.avgRollsBeforeSecure.value))}
      ${statCardHTML('fa-skull','Dobles 1 en la partida','Total de la clase',s.doubleOnes)}
      ${statCardHTML('fa-star-of-david','Dobles 6 en la partida','Total de la clase',s.doubleSixes)}
    </div>`;
}
function statCardHTML(icon,title,name,detail){
  return `<div class="stat-recog" style="background:#f8faff;border-color:var(--line)">
    <div class="sr-icon"><i class="fas ${icon}" style="color:var(--blue)"></i></div>
    <div class="sr-title">${title}</div>
    <div class="sr-name">${esc(String(name))}</div>
    <div class="sr-detail">${esc(String(detail))}</div>
  </div>`;
}

/* ============================================================
   FIN DE PARTIDA / PODIO
============================================================ */
function finishGame(){
  game.status='finished';
  game.finishedAt=new Date().toISOString();
  saveGame();
  sfx('victory');
  renderPodium();
  showView('view-podium');
  fireConfetti();
}
function renderPodium(){
  const ranked=rankingOf();
  const champion=ranked[0];
  $('#podium-sub').innerHTML=champion?('<b style="color:var(--gold-2)">'+esc(champion.nickname||champion.name)+'</b> — Maestro de la Decisión'):'';
  const slots=[
    {p:ranked[0],cls:'first',label:'1er Lugar'},
    {p:ranked[1],cls:'second',label:'2do Lugar'},
    {p:ranked[2],cls:'third',label:'3er Lugar'}
  ].filter(s=>s.p);
  $('#podium-stage').innerHTML=slots.map(s=>`
    <div class="podium-slot ${s.cls}">
      <div class="ps-avatar" style="background:${s.p.color}">${s.p.avatar}</div>
      <div class="ps-name">${esc(s.p.nickname||s.p.name)}</div>
      <div class="ps-title">${s.label}</div>
      <div class="podium-bar">${s.p.totalScore}</div>
    </div>`).join('');
  const s=computeStats();
  $('#recognitions-grid').innerHTML=`
    ${statCardHTML('fa-crown','Maestro de la Decisión',champion?(champion.nickname||champion.name):'—',(champion?champion.totalScore:0)+' pts')}
    ${statCardHTML('fa-shield-halved','Gran Estratega',s.mostSecure.name,s.mostSecure.value+' aseguradas')}
    ${statCardHTML('fa-dice','Valiente Pensador',s.mostContinue.name,s.mostContinue.value+' veces continuó')}
    ${statCardHTML('fa-scale-balanced','Maestro del Equilibrio',s.avgRollsBeforeSecure.name,String(s.avgRollsBeforeSecure.value)+' lanzamientos promedio')}
    ${statCardHTML('fa-star','Gran Remontada',s.comeback.value>0?s.comeback.name:'—',s.comeback.value>0?('subió '+s.comeback.value+' posiciones'):'Sin datos suficientes')}
  `;
}
function fireConfetti(){
  const layer=$('#confetti-layer');
  layer.innerHTML='';
  const colors=['#2f6bff','#f6b93c','#ff7a3d','#22c55e','#ef4444','#fff'];
  for(let i=0;i<70;i++){
    const c=document.createElement('div');
    c.className='confetti-piece';
    c.style.left=Math.random()*100+'%';
    c.style.width=(6+Math.random()*6)+'px';
    c.style.height=(10+Math.random()*8)+'px';
    c.style.background=colors[i%colors.length];
    c.style.animationDuration=(2.5+Math.random()*2.5)+'s';
    c.style.animationDelay=(Math.random()*1.2)+'s';
    layer.appendChild(c);
  }
  setTimeout(()=>{layer.innerHTML='';},6000);
}

/* ============================================================
   REFLEXIÓN FINAL
============================================================ */
let reflectIndex=0;
function renderReflection(){
  reflectIndex=0;
  $('#reflect-questions').innerHTML=REFLECTION_QUESTIONS.map((q,i)=>`
    <div class="reflect-q ${i===0?'active':''}" data-i="${i}">
      <div class="rq-num">Pregunta ${i+1} de ${REFLECTION_QUESTIONS.length}</div>
      <p>${q}</p>
    </div>`).join('');
  $('#reflect-dots').innerHTML=REFLECTION_QUESTIONS.map((q,i)=>`<span class="reflect-dot ${i===0?'active':''}" data-i="${i}"></span>`).join('');
  $('#reflect-dots').querySelectorAll('.reflect-dot').forEach(d=>d.addEventListener('click',()=>gotoReflectQuestion(parseInt(d.dataset.i,10))));
  updateReflectNav();
}
function gotoReflectQuestion(i){
  reflectIndex=Math.max(0,Math.min(REFLECTION_QUESTIONS.length-1,i));
  $all('.reflect-q').forEach(q=>q.classList.toggle('active',parseInt(q.dataset.i,10)===reflectIndex));
  $all('.reflect-dot').forEach(d=>d.classList.toggle('active',parseInt(d.dataset.i,10)===reflectIndex));
  updateReflectNav();
}
function updateReflectNav(){
  const btn=$('#btn-finish-reflection');
  btn.textContent=reflectIndex>=REFLECTION_QUESTIONS.length-1?'Finalizar Reflexión':'Siguiente pregunta';
}

/* ============================================================
   EVENT BINDINGS (DOM ya cargado — script al final de <body>)
============================================================ */
$all('[data-close]').forEach(btn=>btn.addEventListener('click',()=>closeModal(btn.dataset.close)));
$all('.modal-overlay:not(.modal-forced)').forEach(ov=>ov.addEventListener('click',e=>{if(e.target===ov)ov.classList.remove('open');}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$all('.modal-overlay.open:not(.modal-forced)').forEach(ov=>ov.classList.remove('open'));}});
$('#confirm-ok').addEventListener('click',()=>{closeModal('modal-confirm');if(confirmCallback)confirmCallback();});
$('#confirm-cancel').addEventListener('click',()=>closeModal('modal-confirm'));

spawnParticles();

$('#btn-sound').addEventListener('click',()=>{
  soundOn=!soundOn;localStorage.setItem(STORAGE_SOUND,soundOn?'1':'0');updateSoundBtn();ensureAudio();
});
soundOn=localStorage.getItem(STORAGE_SOUND)!=='0';

$('#btn-howto').addEventListener('click',()=>openModal('modal-howto'));
$('#btn-new-adventure').addEventListener('click',startNewAdventureFlow);
$('#btn-continue-game').addEventListener('click',()=>{
  const cur=localStorage.getItem(STORAGE_CURRENT);
  if(cur&&loadGame(cur)){resumeGame(cur);}
  else{renderPreviousGames();openModal('modal-previous');}
});
$('#btn-previous').addEventListener('click',()=>{renderPreviousGames();openModal('modal-previous');});

$('#w1-back').addEventListener('click',()=>showView('view-hero'));
$('#w1-next').addEventListener('click',()=>{
  const name=$('#w-name').value.trim();
  if(!name){toast('Ponle un nombre a tu aventura','warn');$('#w-name').focus();return;}
  wizardDraft.name=name;
  wizardDraft.institution=$('#w-inst').value.trim();
  wizardDraft.group=$('#w-group').value.trim();
  wizardDraft.facilitator=$('#w-facil').value.trim();
  showView('view-wizard2');
});

$all('.goal-card').forEach(card=>{
  card.addEventListener('click',()=>{
    $all('.goal-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    wizardDraft.goal=card.dataset.goal;
    $('#custom-goal-field').style.display=card.dataset.goal==='custom'?'block':'none';
    $('#time-goal-field').style.display=card.dataset.goal==='time'?'block':'none';
  });
});
$('#w2-back').addEventListener('click',()=>showView('view-wizard1'));
$('#w2-next').addEventListener('click',()=>{
  let goal=wizardDraft.goal;
  let targetScore=null,timeGoal=null;
  if(goal==='custom'){
    targetScore=parseInt($('#w-custom-goal').value,10);
    if(!targetScore||targetScore<10){toast('Define una meta válida (mínimo 10 puntos)','warn');return;}
  } else if(goal==='free'){
    targetScore=null;
  } else if(goal==='time'){
    timeGoal=parseInt($('#w-time-goal').value,10);
    if(!timeGoal||timeGoal<1){toast('Define una duración válida en minutos','warn');return;}
    targetScore=null;
  } else {
    targetScore=parseInt(goal,10);
  }
  wizardDraft.targetScore=targetScore;
  wizardDraft.timeGoal=timeGoal;
  wizardDraft.endMode=$('#w-endmode').value;
  draftPlayers=[];
  playersScreenMode='new';
  $('#pl-start').innerHTML='<i class="fas fa-rocket"></i> Comenzar Aventura';
  renderPlayersGrid();
  showView('view-players');
  setTimeout(()=>$('#p-name-input').focus(),50);
});

$('#p-add-btn').addEventListener('click',addPlayerFromInput);
$('#p-name-input').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addPlayerFromInput();}});
$('#pl-back').addEventListener('click',()=>{
  if(playersScreenMode==='editMidGame'){showView('view-board');}
  else{showView('view-wizard2');}
});

$('#ep-save').addEventListener('click',()=>{
  const p=draftPlayers.find(x=>x.id===editingPlayerId);
  if(p){
    p.name=$('#ep-name').value.trim()||p.name;
    p.nickname=$('#ep-nick').value.trim();
    p.team=$('#ep-team').value.trim();
  }
  closeModal('modal-edit-player');
  renderPlayersGrid();
  if(game)renderBoard();
});

$('#pl-start').addEventListener('click',()=>{
  if(draftPlayers.length<2){toast('Necesitas al menos 2 jugadores','warn');return;}
  if(playersScreenMode==='editMidGame'){
    game.players=game.players.map(orig=>{
      const edited=draftPlayers.find(d=>d.id===orig.id);
      return edited?{...orig,name:edited.name,nickname:edited.nickname,team:edited.team,avatar:edited.avatar,color:edited.color}:orig;
    });
    saveGame();renderBoard();showView('view-board');
    toast('Jugadores actualizados','good');
    return;
  }
  const now=new Date();
  game={
    id:uid(),
    name:wizardDraft.name,institution:wizardDraft.institution,group:wizardDraft.group,facilitator:wizardDraft.facilitator,
    createdAt:now.toISOString(),
    status:'playing',
    targetScore:wizardDraft.targetScore,
    timeGoal:wizardDraft.timeGoal,
    endMode:wizardDraft.endMode||'B',
    currentPlayerIndex:0,
    roundNumber:1,
    players:clone(draftPlayers),
    history:[],
    snapshots:[],
    pendingFinish:false,
    finishRound:null,
    finishNow:false,
    turnPhase:'awaiting_roll',
    lastRoll:null,
    startedAt:now.toISOString()
  };
  saveGame();
  ensureAudio();
  renderBoard();
  showView('view-board');
  toast('¡Aventura iniciada! Buena suerte 🎲','good');
});

$('#btn-register-roll').addEventListener('click',openDiceModal);
$('#btn-confirm-roll').addEventListener('click',()=>{
  if(!pendingDice.d1||!pendingDice.d2)return;
  closeModal('modal-dice');
  commitRoll(pendingDice.d1,pendingDice.d2);
});
$('#s1-next').addEventListener('click',()=>{closeModal('modal-single-one');endTurnAdvance();});
$('#d1-next').addEventListener('click',()=>{closeModal('modal-double-one');endTurnAdvance();});
$('#d6-next').addEventListener('click',()=>{closeModal('modal-double-six');openDecisionPanel();});

$('#btn-choice-continue').addEventListener('click',()=>{
  const p=currentPlayer();
  p.continueCount++;
  if(game.history.length)game.history[game.history.length-1].decision='Continuó';
  closeModal('modal-decision');
  saveGame();
  renderBoard();
  sfx('click');
});
$('#btn-choice-secure').addEventListener('click',()=>{
  const p=currentPlayer();
  pushSnapshot();
  const added=p.turnScore;
  p.secureCount++;
  securePlayer(p);
  if(game.history.length){
    game.history[game.history.length-1].decision='Aseguró';
    game.history.push({
      id:uid(),date:new Date().toISOString(),playerId:p.id,playerName:(p.nickname||p.name),
      round:game.roundNumber,turnNumber:p.turnsPlayed+1,die1:null,die2:null,type:'SECURE',points:added,
      turnScoreBefore:added,turnScoreAfter:0,totalScoreBefore:p.totalScore-added,totalScoreAfter:p.totalScore,decision:'Aseguró'
    });
  }
  closeModal('modal-decision');
  sfx('secure');
  $('#secure-added').textContent='+'+added;
  $('#secure-newtotal').textContent=p.totalScore;
  saveGame();
  renderBoard();
  checkGoalReached(p);
  openModal('modal-secure');
});
$('#secure-next').addEventListener('click',()=>{
  closeModal('modal-secure');
  if(game.finishNow){finishGame();return;}
  endTurnAdvance();
});

$('#btn-skip-turn').addEventListener('click',()=>{
  showConfirm('Saltar turno','¿Deseas saltar el turno de '+esc(currentPlayer().nickname||currentPlayer().name)+' sin lanzar los dados?',()=>{
    pushSnapshot();
    currentPlayer().turnScore=0;
    endTurnAdvance();
  });
});
$('#fp-change-turn').addEventListener('click',()=>{
  $('#change-turn-list').innerHTML=game.players.map((p,i)=>`
    <button class="drawer-btn" data-idx="${i}" style="display:flex;align-items:center;gap:.6rem">
      <span style="width:28px;height:28px;border-radius:50%;background:${p.color};display:flex;align-items:center;justify-content:center;color:#fff">${p.avatar}</span>
      ${esc(p.nickname||p.name)} ${i===game.currentPlayerIndex?'<b style="margin-left:auto;color:var(--blue)">(actual)</b>':''}
    </button>`).join('');
  $('#change-turn-list').querySelectorAll('[data-idx]').forEach(b=>b.addEventListener('click',()=>{
    pushSnapshot();
    game.currentPlayerIndex=parseInt(b.dataset.idx,10);
    game.lastRoll=null;
    saveGame();closeModal('modal-change-turn');closeDrawer();renderBoard();
  }));
  openModal('modal-change-turn');
});

$('#btn-undo').addEventListener('click',()=>{
  showConfirm('Deshacer última jugada','Se restaurará el estado anterior de la partida (puntajes, turno e historial). ¿Continuar?',doUndo);
});
$('#fp-undo').addEventListener('click',()=>{closeDrawer();showConfirm('Deshacer última acción','Se restaurará el estado anterior de la partida. ¿Continuar?',doUndo);});

$('#fp-correct-roll').addEventListener('click',()=>{
  closeDrawer();
  if(!lastRollSnapshot){toast('No hay una tirada reciente para corregir','warn');return;}
  showConfirm('Corregir última tirada','Se restaurará el estado previo a la última tirada para que puedas volver a ingresarla. ¿Continuar?',()=>{
    const keepSnapshots=game.snapshots;
    game=JSON.parse(lastRollSnapshot);
    game.snapshots=keepSnapshots;
    saveGame();
    renderBoard();
    openDiceModal();
  });
});

$('#btn-facilitator').addEventListener('click',openDrawer);
$('#facilitator-overlay').addEventListener('click',closeDrawer);
$('#btn-projector').addEventListener('click',()=>{
  document.body.classList.toggle('projector');
  $('#btn-projector').classList.toggle('active');
});

$('#fp-pause').addEventListener('click',()=>{
  closeDrawer();
  if(game.status==='paused'){game.status='playing';toast('Partida reanudada');}
  else{game.status='paused';toast('Partida pausada');}
  saveGame();
  updatePauseLabel();
});

$('#fp-players').addEventListener('click',()=>{
  closeDrawer();
  draftPlayers=clone(game.players);
  playersScreenMode='editMidGame';
  renderPlayersGrid();
  $('#pl-start').innerHTML='<i class="fas fa-floppy-disk"></i> Guardar cambios';
  $('#pl-start').disabled=draftPlayers.length<2;
  showView('view-players');
});

$('#fp-restart').addEventListener('click',()=>{
  closeDrawer();
  showConfirm('Reiniciar partida','Se borrarán todos los puntajes, el historial y el progreso de esta partida. Esta acción no se puede deshacer. ¿Continuar?',()=>{
    game.players.forEach(p=>{p.totalScore=0;p.turnScore=0;p.rollsCount=0;p.continueCount=0;p.secureCount=0;p.doubleOneCount=0;p.doubleSixCount=0;p.turnsPlayed=0;});
    game.history=[];game.snapshots=[];game.currentPlayerIndex=0;game.roundNumber=1;game.pendingFinish=false;game.finishRound=null;game.finishNow=false;game.lastRoll=null;game.status='playing';
    saveGame();renderBoard();toast('Partida reiniciada');
  });
});
$('#fp-finish').addEventListener('click',()=>{
  closeDrawer();
  showConfirm('Finalizar manualmente','¿Deseas terminar la aventura ahora y mostrar el podio final?',finishGame);
});
$('#fp-stats').addEventListener('click',()=>{closeDrawer();renderStatsModal();openModal('modal-stats');});
$('#btn-full-history').addEventListener('click',()=>{renderFullHistory();openModal('modal-full-history');});

$('#btn-podium-stats').addEventListener('click',()=>{renderStatsModal();openModal('modal-stats');});
$('#btn-podium-home').addEventListener('click',()=>showView('view-hero'));
$('#btn-to-reflection').addEventListener('click',()=>{renderReflection();showView('view-reflection');});

$('#btn-finish-reflection').addEventListener('click',()=>{
  if(reflectIndex<REFLECTION_QUESTIONS.length-1){gotoReflectQuestion(reflectIndex+1);}
  else{showView('view-final');}
});
$('#btn-final-home').addEventListener('click',()=>{
  localStorage.removeItem(STORAGE_CURRENT);
  showView('view-hero');
});

/* ============================================================
   INICIALIZACIÓN
============================================================ */
function init(){
  updateSoundBtn();
  updatePauseLabel();
  const curId=localStorage.getItem(STORAGE_CURRENT);
  if(curId){
    const g=loadGame(curId);
    if(g&&(g.status==='playing'||g.status==='paused')){
      game=g;
      toast('<i class="fas fa-circle-check"></i> Partida recuperada','good');
      renderBoard();
      showView('view-board');
      updatePauseLabel();
      return;
    }
  }
  showView('view-hero');
}
init();
})();
