export type ConversationMessage={id:string;role:'user'|'assistant'|'bridge';text:string};

export function failureFeedback(message:unknown,permission:'read'|'control'|'disconnected'){
  const detail=typeof message==='string'&&message.trim()?message.trim():'Codex could not complete this request.';
  if(permission==='read')return `${detail}\n\nThis connection is read only. You can ask about the model’s current state or run an investigation. Changing time, labels or orbits requires model control: disconnect, request control and reconnect. You can continue asking read-only questions here.`;
  if(permission==='control')return `${detail}\n\nIf a change may have started, ask for the current state before trying it again. Nothing will be retried automatically. You can try another message or start a new conversation.`;
  return `${detail}\n\nCheck Bridge and the browser’s application-launch and local-access prompts, then connect again. Previous actions will not be sent again.`;
}

export function conversationFeedback(operate:boolean){
  return `Codex is connected. This is a new conversation for this model; previously completed changes remain.\n\n${operate?'Model control is allowed. Any action approval requested by Codex appears in Bridge.':'This connection is read only. Ask about the current state or run an investigation. To change time, labels or orbits, disconnect and reconnect with model control.'}`;
}

export function bridgeNotice(messages:ConversationMessage[],id:string,text:string):ConversationMessage[]{
  const notice:ConversationMessage={id,role:'bridge',text};
  return messages.some(message=>message.id===id)?messages.map(message=>message.id===id?notice:message):[...messages,notice];
}
