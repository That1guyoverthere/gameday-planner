import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient('https://aivnvbrnmjjmqkgednef.supabase.co','sb_publishable_-wUY5bCH05d9SDDKAwfweQ_tDWN9U-Z');
const KEY='gameday-planner-v1';
const themes={midnight:['#0d1018','#171c28','#9b8cff'],ocean:['#071923','#102b3a','#55c7e8'],forest:['#0c1b16','#183126','#78d6a0'],sunset:['#241316','#392027','#ff9a76']};
const icons={controller:'🎮',trophy:'🏆',swords:'⚔️',rocket:'🚀',dragon:'🐉'};
let user=null, syncing=false;
const $=id=>document.getElementById(id);
function localGames(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return []}}
function setStatus(s){$('cloudStatus').textContent=s}
function applyTheme(bg,ic){const t=themes[bg]||themes.midnight;document.documentElement.style.setProperty('--bg',t[0]);document.documentElement.style.setProperty('--panel',t[1]);document.documentElement.style.setProperty('--accent',t[2]);document.querySelector('.logo').textContent=icons[ic]||icons.controller}
function addUI(){
 const section=document.createElement('section');section.className='panel';section.innerHTML=`
 <h2>👤 My profile & cloud backup</h2>
 <p id="cloudStatus" class="installhint">Sign in to sync your games between devices.</p>
 <form id="accountForm"><div class="formgrid">
 <div class="field full"><label for="profileName">PROFILE NAME</label><input id="profileName" maxlength="50" placeholder="Your name"></div>
 <div class="field full"><label for="profileEmail">EMAIL</label><input id="profileEmail" type="email" autocomplete="email" required placeholder="you@example.com"></div>
 <div class="field full"><label for="profilePassword">PASSWORD</label><input id="profilePassword" type="password" autocomplete="current-password" minlength="6" required placeholder="At least 6 characters"></div>
 <div class="field"><label for="backgroundTheme">BACKGROUND THEME</label><select id="backgroundTheme"><option value="midnight">Midnight</option><option value="ocean">Ocean</option><option value="forest">Forest</option><option value="sunset">Sunset</option></select></div>
 <div class="field"><label for="iconTheme">APP ICON THEME</label><select id="iconTheme"><option value="controller">Controller</option><option value="trophy">Trophy</option><option value="swords">Swords</option><option value="rocket">Rocket</option><option value="dragon">Dragon</option></select></div>
 </div><div class="formfoot" style="justify-content:flex-start;flex-wrap:wrap"><button class="btn primary" type="submit" id="signInBtn">Sign in</button><button class="btn" type="button" id="signUpBtn">Create my profile</button><button class="btn" type="button" id="saveProfileBtn" hidden>Save profile</button><button class="btn" type="button" id="signOutBtn" hidden>Sign out</button></div></form>`;
 document.querySelector('.stats').before(section);
 $('accountForm').addEventListener('submit',async e=>{e.preventDefault();await signIn()});
 $('signUpBtn').onclick=signUp;$('saveProfileBtn').onclick=saveProfile;$('signOutBtn').onclick=signOut;
 $('backgroundTheme').onchange=()=>applyTheme($('backgroundTheme').value,$('iconTheme').value);
 $('iconTheme').onchange=()=>applyTheme($('backgroundTheme').value,$('iconTheme').value);
}
async function signUp(){const email=$('profileEmail').value.trim(),password=$('profilePassword').value,name=$('profileName').value.trim();if(!email||password.length<6){setStatus('Enter an email and a password with at least 6 characters.');return}setStatus('Creating your profile…');const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name}}});if(error){setStatus(error.message);return}if(!data.session){setStatus('Check your email to confirm your account, then sign in.');return}user=data.user;await loadCloud();setStatus('Profile created. Your games are syncing.')}
async function signIn(){setStatus('Signing in…');const {data,error}=await supabase.auth.signInWithPassword({email:$('profileEmail').value.trim(),password:$('profilePassword').value});if(error){setStatus(error.message);return}user=data.user;await loadCloud()}
async function loadCloud(){if(!user)return;syncing=true;const [{data:rows,error:ge},{data:p,error:pe}]=await Promise.all([supabase.from('games').select('id,data').eq('user_id',user.id),supabase.from('profiles').select('*').eq('id',user.id).maybeSingle()]);if(ge||pe){syncing=false;setStatus((ge||pe).message);return}
 const cloud=(rows||[]).map(r=>({...r.data,id:r.id})),local=localGames(),byId=new Map();cloud.forEach(g=>byId.set(g.id,g));local.forEach(g=>{if(!byId.has(g.id))byId.set(g.id,g)});const merged=[...byId.values()];localStorage.setItem(KEY,JSON.stringify(merged));document.dispatchEvent(new Event('gameday:cloud-loaded'));
 if(merged.length){const payload=merged.map(g=>({user_id:user.id,id:String(g.id),data:g,updated_at:new Date().toISOString()}));const {error}=await supabase.from('games').upsert(payload,{onConflict:'user_id,id'});if(error){syncing=false;setStatus(error.message);return}}
 $('profileName').value=p?.display_name||user.user_metadata?.display_name||'';$('backgroundTheme').value=p?.background_theme||'midnight';$('iconTheme').value=p?.icon_theme||'controller';applyTheme($('backgroundTheme').value,$('iconTheme').value);
 $('signInBtn').hidden=true;$('signUpBtn').hidden=true;$('saveProfileBtn').hidden=false;$('signOutBtn').hidden=false;$('profileEmail').disabled=true;$('profilePassword').hidden=true;$('profilePassword').required=false;$('profileName').disabled=false;$('backgroundTheme').disabled=false;$('iconTheme').disabled=false;
 syncing=false;setStatus('Signed in as '+user.email+' · Cloud sync is on.');
}
async function saveProfile(){if(!user)return;const values={display_name:$('profileName').value.trim(),background_theme:$('backgroundTheme').value,icon_theme:$('iconTheme').value,updated_at:new Date().toISOString()};const {error}=await supabase.from('profiles').update(values).eq('id',user.id);if(error){setStatus(error.message);return}applyTheme(values.background_theme,values.icon_theme);setStatus('Profile preferences saved.')}
async function signOut(){await supabase.auth.signOut();user=null;$('signInBtn').hidden=false;$('signUpBtn').hidden=false;$('saveProfileBtn').hidden=true;$('signOutBtn').hidden=true;$('profileEmail').disabled=false;$('profilePassword').hidden=false;$('profilePassword').required=true;$('profilePassword').value='';$('profileName').disabled=false;setStatus('Signed out. Your games remain saved on this device.')}
async function syncGames(){if(!user||syncing)return;const games=localGames(),ids=games.map(g=>String(g.id)),payload=games.map(g=>({user_id:user.id,id:String(g.id),data:g,updated_at:new Date().toISOString()}));const {data:existing,error:readError}=await supabase.from('games').select('id').eq('user_id',user.id);if(readError){setStatus('Cloud sync issue: '+readError.message);return}const removed=(existing||[]).map(x=>x.id).filter(id=>!ids.includes(id));if(removed.length){const {error}=await supabase.from('games').delete().eq('user_id',user.id).in('id',removed);if(error){setStatus('Cloud sync issue: '+error.message);return}}if(payload.length){const {error}=await supabase.from('games').upsert(payload,{onConflict:'user_id,id'});if(error)setStatus('Cloud sync issue: '+error.message)}}
addUI();document.addEventListener('gameday:changed',syncGames);supabase.auth.getSession().then(({data})=>{if(data.session){user=data.session.user;loadCloud()}});
