(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.QuotaImport=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const norm=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\*/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const matrix=raw=>String(raw??'').replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n')
    .map(line=>line.split('\t').map(cell=>cell.trim())).filter(row=>row.some(Boolean));
  function number(value,kind){
    let text=String(value??'').replace(/\*/g,'').replace(/\s/g,'').replace(/%/g,'');
    if(kind==='percent')text=text.replace(/\./g,'').replace(',','.');
    else if(/^[-+]?\d{1,3}(?:\.\d{3})+$/.test(text))text=text.replace(/\./g,'');
    else if(/^[-+]?\d{1,3}(?:,\d{3})+$/.test(text))text=text.replace(/,/g,'');
    else text=text.replace(',','.');
    const result=Number(text);
    return Number.isFinite(result)?result:null;
  }
  const isSegment=value=>/^[hm]\s+.+/i.test(String(value??'').trim());
  function segment(value){
    const match=String(value??'').trim().match(/^([HM])\s+(.+)$/i);
    return match?{gender:match[1].toUpperCase(),age:match[2].trim()}:null;
  }
  function parseVertical(rows){
    const result=[];let region='',layout=null;
    rows.forEach((cells,index)=>{
      const normalized=cells.map(value=>norm(value).replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim());
      const cases=normalized.findIndex(value=>value.includes('casos proyectados')||value==='casos');
      const universe=normalized.findIndex(value=>value==='p o'||value==='po'||value.includes('universo'));
      const percentage=normalized.findIndex(value=>value.includes('cuota')&&value.includes('p o'));
      if(cases>=0&&cells[0]&&!isSegment(cells[0])&&norm(cells[0])!=='total'){
        region=cells[0].replace(/\*/g,'').trim();layout={cases,universe,percentage};return;
      }
      if(!layout||!region||!isSegment(cells[0]))return;
      const part=segment(cells[0]),amount=number(cells[layout.cases],'integer');
      if(amount===null||!Number.isInteger(amount)||amount<0)throw Error(`Fila ${index+1}: Casos proyectados debe ser un entero.`);
      result.push({region,gender:part.gender,age:part.age,cases:amount,
        universe:layout.universe>=0?number(cells[layout.universe],'integer'):null,
        percentage:layout.percentage>=0?number(cells[layout.percentage],'percent'):null});
    });
    return result.length?{format:'vertical',rows:result}:null;
  }
  function parseHorizontal(rows){
    const result=[];let region='';
    for(let index=0;index<rows.length;index++){
      const cells=rows[index],nonempty=cells.map((value,i)=>[value,i]).filter(([value])=>value);
      if(nonempty.length===1&&!isSegment(nonempty[0][0])&&!['universo','casos','cuota / po'].includes(norm(nonempty[0][0]))){
        region=nonempty[0][0].replace(/\*/g,'').trim();continue;
      }
      const segmentColumns=cells.map((value,i)=>isSegment(value)?i:-1).filter(i=>i>=0);
      if(!region||segmentColumns.length<2)continue;
      const universeRow=rows.slice(index+1).find(row=>norm(row[0]).includes('universo'));
      const percentageRow=rows.slice(index+1).find(row=>norm(row[0]).includes('cuota')&&norm(row[0]).includes('po'));
      const casesRow=rows.slice(index+1).find(row=>norm(row[0])==='casos'||norm(row[0]).includes('casos proyectados'));
      if(!casesRow)throw Error(`Región ${region}: falta la fila Casos.`);
      segmentColumns.forEach(column=>{
        const part=segment(cells[column]),amount=number(casesRow[column],'integer');
        if(amount===null||!Number.isInteger(amount)||amount<0)throw Error(`Región ${region}, ${cells[column]}: Casos debe ser un entero.`);
        result.push({region,gender:part.gender,age:part.age,cases:amount,
          universe:universeRow?number(universeRow[column],'integer'):null,
          percentage:percentageRow?number(percentageRow[column],'percent'):null});
      });
      region='';
    }
    return result.length?{format:'horizontal',rows:result}:null;
  }
  function parse(raw){
    const rows=matrix(raw);
    if(!rows.length)return null;
    return parseHorizontal(rows)||parseVertical(rows);
  }
  return {parse,number,norm};
});
