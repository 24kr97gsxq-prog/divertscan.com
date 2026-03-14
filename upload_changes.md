# upload.html Changes

## CHANGE 1: Replace Step 3 HTML (around lines 141-168)

Find this block (Scale Ticket + Debris sections):
```
<div class="c">
<div class="ct">📄 Scale Ticket <span s
```

Replace the entire Step 3 photo section (lines ~141-168) with:

```html
<div class="c">
<div class="ct">📷 Upload All Photos <span style="color:var(--danger)">*required</span></div>
<p style="font-size:.75rem;color:var(--text-d);margin-bottom:10px">Select all photos at once — scale tickets AND debris/load photos. AI will sort them automatically.</p>
<div class="br" style="margin-bottom:8px">
<div class="ub" style="flex:1;background:var(--bg2);border-radius:8px;padding:12px;text-align:center;cursor:pointer;position:relative;overflow:hidden">
📷 Camera<input type="file" accept="image/*" capture="environment" multiple onchange="U.add(this)" style="position:absolute;inset:0;opacity:0;cursor:pointer"></div>
<div class="ub" style="flex:1;background:var(--bg2);border-radius:8px;padding:12px;text-align:center;cursor:pointer;position:relative;overflow:hidden">
📁 Upload<input type="file" accept="image/*" multiple onchange="U.add(this)" style="position:absolute;inset:0;opacity:0;cursor:pointer"></div>
</div>
<div class="ps" id="allPhotos"></div>
</div>
```

## CHANGE 2: Replace the add() function (around line 273-276)

Find:
```javascript
add(type,input){var files=Array.from(input.files);var arr=U.photos[type];
files.forEach(function(f){var r=new FileReader();r.onload=function(e){
arr.push({file:f,prev:e.target.result});U.renderPhotos(type);U.updBtn();};r.readAsDataURL(f)});input.value=''},
```

Replace with:
```javascript
add(input){var files=Array.from(input.files);
files.forEach(function(f){var r=new FileReader();r.onload=function(e){
U.photos.all.push({file:f,prev:e.target.result});U.renderAllPhotos();U.updBtn();};r.readAsDataURL(f)});input.value=''},
```

## CHANGE 3: Replace renderPhotos and renderAllPhotos (around line 278-280)

Find:
```javascript
renderPhotos(type){var arr=U.photos[type];var el=document.getElementById(type==='s'?'sPhotos':'dPhotos');
el.innerHTML=arr.map(function(p,i){return '<div class="ps-item"><img src="'+p.prev+'">'+
'<button class="ps-x" onclick="U.rm(\''+type+'\','+i+')">×</button></div>';}).join('');},
```

Replace with:
```javascript
renderAllPhotos(){var arr=U.photos.all;var el=document.getElementById('allPhotos');
if(!el)return;
el.innerHTML=arr.map(function(p,i){
var tag=p.type?'<span style="font-size:.5rem;position:absolute;bottom:2px;left:2px;background:'+(p.type==='scale_ticket'?'#059669':'#0891b2')+';color:#fff;padding:1px 4px;border-radius:3px">'+(p.type==='scale_ticket'?'SCALE':'DEBRIS')+'</span>':'';
return '<div class="ps-item" style="position:relative"><img src="'+p.prev+'">'+tag+'<button class="ps-x" onclick="U.rmAll('+i+')">×</button></div>';}).join('');},
```

## CHANGE 4: Replace rm() function (around line 282)

Find:
```javascript
rm(type,i){U.photos[type].splice(i,1);U.renderPhotos(type);U.updBtn();},
```

Replace with:
```javascript
rmAll(i){U.photos.all.splice(i,1);U.renderAllPhotos();U.updBtn();},
```

## CHANGE 5: Replace updBtn() function (around line 284-287)

Find:
```javascript
updBtn(){var n=U.photos.s.length;var btn=document.getElementById('submitBtn');
if(n>0){var total=n+U.photos.d.length;btn.style.opacity='1';btn.style.pointerEvents='auto';
btn.textContent='📤 Submit '+total+' Photo'+(total>1?'s':'');}
else{btn.style.opacity='.4';btn.style.pointerEvents='none';btn.textContent='📤 Submit (add scale ticket first)';}},
```

Replace with:
```javascript
updBtn(){var n=U.photos.all.length;var btn=document.getElementById('submitBtn');
if(n>0){btn.style.opacity='1';btn.style.pointerEvents='auto';
btn.textContent='📤 Submit '+n+' Photo'+(n>1?'s':'')+' — AI will classify';}
else{btn.style.opacity='.4';btn.style.pointerEvents='none';btn.textContent='📤 Submit (add photos first)';}},
```

## CHANGE 6: Replace submit() function (around lines 294-313)

Find:
```javascript
async submit(){if(!U.photos.s.length||!U.projId)return;
```

Replace the ENTIRE submit function with:
```javascript
async submit(){if(!U.photos.all.length||!U.projId)return;
var btn=document.getElementById('submitBtn');btn.style.opacity='.4';btn.style.pointerEvents='none';
var all=U.photos.all;
var tNum=document.getElementById('tktNum').value.trim()||null;
var notes=document.getElementById('tktNotes').value.trim()||null;
var batchId='batch_'+Date.now()+'_'+Math.random().toString(36).substring(2,8);
var ok=0;
for(var i=0;i<all.length;i++){
btn.textContent='📤 Uploading '+(i+1)+'/'+all.length+'...';
try{
// Compress: scale tickets at 1200px, others at 800px (will be classified by AI on admin side)
var blob=await U.compress(all[i].file,1000);
var path='queue/'+U.projId+'/'+all[i].type+'_'+Date.now()+'_'+i+'.jpg';
var up=await fetch(SB+'/storage/v1/object/ticket-photos/'+path,{method:'POST',
headers:{'apikey':SK,'Authorization':'Bearer '+SK,'Content-Type':'image/jpeg','x-upsert':'true'},body:blob});
if(!up.ok)continue;
var url=SB+'/storage/v1/object/public/ticket-photos/'+path;
await U.api('photo_queue','POST',{project_id:U.projId,access_code:U.haulerCode||'field',
submitted_by:U.name,photo_type:'scale_ticket',photo_url:url,
ticket_number:tNum,notes:notes,status:'pending',batch_id:batchId});
ok++;
}catch(x){console.error(x);}
}
document.getElementById('successDetail').textContent=ok+' photo'+(ok>1?'s':'')+' uploaded for '+U.projName+(tNum?' (Ticket #'+tNum+')':'')+'';
U.goStep(4);U.loadSuccessSubmissions();},
```

## CHANGE 7: Replace reset() function (around line 315)

Find:
```javascript
reset(){U.photos={s:[],d:[]};document.getElementById('tktNum').value='';document.getElementById('tktNotes').value='';
U.renderPhotos('s');U.renderPhotos('d');U.updBtn();U.goStep(3);U.loadInlineSubmissions();},
```

Replace with:
```javascript
reset(){U.photos={all:[]};document.getElementById('tktNum').value='';document.getElementById('tktNotes').value='';
U.renderAllPhotos();U.updBtn();U.goStep(3);U.loadInlineSubmissions();},
```

## CHANGE 8: Update photos initial state (line 213)

Find:
```javascript
name:null,projId:null,projName:null,photos:{s:[],d:[]},
```

Replace with:
```javascript
name:null,projId:null,projName:null,photos:{all:[]},
```

## CHANGE 9: Update projNext() reset (line 270)

Find:
```javascript
U.photos={s:[],d:[]};U.renderPhotos('s');U.renderPhotos('d');U.updBtn();
```

Replace with:
```javascript
U.photos={all:[]};U.renderAllPhotos();U.updBtn();
```
