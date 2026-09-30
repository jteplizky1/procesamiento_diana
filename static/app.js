const S={projects:[],project:null,source:null,step:0,quotaOptions:null,quotaDraft:[],quotaDirty:false,sheetTabs:null,workflow:null};
const stages=[
 {name:'Proyecto',sub:'Nombre y contexto',title:'Prepará tu investigación',desc:'Creá un proyecto nuevo o continuá exactamente donde lo dejaste.'},
 {name:'Fuente',sub:'Google Sheets',title:'Conectá las respuestas',desc:'La fuente se copia localmente para trabajar rápido y se actualiza sólo cuando vos lo decidís.'},
 {name:'Cuotas',sub:'Diseño muestral',title:'Definí la muestra objetivo',desc:'Elegí dimensiones, editá cantidades o porcentajes y guardá todo junto al finalizar.'},
 {name:'Balanceo',sub:'Selección aleatoria',title:'Construí la base balanceada',desc:'Se conservan al azar sólo las respuestas necesarias dentro de cada cuota.'},
 {name:'Texto libre',sub:'Gemini + revisión',title:'Interpretá respuestas abiertas',desc:'Procesamiento semántico por lotes, con aprobación manual respuesta por respuesta.'},
 {name:'Rankings',sub:'Posiciones',title:'Procesá los ordenamientos',desc:'Convertí cada ranking en una tabla clara de posiciones por opción.'},
 {name:'Análisis',sub:'Gráficos y cruces',title:'Explorá los resultados',desc:'Visualizá distribuciones y revisá cruces sugeridos sobre la muestra definitiva.'},
 {name:'Exportación',sub:'Excel limpio',title:'Llevate la base procesada',desc:'Descargá datos, cuotas, gráficos y sugerencias en un único archivo Excel.'},
];
const $=s=>document.querySelector(s), esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(url,opt={}){let r=await fetch(url,{headers:{'Content-Type':'application/json'},...opt});let type=r.headers.get('content-type')||'';if(!r.ok){const body=await r.text();let detail=body;try{const data=JSON.parse(body);detail=data.details||data.error||body}catch{}throw Error(`HTTP ${r.status} ${r.statusText}\n${url}\n\n${detail}`)}return type.includes('json')?await r.json():await r.blob()}
function showPersistentError(message){
  let dialog=document.querySelector('#errorDialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='errorDialog';
    dialog.innerHTML='<h2>No se pudo completar la operación</h2><pre id="fullErrorText"></pre><form method="dialog"><button class="primary">Aceptar</button></form>';
    document.body.appendChild(dialog);
  }
  const text=String(message||'Error desconocido');
  if(dialog.open){document.querySelector('#fullErrorText').textContent+='\n\n'+text}
  else{document.querySelector('#fullErrorText').textContent=text;dialog.showModal()}
}
function toast(msg,bad=false){
  if(bad){showPersistentError(msg);return}
  let x=$('#toast');x.textContent=msg;x.style.background='#102a43';x.classList.add('show');setTimeout(()=>x.classList.remove('show'),3200)
}
window.addEventListener('unhandledrejection',event=>{event.preventDefault();showPersistentError(event.reason?.stack||event.reason?.message||event.reason)});
window.addEventListener('error',event=>showPersistentError(event.error?.stack||event.message));
function markSaving(on){$('#saveState').textContent=on?'Cambios sin guardar':'Todo guardado';$('#saveState').style.color=on?'#b7791f':'#25855a'}
async function init(){S.projects=await api('/api/projects');renderProjectSelect();if(S.projects.length)await openProject(S.projects[0].id);else render();}
function renderProjectSelect(){let el=$('#projectSelect');el.innerHTML=S.projects.length?S.projects.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join(''):'<option>Sin proyectos</option>';if(S.project)el.value=S.project.id;if($('#deleteProject'))$('#deleteProject').disabled=!S.project}
async function openProject(id){S.project=await api('/api/project/'+id);S.source=null;S.workflow=null;S.sheetTabs=null;S.quotaDraft=structuredClone(S.project.quota_rows||[]);S.quotaDirty=false;renderProjectSelect();render();if(S.project.source_url){try{S.source=await api(`/api/project/${id}/source`);S.workflow=await api(`/api/project/${id}/workflow-status`);render()}catch(e){toast(e.message,true)}}}
$('#projectSelect').onchange=e=>openProject(e.target.value);
async function cloudCheckpoint(reason='avance',silent=false){
 if(!S.project?.id)return false;
 try{const r=await api('/api/project/'+S.project.id+'/save-cloud',{method:'POST',body:JSON.stringify({reason})});if(!silent)toast('Avance guardado en el sandbox');return r}
 catch(e){toast('El avance quedó guardado localmente, pero no se pudo copiar al sandbox:\n'+e.message,true);return false}
}
$('#newProject').onclick=()=>{document.body.insertAdjacentHTML('beforeend',`<div class="modal"><div class="card"><h2>Nuevo proyecto</h2><div class="field"><label>Nombre</label><input id="npName" autofocus></div><div class="field"><label>Descripción</label><textarea id="npDesc"></textarea></div><div class="actions"><button class="secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="primary" id="createP">Crear proyecto</button></div></div></div>`);$('#createP').onclick=async()=>{let p=await api('/api/projects',{method:'POST',body:JSON.stringify({name:$('#npName').value,description:$('#npDesc').value})});document.querySelector('.modal').remove();S.projects=await api('/api/projects');await openProject(p.id);await cloudCheckpoint('creación del proyecto')}};
$('#saveCloudProject').onclick=async()=>{if(!S.project)return;const b=$('#saveCloudProject');b.disabled=true;b.textContent='☁ Guardando…';try{const r=await api('/api/project/'+S.project.id+'/save-cloud',{method:'POST',body:'{}'});toast('Proyecto guardado en '+r.bucket+'/'+r.prefix)}catch(e){toast(e.message,true)}finally{b.disabled=false;b.textContent='☁ Guardar en sandbox'}};
$('#openCloudProject').onclick=async()=>{const b=$('#openCloudProject');b.disabled=true;b.textContent='☁ Buscando…';try{const rows=await api('/api/cloud-projects');document.body.insertAdjacentHTML('beforeend',`<div class="modal"><div class="card"><h2>Abrir proyecto del sandbox</h2><p>Al abrirlo se descarga una copia local para continuar trabajando.</p><div class="field"><label>Proyecto guardado</label><select id="cloudProjectSelect">${rows.map((p,i)=>`<option value="${i}">${esc(p.name)} · ${esc(p.updated_at||'sin fecha')}</option>`).join('')}</select></div><div class="actions"><button class="secondary" onclick="this.closest('.modal').remove()">Cancelar</button><button class="primary" id="restoreCloud" ${rows.length?'':'disabled'}>Abrir proyecto</button></div>${rows.length?'':'<div class="alert">No hay proyectos guardados en el sandbox.</div>'}</div></div>`);if(rows.length)$('#restoreCloud').onclick=async()=>{const selected=rows[+$('#cloudProjectSelect').value];const p=await api('/api/cloud-projects/restore',{method:'POST',body:JSON.stringify({prefix:selected.prefix})});document.querySelector('.modal').remove();S.projects=await api('/api/projects');await openProject(p.id);toast('Proyecto recuperado del sandbox')}}catch(e){toast(e.message,true)}finally{b.disabled=false;b.textContent='☁ Abrir del sandbox'}};
$('#deleteProject').onclick=async()=>{if(!S.project)return;const id=S.project.id,name=S.project.name||'Sin nombre';if(!confirm(`¿Eliminar definitivamente el proyecto “${name}”?\n\nSe borrarán su configuración, clasificaciones y la copia local de las respuestas. Esta acción no afecta Google Sheets y no se puede deshacer.`))return;try{await api('/api/project/'+id,{method:'DELETE'});S.projects=await api('/api/projects');S.project=null;S.source=null;S.workflow=null;S.quotaOptions=null;S.quotaDraft=[];S.sheetTabs=null;if(S.projects.length)await openProject(S.projects[0].id);else{renderProjectSelect();render()}toast(`Proyecto “${name}” eliminado definitivamente.`)}catch(e){toast(e.message,true)}};
function completeness(){let p=S.project||{},sample=!!(p.sample_response_ids||[]).length;return [!!p.id,!!S.source,!!(p.quota_rows||[]).length,sample,sample&&!!S.workflow?.text?.complete,sample&&!!S.workflow?.rankings_complete,sample,sample]}
const stageRequirements=[
 'Creá un proyecto nuevo o seleccioná uno existente.',
 'Conectá una hoja de respuestas y cargá la solapa que querés analizar.',
 'Completá la distribución y tocá “Guardar cuotas”.',
 'Sorteá y guardá la muestra balanceada.',
 'Procesá o revisá todas las preguntas de texto libre seleccionadas.',
 'Procesá las preguntas de ranking seleccionadas.',
 'Completá primero la muestra balanceada.',
 'Completá primero la muestra balanceada.',
];
function effectiveCompleteness(){let done=completeness();if(S.quotaDirty)done[2]=false;return done}
function firstPendingStep(done){let pending=done.findIndex(value=>!value);return pending<0?stages.length-1:pending}
function stageRequirement(index){
 if(index===4){
  const text=S.workflow?.text;
  if(!text)return'Esperá a que se cargue el estado de las respuestas libres.';
  if(!text.processing_complete)return`Falta procesar ${Math.max(0,(text.total||0)-(text.processed||0))} respuestas de texto libre.`;
  if(!text.complete)return`Revisá las propuestas y tocá “Siguiente” para confirmar ${Math.max(0,(text.total||0)-(text.approved||0))} respuestas.`;
  return stageRequirements[index];
 }
 if(index!==2)return stageRequirements[index]||'Completá este paso para continuar.';
 const settings=S.project?.quota_settings||{},dims=settings.dimensions||[],rows=S.quotaDraft||[],mode=$('#qMode')?.value||settings.input_mode||'Cantidades',key=mode==='Cantidades'?'cantidad':'porcentaje';
 if(!dims.length)return'Elegí al menos una variable de cuota.';
 if(!rows.length)return'Generá las combinaciones o pegá la tabla de cuotas.';
 const incomplete=rows.findIndex(row=>dims.some(d=>String(row[d]??'').trim()===''));
 if(incomplete>=0)return`Completá todas las dimensiones de la cuota en la fila ${incomplete+1}.`;
 const invalid=rows.findIndex(row=>!Number.isFinite(Number(row[key]))||Number(row[key])<0);
 if(invalid>=0)return`Corregí el valor de ${key} en la fila ${invalid+1}.`;
 const expected=mode==='Cantidades'?Number($('#qTotal')?.value||settings.target_total||0):100,actual=rows.reduce((sum,row)=>sum+Number(row[key]||0),0);
 if(Math.abs(actual-expected)>.01)return`La suma de ${key} es ${Math.round(actual*100)/100} y debe ser ${expected}. Faltan ${Math.round((expected-actual)*100)/100}.`;
 if(S.quotaDirty)return'Todo está completo, pero falta tocar “Guardar cuotas”.';
 if(!S.project?.quota_rows?.length)return'Tocá “Guardar cuotas” para confirmar la distribución.';
 return stageRequirements[index];
}
function shell(){
 let p=S.project||{},done=effectiveCompleteness(),maxStep=firstPendingStep(done);
 if(S.step>maxStep)S.step=maxStep;
 let st=stages[S.step];
 $('#stageLabel').textContent=`PASO ${S.step+1} DE ${stages.length} · ${st.name.toUpperCase()}`;
 $('#title').textContent=st.title;$('#subtitle').textContent=st.desc;
 $('#steps').innerHTML=stages.map((x,i)=>{let locked=i>maxStep,reason=stageRequirement(maxStep);return `<div class="step ${i===S.step?'active':''} ${done[i]?'done':''} ${locked?'locked':''}" data-step="${i}" aria-disabled="${locked}" title="${locked?esc(reason):''}"><span class="n">${done[i]?'✓':locked?'🔒':i+1}</span><div><b>${x.name}</b><small>${locked?'Bloqueado · completá el paso anterior':x.sub}</small></div></div>`}).join('');
 document.querySelectorAll('.step').forEach(x=>x.onclick=()=>{let target=+x.dataset.step;if(target>maxStep){toast(stageRequirement(maxStep),true);return}S.step=target;render()});
 $('#back').disabled=S.step===0;
 const textReadyToConfirm=S.step===4&&!!S.workflow?.text?.processing_complete;
 const nextBlocked=!done[S.step]&&!textReadyToConfirm,nextReason=nextBlocked?stageRequirement(S.step):textReadyToConfirm?'Confirmar las respuestas procesadas y continuar.':'';
 $('#next').disabled=S.step===stages.length-1;
 $('#next').classList.toggle('blocked-next',nextBlocked);$('#next').setAttribute('aria-disabled',String(nextBlocked));$('#next').dataset.tooltip=nextReason;$('#next').title=nextReason;
 $('#back').onclick=()=>{S.step--;render()};
 $('#next').onclick=async()=>{if(S.step===4&&!done[4]){if(!textReadyToConfirm){toast(stageRequirement(4),true);return}await finalizeTextStage();return}if(!done[S.step]){toast(stageRequirement(S.step),true);return}const completed=S.step;S.step++;render();await cloudCheckpoint('paso '+(completed+1)+' completado',true)};
 $('#stageHint').innerHTML=!done[S.step]?`<span class="muted">Para continuar: ${esc(stageRequirement(S.step))}</span>`:done[3]?`<a href="/api/project/${p.id}/export"><button class="secondary">Descargar base procesada</button></a>`:'';
}
async function refreshWorkflow(){if(!S.project?.source_url)return;S.workflow=await api('/api/project/'+S.project.id+'/workflow-status')}
function render(){shell();if(!S.project){$('#content').innerHTML='<div class="card"><h2>Empecemos</h2><p>Creá tu primer proyecto para comenzar.</p></div>';return}([projectView,sourceView,quotasView,balanceView,textView,rankingView,analysisView,exportView][S.step])()}
async function saveFields(data){markSaving(true);S.project=await api(`/api/project/${S.project.id}/save`,{method:'POST',body:JSON.stringify(data)});markSaving(false);S.projects=await api('/api/projects');renderProjectSelect();shell();toast('Proyecto guardado')}
function projectView(){let p=S.project;$('#content').innerHTML=`<div class="card"><h2>Identidad del proyecto</h2><p>Esta información y todo el avance permanecen guardados aunque cierres o actualices la página.</p><div class="grid"><div class="field"><label>Nombre</label><input id="pName" value="${esc(p.name)}"></div><div class="field wide"><label>Descripción</label><textarea id="pDesc">${esc(p.description)}</textarea></div></div><div class="actions"><button id="saveProject" class="primary">Guardar proyecto</button><span class="muted">ID: ${p.id.slice(0,10)}</span></div></div>`;$('#saveProject').onclick=()=>saveFields({name:$('#pName').value,description:$('#pDesc').value})}
function sourceView(){let p=S.project,src=S.source;$('#content').innerHTML=`<div class="card"><h2>Hoja de respuestas</h2><p>Pegá el enlace normal de una hoja pública. Después elegí exactamente qué solapa querés analizar.</p><div class="field"><label>URL de Google Sheets</label><input id="sourceUrl" value="${esc(p.source_url||'')}" placeholder="https://docs.google.com/spreadsheets/d/..."></div><div class="actions"><button class="secondary" id="findSheets">Buscar solapas</button></div><div id="sheetPicker">${sheetPickerHtml()}</div><div class="actions"><button class="primary" id="connect" ${S.sheetTabs?.length?'':'disabled'}>Guardar y cargar solapa</button><button class="secondary" id="refresh" ${!p.source_url||!p.source_sheet_gid?'disabled':''}>Actualizar esta solapa desde Drive</button></div>${src?`<div class="metrics"><div class="metric"><small>Solapa analizada</small><strong style="font-size:15px">${esc(p.source_sheet_name||'Predeterminada')}</strong></div><div class="metric"><small>Respuestas</small><strong>${src.rows}</strong></div><div class="metric"><small>Columnas</small><strong>${src.columns.length}</strong></div><div class="metric"><small>Última actualización</small><strong style="font-size:13px">${esc(src.refreshed_at||'—')}</strong></div></div>`:''}</div>${src?dictionaryCard(src.dictionary):''}`;$('#findSheets').onclick=discoverSheets;$('#connect').onclick=async()=>{try{let selected=$('#sourceSheet'),option=selected.options[selected.selectedIndex];await saveFields({source_url:$('#sourceUrl').value.trim(),source_sheet_gid:selected.value,source_sheet_name:option.text});S.source=await api(`/api/project/${p.id}/refresh-source`,{method:'POST',body:'{}'});S.project=await api('/api/project/'+p.id);S.quotaOptions=null;toast(`Solapa “${option.text}” conectada`);render()}catch(e){toast(e.message,true)}};$('#refresh').onclick=async()=>{try{S.source=await api(`/api/project/${p.id}/refresh-source`,{method:'POST',body:'{}'});S.project=await api('/api/project/'+p.id);S.quotaOptions=null;toast(`Solapa “${p.source_sheet_name}” actualizada`);render()}catch(e){toast(e.message,true)}};if(p.source_url&&!S.sheetTabs)discoverSheets(true)}
function sheetPickerHtml(){if(!S.sheetTabs)return'<p class="muted">Buscá las solapas disponibles para continuar.</p>';if(!S.sheetTabs.length)return'<div class="alert">No se encontraron solapas.</div>';return`<div class="field" style="margin-top:14px"><label>Solapa a analizar</label><select id="sourceSheet">${S.sheetTabs.map(x=>`<option value="${esc(x.gid)}" ${String(x.gid)===String(S.project.source_sheet_gid)?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>`}
async function discoverSheets(silent=false){try{let input=$('#sourceUrl'),url=input?input.value.trim():S.project.source_url;if(!url)throw Error('Pegá primero el enlace de Google Sheets');if(!silent)toast('Buscando solapas…');S.sheetTabs=await api(`/api/project/${S.project.id}/discover-sheets`,{method:'POST',body:JSON.stringify({url})});let picker=$('#sheetPicker');if(picker)picker.innerHTML=sheetPickerHtml();let connect=$('#connect');if(connect)connect.disabled=!S.sheetTabs.length;if(!silent)toast(`Se encontraron ${S.sheetTabs.length} solapas`)}catch(e){if(!silent)toast(e.message,true)}}
const typeGuidance={
 'selección única':'Una sola alternativa por persona. Ej.: marca principal, sí/no o situación laboral. Se analiza como distribución.',
 'selección múltiple':'La persona puede marcar varias alternativas. Ej.: marcas conocidas o motivos de compra. Cada alternativa se cuenta por separado.',
 'escala':'Valor ordenado en un rango, normalmente 1–5, 1–7 o 0–10. Sirve para promedios y distribuciones.',
 'matriz de escala':'Varias afirmaciones evaluadas con la misma escala. Usalo cuando la columna representa un ítem de una batería.',
 'ordenamiento/ranking':'Opciones ubicadas de mejor a peor o del puesto 1 al N. El sistema calcula posiciones y promedio por opción.',
 'texto libre':'Opinión, explicación o mención escrita sin opciones cerradas. Después puede normalizarse con Gemini o revisión manual.',
 'demográfica':'Variable para segmentar o filtrar: región, edad, género, ingresos, educación, etc. También puede utilizarse para cuotas.',
 'numérica':'Cantidad o medida abierta, no una categoría: precio, kilómetros, integrantes, año, etc.',
 'identificador':'Código único para rastrear una respuesta. No se usa como resultado estadístico.',
 'técnica':'Dato generado por la plataforma: fecha, duración, estado o metadato. Normalmente se excluye del análisis.',
 'vacía':'Columna sin respuestas utilizables. Conviene excluirla.'
};
function typeHelp(type){return typeGuidance[type]||'Elegí el tipo que describa cómo respondió la persona.'}
function dictionaryCard(rows){const types=Object.keys(typeGuidance);return `<div class="card"><h2>Diccionario de preguntas</h2><p>Revisá el tipo detectado: esta decisión define cómo se procesa, grafica y exporta cada respuesta.</p><details><summary>Cómo elegir correctamente el tipo de pregunta</summary><div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Cuándo usarlo</th></tr></thead><tbody>${types.map(type=>`<tr><td><b>${esc(type)}</b></td><td>${esc(typeHelp(type))}</td></tr>`).join('')}</tbody></table></div><div class="alert"><b>Diferencia clave:</b> selección múltiple significa que una persona eligió varias opciones; ranking significa que además les asignó un orden. Una opinión escrita o una marca tipeada manualmente es texto libre.</div></details><div class="table-wrap"><table><thead><tr><th>Incluir</th><th>Pregunta</th><th>Clasificación</th><th>Qué hará el sistema</th><th>Respuestas</th><th>Valores distintos</th></tr></thead><tbody>${rows.map((r,i)=>{const detected=r.tipo_detectado||r.tipo,mismatch=detected!==r.tipo;return `<tr><td><input type="checkbox" class="dic-inc" data-i="${i}" ${r.incluir?'checked':''}></td><td>${esc(r.pregunta)}</td><td><select class="dic-type" data-i="${i}" data-detected="${esc(detected)}">${types.map(x=>`<option value="${esc(x)}" ${x===r.tipo?'selected':''}>${esc(x)}</option>`).join('')}</select>${mismatch?`<small class="muted">Sugerencia automática: <b>${esc(detected)}</b></small>`:''}</td><td class="dic-help" data-help-i="${i}">${esc(typeHelp(r.tipo))}</td><td>${r.respuestas}</td><td>${r.valores_unicos}</td></tr>`}).join('')}</tbody></table></div><div class="actions"><button class="secondary" id="applyDetectedTypes">Aplicar sugerencias automáticas</button><button class="primary" id="saveDic">Guardar diccionario</button><span class="muted">El tipo decide el tratamiento. Los resultados anteriores se conservan si luego volvés al tipo previo.</span></div></div>`}
document.addEventListener('change',e=>{if(e.target.classList.contains('dic-type')){let help=document.querySelector(`[data-help-i="${e.target.dataset.i}"]`);if(help)help.textContent=typeHelp(e.target.value);markSaving(true)}if(e.target.classList.contains('dic-inc'))markSaving(true)})
document.addEventListener('click',e=>{if(e.target.id==='applyDetectedTypes'){document.querySelectorAll('.dic-type').forEach(select=>{select.value=select.dataset.detected;select.dispatchEvent(new Event('change',{bubbles:true}))});toast('Sugerencias aplicadas. Revisalas y tocá Guardar diccionario.')}})
document.addEventListener('click',e=>{if(e.target.id==='saveDic'){let rows=structuredClone(S.source.dictionary);document.querySelectorAll('.dic-inc').forEach(x=>rows[+x.dataset.i].incluir=x.checked);document.querySelectorAll('.dic-type').forEach(x=>rows[+x.dataset.i].tipo=x.value);saveFields({dictionary:rows}).then(async()=>{S.source.dictionary=rows;await refreshWorkflow();render();toast('Diccionario guardado. Las preguntas incluidas se procesarán según el tipo elegido; no se borraron resultados anteriores.')}).catch(err=>toast(err.message,true))}})
async function ensureQuotaOptions(){if(!S.quotaOptions)S.quotaOptions=await api(`/api/project/${S.project.id}/quota-options`)}
async function quotasView(){if(!S.source){$('#content').innerHTML='<div class="alert">Primero conectá una fuente en el paso anterior.</div>';return}await ensureQuotaOptions();let p=S.project,q=p.quota_settings||{},dims=q.dimensions||[],mode=q.input_mode||'Cantidades',total=q.target_total||386;$('#content').innerHTML=`<div class="card"><h2>Configuración de cuotas</h2><div class="grid three"><div class="field"><label>Total de la muestra</label><input id="qTotal" type="number" min="1" value="${total}"></div><div class="field"><label>Forma de carga</label><select id="qMode"><option ${mode==='Cantidades'?'selected':''}>Cantidades</option><option ${mode==='Porcentajes'?'selected':''}>Porcentajes</option></select></div><div class="field"><label>Variables de cuota</label><select id="qDimAdd"><option value="">Agregar variable…</option>${Object.keys(S.quotaOptions).filter(x=>!dims.includes(x)).map(x=>`<option>${esc(x)}</option>`).join('')}</select></div></div><div id="dimList" class="checklist">${dims.map((d,i)=>`<span class="check">${i+1}. ${esc(d)} <button data-remove-dim="${esc(d)}">×</button></span>`).join('')}</div><div class="actions"><button class="secondary" id="generateQuota">Generar combinaciones desde respuestas</button><button class="primary" id="saveQuota">Guardar cuotas</button><span class="muted">Los cambios no se guardan hasta tocar Guardar cuotas.</span></div><div id="quotaMetrics"></div></div><div class="card"><h2>Tabla de distribución</h2><p>Podés escribir, pegar bloques desde Excel o agregar y eliminar combinaciones.</p><div class="actions"><button class="secondary" id="addQuotaRow">＋ Agregar fila</button></div><div id="quotaTable"></div></div>`;renderQuotaTable(dims,mode);$('#qTotal').oninput=()=>{S.project.quota_settings={...q,input_mode:$('#qMode').value,target_total:+$('#qTotal').value};S.quotaDirty=true;markSaving(true);shell()};$('#qDimAdd').onchange=e=>{if(!e.target.value)return;q.dimensions=[...dims,e.target.value];S.project.quota_settings={...q,input_mode:$('#qMode').value,target_total:+$('#qTotal').value};S.quotaDraft=[];S.quotaDirty=true;markSaving(true);render()};document.querySelectorAll('[data-remove-dim]').forEach(b=>b.onclick=()=>{q.dimensions=dims.filter(x=>x!==b.dataset.removeDim);S.project.quota_settings=q;S.quotaDraft=[];S.quotaDirty=true;render()});$('#qMode').onchange=()=>{S.project.quota_settings={...q,input_mode:$('#qMode').value,target_total:+$('#qTotal').value};S.quotaDraft=[];S.quotaDirty=true;render()};$('#generateQuota').onclick=async()=>{try{let settings=currentQuotaSettings();S.quotaDraft=await api(`/api/project/${p.id}/quota-template`,{method:'POST',body:JSON.stringify(settings)});S.quotaDirty=true;markSaving(true);renderQuotaTable(settings.dimensions,settings.input_mode)}catch(e){toast(e.message,true)}};$('#addQuotaRow').onclick=()=>{let row={};dims.forEach(d=>row[d]='');row[mode==='Cantidades'?'cantidad':'porcentaje']=0;S.quotaDraft.push(row);S.quotaDirty=true;renderQuotaTable(dims,mode)};$('#saveQuota').onclick=saveQuotas}
function currentQuotaSettings(){return{dimensions:S.project.quota_settings?.dimensions||[],sort_dimensions:S.project.quota_settings?.dimensions||[],input_mode:$('#qMode')?.value||S.project.quota_settings?.input_mode||'Cantidades',target_total:+($('#qTotal')?.value||S.project.quota_settings?.target_total||386)}}
function renderQuotaTable(dims,mode){let box=$('#quotaTable');if(!box)return;let key=mode==='Cantidades'?'cantidad':'porcentaje',cols=[...dims,key];box.innerHTML=`<div class="table-wrap"><table><thead><tr>${dims.map(x=>`<th>${esc(x)}</th>`).join('')}<th>${key}</th><th></th></tr></thead><tbody>${S.quotaDraft.map((r,i)=>`<tr>${dims.map(d=>`<td><select data-qr="${i}" data-qc="${esc(d)}"><option value="">—</option>${(S.quotaOptions[d]||[]).map(x=>`<option ${String(x)===String(r[d])?'selected':''}>${esc(x)}</option>`).join('')}</select></td>`).join('')}<td><input type="number" step="${key==='porcentaje'?'.01':'1'}" value="${r[key]??0}" data-qr="${i}" data-qc="${key}"></td><td><button class="secondary" data-del="${i}">×</button></td></tr>`).join('')}</tbody></table></div>`;box.querySelectorAll('[data-qc]').forEach(x=>{x.onchange=()=>{S.quotaDraft[+x.dataset.qr][x.dataset.qc]=x.type==='number'?+x.value:x.value;S.quotaDirty=true;markSaving(true);shell()};x.onpaste=e=>{let text=e.clipboardData.getData('text');if(!text.includes('\t')&&!text.includes('\n'))return;e.preventDefault();let matrix=text.trim().split(/\r?\n/).map(r=>r.split('\t')),startRow=+x.dataset.qr,startCol=cols.indexOf(x.dataset.qc);matrix.forEach((values,ri)=>{let rowIndex=startRow+ri;while(S.quotaDraft.length<=rowIndex){let empty={};dims.forEach(d=>empty[d]='');empty[key]=0;S.quotaDraft.push(empty)}values.forEach((value,ci)=>{let col=cols[startCol+ci];if(col)S.quotaDraft[rowIndex][col]=col===key?+(value.replace(',','.')):value.trim()})});S.quotaDirty=true;markSaving(true);renderQuotaTable(dims,mode)}});box.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>{S.quotaDraft.splice(+x.dataset.del,1);S.quotaDirty=true;renderQuotaTable(dims,mode)})}
const renderQuotaTableBase=renderQuotaTable;
function sortQuotaDraft(dims){S.quotaDraft.sort((a,b)=>{for(const d of dims){const compared=String(a[d]??'').localeCompare(String(b[d]??''),'es',{numeric:true,sensitivity:'base'});if(compared)return compared}return 0})}
function renderDimensionPriority(dims){const box=$('#dimList');if(!box)return;box.innerHTML=dims.map((d,i)=>`<span class="check"><b>${i+1}.</b> ${esc(d)} <button class="secondary" data-dim-up="${i}" ${i===0?'disabled':''}>↑</button> <button class="secondary" data-dim-down="${i}" ${i===dims.length-1?'disabled':''}>↓</button> <button class="secondary" data-remove-dim="${esc(d)}">×</button></span>`).join('');box.querySelectorAll('[data-dim-up],[data-dim-down]').forEach(button=>button.onclick=()=>{const from=+(button.dataset.dimUp??button.dataset.dimDown),delta=button.hasAttribute('data-dim-up')?-1:1,next=[...dims],[moved]=next.splice(from,1);next.splice(from+delta,0,moved);S.project.quota_settings={...(S.project.quota_settings||{}),dimensions:next,sort_dimensions:next};sortQuotaDraft(next);S.quotaDirty=true;markSaving(true);render()});box.querySelectorAll('[data-remove-dim]').forEach(button=>button.onclick=()=>{const next=dims.filter(x=>x!==button.dataset.removeDim);S.project.quota_settings={...(S.project.quota_settings||{}),dimensions:next,sort_dimensions:next};S.quotaDraft=[];S.quotaDirty=true;markSaving(true);render()})}
function renderQuotaBulkPaste(dims,mode){if($('#quotaBulkPaste'))return;const tableBox=$('#quotaTable');if(!tableBox)return;const key=mode==='Cantidades'?'cantidad':'porcentaje',headers=[...dims,key];tableBox.insertAdjacentHTML('beforebegin',`<div id="quotaBulkPaste" class="alert"><h3 style="margin-top:0">Pegado masivo desde Excel</h3><p>Copiá las columnas en este orden: <b>${headers.map(esc).join(' · ')}</b>. Podés incluir o no los encabezados.</p><textarea id="quotaPasteArea" style="width:100%;min-height:140px;white-space:pre" placeholder="${esc(headers.join('\t'))}"></textarea><div class="actions"><button class="secondary" id="copyQuotaHeaders">Copiar encabezados</button><button class="primary" id="applyQuotaPaste">Pegar y reemplazar toda la tabla</button></div><small>Las filas vacías se ignoran. La última columna debe contener números. Nada se guarda hasta tocar Guardar cuotas.</small></div>`);$('#copyQuotaHeaders').onclick=async()=>{const text=headers.join('\t');try{await navigator.clipboard.writeText(text);toast('Encabezados copiados')}catch{$('#quotaPasteArea').value=text;$('#quotaPasteArea').select()}};$('#applyQuotaPaste').onclick=()=>{try{const raw=$('#quotaPasteArea').value;if(!raw.trim())throw Error('Pegá primero las filas copiadas desde Excel.');let matrix=raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(line=>line.trim()).map(line=>line.split('\t'));const canon=x=>String(x??'').trim().toLocaleLowerCase('es');if(matrix.length&&matrix[0].length===headers.length&&matrix[0].every((value,i)=>canon(value)===canon(headers[i])))matrix.shift();const rows=[],seen=new Set();matrix.forEach((values,index)=>{if(values.length!==headers.length)throw Error(`Fila ${index+1}: se esperaban ${headers.length} columnas y llegaron ${values.length}.`);const row={};dims.forEach((d,i)=>{row[d]=values[i].trim();if(!row[d])throw Error(`Fila ${index+1}: ${d} está vacío.`);S.quotaOptions[d]=S.quotaOptions[d]||[];if(!S.quotaOptions[d].includes(row[d]))S.quotaOptions[d].push(row[d])});const number=Number(values.at(-1).trim().replace(',','.'));if(!Number.isFinite(number)||number<0||key==='cantidad'&&!Number.isInteger(number))throw Error(`Fila ${index+1}: ${key} debe ser un número ${key==='cantidad'?'entero ':''}mayor o igual a cero.`);row[key]=number;const signature=dims.map(d=>row[d]).join('\u001f');if(seen.has(signature))throw Error(`Fila ${index+1}: la combinación está duplicada.`);seen.add(signature);rows.push(row)});if(!rows.length)throw Error('No se encontraron filas de cuotas.');S.quotaDraft=rows;sortQuotaDraft(dims);S.quotaDirty=true;markSaving(true);renderQuotaTable(dims,mode);toast(`${rows.length} cuotas pegadas. Revisalas y tocá Guardar cuotas.`)}catch(e){toast(e.message,true)}}}
function quotaPasteNorm(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim()}
function quotaRegionKey(value){return quotaPasteNorm(value).split(' ').filter(word=>word&&word!=='zona'&&word!=='region').map(word=>word.length>5?word.replace(/(?:os|as|o|a)$/,''):word).join(' ')}
function quotaDimensionRole(dimension){const value=quotaPasteNorm(dimension),options=(S.quotaOptions?.[dimension]||[]).map(quotaPasteNorm);if(value.includes('region')||value.includes('zona'))return'region';if(value.includes('genero')||value.includes('sexo'))return'gender';if(value.includes('edad')||value.includes('etario'))return'age';if(options.some(x=>['mujer','hombre','femenino','masculino'].includes(x)))return'gender';if(options.length&&options.filter(x=>(x.match(/\d+/g)||[]).length>=1||x.includes('mas')).length/options.length>=.6)return'age';return''}
function quotaOptionMatch(dimension,raw,role,strict=false){const options=S.quotaOptions?.[dimension]||[],wanted=quotaPasteNorm(raw);let match=options.find(value=>quotaPasteNorm(value)===wanted);if(match!==undefined)return match;if(role==='region'){const regionKey=quotaRegionKey(raw),matches=options.filter(value=>quotaRegionKey(value)===regionKey);if(matches.length===1)return matches[0];if(matches.length>1)throw Error(`“${raw}” coincide con más de una región de la fuente: ${matches.join(', ')}.`)}if(role==='gender'){const aliases=wanted==='h'?['hombre','masculino','h']:wanted==='m'?['mujer','femenino','m']:[];match=options.find(value=>aliases.includes(quotaPasteNorm(value)));if(match!==undefined)return match}if(role==='age'){const numbers=wanted.match(/\d+/g)||[],isOlder=wanted.includes('mas');match=options.find(value=>{const candidate=quotaPasteNorm(value),candidateNumbers=candidate.match(/\d+/g)||[];return numbers.join('|')===candidateNumbers.join('|')&&isOlder===candidate.includes('mas')});if(match!==undefined)return match}if(strict)throw Error(`No se pudo relacionar “${raw}” con los valores reales de ${dimension}: ${options.join(', ')||'sin valores'}.`);return raw.trim()}
function quotaDimensionRoles(dims){const roles={},ambiguous=[];for(const dimension of dims){const role=quotaDimensionRole(dimension);if(!role)continue;if(roles[role])ambiguous.push(role);else roles[role]=dimension}const remaining=dims.filter(d=>!Object.values(roles).includes(d));if(!roles.region&&remaining.length===1)roles.region=remaining[0];if(ambiguous.length)throw Error(`No se pudo decidir qué columnas representan ${[...new Set(ambiguous)].join(', ')}. Renombrá esas variables para incluir Región/Zona, Género/Sexo o Edad/Rango etario.`);if(!roles.region||!roles.gender||!roles.age)throw Error('La importación estructurada requiere variables de cuota para región/zona, género/sexo y edad/rango etario.');return roles}
function tryStructuredQuotaPaste(raw,dims){
 const parsed=globalThis.QuotaImport?.parse(raw);if(!parsed)return false;
 const roles=quotaDimensionRoles(dims),rows=[],seen=new Set();
 parsed.rows.forEach((item,index)=>{const row={};row[roles.region]=quotaOptionMatch(roles.region,item.region,'region',true);row[roles.gender]=quotaOptionMatch(roles.gender,item.gender,'gender',true);row[roles.age]=quotaOptionMatch(roles.age,item.age,'age',true);for(const d of dims)if(!(d in row))throw Error(`No se pudo completar la variable ${d}.`);row.cantidad=item.cases;if(item.universe!==null)row.universo=item.universe;if(item.percentage!==null)row.porcentaje_poblacion=item.percentage;const signature=dims.map(d=>row[d]).join('\u001f');if(seen.has(signature))throw Error(`La combinación ${item.region} / ${item.gender} / ${item.age} está duplicada.`);seen.add(signature);rows.push(row)});
 if(!rows.length)return false;const total=rows.reduce((sum,row)=>sum+row.cantidad,0);S.quotaDraft=rows;sortQuotaDraft(dims);S.project.quota_settings={...(S.project.quota_settings||{}),dimensions:dims,sort_dimensions:dims,input_mode:'Cantidades',target_total:total};if($('#qMode'))$('#qMode').value='Cantidades';if($('#qTotal'))$('#qTotal').value=total;S.quotaDirty=true;markSaving(true);renderQuotaTable(dims,'Cantidades');toast(`${rows.length} cuotas importadas desde formato ${parsed.format==='horizontal'?'horizontal':'vertical'} · ${total} casos. Universo y porcentaje también quedaron guardados.`);return true
}
function tryProjectedQuotaPaste(raw,dims,mode){if(!quotaPasteNorm(raw).includes('casos proyectados'))return false;const roles={},ambiguous=[];for(const dimension of dims){const role=quotaDimensionRole(dimension);if(!role)continue;if(roles[role])ambiguous.push(role);else roles[role]=dimension}const remaining=dims.filter(d=>!Object.values(roles).includes(d));if(!roles.region&&remaining.length===1)roles.region=remaining[0];if(ambiguous.length)throw Error(`No se pudo decidir qué columnas representan ${[...new Set(ambiguous)].join(', ')}. Renombrá esas variables para incluir Región/Zona, Género/Sexo o Edad/Rango etario.`);if(!roles.region||!roles.gender||!roles.age)throw Error('Este formato agrupado requiere variables de cuota para región/zona, género/sexo y edad/rango etario. El sistema intentó reconocerlas por nombre y por sus valores, pero la relación no fue inequívoca.');const key=mode==='Cantidades'?'cantidad':'porcentaje',lines=raw.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(line=>line.trim()),rows=[],seen=new Set();let region='';lines.forEach((line,index)=>{const cells=line.split('\t').map(x=>x.trim());if(cells.length!==2)throw Error(`Fila ${index+1}: se esperaban 2 columnas.`);if(quotaPasteNorm(cells[1])==='casos proyectados'){region=quotaOptionMatch(roles.region,cells[0],'region',true);return}if(!region)throw Error(`Fila ${index+1}: falta el encabezado de región antes de los casos.`);const detail=cells[0].match(/^([HM])\s+(.+)$/i);if(!detail)throw Error(`Fila ${index+1}: usá H o M seguido del rango etario.`);const amount=Number(cells[1].replace(',','.'));if(!Number.isFinite(amount)||amount<0||key==='cantidad'&&!Number.isInteger(amount))throw Error(`Fila ${index+1}: la cantidad debe ser un entero mayor o igual a cero.`);const row={};row[roles.region]=region;row[roles.gender]=quotaOptionMatch(roles.gender,detail[1].toUpperCase(),'gender',true);row[roles.age]=quotaOptionMatch(roles.age,detail[2],'age',true);for(const d of dims)if(!(d in row))throw Error(`No se pudo completar la variable ${d} desde el formato agrupado.`);row[key]=amount;const signature=dims.map(d=>row[d]).join('\u001f');if(seen.has(signature))throw Error(`Fila ${index+1}: la combinación está duplicada.`);seen.add(signature);rows.push(row)});if(!rows.length)throw Error('No se encontraron casos debajo de los encabezados regionales.');S.quotaDraft=rows;sortQuotaDraft(dims);S.quotaDirty=true;markSaving(true);renderQuotaTable(dims,mode);const total=rows.reduce((sum,row)=>sum+row[key],0);toast(`${rows.length} cuotas importadas · suma ${total}. Revisalas y tocá Guardar cuotas.`);return true}
document.addEventListener('click',e=>{if(e.target.id!=='applyQuotaPaste')return;const raw=$('#quotaPasteArea')?.value||'',dims=S.project.quota_settings?.dimensions||[],mode=$('#qMode')?.value||S.project.quota_settings?.input_mode||'Cantidades';try{if(tryStructuredQuotaPaste(raw,dims)||tryProjectedQuotaPaste(raw,dims,mode)){e.preventDefault();e.stopImmediatePropagation()}}catch(error){e.preventDefault();e.stopImmediatePropagation();toast(error.message,true)}},true)
renderQuotaTable=(dims,mode)=>{sortQuotaDraft(dims);renderDimensionPriority(dims);renderQuotaBulkPaste(dims,mode);const bulk=$('#quotaBulkPaste');if(bulk&&!bulk.dataset.groupedHelp){bulk.dataset.groupedHelp='1';bulk.insertAdjacentHTML('beforeend','<p class="muted"><b>Formatos reconocidos automáticamente:</b> tabla vertical Región / P.O. / Cuota-P.O. / Casos proyectados; minitablas horizontales por región con filas Universo / Cuota-PO / Casos; y el formato simple Región + CASOS PROYECTADOS. H se interpreta como Hombre y M como Mujer. El objetivo siempre se toma de Casos y la suma completa automáticamente el total de muestra.</p>')}renderQuotaTableBase(dims,mode);shell()};
async function saveQuotas(){
 const button=$('#saveQuota'),originalLabel=button?.textContent||'Guardar cuotas';
 try{
  if(button){button.disabled=true;button.textContent='Guardando…'}
  let cfg=currentQuotaSettings(),body={...cfg,rows:S.quotaDraft};
  let status=await api(`/api/project/${S.project.id}/save-quotas`,{method:'POST',body:JSON.stringify(body)});
  S.project=await api('/api/project/'+S.project.id);
  S.quotaDraft=structuredClone(S.project.quota_rows||[]);
  S.quotaDirty=false;
  markSaving(false);
  shell();
  showQuotaMetrics(status,true);
  toast('Cuotas guardadas. Ya podés continuar a Balanceo.');
 }catch(e){
  toast(e.message,true);
 }finally{
  if(button&&button.isConnected){button.disabled=false;button.textContent=originalLabel}
 }
}
function showQuotaMetrics(s,saved=false){
 let x=$('#quotaMetrics');if(!x)return;
 x.innerHTML=`<div class="metrics"><div class="metric"><small>Objetivo</small><strong>${s.total}</strong></div><div class="metric ok"><small>Utilizables</small><strong>${s.available}</strong></div><div class="metric bad"><small>Faltantes</small><strong>${s.missing}</strong></div><div class="metric"><small>A descartar</small><strong>${s.discard}</strong></div></div>${saved?'<div class="alert success"><b>Cuotas guardadas correctamente.</b> No necesitás volver a guardarlas.<div class="actions"><button class="primary" id="continueBalance">Continuar a Balanceo →</button></div></div>':''}`;
 if(saved&&$('#continueBalance'))$('#continueBalance').onclick=async()=>{S.step=3;render();await cloudCheckpoint('cuotas completadas',true)};
}
async function balanceView(){let q=S.project.quota_settings||{};if(!S.project.quota_rows?.length){$('#content').innerHTML='<div class="alert">Primero guardá una distribución válida en Cuotas.</div>';return}let status;try{status=await api(`/api/project/${S.project.id}/quota-status`,{method:'POST',body:JSON.stringify({...q,rows:S.project.quota_rows})})}catch(e){$('#content').innerHTML=`<div class="alert">${esc(e.message)}</div>`;return}let exact=status.rows.filter(x=>x.disponibles===x.objetivo).length,excess=status.rows.filter(x=>x.excedentes>0).length,missing=status.rows.filter(x=>x.faltantes>0).length;$('#content').innerHTML=`<div class="card"><h2>Disponibilidad por cuota</h2><p>El cumplimiento de cada fila se expresa como porcentaje del total de la muestra.</p><div id="quotaMetrics"></div><div class="grid three" style="margin:14px 0"><div class="field"><label>Mostrar cuotas</label><select id="balanceFilter"><option value="all">Todas (${status.rows.length})</option><option value="complete">Completas exactas (${exact})</option><option value="excess">Con excedente (${excess})</option><option value="missing">Faltantes (${missing})</option></select></div></div><div id="balanceRows"></div></div><div class="card"><h2>Sorteo reproducible</h2><p>La semilla permite repetir exactamente la misma selección. La fuente original nunca se modifica.</p><div class="grid"><div class="field"><label>Semilla aleatoria</label><input id="seed" type="number" value="${S.project.sample_seed||2026}"></div></div><div class="actions"><button class="primary" id="balance" ${status.missing?'disabled':''}>Sortear y guardar muestra</button></div>${S.project.sample_response_ids?.length?`<div class="alert success"><b>Muestra guardada:</b> ${S.project.sample_response_ids.length} respuestas. No necesitás volver a sortearla.<div class="actions"><button class="primary" id="continueText">Continuar a Texto libre →</button></div></div>`:''}</div>`;showQuotaMetrics(status);renderBalanceRows(status.rows,'all');$('#balanceFilter').onchange=e=>renderBalanceRows(status.rows,e.target.value);if($('#continueText'))$('#continueText').onclick=async()=>{S.step=4;render();await cloudCheckpoint('balanceo completado',true)};$('#balance').onclick=async()=>{try{let r=await api(`/api/project/${S.project.id}/balance`,{method:'POST',body:JSON.stringify({seed:+$('#seed').value})});S.project=await api('/api/project/'+S.project.id);await refreshWorkflow();shell();toast(`Muestra guardada: ${r.selected} incluidas, ${r.discarded} descartadas`);render()}catch(e){toast(e.message,true)}}}
function renderBalanceRows(rows,filter){let filtered=rows.filter(x=>filter==='all'||filter==='complete'&&x.disponibles===x.objetivo||filter==='excess'&&x.excedentes>0||filter==='missing'&&x.faltantes>0),box=$('#balanceRows');box.innerHTML=`<p class="muted">Mostrando ${filtered.length} de ${rows.length} cuotas.</p>${filtered.length?table(filtered):'<div class="alert success">No hay cuotas en esta categoría.</div>'}`}
function table(rows,editable=false){if(!rows?.length)return'<div class="muted">Sin datos.</div>';let cols=[...new Set(rows.flatMap(Object.keys))];return`<div class="table-wrap"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c]??'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}
function textView(){if(!S.project.sample_response_ids?.length){$('#content').innerHTML='<div class="alert">Primero guardá una muestra balanceada.</div>';return}let questions=(S.project.dictionary||[]).filter(x=>x.incluir&&x.tipo==='texto libre').map(x=>x.pregunta),first=questions[0]||'',savedMode=S.project.text_processing_modes?.[first]||'semantic',savedCount=S.project.text_category_counts?.[first]||'';$('#content').innerHTML=`<div class="card"><h2>Preguntas abiertas</h2><div class="grid three"><div class="field"><label>Pregunta a procesar</label><select id="textQ">${questions.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Tipo de interpretación</label><select id="textMode"><option value="semantic" ${savedMode==='semantic'?'selected':''}>Segmentación temática</option><option value="brands" ${savedMode==='brands'?'selected':''}>Normalización de marcas</option></select></div><div class="field" id="categoryCountField"><label>Cantidad de categorías</label><input id="categoryCount" type="number" min="2" value="${esc(savedCount)}" placeholder="Vacío = libre"><small class="muted">Dejalo vacío para que Ollama elija la cantidad.</small></div></div><div id="modeHelp" class="alert"></div><div class="grid three"><div class="field"><label>Tamaño del lote</label><input id="batch" type="number" value="25" min="1" max="100"></div><div class="field"><label>Modelo Ollama</label><input id="ollamaModel" value="${esc(S.project.ollama?.model||'qwen2.5:3b')}"></div><div class="field"><label>Servidor</label><input id="ollamaUrl" value="${esc(S.project.ollama?.url||'https://annie-ollama.6nmbll.easypanel.host')}"></div><div class="field"><label>Usuario</label><input id="ollamaUser" value="${esc(S.project.ollama?.username||'survey_app')}"></div><div class="field"><label>Contraseña</label><input id="ollamaPass" type="password" value="${esc(S.project.ollama?.password||'')}" placeholder="Configurada por defecto"></div></div><div class="actions"><button class="primary" id="processText" ${questions.length?'':'disabled'}>Procesar siguiente lote</button><button class="secondary" id="loadReview" ${questions.length?'':'disabled'}>Revisar clasificaciones</button></div><div id="review"></div></div>`;let updateHelp=()=>{let brands=$('#textMode').value==='brands';$('#modeHelp').textContent=brands?'Agrupa errores, variantes fonéticas y modelos bajo la marca oficial. Ejemplos: jiundai → Hyundai; Corolla → Toyota.':'Interpreta el significado completo. La cantidad de categorías puede ser libre o fijada manualmente.';$('#categoryCountField').style.display=brands?'none':'flex'};updateHelp();$('#textMode').onchange=updateHelp;$('#textQ').onchange=()=>{let q=$('#textQ').value;$('#textMode').value=S.project.text_processing_modes?.[q]||'semantic';$('#categoryCount').value=S.project.text_category_counts?.[q]||'';updateHelp()};$('#processText').onclick=async()=>{try{await saveFields({ollama:{url:$('#ollamaUrl').value,model:$('#ollamaModel').value,username:$('#ollamaUser').value,password:$('#ollamaPass').value}});toast('Procesando lote…');let r=await api(`/api/project/${S.project.id}/process-text`,{method:'POST',body:JSON.stringify({question:$('#textQ').value,batch_size:+$('#batch').value,mode:$('#textMode').value,category_count:$('#textMode').value==='semantic'?$('#categoryCount').value:''})});S.project=await api('/api/project/'+S.project.id);toast(`Procesadas ${r.processed}; pendientes ${r.remaining}`);loadReview()}catch(e){toast(e.message,true)}};$('#loadReview').onclick=loadReview}
function textViewEnhanced(){
  if(!S.project.sample_response_ids?.length){$('#content').innerHTML='<div class="alert">Primero guardá una muestra balanceada.</div>';return}
  const all=(S.project.dictionary||[]).filter(x=>x.incluir&&x.tipo==='texto libre').map(x=>x.pregunta);
  const chosen=S.project.selected_text_questions||[];
  S.textCandidates=all;
  $('#content').innerHTML=`<div class="card"><h2>Preguntas a procesar</h2>
    <p>Marcá las preguntas. La cola completa todos los lotes de una pregunta antes de pasar a la siguiente, en el orden de esta tabla.</p>
    <p class="muted">Instrucciones: escribí tu criterio en lenguaje natural. El sistema lo integra al prompt y agrega el formato JSON. Las correcciones de marcas guardadas sirven de referencia para próximos lotes de este proyecto.</p>
    <div class="actions"><label class="check" style="background:#e7f6f7;border-color:#87d4d8"><input type="checkbox" id="selectAllText"> <b>Incluir todas las preguntas</b></label><span id="textSelectionCount" class="muted"></span></div>
    <div class="table-wrap"><table><thead><tr><th>Incluir</th><th>Pregunta</th><th>Interpretación</th><th>Categorías (vacío = libre)</th><th>Instrucciones para Gemini</th></tr></thead><tbody>
    ${all.map((q,i)=>{const cfg=S.project.text_question_settings?.[q]||{mode:S.project.text_processing_modes?.[q]||'semantic',category_count:S.project.text_category_counts?.[q]};
      return `<tr><td><input type="checkbox" data-tselect="${i}" ${chosen.includes(q)?'checked':''}></td><td>${i+1}. ${esc(q)}</td>
      <td><select data-tmode="${i}"><option value="semantic" ${cfg.mode==='semantic'?'selected':''}>Categorías temáticas</option><option value="brands" ${cfg.mode==='brands'?'selected':''}>Normalizar marcas</option></select></td>
      <td><input type="number" min="2" data-tcount="${i}" value="${esc(cfg.category_count||'')}" placeholder="Libre"></td><td><textarea data-tprompt="${i}" placeholder="Ej.: Devolver solo marcas de autos, nunca modelos.">${esc(cfg.instructions||'')}</textarea></td></tr>`}).join('')}</tbody></table></div></div>
    <div class="card"><h2>Procesamiento y resultados</h2><div class="field"><label>Pregunta para ver resultados o procesar un lote</label><select id="textQ"></select></div>
    <div class="grid three"><div class="field"><label>Tamaño del lote</label><input id="batch" type="number" value="10" min="1" max="100"></div>
    <div class="field"><label>Modelo Gemini</label><input id="geminiModel" value="${esc(S.project.ai?.model||'gemini-2.5-flash')}"></div>
    <div class="field"><label>Máximo de tokens de salida</label><input id="geminiMaxTokens" type="number" min="1024" max="65536" value="${esc(S.project.ai?.max_output_tokens||8192)}"></div></div>
    <p class="muted">Un solo clic procesa todos los pendientes en lotes automáticos, sin pedir confirmación entre lotes. Podés revisar y guardar correcciones mientras continúa. Mantené el servidor encendido.</p>
    <div class="actions"><button id="processText" class="primary">Procesar pregunta seleccionada</button><button id="processAllText" class="primary">Procesar todas las preguntas</button><button id="openManual" class="secondary">Ingresar manualmente las equivalencias</button></div>
    <div id="connectionResult"></div><div id="jobProgress" aria-live="polite"></div><div id="batchHistory"></div>
    <div id="review"></div><div id="manualWorkspace" hidden><div id="externalReview"></div></div></div>`;
  document.querySelectorAll('[data-tselect]').forEach(x=>x.onchange=syncTextSelection);
  $('#selectAllText').onchange=e=>{document.querySelectorAll('[data-tselect]').forEach(x=>x.checked=e.target.checked);syncTextSelection()};
  $('#textQ').onchange=async()=>{await loadReview();if(!$('#manualWorkspace').hidden)await openExternalReview()};
  $('#processText').onclick=()=>startTextProcessing(false);
  $('#processAllText').onclick=()=>startTextProcessing(true);
  $('#openManual').onclick=async()=>{try{await saveTextSelection();$('#manualWorkspace').hidden=false;await openExternalReview();await loadReview();$('#manualWorkspace').scrollIntoView({behavior:'smooth',block:'start'})}catch(e){toast(e.message,true)}};
  syncTextSelection();
  resumeTextJob();
  loadReview();
}
textView=textViewEnhanced;

async function openExternalReview(){
  const pid=S.project.id,q=$('#textQ').value;
  if(!q){toast('Elegí una pregunta de texto libre.',true);return}
  try{
    const result=await api('/api/project/'+pid+'/external-review?question='+encodeURIComponent(q));
    if(S.project.id!==pid||!$('#externalReview'))return;
    const originalTsv=['ID de respuesta\tRespuesta original',...result.rows.map(r=>String(r.id)+'\t'+String(r.original??'').replace(/[\r\n]+/g,' '))].join('\n');
    $('#externalReview').innerHTML='<div class="card"><h2>Equivalencias manuales por ID: '+esc(q)+'</h2><p>'+result.rows.length+' encuestados de la muestra balanceada. El ID permite aplicar cada corrección a la persona correcta dentro de la base total.</p>'+
      '<label><b>1. Respuestas para copiar</b> · dos columnas: ID de respuesta y respuesta original</label><textarea id="externalTable" readonly style="width:100%;height:260px;white-space:pre;overflow:auto">'+esc(originalTsv)+'</textarea>'+
      '<div class="actions"><button id="copyExternalTable" class="secondary">Copiar ID + respuesta</button></div>'+
      '<label><b>2. Respuestas procesadas manualmente</b> · tres columnas: ID de respuesta, respuesta original y respuesta nueva</label><p class="muted">Pegá desde Excel, Google Sheets, ChatGPT, Claude o Gemini. Podés incluir los encabezados y podés pegar todas las filas o sólo las modificadas.</p><textarea id="externalPaste" style="width:100%;height:260px;white-space:pre;overflow:auto" placeholder="40797&#9;SUV.&#9;SUV.\n40802&#9;Chebroleth&#9;Chevrolet"></textarea>'+
      '<button id="externalPreview" class="secondary">Comparar cambios</button><div id="externalDiff"></div><button id="externalApply" class="primary" disabled>Confirmar y guardar correcciones por ID</button></div>';
    let preview=null,pasted='';
    const copy=async selector=>{const input=$(selector);try{await navigator.clipboard.writeText(input.value);toast('Copiado')}catch{input.focus();input.select();toast('Texto seleccionado: presioná Ctrl+C')}};
    $('#copyExternalTable').onclick=()=>copy('#externalTable');
    $('#externalPaste').oninput=()=>{preview=null;$('#externalApply').disabled=true};
    $('#externalPreview').onclick=async()=>{try{
      const text=$('#externalPaste').value;
      const r=await api('/api/project/'+pid+'/external-preview',{method:'POST',body:JSON.stringify({question:q,tsv:text})});
      if(!$('#externalPaste')||$('#externalPaste').value!==text)return;
      preview=r;pasted=text;
      $('#externalDiff').innerHTML='<p>'+r.received+' filas recibidas · '+r.changes.length+' cambios · '+r.unchanged+' sin cambios · '+r.altered_originals+' originales modificados externamente (se conservará el original de la encuesta). Las filas omitidas se conservan.</p>'+table(r.changes);
      $('#externalApply').disabled=!r.changes.length;
    }catch(e){toast(e.message,true)}};
    $('#externalApply').onclick=async()=>{if(!preview)return;$('#externalApply').disabled=true;try{
      const r=await api('/api/project/'+pid+'/external-apply',{method:'POST',body:JSON.stringify({question:q,tsv:pasted,revision:preview.revision})});
      preview=null;toast(r.changes.length+' correcciones por ID guardadas y aprobadas.');
      S.project=await api('/api/project/'+pid);await refreshWorkflow();shell();
      $('#externalDiff').innerHTML='<div class="alert success">Guardado. Volvé a abrir esta planilla para ver la tabla actualizada. Las correcciones se usarán en la exportación.</div>';
    }catch(e){toast(e.message,true)}};
    $('#externalReview').scrollIntoView({behavior:'smooth',block:'start'});
  }catch(e){toast(e.message,true)}
}

function aiForm(){return{provider:'auto',model:$('#geminiModel').value.trim(),max_output_tokens:+$('#geminiMaxTokens').value||8192}}
function selectedTextSettings(){
  const questions=[],settings={};
  document.querySelectorAll('[data-tselect]').forEach(x=>{
    if(x.checked){const i=x.dataset.tselect,q=S.textCandidates[+i];questions.push(q);
      settings[q]={mode:document.querySelector('[data-tmode="'+i+'"]').value,category_count:document.querySelector('[data-tcount="'+i+'"]').value||null,instructions:document.querySelector('[data-tprompt="'+i+'"]').value};
    }
  });
  return{questions,settings};
}
function initialReviewQuestion(questions,classifications){
  return questions.find(q=>Object.values(classifications?.[q]||{}).some(r=>!r.approved))||questions[0]||'';
}
function syncTextSelection(){
  const current=$('#textQ').value,{questions}=selectedTextSettings();
  $('#textQ').innerHTML=questions.map(q=>'<option value="'+esc(q)+'">'+esc(q)+'</option>').join('');
  if(questions.includes(current))$('#textQ').value=current;
  else $('#textQ').value=initialReviewQuestion(questions,S.project.text_classifications);
  $('#processText').disabled=$('#processAllText').disabled=questions.length===0;
  $('#openManual').disabled=questions.length===0;
  const checks=[...document.querySelectorAll('[data-tselect]')];if($('#selectAllText')){$('#selectAllText').checked=checks.length>0&&checks.every(x=>x.checked);$('#selectAllText').indeterminate=checks.some(x=>x.checked)&&!checks.every(x=>x.checked)}
  if($('#textSelectionCount'))$('#textSelectionCount').textContent=`${questions.length} de ${checks.length} preguntas incluidas`;
  if(!questions.length&&$('#review'))$('#review').innerHTML='<div class="alert">Seleccioná al menos una pregunta arriba.</div>';
}
async function saveTextSelection(){
  const data=selectedTextSettings();
  if(!data.questions.length)throw Error('Seleccioná al menos una pregunta.');
  await api('/api/project/'+S.project.id+'/text-settings',{method:'POST',body:JSON.stringify(data)});
  S.project.selected_text_questions=data.questions;S.project.text_question_settings=data.settings;
  return data;
}
async function testGeminiConnection(){
  const button=$('#testGemini');button.disabled=true;button.textContent='Probando…';
  try{const r=await api('/api/project/'+S.project.id+'/test-ai',{method:'POST',body:JSON.stringify(aiForm())});
    $('#connectionResult').innerHTML='<div class="alert success">Conexión correcta con Gemini · '+r.latency_ms+' ms<br>Modelo: '+esc(r.model)+' · autenticación: '+esc(r.provider)+'</div>';
  }catch(e){$('#connectionResult').innerHTML='<div class="alert">'+esc(e.message)+'</div>';toast(e.message,true)}
  finally{button.disabled=false;button.textContent='Probar conexión'}
}
async function previewTextPrompt(){
  try{
    const data=selectedTextSettings();data.questions=[$('#textQ').value];data.batch_size=+$('#batch').value;
    const result=await api('/api/project/'+S.project.id+'/text-prompt',{method:'POST',body:JSON.stringify(data)});
    $('#promptNote').textContent=result.note;
    $('#promptContent').textContent=JSON.stringify(result,null,2);$('#promptPanel').open=true;
  }catch(e){toast(e.message,true)}
}
function textBusy(busy){
  ['processText','processAllText','openManual','batch','geminiModel','geminiMaxTokens','selectAllText'].forEach(id=>{if($('#'+id))$('#'+id).disabled=busy});
  document.querySelectorAll('[data-tselect],[data-tmode],[data-tcount],[data-tprompt]').forEach(x=>x.disabled=busy);
  if($('#stopText'))$('#stopText').disabled=!busy;
}
async function startTextProcessing(all){
  if(S.textStarting)return;
  S.textStarting=true;
  textBusy(true);
  try{
    const data=await saveTextSelection(),pid=S.project.id;
    data.batch_size=+$('#batch').value;data.all_batches=true;
    if(!all)data.questions=[$('#textQ').value];
    textBusy(true);
    await saveFields({ai:aiForm()});
    const job=await api('/api/project/'+pid+'/process-text',{method:'POST',body:JSON.stringify(data)});
    watchTextJob(job.id,pid);
  }catch(e){toast(e.message,true);textBusy(false)}
  finally{S.textStarting=false}
}
async function resumeTextJob(){
  try{
    const jobs=await api('/api/text-jobs');
    if(!$('#textQ'))return;
    const job=jobs.filter(j=>j.project_id===S.project.id).at(-1);
    if(job)watchTextJob(job.id,S.project.id);
  }catch(e){toast(e.message,true)}
}
async function watchTextJob(jobId,pid){
  const token={};S.textPollToken=token;let lastBatch=-1;
  try{
    while(S.textPollToken===token){
      const job=await api('/api/job/'+jobId);
      if(S.project.id!==pid||!$('#jobProgress')||S.textPollToken!==token)return;
      textBusy(job.status==='running');
      const elapsed=Math.round(Date.now()/1000-job.started_at);
      $('#jobProgress').innerHTML='<div class="job-progress"><div class="job-head"><strong>'+esc(job.phase)+'</strong><b>'+job.percent+'% guardado</b></div>'+
        '<div class="track"><div class="fill" style="width:'+job.percent+'%"></div></div>'+
        '<p>'+job.completed+' de '+job.total+' textos únicos guardados · '+job.remaining+' pendientes</p>'+
        '<p>Pregunta '+(job.question_index||0)+' de '+(job.question_count||job.questions.length)+': '+esc(job.question||'')+'</p>'+
        '<small>'+elapsed+' s transcurridos · '+(job.generated_chars||0)+' caracteres recibidos en la llamada actual. '+(job.stop_requested?'Detención solicitada.':'')+'</small>'+
        (job.error?'<div class="alert">'+esc(job.error)+'</div>':'')+
        (job.failed_questions?.length?'<details><summary>'+job.failed_questions.length+' preguntas pendientes por error (ver detalles)</summary>'+job.failed_questions.map(f=>'<h4>'+esc(f.question)+'</h4><pre style="white-space:pre-wrap">'+esc(f.details||f.error)+'</pre>').join('')+'</details>':'')+'</div>';
      if(job.prompt_messages){
        if($('#promptNote'))$('#promptNote').textContent='Última llamada real enviada: '+job.model+'. El avance cuenta resultados guardados, no tokens inferidos.';
        if($('#promptContent'))$('#promptContent').textContent=JSON.stringify({messages:job.prompt_messages,schema:job.prompt_schema,options:job.options},null,2);
      }
      if(lastBatch!==job.saved_batches){
        if(lastBatch>=0 && job.saved_batches>lastBatch)toast('Lote '+job.saved_batches+' terminado. Resultados disponibles para revisar.');
        lastBatch=job.saved_batches;
        $('#batchHistory').innerHTML='<p class="muted">Lotes procesados en esta ejecución: '+job.saved_batches+'. Revisá los pendientes en Inspección manual.</p>';
        await loadReview();
      }
      if(job.status!=='running'){
        if(job.status==='complete')toast('Procesamiento finalizado; resultados guardados.');
        if(job.status==='error')toast(job.error_details||job.error,true);
        if(job.status==='partial')toast('Finalizó con preguntas pendientes. Los resultados guardados se conservan.\n\n'+job.failed_questions.map(f=>f.question+'\n'+(f.details||f.error)).join('\n\n'),true);
        await loadReview();S.project=await api('/api/project/'+pid);await refreshWorkflow();shell();return;
      }
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
  }catch(e){toast('No se pudo consultar el progreso: '+e.message,true);textBusy(false)}
}

function reviewSlice(rows,state){
  const filtered=rows.filter(r=>state.status==='all'||(state.status==='approved'?!!r.approved:!r.approved));
  const batches=[...new Set(filtered.map(r=>String(r.batch||0)))];
  if(state.batch!=='all'&&!batches.includes(state.batch)){state.batch=batches[0]||'';state.page=1}
  const batchRows=state.batch==='all'?filtered:filtered.filter(r=>String(r.batch||0)===state.batch);
  const pages=Math.max(1,Math.ceil(batchRows.length/state.size));
  state.page=Math.max(1,Math.min(state.page,pages));
  return {batches,batchRows,pages,visible:batchRows.slice((state.page-1)*state.size,state.page*state.size)};
}
async function loadReview(){
  const pid=S.project.id,q=$('#textQ')?.value;
  if(!q||!$('#review'))return;
  const key=pid+'::'+q;
  S.reviewDrafts ||= {};S.reviewViews ||= {};
  const drafts=S.reviewDrafts[key] ||= {};
  const state=S.reviewViews[key] ||= {status:'pending',batch:'all',page:1,size:25};
  const request={};S.reviewRequest=request;
  try{
    const rows=await api('/api/project/'+pid+'/text-review?question='+encodeURIComponent(q));
    if(S.reviewRequest!==request||S.project.id!==pid||$('#textQ')?.value!==q||!$('#review'))return;
    // Filter on saved approval, so checking a box doesn't hide unsaved edits.
    const {batches,batchRows,pages,visible}=reviewSlice(rows,state);
    const active=document.activeElement;
    const focus=active?.closest('#review') && active.hasAttribute('data-seg') ?
      {answer:active.dataset.answer,start:active.selectionStart,end:active.selectionEnd}:null;
    const pending=rows.filter(r=>!r.approved).length;
    const entireBatch=rows.filter(r=>String(r.batch||0)===state.batch);
    $('#review').innerHTML='<h3>Inspección manual · '+pending+' pendientes · '+(rows.length-pending)+' aprobadas</h3>'+
      '<p class="muted">Los lotes aprobados salen de Pendientes, pero se conservan. Los cambios de todas las páginas se guardan al tocar un botón.</p>'+
      '<div class="grid three"><div class="field"><label>Mostrar</label><select id="reviewStatus">'+
      [['pending','Pendientes'],['approved','Aprobadas'],['all','Todas']].map(([v,t])=>'<option value="'+v+'" '+(state.status===v?'selected':'')+'>'+t+'</option>').join('')+
      '</select></div><div class="field"><label>Lote</label><select id="reviewBatch"><option value="all" '+(state.batch==='all'?'selected':'')+'>Todos los lotes de esta pregunta</option>'+batches.map(b=>'<option value="'+b+'" '+(state.batch===b?'selected':'')+'>'+(b==='0'?'Anterior':'Lote '+b)+'</option>').join('')+
      '</select></div><div class="field"><label>Respuestas por página</label><select id="reviewSize">'+[10,25,50,100].map(n=>'<option '+(state.size===n?'selected':'')+'>'+n+'</option>').join('')+'</select></div></div>'+
      (visible.length?'<div class="table-wrap"><table><thead><tr><th>Lote</th><th>Respuesta original</th><th>Valor normalizado</th><th>Aprobar</th></tr></thead><tbody>'+
      visible.map((r,i)=>{const v={...r,...drafts[r.respuesta]};return '<tr><td>'+esc(r.batch||'Anterior')+'</td><td>'+esc(r.respuesta)+(r.needs_review?'<br><small>Requiere revisión manual</small>':'')+'</td><td><input data-seg="'+i+'" data-answer="'+esc(r.respuesta)+'" value="'+esc(v.segment)+'"></td><td><input type="checkbox" data-ap="'+i+'" '+(v.approved?'checked':'')+'></td></tr>'}).join('')+
      '</tbody></table></div>':(rows.length&&state.status==='pending'&&!pending?
      '<div class="alert success">Esta pregunta tiene '+rows.length+' textos procesados y ya aprobados. No hay inspecciones pendientes. <button id="showApprovedReview" class="secondary">Ver resultados aprobados</button></div>':
      '<div class="alert">'+(rows.length?'No hay respuestas con estos filtros. Elegí Mostrar: Todas y Todos los lotes.':'Esta pregunta todavía no tiene resultados guardados. Elegí otra pregunta en el desplegable superior o procesá sus pendientes.')+'</div>'))+
      '<div class="actions"><button id="reviewPrev" class="secondary" '+(state.page<=1?'disabled':'')+'>Anterior página</button><span>Página '+state.page+' de '+pages+' · '+batchRows.length+' respuestas '+(state.batch==='all'?'en todos los lotes':'en este lote')+'</span><button id="reviewNext" class="secondary" '+(state.page>=pages?'disabled':'')+'>Siguiente página</button></div>'+
      '<div class="actions"><button class="secondary" id="saveReview">Guardar modificaciones y aprobaciones marcadas</button><button class="primary" id="approveBatch" '+(!batchRows.length?'disabled':'')+'>Guardar y aprobar todo el lote ('+entireBatch.length+' respuestas, todas las páginas)</button></div>';
    $('#reviewStatus').onchange=e=>{state.status=e.target.value;state.page=1;loadReview()};
    if($('#showApprovedReview'))$('#showApprovedReview').onclick=()=>{state.status='approved';state.batch='all';state.page=1;loadReview()};
    $('#reviewBatch').onchange=e=>{state.batch=e.target.value;state.page=1;loadReview()};
    $('#reviewSize').onchange=e=>{state.size=+e.target.value;state.page=1;loadReview()};
    $('#reviewPrev').onclick=()=>{state.page--;loadReview()};
    $('#reviewNext').onclick=()=>{state.page++;loadReview()};
    visible.forEach((r,i)=>{
      const capture=()=>{drafts[r.respuesta]={segment:$('#review [data-seg="'+i+'"]').value,approved:$('#review [data-ap="'+i+'"]').checked}};
      $('#review [data-seg="'+i+'"]').oninput=capture;
      $('#review [data-ap="'+i+'"]').onchange=capture;
    });
    if(focus){const i=visible.findIndex(r=>r.respuesta===focus.answer);const input=$('#review [data-seg="'+i+'"]');if(input){input.focus({preventScroll:true});input.setSelectionRange(focus.start,focus.end)}}
    const save=async approve=>{
      if(state.saving)return;
      state.saving=true;
      $('#saveReview').disabled=$('#approveBatch').disabled=true;
      const snapshot=structuredClone(drafts);
      // Approve all saved rows of this batch, across every page, not other batches.
      const submitted=approve?Object.fromEntries(entireBatch.map(r=>[r.respuesta,{segment:(snapshot[r.respuesta]||r).segment,approved:true}])):snapshot;
      try{
        await api('/api/project/'+pid+'/review-text',{method:'POST',body:JSON.stringify({question:q,rows:Object.entries(submitted).map(([respuesta,value])=>({respuesta,...value}))})});
        Object.keys(submitted).forEach(answer=>{if(JSON.stringify(drafts[answer])===JSON.stringify(snapshot[answer]))delete drafts[answer]});
        S.project=await api('/api/project/'+pid);await refreshWorkflow();shell();
        toast(approve?'Lote aprobado y guardado. Ya no aparece en Pendientes.':'Revisión guardada');
      }catch(e){toast(e.message,true)}
      finally{state.saving=false;if(S.project.id===pid&&$('#textQ')?.value===q)await loadReview()}
    };
    $('#saveReview').disabled=state.saving||false;
    $('#approveBatch').disabled=state.saving||!batchRows.length||state.batch==='all';
    if(state.batch==='all')$('#approveBatch').textContent='Elegí un lote para aprobarlo completo';
    $('#saveReview').onclick=()=>save(false);
    $('#approveBatch').onclick=()=>save(true);
  }catch(e){toast(e.message,true)}
}

async function saveInlineReview(approve=false,question=null){
 const pid=S.project.id,questions=question?[question]:Object.keys(S.idReviewDrafts||{});
 let saved=0;
 for(const q of questions){
  const drafts=S.idReviewDrafts?.[q]||{},rows=S.idReviewRows?.[q]||[];
  const submitted=approve?rows.filter(row=>row.original.trim()).map(row=>({id:row.id,segment:drafts[row.id]??row.segment,approved:true})):
    Object.entries(drafts).map(([id,segment])=>({id,segment,approved:false}));
  if(!submitted.length)continue;
  const result=await api('/api/project/'+pid+'/review-text-by-id',{method:'POST',body:JSON.stringify({question:q,rows:submitted})});
  saved+=result.saved;
  if(S.idReviewDrafts?.[q])S.idReviewDrafts[q]={};
 }
 return saved;
}

loadReview=async function(){
 const pid=S.project.id,q=$('#textQ')?.value,box=$('#review');
 if(!q||!box)return;
 S.idReviewDrafts ||= {};S.idReviewRows ||= {};S.idReviewPages ||= {};
 const drafts=S.idReviewDrafts[q] ||= {},state=S.idReviewPages[q] ||= {page:1,size:50};
 const request={};S.idReviewRequest=request;
 try{
  const result=await api('/api/project/'+pid+'/external-review?question='+encodeURIComponent(q));
  if(S.idReviewRequest!==request||S.project.id!==pid||$('#textQ')?.value!==q||!$('#review'))return;
  const rows=result.rows;S.idReviewRows[q]=rows;
  const pages=Math.max(1,Math.ceil(rows.length/state.size));state.page=Math.min(state.page,pages);
  const visible=rows.slice((state.page-1)*state.size,state.page*state.size);
  const approved=rows.filter(row=>row.approved).length,processed=rows.filter(row=>!row.original.trim()||String(drafts[row.id]??row.segment).trim()).length;
  box.innerHTML='<div class="card"><h2>Revisión final · '+esc(q)+'</h2>'+
   '<p>Editá directamente la tercera columna. Cada fila corresponde a una persona concreta, incluso cuando varias escribieron la misma respuesta.</p>'+
   '<div class="metrics"><div class="metric"><small>Respuestas</small><strong>'+rows.length+'</strong></div><div class="metric"><small>Con propuesta</small><strong>'+processed+'</strong></div><div class="metric ok"><small>Confirmadas</small><strong>'+approved+'</strong></div></div>'+
   '<div class="table-wrap"><table><thead><tr><th>ID respuesta</th><th>Respuesta original</th><th>Respuesta procesada</th></tr></thead><tbody>'+
   visible.map((row,i)=>'<tr><td><code>'+esc(row.id)+'</code></td><td>'+esc(row.original)+'</td><td><input style="min-width:260px" data-id-review="'+i+'" data-response-id="'+esc(row.id)+'" value="'+esc(drafts[row.id]??row.segment)+'" '+(!row.original.trim()?'disabled':'')+'></td></tr>').join('')+
   '</tbody></table></div><div class="actions"><button id="idReviewPrev" class="secondary" '+(state.page<=1?'disabled':'')+'>Anterior</button><span>Página '+state.page+' de '+pages+'</span><button id="idReviewNext" class="secondary" '+(state.page>=pages?'disabled':'')+'>Siguiente</button><select id="idReviewSize">'+[25,50,100,200].map(n=>'<option '+(state.size===n?'selected':'')+'>'+n+'</option>').join('')+'</select></div>'+
   '<div class="actions"><button id="saveIdReview" class="secondary">Guardar modificaciones</button><button id="approveQuestion" class="primary">Confirmar esta pregunta completa</button><span class="muted">También podés revisar todas las preguntas y tocar Siguiente para confirmarlas juntas.</span></div></div>';
  visible.forEach((row,i)=>{$('#review [data-id-review="'+i+'"]').oninput=e=>{drafts[row.id]=e.target.value;markSaving(true)}});
  $('#idReviewPrev').onclick=()=>{state.page--;loadReview()};$('#idReviewNext').onclick=()=>{state.page++;loadReview()};
  $('#idReviewSize').onchange=e=>{state.size=+e.target.value;state.page=1;loadReview()};
  $('#saveIdReview').onclick=async()=>{try{const count=await saveInlineReview(false,q);markSaving(false);toast(count+' modificaciones guardadas');await loadReview()}catch(e){toast(e.message,true)}};
  $('#approveQuestion').onclick=async()=>{try{const count=await saveInlineReview(true,q);S.project=await api('/api/project/'+pid);await refreshWorkflow();shell();markSaving(false);toast(count+' respuestas confirmadas para esta pregunta');await loadReview();await cloudCheckpoint('revisión de texto libre',true)}catch(e){toast(e.message,true)}};
 }catch(e){toast(e.message,true)}
};

async function finalizeTextStage(){
 try{
  const next=$('#next');next.disabled=true;next.textContent='Confirmando…';
  await saveInlineReview(false);
  const result=await api('/api/project/'+S.project.id+'/finalize-text-review',{method:'POST',body:'{}'});
  S.project=await api('/api/project/'+S.project.id);await refreshWorkflow();markSaving(false);
  await cloudCheckpoint('texto libre confirmado',true);
  toast(result.approved+' respuestas procesadas confirmadas.');S.step=5;render();
 }catch(e){toast(e.message,true);shell()}
}

function rankingView(){if(!S.project.sample_response_ids?.length){$('#content').innerHTML='<div class="alert">Primero guardá una muestra balanceada.</div>';return}let qs=(S.project.dictionary||[]).filter(x=>x.incluir&&x.tipo==='ordenamiento/ranking').map(x=>x.pregunta),dims=S.project.quota_settings?.dimensions||[],quotas=S.project.quota_rows||[],quotaOptions=quotas.map((r,i)=>`<option value="${i}">${esc(dims.map(d=>r[d]??'').join(' / '))}</option>`).join('');$('#content').innerHTML=`<div class="card"><h2>Preguntas de ranking</h2><div class="grid"><div class="field"><label>Pregunta</label><select id="rankQ">${qs.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="field"><label>Cuota</label><select id="rankQuota"><option value="">Todas las cuotas</option>${quotaOptions}</select></div></div><div class="actions"><button class="primary" id="rankLoad" ${qs.length?'':'disabled'}>Ver ranking por cuota</button></div><div id="rankResult"></div></div>`;$('#rankLoad').onclick=async()=>{let q=$('#rankQ').value,quota=$('#rankQuota').value,r=await api(`/api/project/${S.project.id}/ranking?question=${encodeURIComponent(q)}&quota=${encodeURIComponent(quota)}`);$('#rankResult').innerHTML=`<div class="metrics"><div class="metric"><small>Cuota</small><strong style="font-size:14px">${esc(r.quota)}</strong></div><div class="metric"><small>Personas reales</small><strong>${r.personas_reales}</strong></div><div class="metric"><small>Base ponderada</small><strong>${r.base_ponderada}</strong></div></div>${table(r.rows)}`;let selected=[...new Set([...(S.project.selected_ranking_questions||[]),q])];await saveFields({selected_ranking_questions:selected});await refreshWorkflow();shell()}}
function analysisView(){if(!S.project.sample_response_ids?.length){$('#content').innerHTML='<div class="alert">Primero guardá una muestra balanceada.</div>';return}let qs=(S.project.dictionary||[]).filter(x=>x.incluir&&['selección única','selección múltiple','escala','demográfica'].includes(x.tipo)).map(x=>x.pregunta);$('#content').innerHTML=`<div class="card"><h2>Distribuciones</h2><div class="field"><label>Pregunta</label><select id="chartQ">${qs.map(x=>`<option>${esc(x)}</option>`).join('')}</select></div><div class="actions"><button class="primary" id="chartLoad">Ver gráfico</button><button class="secondary" id="crossLoad">Ver cruces sugeridos</button></div><div id="chart"></div></div>`;$('#chartLoad').onclick=async()=>{let r=await api(`/api/project/${S.project.id}/analysis?question=${encodeURIComponent($('#chartQ').value)}`),max=Math.max(...r.map(x=>x.porcentaje),1);$('#chart').innerHTML=`<h3>${esc($('#chartQ').value)}</h3>${r.slice(0,30).map(x=>`<div class="barrow"><span>${esc(x.respuesta)}</span><div class="bar"><span style="width:${x.porcentaje/max*100}%"></span></div><b>${x.porcentaje}%</b></div>`).join('')}`};$('#crossLoad').onclick=async()=>{$('#chart').innerHTML='<p>Calculando asociaciones…</p>';let r=await api(`/api/project/${S.project.id}/suggestions`);$('#chart').innerHTML='<h3>Cruces sugeridos</h3>'+table(r)}}
function exportView(){let ready=S.project.sample_response_ids?.length,expanded=S.project.sample_expanded_response_ids?.length||ready||0,dims=S.project.quota_settings?.dimensions||[];$('#content').innerHTML=`<div class="card"><h2>Libro final de resultados</h2><p>Incluye tres bases claramente separadas: <b>Base original</b> con todas las respuestas recibidas, <b>Base limpia</b> con una fila por persona seleccionada y sólo valores procesados, y <b>Base ponderada</b> expandida hasta el objetivo. Las réplicas quedan identificadas y nunca se presentan como nuevas personas.</p><p><b>Desgloses incluidos:</b> cada combinación completa de ${dims.length?dims.map(esc).join(', '):'las cuotas configuradas'}.</p><div class="metrics"><div class="metric"><small>Personas reales seleccionadas</small><strong>${S.project.sample_response_ids?.length||0}</strong></div><div class="metric"><small>Filas ponderadas</small><strong>${expanded}</strong></div><div class="metric"><small>Texto normalizado</small><strong>${S.workflow?.text?.processed||0}/${S.workflow?.text?.total||0}</strong></div><div class="metric"><small>Rankings</small><strong>${S.workflow?.ranking_processed||0}/${S.workflow?.ranking_total||0}</strong></div></div><div class="actions"><a href="/api/project/${S.project.id}/export"><button class="primary" ${ready?'':'disabled'}>Descargar libro completo</button></a><button id="syncStorage" class="secondary" ${ready?'':'disabled'}>Sincronizar con Supabase</button><a href="https://sheets.new" target="_blank"><button class="secondary">Abrir Google Sheets</button></a></div><div id="storageResult"></div>${ready?'':'<div class="alert">Necesitás una muestra balanceada antes de exportar.</div>'}</div>`;if($('#syncStorage'))$('#syncStorage').onclick=async()=>{const b=$('#syncStorage');b.disabled=true;b.textContent='Sincronizando…';try{const r=await api('/api/project/'+S.project.id+'/sync-storage',{method:'POST',body:'{}'});$('#storageResult').innerHTML='<div class="alert success">Supabase actualizado: '+r.raw+' respuestas originales, '+r.processed+' filas procesadas y '+r.results+' resultados por cuota.</div>'}catch(e){toast(e.message,true);$('#storageResult').innerHTML='<div class="alert">'+esc(e.message)+'</div>'}finally{b.disabled=false;b.textContent='Sincronizar con Supabase'}}}
const exactBalanceView=balanceView;
balanceView=async()=>{
  await exactBalanceView();
  const exact=$('#balance');
  if(!exact||$('#balanceWeighted'))return;
  exact.textContent='Sortear muestra exacta';
  exact.insertAdjacentHTML('afterend','<button class="secondary" id="balanceWeighted">Completar faltantes con ponderación y réplicas</button>');
  $('#balanceWeighted').onclick=async()=>{try{
    const r=await api('/api/project/'+S.project.id+'/balance',{method:'POST',body:JSON.stringify({seed:+$('#seed').value,weighted:true})});
    S.project=await api('/api/project/'+S.project.id);
    await refreshWorkflow();
    toast('Muestra ponderada: '+r.selected+' personas reales · '+r.expanded_total+' filas representativas · peso máximo '+r.max_weight);
    render();
  }catch(e){toast(e.message,true)}};
};
async function analysisViewFlexible(){
 if(!S.project.sample_response_ids?.length){$('#content').innerHTML='<div class="alert">Primero guardá una muestra balanceada.</div>';return}
 $('#content').innerHTML='<div class="card"><h2>Resultados totales y por cuota</h2><p>La distribución total siempre se muestra primero. Debajo podés abrir cada combinación de las dimensiones usadas para segmentar la muestra.</p><div id="quotaAnalysis">Cargando…</div><div id="quotaAnalysisResult"></div></div><div class="card"><h2>Constructor de cruces y filtros</h2><p>Una pregunta principal, cero o más desgloses y cero o más filtros con una o varias respuestas. Se aplica el peso muestral.</p><div id="crossBuilder">Cargando…</div><div id="crossResult"></div></div>';
 try{const cfg=await api('/api/project/'+S.project.id+'/cross-options'),questions=Object.keys(cfg.values),options=questions.map(q=>'<option value="'+esc(q)+'">'+esc(q)+'</option>').join('');
 const analysisQuestions=(S.project.dictionary||[]).filter(x=>x.incluir&&['selección única','selección múltiple','escala','matriz de escala','demográfica'].includes(x.tipo)).map(x=>x.pregunta);
 $('#quotaAnalysis').innerHTML='<div class="field"><label>Pregunta</label><select id="quotaAnalysisQ">'+analysisQuestions.map(q=>'<option value="'+esc(q)+'">'+esc(q)+'</option>').join('')+'</select></div><div class="actions"><button id="runQuotaAnalysis" class="primary" '+(analysisQuestions.length?'':'disabled')+'>Ver total y todas las cuotas</button></div>';
 $('#runQuotaAnalysis').onclick=async()=>{try{const q=$('#quotaAnalysisQ').value,result=await api('/api/project/'+S.project.id+'/analysis-by-quota?question='+encodeURIComponent(q)),max=Math.max(...result.total.map(x=>x.cantidad_ponderada),1),bars=result.total.map(x=>'<div class="barrow"><span>'+esc(x.respuesta)+'</span><div class="bar"><span style="width:'+(x.cantidad_ponderada/max*100)+'%"></span></div><b>'+x.cantidad_ponderada+' ('+x.porcentaje+'%)</b></div>').join('');
   $('#quotaAnalysisResult').innerHTML='<h3>Total de la muestra</h3>'+bars+'<h3>Resultados por cuota</h3>'+result.quotas.map(c=>'<details><summary>Cuota '+c.cuota+' · '+esc(result.dimensions.map(d=>c.dimensiones[d]).join(' / '))+' · '+c.personas_reales+' personas · base ponderada '+c.base_ponderada+'</summary>'+table(c.rows)+'</details>').join('');
 }catch(e){toast(e.message,true)}};
 $('#crossBuilder').innerHTML='<div class="field"><label>Pregunta principal</label><select id="crossPrimary">'+options+'</select></div><div class="field"><label>Preguntas cruzadas (Ctrl+clic para elegir varias)</label><select id="crossBreakdowns" multiple size="6">'+options+'</select></div><h3>Filtros</h3><div id="crossFilters"></div><div class="actions"><button id="addCrossFilter" class="secondary">＋ Agregar filtro</button><button id="runCross" class="primary">Generar tabla y gráfico</button></div>';
 const add=()=>{$('#crossFilters').insertAdjacentHTML('beforeend','<div class="grid cross-filter"><div class="field"><label>Pregunta</label><select class="filterQ"><option value="">Elegir…</option>'+options+'</select></div><div class="field"><label>Respuestas (Ctrl+clic para varias)</label><select class="filterValues" multiple size="5"></select></div><button class="secondary removeFilter">Eliminar</button></div>');let row=$('#crossFilters').lastElementChild;row.querySelector('.filterQ').onchange=e=>row.querySelector('.filterValues').innerHTML=(cfg.values[e.target.value]||[]).map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');row.querySelector('.removeFilter').onclick=()=>row.remove()};
 $('#addCrossFilter').onclick=add;$('#runCross').onclick=async()=>{try{let body={primary:$('#crossPrimary').value,breakdowns:[...$('#crossBreakdowns').selectedOptions].map(x=>x.value),filters:[...document.querySelectorAll('.cross-filter')].map(r=>({question:r.querySelector('.filterQ').value,values:[...r.querySelector('.filterValues').selectedOptions].map(x=>x.value)}))},result=await api('/api/project/'+S.project.id+'/cross-analysis',{method:'POST',body:JSON.stringify(body)}),dims=[body.primary,...body.breakdowns],max=Math.max(...result.rows.map(x=>x.cantidad_ponderada),1);$('#crossResult').innerHTML='<div class="metrics"><div class="metric"><small>Personas reales</small><strong>'+result.respondents+'</strong></div><div class="metric"><small>Base ponderada</small><strong>'+result.weighted_base+'</strong></div><div class="metric"><small>Excluidas</small><strong>'+result.filtered_out+'</strong></div></div>'+result.rows.slice(0,40).map(x=>'<div class="barrow"><span>'+esc(dims.map(q=>x[q]).join(' · '))+'</span><div class="bar"><span style="width:'+(x.cantidad_ponderada/max*100)+'%"></span></div><b>'+x.cantidad_ponderada+' ('+x.porcentaje_ponderado+'%)</b></div>').join('')+'<h3>Tabla completa</h3>'+table(result.rows)}catch(e){toast(e.message,true)}}
 }catch(e){toast(e.message,true)}
}
analysisView=analysisViewFlexible;
init().catch(e=>toast(e.message,true));
