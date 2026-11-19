'use strict';
const $=id=>document.getElementById(id);
const legacyCats={all:['全部','#d1e5b4','<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'],shop:['店铺','#ffc281','<path d="M3 10l2-6h14l2 6M4 11v9h16v-9M9 20v-6h6v6M3 10q2 5 5 0 4 5 8 0 3 5 5 0"/>'],mission:['任务','#f5a2c3','<path d="M5 21V3m1 1q4-3 8 0t6 0v9q-3 3-7 0t-7 0"/>'],secret:['隐藏要素','#c3aafa','<path d="M12 2l2.6 6.9L22 12l-7.4 3.1L12 22l-2.7-6.9L2 12l7.3-3.1z"/>'],person:['人物','#8ed5ee','<circle cx="12" cy="8" r="4"/><path d="M4 21q0-8 8-8t8 8"/>'],place:['地点','#b5dc9b','<path d="M19 9c0 5-7 12-7 12S5 14 5 9a7 7 0 0114 0z"/><circle cx="12" cy="9" r="2"/>']};
// Keep the upstream catalogue taxonomy alongside the three walkthrough categories.
const cats={
 all:legacyCats.all,
 region:['地区','#cfe99c','<path d="m2 5 6-2 8 3 6-3v16l-6 3-8-3-6 2zm6-2v16m8-13v16"/>'],
 landmark:['地标',...legacyCats.place.slice(1)],
 nature:['自然','#92d49b','<path d="M4 19c-4-8 3-14 16-16-1 11-5 18-14 15m-3 3L15 9"/>'],
 transport:['交通','#accfff','<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M5 11h14M7 21l2-3m6 0 2 3M8 15h2m4 0h2"/>'],
 business:['商业',...legacyCats.shop.slice(1)],mission:legacyCats.mission,secret:legacyCats.secret,person:legacyCats.person
};
const tagZh={enterable:'可进入',residential:'住宅',unconfirmed:'未确认',retail:'零售',transportation:'交通',demolished:'已拆除',natural:'自然',industrial:'工业',hotel:'酒店',leisure:'休闲',government:'政府',events:'活动',closed:'已关闭',utilities:'公用设施',reused:'重复使用',landmark:'地标',public:'公共场所',restaurant:'餐饮',construction:'施工',office:'办公',agriculture:'农业',service:'服务',supermarket:'超市',bus:'公交站',gas:'加油站',train:'火车',marina:'码头',airport:'机场',safehouse:'安全屋',guns:'武器店',hospital:'医院',clothes:'服装店',nightclub:'夜店',bar:'酒吧',fastfood:'快餐',metro:'地铁',tattoos:'纹身店',hair:'理发店',police:'警局',modshop:'改装店',racetrack:'赛道',cinema:'电影院',gym:'健身房',golf:'高尔夫',pharmacy:'药店',ferry:'渡轮',bikeshop:'车店',carwash:'洗车场',tennis:'网球',fence:'销赃点',food:'食品',electronics:'电子产品',stripclub:'脱衣舞俱乐部',jail:'监狱',metromover:'高架捷运'};
function tagLabel(tag){const label=tagZh[tag.replace(/^#/,'')];return label?label+' · '+tag:tag}
const regions={vice:'罪城',keys:'莱奥奈达群岛',grass:'草河湿地',port:'盖尔霍恩港',ambrosia:'安布罗西亚',mount:'卡拉加山',unknown:'地区待核实'};
const regionNames={vice:'Vice City 罪恶之城',keys:'Leonida Keys 里奥奈达群岛',grass:'Grassrivers',port:'Port Gellhorn',ambrosia:'Ambrosia',mount:'Mount Kalaga',unknown:''};
const icon=c=>'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+cats[c][2]+'</svg>';
function esc(text){return String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
const normalize=s=>s.toLowerCase().replace(/[’‘]/g,"'").trim();
const aliases={'real dimez · bae-luxe & roxy':'real dimez','vcia airport':'the vice city airport','gellhorn raceway':'the circuit race at the speedway','pawn & gun – port gellhorn':'the pawn & gun shop'};
const records=new Map();
for(const line of [...window.communityEntries,...window.entries]){
  const key=normalize(line.en);
  const id=line.cat+'|'+(aliases[key]||key), prior=records.get(id);
  const rec={...prior,...line,id,refs:[...new Set([...(prior?.refs||[]),line.url])]};
  if(prior && rec.region==='unknown')rec.region=prior.region;
  rec.cat=({shop:'business',place:'landmark'})[line.cat]||line.cat;
  records.set(id,rec);
}
const extras=(window.extraEntries||[]).map((r,i)=>({...r,extra:true,id:'gtadb|'+(r.sourceId??i),refs:[r.url]}));
const all=[...extras.filter(r=>r.cat==='region'),...records.values(),...extras.filter(r=>r.cat!=='region'&&r.evidence==='approximate'),...extras.filter(r=>r.cat!=='region'&&r.evidence!=='approximate')];
const tagCounts=new Map();
for(const r of all){
 const caseUrl=r.refs.find(url=>typeof url==='string' && /^https:\/\/mapheist\.com\/en\/case\/[a-z0-9-]+\/$/.test(url));
 if(caseUrl)r.mapheistId=caseUrl.split('/').at(-2);
 for(const t of r.tags||[])tagCounts.set(t,(tagCounts.get(t)||0)+1);
 r.search=normalize([r.name,r.en,r.sourceId,r.gameAddress,r.realAddress,r.desc,regions[r.region],regionNames[r.region],r.cat,cats[r.cat][0],r.cat==='business'?'店铺':'',...(r.tags||[]).map(tagLabel)].join(' '));
}
for(const [tag,count] of [...tagCounts].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))){
 $('tag').add(new Option(tagLabel(tag)+' ('+count+')',tag));
}
const map=window.ATLAS_MAP;
const addressTerms=['Coastal Auto Care','Island Dreams','Jack of Hearts','Three Sheets Liquor','Only Raw Records','Sunrise RV Park','曼迪家','Key Lento','Washington Beach','Corsair Key','Vice Beach','Pelican Valley','Maroon Key'];
let saved;
try{saved=new Set(JSON.parse(localStorage.getItem('leonida.bookmarks.v1')||'[]'))}catch{saved=new Set()}
let category='all',onlySaved=false,visible=[],selected=null,zoom=1,cx=0,cy=0,baseSize=0;
const hasXY=r=>Number.isFinite(r.rawX)&&Number.isFinite(r.rawY);
function pos(r){return hasXY(r)?map.project(r.rawX,r.rawY):(r.extra?null:map.anchors[r.region])}
const playerKey='leonida.position.yanis-v16.v1';
let player=null,nearby=false,placing=false,placementTap=null;
let gpsOpen=false,destination=null,routeResult=null,placementKind='start';
try{
 const stored=JSON.parse(localStorage.getItem(playerKey));
 if(Array.isArray(stored)&&stored.length===2&&stored.every(Number.isFinite)
   &&map.project(...stored).every(v=>v>=0&&v<=1000))player=stored;
}catch{}
const nearDistances=new Map();
function distanceLabel(meters){
 return meters>=1000?'约 '+(meters/1000).toFixed(1)+' 公里':'约 '+Math.round(meters)+' 米';
}
function nearLabel(record){
 const dx=record.rawX-player[0],dy=record.rawY-player[1],meters=nearDistances.get(record.id);
 if(meters<1)return '当前位置';
 const octant=(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8;
 return distanceLabel(meters)+' · '+['东','东南','南','西南','西','西北','北','东北'][octant];
}
function positionOverlay(){
 $('playerPin').hidden=!player;
 $('nearRing').hidden=!nearby||!player;
 if(!player)return;
 const [x,y]=map.project(...player);
 for(const el of [$('playerPin'),$('nearRing')]){
   el.style.left=x/10+'%';el.style.top=y/10+'%';
 }
 const worldWidth=map.unproject(1000,0)[0]-map.unproject(0,0)[0];
 $('nearRing').style.width=(200*Number($('nearRadius').value)/worldWidth)+'%';
}
function setPlacing(on,kind='start'){
 placementKind=kind;
 placing=on;placementTap=null;viewport.classList.toggle('placing',on);
 $('placeHint').hidden=!on;$('locationTool').textContent=on?'取消放置':'⌖ 我的位置';
 if(on){clearPop();$('placeHint').textContent=kind==='end'?'点击地图选择导航终点':'点击地图放置「我的位置」';viewport.scrollIntoView({block:'nearest'});viewport.focus({preventScroll:true})}
}
function recenterNearby(){
 const range=Number($('nearRadius').value);
 const projectedRadius=map.project(player[0]+range,player[1])[0]-map.project(...player)[0];
 zoom=Math.min(maxZoom(),Math.max(1,.85*Math.min(viewport.clientWidth,viewport.clientHeight)*1000/(2*projectedRadius*baseSize)));
 centerAt(map.project(...player));
}
function showNearby(){
 if(!player){setPlacing(true);return}
 setPlacing(false);onlySaved=false;nearby=true;
 resetExtraFilters();category='all';$('query').value='';$('region').value='';
 clearPop();recenterNearby();refresh();$('list').scrollTop=0;
}
function placeAt(clientX,clientY){
 const rect=$('world').getBoundingClientRect();
 const x=(clientX-rect.left)/rect.width*1000,y=(clientY-rect.top)/rect.height*1000;
 if(x<0||y<0||x>1000||y>1000){$('placeHint').textContent='请在地图边界内选择位置';return}
 if(placementKind==='end'){
   setPlacing(false);chooseDestination({point:[x,y],name:'地图选点',record:null});return;
 }
 setOrigin(map.unproject(x,y));
}
// All route geometry uses the same 0–1000 map projection as the POI markers.
function setOrigin(raw){
 player=raw;
 try{localStorage.setItem(playerKey,JSON.stringify(player))}catch{}
 showNearby();
 if(gpsOpen)calculateRoute();
}
function chooseDestination(target){
 destination=target;gpsOpen=true;clearPop();calculateRoute();
 if(matchMedia('(max-width:760px)').matches)viewport.scrollIntoView({block:'start',behavior:'instant'});
 if(!player)setPlacing(true);
}
function calculateRoute(){
 routeResult=null;
 if(player&&destination)routeResult=AtlasRouting.route(map.project(...player),destination.point,window.roadNetwork);
 renderRoute();
 if(routeResult)fitRoute();
}
function svgPath(points){
 return points.map(([x,y],index)=>(index?'L':'M')+x.toFixed(4)+' '+y.toFixed(4)).join(' ');
}
function fitRoute(){
 if(!player||!destination)return;
 const points=[map.project(...player),destination.point,...(routeResult?.path||[])];
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const [x,y] of points){minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY)}
 const w=viewport.clientWidth,h=viewport.clientHeight;
 const top=Math.min(h*.38,$('routePanel').offsetHeight+25),bottom=52;
 zoom=Math.min(maxZoom(),Math.max(.7,Math.min((w-76)/Math.max(1,maxX-minX),(h-top-bottom)/Math.max(1,maxY-minY))*1000/baseSize));
 centerAt([(minX+maxX)/2,(minY+maxY)/2]);cy+=(top-bottom)/2;draw();
}
// Render each local set of road strokes only while it intersects the viewport.
const coverageCells = new Map();
let coverageOrigin, coverageGroup = null;
function updateCoverage() {
 const overlay = $('coverageOverlay');
 const show = gpsOpen && $('showRoads').checked;
 overlay.style.display = show ? '' : 'none';
 if (!show) return;
 if (!coverageCells.size || coverageOrigin !== player) {
   const {segments,group} = AtlasRouting.coverage(window.roadNetwork, player && map.project(...player));
   coverageOrigin = player;
   coverageGroup = group;
   if (!coverageCells.size) {
     for (const edge of segments) {
       const gx = Math.floor(edge.x/40), gy = Math.floor(edge.y/40);
       const key = gx+','+gy+','+edge.group;
       if (!coverageCells.has(key)) coverageCells.set(key,{group:edge.group,strokes:[],minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
       const cell = coverageCells.get(key), x2 = edge.x+edge.dx, y2 = edge.y+edge.dy;
       cell.minX=Math.min(cell.minX,edge.x,x2); cell.maxX=Math.max(cell.maxX,edge.x,x2);
       cell.minY=Math.min(cell.minY,edge.y,y2); cell.maxY=Math.max(cell.maxY,edge.y,y2);
       cell.strokes.push('M'+edge.x.toFixed(2)+' '+edge.y.toFixed(2)+'L'+x2.toFixed(2)+' '+y2.toFixed(2));
     }
   }
 }
 const displayGroup = routeResult?.ok ? routeResult.group : coverageGroup;
 const label = displayGroup == null ? '青线 · 已收录道路' : '青线 · 与起点连通的道路';
 if ($('coverageLabel').textContent !== label) $('coverageLabel').textContent = label;
 const width=viewport.clientWidth, height=viewport.clientHeight;
 const scale = baseSize*zoom/1000;
 for (const cell of coverageCells.values()) {
   const visible = (displayGroup == null || cell.group === displayGroup)
     && cx+cell.maxX*scale>=-2*panMargin && cy+cell.maxY*scale>=-2*panMargin
     && cx+cell.minX*scale<=width+2*panMargin && cy+cell.minY*scale<=height+2*panMargin;
   if (visible && !cell.path) {
     cell.path=document.createElementNS('http://www.w3.org/2000/svg','path');
     cell.path.setAttribute('d',cell.strokes.join(''));
     cell.strokes=null;
   }
   if (visible && !cell.path.parentNode) overlay.append(cell.path);
   else if (!visible && cell.path?.parentNode) cell.path.remove();
 }
}
function renderRoute(){
 updateCoverage();
 $('world').classList.toggle('has-route',gpsOpen&&Boolean(routeResult?.ok));
 $('routePanel').hidden=!gpsOpen;$('gpsTool').setAttribute('aria-pressed',String(gpsOpen));
 $('routeStart').textContent=player?'移动起点':'放置起点';
 $('routePick').textContent=destination?'更改终点':'地图选终点';
 $('routeFit').hidden=!(player&&destination);
 $('routeTitle').textContent=destination?'前往 '+destination.name:'规划驾驶路线';
 $('routePin').hidden=!gpsOpen||!destination;
 if(destination){$('routePin').style.left=destination.point[0]/10+'%';$('routePin').style.top=destination.point[1]/10+'%'}
 let road='',access='',summary;
 if(!destination)summary='点「地图选终点」，或在地点详情点「导航到这里」。放置起点后，可查看哪些道路与它连通。';
 else if(!player)summary='在地图上放置「我的位置」作为起点。';
 else if(routeResult?.ok){
   const path=routeResult.path;road=svgPath(path);
   access=svgPath([map.project(...player),path[0]])+' '+svgPath([path[path.length-1],destination.point]);
   const [startX,startY]=map.project(...player);
   const direct=Math.hypot(startX-destination.point[0],startY-destination.point[1])*19;
   summary='沿路 '+distanceLabel(routeResult.meters)+' · 直线 '+distanceLabel(direct)+'。';
   const gap=routeResult.startWalk+routeResult.endWalk;
   if(gap>=1)summary+='虚线接驳合计'+distanceLabel(gap)+'。';
   if(routeResult.alternativeApproach)summary+='已匹配附近可连通的路段，请核对虚线接驳位置。';
   summary+='路口和通行方向以游戏为准。';
 }else{
   const messages={'unreliable-detour':'路网给出的绕行过长，暂无法提供可信的参考路线。可在附近主路重新选点。','too-far':'起点或终点距已收录道路超过 180 米。可在附近道路上重新选点。',disconnected:'起终点所在路段在参考路网中尚未连通。可更改起点或终点。','no-roads':'未能加载路网，请刷新页面再试。'};
   summary=messages[routeResult?.reason]||'请选择起点和终点。';
   if(routeResult?.reason==='too-far'){
     const which=routeResult.missingStart?(routeResult.missingEnd?'起点和终点':'起点'):'终点';
     summary=which+'距已收录道路超过 180 米。打开青线路网，在附近道路上重新选点。';
   }
 }
 $('routeSummary').textContent=summary;
 $('routeRoad').setAttribute('d',road);$('routeHalo').setAttribute('d',road);$('routeAccess').setAttribute('d',access);
}
function stopRoute(){
 gpsOpen=false;destination=null;routeResult=null;setPlacing(false);renderRoute();
}
function setTone(el,c){el.style.setProperty('--tone',cats[c][1])}
function button(cls,html,action){const b=document.createElement('button');b.className=cls;b.innerHTML=html;b.onclick=action;return b}
for(const [id,[label]] of Object.entries(cats)){
  const b=button('cat',icon(id)+label,()=>{category=id;clearPop();refresh()});setTone(b,id);b.dataset.cat=id;$('cats').append(b);
}
$('region').innerHTML='<option value="">所有地区</option>'+Object.entries(regions).map(([k,v])=>'<option value="'+k+'">'+v+'</option>').join('');
function clearPop(){selected=null;$('popup').hidden=true}
function resetExtraFilters(){$('hasPhoto').checked=false;for(const id of ['scope','layer','tag'])$(id).value=''}
function viewMode(mode){nearby=false;setPlacing(false);resetExtraFilters();onlySaved=mode;category='all';$('query').value='';$('region').value='';clearPop();refresh()}
$('explore').onclick=()=>viewMode(false);$('saved').onclick=()=>viewMode(true);
function refresh(){
 const words=normalize($('query').value).split(/\s+/).filter(Boolean);
 const scope=$('scope').value,layer=$('layer').value,tag=$('tag').value,region=$('region').value;
 nearDistances.clear();
 visible=all.filter(r=>{
   if(nearby){
     if(!hasXY(r)||r.cat==='region'||(!$('nearUnknown').checked&&r.reasons?.includes('unknown-name')))return false;
     const meters=Math.hypot(r.rawX-player[0],r.rawY-player[1]);
     if(meters>Number($('nearRadius').value))return false;
     nearDistances.set(r.id,meters);
   }
   if($('hasPhoto').checked&&!gamePhotoIds.has(r.sourceId))return false;
   if(scope==='atlas'&&!r.extra||scope==='guide'&&r.extra)return false;
   if(layer==='unplaced'&&(!r.extra||hasXY(r)))return false;
   if(layer&&layer!=='unplaced'&&r.layer!==layer)return false;
   return (!tag||r.tags?.includes(tag))&&(!onlySaved||saved.has(r.id))&&(category==='all'||category===r.cat)&&(!region||region===r.region)&&words.every(w=>r.search.includes(w));
 });
 if(nearby)visible.sort((a,b)=>nearDistances.get(a.id)-nearDistances.get(b.id));
 $('nearTools').hidden=!nearby;positionOverlay();
 $('savedCount').textContent=saved.size;$('explore').setAttribute('aria-pressed',String(!onlySaved&&!nearby));$('saved').setAttribute('aria-pressed',String(onlySaved));
 $('panelTitle').textContent=nearby?'附近推荐':onlySaved?'我的收藏':'探索索引';$('listTitle').textContent=category==='all'?(nearby?'由近到远':'全部条目'):cats[category][0];$('count').textContent=visible.length+' 项';
 for(const b of $('cats').children)b.setAttribute('aria-pressed',String(category===b.dataset.cat));
 const list=$('list');list.replaceChildren();
 let displayed=0;
 function addRows(){
 const next=Math.min(displayed+80,visible.length);
 for(const r of visible.slice(displayed,next)){const b=button('row'+(selected===r.id?' selected':''),'<span class="token">'+icon(r.cat)+'</span><span><strong>'+esc(r.name)+'</strong><small>'+(nearby?nearLabel(r)+' · '+cats[r.cat][0]+' · ':'')+esc(regions[r.region])+' · '+esc(r.en)+(gamePhotoIds.has(r.sourceId)?' · 有图':'')+'</small></span><span class="chev">›</span>',()=>openRecord(r,true));setTone(b,r.cat);list.append(b)}
 displayed=next;
 if(displayed<visible.length){const more=button('more','显示更多（'+displayed+' / '+visible.length+'）',()=>{more.remove();addRows()});list.append(more)}
 }
 addRows();
 if(!visible.length)list.innerHTML='<p class="empty">'+(nearby?'这个范围内没有符合筛选的已定位点位。可扩大范围、切换分类或重新放置。':onlySaved&&!saved.size?'收藏条目后，可以在这里找到它。':'没有匹配的条目。试试其他关键词或地区。')+'</p>';
 draw();
}
function popup(){const p=$('popup');p.hidden=false;p.innerHTML='';p.append(button('x','×',()=>{clearPop();refresh()}));p.firstChild.setAttribute('aria-label','关闭详情');return p}
const originalPhotoRoot='https://raw.githubusercontent.com/rolux/gtadb.org/5c1d69ff864623d181da5457afaacd00b623e1a4/map/photos/6/';
function showPhoto(record){
 const id=record.sourceId;
 const original=window.localPhotoOriginals?'photos-hd/'+id+'.jpg':originalPhotoRoot+id+'%2Cig.jpg';
 dialog(record.name,'',true);
 const figure=document.createElement('figure');figure.className='photo-view';
 const image=new Image();image.alt=record.name+'的游戏画面';image.src='photos/'+id+'.webp';figure.append(image);
 const caption=document.createElement('figcaption');
 const link=document.createElement('a');link.textContent='打开原图';link.href=original;link.target='_blank';link.rel='noopener';
 const credit=document.createElement('a');credit.textContent='GTADB · '+id;credit.href=record.url;credit.target='_blank';credit.rel='noopener';
 caption.append(credit,link);figure.append(caption);$('infoBody').append(figure);
 const full=new Image();full.alt=image.alt;
 full.onload=()=>image.replaceWith(full);
 full.onerror=()=>{link.textContent='重试打开原图'};
 full.src=original;
}
function appendPhoto(record,container){
 const preview=button('photo-preview','',()=>showPhoto(record));
 preview.setAttribute('aria-label','放大查看'+record.name+'的游戏画面');
 const image=new Image();image.alt=record.name+'的游戏画面';image.src='photos/'+record.sourceId+'.webp';
 const caption=document.createElement('span');caption.textContent='游戏画面 · 点击放大';
 preview.append(image,caption);container.insertBefore(preview,container.querySelector('p'));
}
function openRecord(r,focus){
 selected=r.id;
 if(focus){const point=pos(r);if(point){zoom=Math.min(maxZoom(),Math.max(zoom,hasXY(r)?2.4:1.45));centerAt(point)}if(matchMedia('(max-width:760px)').matches)$('viewport').scrollIntoView({block:'start',behavior:'smooth'})}
 refresh();const p=popup();setTone(p,r.cat);
 const body=document.createElement('div');body.innerHTML='<div class="tag">'+icon(r.cat)+' '+cats[r.cat][0]+' / '+esc(regions[r.region])+'</div><h3>'+esc(r.name)+'</h3><small class="muted">'+esc(r.en)+'</small><p>'+esc(r.desc)+'</p><div class="muted">'+(hasXY(r)?'社区推定点位':pos(r)?'按关联地区展示 · 具体坐标待核实':'具体位置待核实')+'</div>';p.append(body);
 if(nearby&&nearDistances.has(r.id)){
   const distance=document.createElement('p');distance.textContent='距我的位置 · '+nearLabel(r);body.append(distance);
 }
 if(gamePhotoIds.has(r.sourceId))appendPhoto(r,body);
 if(r.extra){
   const meta=document.createElement('p');meta.className='evidence';
   meta.textContent=[r.sourceId,r.layer==='uncertain'?'待核实':r.layer==='regions'?'地区':'社区推定',...(r.tags||[]).map(tagLabel)].join(' · ');p.append(meta);
 }
 if(hasXY(r)&&r.cat!=='region'){
   const actions=document.createElement('div');actions.className='poi-route-actions';
   actions.append(button('navigate','导航到这里',()=>chooseDestination({point:pos(r),name:r.name,record:r})),
     button('depart','从这里出发',()=>{gpsOpen=true;setOrigin([r.rawX,r.rawY])}));
   body.insertBefore(actions,body.querySelector('p'));
 }
 const foot=document.createElement('div');foot.className='popfoot';p.append(foot);
 foot.append(button('',saved.has(r.id)?'★ 已收藏':'☆ 收藏',()=>{if(saved.has(r.id))saved.delete(r.id);else saved.add(r.id);try{localStorage.setItem('leonida.bookmarks.v1',JSON.stringify([...saved]))}catch{}if(onlySaved&&!saved.has(r.id)){clearPop();refresh()}else openRecord(r,false)}));
 if(r.mapheistId && hasXY(r)){
   const link=document.createElement('a');link.href='https://mapheist.com/en/map/?point='+encodeURIComponent(r.mapheistId);
   link.target='_blank';link.rel='noopener';link.textContent='在 Mapheist 对照此处';foot.append(link);
 }
 const address=addressTerms.find(term=>normalize(r.en+' '+r.desc+' '+r.name).includes(normalize(term)));
 if(address){const link=button('related','查询同地点 · '+esc(address),()=>{nearby=false;resetExtraFilters();onlySaved=false;category='all';$('region').value='';$('query').value=address;clearPop();refresh();if(matchMedia('(max-width:760px)').matches)$('panelTitle').scrollIntoView({behavior:'smooth'})});p.append(link)}
 r.refs.forEach((url,i)=>{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent=r.refs.length>1?'来源 '+(i+1):'查看来源';foot.append(a)});
}
function showGroup(items){if(items.length===1){openRecord(items[0],false);return}selected=null;const p=popup();p.insertAdjacentHTML('beforeend','<h3>相关条目</h3><p>'+items.length+' 项 · 选择查看位置说明</p>');for(const r of items){p.append(button('pick',icon(r.cat)+' '+esc(r.name),()=>openRecord(r,false)))}}
const viewport=$('viewport');
const panMargin=160;
const hdWidth=19000;
const tileGrids=[1,2,4,8,16];
const visibleTiles=new Map();
function maxZoom(){
 return Math.max(1,hdWidth/(baseSize*(window.devicePixelRatio||1)));
}
function updateTiles(){
 const size=baseSize*zoom;
 if(!size)return;
 const physicalWidth=size*(window.devicePixelRatio||1);
 const grid=tileGrids.find(n=>hdWidth*n/16>=physicalWidth-0.5)||16;
 const cell=size/grid;
 const wanted=new Set();
 // The overview image stays in place while newly visible detail tiles decode.
 if(grid>1){
   const x0=Math.max(0,Math.floor((-cx-panMargin)/cell)),y0=Math.max(0,Math.floor((-cy-panMargin)/cell));
   const x1=Math.min(grid-1,Math.floor((viewport.clientWidth-cx+panMargin)/cell));
   const y1=Math.min(grid-1,Math.floor((viewport.clientHeight-cy+panMargin)/cell));
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
     const key=grid+'/'+x+'-'+y;
     wanted.add(key);
     let tile=visibleTiles.get(key);
     if(!tile){
       tile=new Image();tile.alt='';tile.draggable=false;tile.decoding='async';
       tile.src='tiles/'+key+'.webp';
       visibleTiles.set(key,tile);$('tileLayer').append(tile);
     }
     const left=Math.round(x*cell),top=Math.round(y*cell);
     Object.assign(tile.style,{left:left+'px',top:top+'px',width:(Math.round((x+1)*cell)-left)+'px',height:(Math.round((y+1)*cell)-top)+'px'});
   }
 }
 for(const [key,tile] of visibleTiles)if(!wanted.has(key)){tile.remove();visibleTiles.delete(key)}
 $('plus').disabled=zoom>=maxZoom()-.001;
 $('minus').disabled=zoom<=.701;
}
function centerAt([x,y]){cx=viewport.clientWidth/2-baseSize*zoom*x/1000;cy=viewport.clientHeight/2-baseSize*zoom*y/1000}
function fit(){baseSize=Math.min(viewport.clientWidth*1.06,viewport.clientHeight*.98);zoom=1;centerAt([500,500]);draw(true)}
let plottedGroups=[], renderedSize=0, renderedRecords=null, renderedSelection;
let layerX=Infinity, layerY=Infinity, pendingPaint=0;
const markerNodes=new Map();
const regionLabels=new Map();
const regionNamesOnMap={vice:'VICE CITY',keys:'LEONIDA KEYS',mount:'MOUNT KALAGA',ambrosia:'AMBROSIA',grass:'GRASSRIVERS',port:'PORT GELLHORN'};

function groupMarkers(size){
 const groups=new Map();
 for(const r of visible){
   const point=pos(r);
   if(!point)continue;
   const x=point[0]*size/1000,y=point[1]*size/1000;
   const regionGroup=hasXY(r)?'':r.region;
   const key=regionGroup+'|'+Math.floor(x/32)+'|'+Math.floor(y/32);
   let group=groups.get(key);
   if(!group){group={x,y,regionGroup,items:[]};groups.set(key,group)}
   group.items.push(r);
 }
 return [...groups.values()];
}

function paintMarks(size,scaleChanged){
 const marks=$('marks'), additions=document.createDocumentFragment();
 // Read the viewport once before writing any marker styles.
 const width=viewport.clientWidth,height=viewport.clientHeight;
 if(scaleChanged){
   for(const [key,[x,y]] of Object.entries(map.anchors)){
     let label=regionLabels.get(key);
     if(!label){
       label=document.createElement('span');label.className='region-label';
       label.textContent=regionNamesOnMap[key];regionLabels.set(key,label);additions.append(label);
     }
     label.style.left=x*size/1000+'px';label.style.top=(y*size/1000-25)+'px';
   }
 }
 const wanted=new Set();
 for(const group of plottedGroups){
   const {x,y,items,regionGroup}=group;
   if(x+cx < -panMargin-35 || y+cy < -panMargin-55 || x+cx > width+panMargin+35 || y+cy > height+panMargin+35)continue;
   const key=items[0].id;wanted.add(key);
   let node=markerNodes.get(key);
   if(!node){
     node=document.createElement('button');
     node.onclick=()=>showGroup(node.atlasGroup.items);
     markerNodes.set(key,node);additions.append(node);
   }
   if(node.atlasGroup===group && renderedSelection===selected)continue;
   node.atlasGroup=group;
   const match=selected && items.find(r=>r.id===selected);
   const r=match||items[0],n=items.length;
   const cat=!match && items.some(item=>item.cat!==r.cat)?'all':r.cat;
   const signature=cat+'|'+n;
   if(node.dataset.symbol!==signature){
     node.innerHTML=icon(cat)+(n>1?'<span class="num">'+n+'</span>':'');
     node.dataset.symbol=signature;setTone(node,cat);
   }
   node.className='pin'+(match?' selected':'')+(hasXY(r)?'':' regional');
   node.style.left=x+'px';node.style.top=(y+(regionGroup?18:0))+'px';
   node.title=n>1?n+' 个条目 · '+regions[r.region]:r.name;
   node.setAttribute('aria-label',node.title);
 }
 for(const [key,node] of markerNodes){
   if(!wanted.has(key)){node.remove();markerNodes.delete(key)}
 }
 marks.append(additions);
}

function draw(force=false){
 const size=baseSize*zoom;
 if(!size)return;
 const scaleChanged=renderedSize!==size;
 const regroup=scaleChanged||renderedRecords!==visible;
 const world=$('world');
 if(scaleChanged){world.style.width=size+'px';world.style.height=size+'px'}
 world.style.transform='translate3d('+cx+'px,'+cy+'px,0)';
 if(!regroup && !force && selected===renderedSelection &&
    Math.abs(cx-layerX)<panMargin && Math.abs(cy-layerY)<panMargin)return;
 if(regroup)plottedGroups=groupMarkers(size);
 updateTiles();updateCoverage();paintMarks(size,scaleChanged);
 renderedSize=size;renderedRecords=visible;renderedSelection=selected;
 layerX=cx;layerY=cy;
}
function queueDraw(){
 if(pendingPaint)return;
 pendingPaint=requestAnimationFrame(()=>{pendingPaint=0;draw()});
}
function scale(f,x=viewport.clientWidth/2,y=viewport.clientHeight/2){
 const next=Math.min(maxZoom(),Math.max(.7,zoom*f)),ratio=next/zoom;
 cx=x-(x-cx)*ratio;cy=y-(y-cy)*ratio;zoom=next;queueDraw();
}
$('plus').onclick=()=>scale(1.5);$('minus').onclick=()=>scale(1/1.5);$('reset').onclick=fit;
viewport.addEventListener('wheel',e=>{e.preventDefault();const b=viewport.getBoundingClientRect();scale(Math.exp(-Math.max(-300,Math.min(300,e.deltaY))*.002),e.clientX-b.left,e.clientY-b.top)},{passive:false});
$('gpsTool').onclick=()=>{
 if(gpsOpen){stopRoute();return}
 gpsOpen=true;clearPop();renderRoute();
};
$('showRoads').onchange=updateCoverage;
$('clearRoute').onclick=stopRoute;
$('routeStart').onclick=()=>setPlacing(true);
$('routePick').onclick=()=>setPlacing(true,'end');
$('routeFit').onclick=fitRoute;
$('routePin').onclick=()=>{if(destination?.record)openRecord(destination.record,false);else fitRoute()};
$('locationTool').onclick=()=>{if(placing)setPlacing(false);else showNearby()};
 $('playerPin').onclick=showNearby;
 $('movePin').onclick=()=>setPlacing(true);
 $('removePin').onclick=()=>{stopRoute();player=null;try{localStorage.removeItem(playerKey)}catch{}viewMode(false)};
 $('nearRadius').onchange=()=>{clearPop();recenterNearby();refresh()};
 $('nearUnknown').onchange=()=>{clearPop();refresh()};
 document.addEventListener('keydown',e=>{
   if(!placing)return;
   if(e.key==='Escape'){setPlacing(false);$('locationTool').focus()}
   if(e.key==='Enter'&&document.activeElement===viewport){const rect=viewport.getBoundingClientRect();placeAt(rect.left+rect.width/2,rect.top+rect.height/2)}
 });
const fingers=new Map();
let draggedFromPin=false;
viewport.addEventListener('click',e=>{
 if(draggedFromPin && e.detail>0){e.preventDefault();e.stopPropagation()}
},true);
viewport.onpointerdown=e=>{
 if(e.button!==0)return;
 if(!fingers.size)draggedFromPin=false;
 const button=e.target.closest('button');
 if(placing)placementTap=fingers.size===0?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;
 fingers.set(e.pointerId,{x:e.clientX,y:e.clientY,button});(button||viewport).setPointerCapture(e.pointerId);
};
viewport.onpointermove=e=>{
 const previous=fingers.get(e.pointerId);if(!previous)return;
 if(placementTap&&Math.hypot(e.clientX-placementTap.x,e.clientY-placementTap.y)>5)placementTap=null;
 if(placing&&placementTap)return;
 if(previous.button){
   if(fingers.size===1 && Math.hypot(e.clientX-previous.x,e.clientY-previous.y)<5)return;
   draggedFromPin=true;viewport.setPointerCapture(e.pointerId);
 }
 const other=[...fingers.entries()].find(([id])=>id!==e.pointerId)?.[1];
 fingers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(other){
   const oldGap=Math.hypot(previous.x-other.x,previous.y-other.y),newGap=Math.hypot(e.clientX-other.x,e.clientY-other.y);
   if(oldGap>2&&newGap>2){const rect=viewport.getBoundingClientRect();scale(newGap/oldGap,(other.x+previous.x)/2-rect.left,(other.y+previous.y)/2-rect.top)}
 }
 const factor=other ? 0.5 : 1;
 cx+=(e.clientX-previous.x)*factor;cy+=(e.clientY-previous.y)*factor;
 queueDraw();
};
viewport.onpointerup=e=>{
 if(placing&&placementTap?.id===e.pointerId&&Math.hypot(e.clientX-placementTap.x,e.clientY-placementTap.y)<=5)placeAt(e.clientX,e.clientY);
 placementTap=null;fingers.delete(e.pointerId);
};
viewport.onpointercancel=e=>{fingers.delete(e.pointerId);if(placementTap?.id===e.pointerId)placementTap=null};
viewport.onlostpointercapture=e=>{
 // Transferring capture from a marker to the viewport is part of starting a drag.
 if(e.target!==viewport)return;
 fingers.delete(e.pointerId);if(placementTap?.id===e.pointerId)placementTap=null;
};
for(const id of ['scope','layer','tag','hasPhoto'])$(id).onchange=()=>{clearPop();refresh()};
$('query').oninput=()=>{clearPop();refresh()};
$('region').onchange=()=>{clearPop();const p=map.anchors[$('region').value];if(!nearby){if(p){zoom=Math.min(maxZoom(),1.8);centerAt(p)}else fit()}refresh()};
function dialog(title,html,wide=false){$('dialogtitle').textContent=title;$('infoBody').innerHTML=html;$('info').classList.toggle('wide',wide);$('info').showModal()}
$('sources').onclick=()=>dialog('地图与资料来源','<p>首版整理于 2026 年 11 月 19 日。地图点位来自社区对照预告片与截图的推定。仅知所属地区的条目集中在地区标记下，人物可能随剧情移动。中文名含本站暂译。</p><p>底图依据 <a href="https://github.com/rolux/gtadb.org" target="_blank" rel="noopener">YANIS v16 / GTADB 社区地图</a>，使用与 Mapheist 同源的 YANIS v16 原色切片，按坐标配准和裁切，最高层覆盖 19000 × 19000 个原图像素。切片来自 <a href="https://github.com/navanem/gta6-leonida-atlas/tree/0c7434f5bd5ed59a58aaa75a3ba7c3734fa0c4d0/public/assets/street-leonida/maps/gtadb-yanis-16-z5" target="_blank" rel="noopener">Leonida Atlas 保存的固定版本</a>。社区目录同步自 GTADB / Map GTA 固定版本 5c1d69f，收录 3431 条记录和参考项目的 6 个地区，沿用来源分类、标签与证据图层。无坐标记录仅供检索。附近推荐使用有坐标点位，直线距离按下述 Mapheist 的 YANIS v16 比例尺估算。地点数据译自 <a href="https://mapheist.com/en/data/" target="_blank" rel="noopener">Mapheist</a>，两者均采用 <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>。</p><p>游戏画面来自 <a href="https://github.com/rolux/gtadb.org/tree/5c1d69ff864623d181da5457afaacd00b623e1a4/map/photos/6" target="_blank" rel="noopener">GTADB 公开游戏图片目录</a>，按标记编号对应，预览图经过缩放和 WebP 转码。游戏画面版权归 Rockstar Games 等权利人所有。任务、店铺和隐藏要素另据首发攻略整理。每条详情附对应出处。场景封面来自 <a href="https://www.rockstargames.com/VI" target="_blank" rel="noopener">Rockstar Games</a>。GPS 路网由本站从上述 YANIS v16 社区底图提取道路中心线，采用 CC BY 4.0。线路按已连接的中心线估算，单行、转向限制与立交层级尚待游戏实测。虚线表示端点到参考道路的直线间隔。本站是非官方个人查询工具。</p>');
$('extmap').onclick=()=>dialog('Mapheist 社区地图','<p><a href="https://mapheist.com/en/map/" target="_blank" rel="noopener">打开 Mapheist 全屏原图</a> · <a href="https://mapheist.com/leonida-drive/?lang=en" target="_blank" rel="noopener">对照 Leonida Drive 路线</a></p><iframe loading="lazy" title="Mapheist 英文社区互动地图" src="https://mapheist.com/en/embed/leonida/"></iframe>',true);
$('closeInfo').onclick=()=>$('info').close();$('info').onclose=()=>$('infoBody').replaceChildren();
$('base').src='tiles/1/0-0.webp';refresh();
let initialPoi=new URLSearchParams(location.search).get('poi');
new ResizeObserver(()=>{
 fit();
 if(initialPoi){
   const record=all.find(r=>r.sourceId===initialPoi || r.mapheistId===initialPoi);
   initialPoi=null;
   if(record)openRecord(record,true);
 }
}).observe(viewport);
