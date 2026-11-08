export const unwrapDocument = doc => JSON.parse(doc.body.replace(/^```json\s*|\s*```$/g,''));
export function humanFeedback(comments) {
  return comments.filter(c=>c.authorUserId&&c.body?.trim()).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(c=>({id:c.id,authorUserId:c.authorUserId,createdAt:c.createdAt,body:c.body}));
}
export function documentUpdate(current, fields) {
  return {...fields,...(current?{baseRevisionId:current.latestRevisionId}:{})};
}
export function validateOutreachMessage(message,sender) {
  if(/medpulse/i.test(message))throw Error('MEDPULSE cannot be the commercial sender');
  if(!message.includes(sender.display_name))throw Error('Missing distributor identity');
  if(/\b(12|49|doce|cuarenta y nueve)\b/i.test(message))throw Error('Internal quantity or timing leaked into initial message');
  if(!/coti[cz]/i.test(message))throw Error('Quotation CTA required');
  if(!/baja|dejar de recibir|no recibir|no te escribamos/i.test(message))throw Error('Opt-out missing');
}
