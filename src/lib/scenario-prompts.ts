export interface ScenarioPrompt { id:string;title:string;prompt:string;revision:string }
export function validateScenarioId(id:string){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||id.length>80||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(id))throw new Error('Invalid scenario id. Use a short lowercase slug.');
 return id;
}
export function parseScenarioMarkdown(id:string,text:string,revision='bundled'):ScenarioPrompt{
 validateScenarioId(id);
 if(text.length>20000)throw new Error('Scenario prompt is too large.');
 const match=/^# ([^\r\n]+)\r?\n(?:\r?\n)?([\s\S]+)$/.exec(text.replace(/^\uFEFF/,''));
 if(!match)throw new Error('Scenario Markdown must start with # Title followed by prompt text.');
 const title=match[1].trim(),prompt=match[2].trim();
 if(!title||title.length>120||!prompt||prompt.length>19000)throw new Error('Invalid scenario title or prompt length.');
 return {id,title,prompt,revision};
}
export function scenarioMarkdown(title:string,prompt:string){
 if(/[\r\n]/.test(title))throw new Error('Scenario title must be one line.');
 const text=`# ${title.trim()}\n\n${prompt.trim()}\n`;
 parseScenarioMarkdown('validation',text);
 return text;
}
export function scenarioId(title:string){return validateScenarioId(title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80).replace(/-$/,''));}
