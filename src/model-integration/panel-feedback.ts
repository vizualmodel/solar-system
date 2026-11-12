export type ConversationMessage={id:string;role:'user'|'assistant'|'bridge';text:string};

export function failureFeedback(message:unknown,permission:'read'|'control'|'disconnected'){
  const detail=typeof message==='string'&&message.trim()?message.trim():'Codex could not complete this request.';
  const recovery=/network|offline|fetch failed|sending request|resolve host|connection reset/i.test(detail)?'Check the internet connection, then retry deliberately. Cloud inference needs connectivity; archived history and local calculations remain available.':/not signed in|signed.out|sign.in/i.test(detail)?'Use the supported Codex sign-in flow, then Test connection in Bridge and retry.':/tested with|runtime validation|unvalidated|different runtime version/i.test(detail)?'Open Bridge settings and compare the detected version with the tested version. Runtime upgrades require separate validation.':/not found|could not start|executable/i.test(detail)?'Open Bridge settings, use the official installation/sign-in instructions or Browse executable, then Test connection and retry.':'';
  const prefix=detail+(recovery?'\n\n'+recovery:'');
  if(permission==='read')return `${prefix}\n\nThis connection is read only. You can ask about the model’s current state or run an investigation. Changing time, labels or orbits requires model control: disconnect, request control and reconnect. You can continue asking read-only questions here.`;
  if(permission==='control')return `${prefix}\n\nIf a change may have started, ask for the current state before trying it again. Nothing will be retried automatically. You can try another message or start a new conversation.`;
  return `${prefix}\n\nCheck Bridge and the browser’s application-launch and local-access prompts, then connect again. Previous actions will not be sent again.`;
}

export function conversationFeedback(operate:boolean,resumed=false){
  return `Codex is connected. ${resumed?'This conversation resumed with current permissions and fresh model tools. Model state was not restored.':'This is a new conversation for this model; previously completed changes remain.'}\n\n${operate?'Model control is allowed. Any action approval requested by Codex appears in Bridge.':'This connection is read only. Ask about the current state or run an investigation. To change time, labels or orbits, disconnect and reconnect with model control.'}`;
}

export function bridgeNotice(messages:ConversationMessage[],id:string,text:string):ConversationMessage[]{
  const notice:ConversationMessage={id,role:'bridge',text};
  return messages.some(message=>message.id===id)?messages.map(message=>message.id===id?notice:message):[...messages,notice];
}
