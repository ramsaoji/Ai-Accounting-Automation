export interface ParsedAiResponse {
  checklist: string;
  projections: string;
  intelligence: string;
}

export function cleanPromptPoint(line: string): string {
  let cleaned = line.trim();
  // Strip common leading markers like bullet points, numbers, asterisks, brackets, or dashes
  cleaned = cleaned.replace(/^[\*\-\d\.\s\[\]\(\)]+/, '');
  // Strip trailing brackets/parentheses if present
  cleaned = cleaned.replace(/[\)\]]+$/, '');
  cleaned = cleaned.trim();
  if (cleaned.length === 0) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function parseAiResponse(responseText: string): ParsedAiResponse {
  const checklistMatch = responseText.match(/\[CHECKLIST_START\]([\s\S]*?)\[CHECKLIST_END\]/i);
  const projectionsMatch = responseText.match(/\[PROJECTIONS_START\]([\s\S]*?)\[PROJECTIONS_END\]/i);
  const intelligenceMatch = responseText.match(/\[INTELLIGENCE_START\]([\s\S]*?)\[INTELLIGENCE_END\]/i);

  let checklist = checklistMatch ? checklistMatch[1].trim() : '';
  let projections = projectionsMatch ? projectionsMatch[1].trim() : '';
  let intelligence = intelligenceMatch ? intelligenceMatch[1].trim() : '';

  // Safest split fallback if formatting blocks completely failed
  if (!checklist || !projections || !intelligence) {
    const lines = responseText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    checklist = lines.slice(0, 3).join('\n');
    projections = lines.slice(3, 6).join('\n');
    intelligence = lines.slice(6, 9).join('\n');
  }

  return { checklist, projections, intelligence };
}
