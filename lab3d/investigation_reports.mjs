const clone=value=>JSON.parse(JSON.stringify(value));
export function investigationReport(task, context) {
 if(!['k117-copper','k311'].includes(task.id))throw new Error('Unsupported investigation');
 const report={schemaVersion:1,labId:task.id,title:context.title,course:task.id==='k311'?'K3':'K1',skillIds:task.id==='k311'?['K3-11']:['K1-17','K1-18'],path:context.path,language:context.language,startedAt:context.startedAt,exportedAt:context.exportedAt,status:task.reached?'complete':'in_progress',dataOrigin:'simulation',units:{volume:'mL',temperature:'°C',dose:'g',dissolved:'g',residue:'g',copper:'mmol',precipitate:'mmol',pH:'dimensionless'},answers:task.picks||{},answerText:context.answerText||null,notebook:context.notebook};
 if(task.id==='k117-copper')report.observations=task.copperEvidence||{};
 else{report.retainedTrials=task.trials||[];report.currentTrial={hypothesis:task.hypothesis,design:task.design,blanks:task.blank,measurements:task.comparison,conclusion:task.reached?task.picks.outcome:null};}
 return clone(report);
}
const md=value=>String(value??'').replace(/[\\`*_<>|\[\]]/g,'\\$&').replace(/\r?\n/g,' ');
export function reportMarkdown(report, labels={}) {
 const L={course:'Course',skills:'Skills',path:'Catalogue path',status:'Status',source:'Simulation data',observations:'Observations',trial:'Trial',hypothesis:'Hypothesis',reason:'Reason',controls:'Experiment plan',answers:'Answers',notebook:'Notebook',...labels};
 const lines=['# '+md(report.title),'',L.course+': '+md(report.course),L.skills+': '+report.skillIds.join(', '),L.path+': '+report.path.map(md).join(' → '),L.status+': '+(L['status_'+report.status]||report.status),L.source+' · '+report.exportedAt,''];
 const table=(rows,columns)=>{if(!rows?.length)return;lines.push('| '+columns.map(([key,unit])=>(L[key]||key)+(unit?' / '+unit:'')).join(' | ')+' |','| '+columns.map(()=> '---').join(' | ')+' |');for(const row of rows)lines.push('| '+columns.map(([key])=>md(typeof row[key]==='number'?Number(row[key].toPrecision(6)):row[key])).join(' | ')+' |');lines.push('');};
 if(report.observations)for(const [stage,rows]of Object.entries(report.observations)){lines.push('## '+L.observations+' · '+(L['stage_'+stage]||stage),'');table(rows,[['vessel'],['volume','mL'],['copper','mmol'],['precipitate','mmol'],['pH'],['temperature','°C']]);}
 else for(const [index,trial]of [...report.retainedTrials,report.currentTrial].entries()){
  lines.push('## '+L.trial+' '+(index+1),'');if(trial.hypothesis)lines.push(L.hypothesis+': '+md(L['prediction_'+trial.hypothesis.prediction]||trial.hypothesis.prediction),L.reason+': '+md(trial.hypothesis.reason),'');if(trial.design)lines.push(L.controls+': '+md(L.designDescription||trial.design.independent+'; '+trial.design.controls.join(', ')),'');
  if(trial.conclusion)lines.push(L.answers+': '+md(L['prediction_'+trial.conclusion]||trial.conclusion),'');
  table(trial.measurements,[['vessel'],['volume','mL'],['temperature','°C'],['dose','g'],['dissolved','g'],['residue','g']]);
 }
 lines.push('## '+L.answers,'');if(report.answerText)for(const row of report.answerText)lines.push('- '+md(row.question)+': '+md(row.answer));else for(const [key,value]of Object.entries(report.answers))lines.push('- '+md(key)+': '+md(value));lines.push('', '## '+L.notebook,'',...String(report.notebook||'').split('\n').map(line=>'> '+md(line)));return lines.join('\n');
}
