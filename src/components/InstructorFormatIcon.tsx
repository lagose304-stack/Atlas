import { AlignLeft, CheckSquare, Columns2, Link2, ListChecks, Target, TextCursorInput } from 'lucide-react';
import type { InstructorQuestionType } from '../types/instructorQuestions';

const icons = { single_choice: ListChecks, short_answer: AlignLeft, completion: TextCursorInput, matching: Link2, image_point: Target, image_versus: Columns2 };

export default function InstructorFormatIcon({ type = 'single_choice', multiple = false }: { type?: InstructorQuestionType; multiple?: boolean }) {
  const Icon = (type === 'single_choice' && multiple) ? CheckSquare : icons[type];
  return <Icon size={16} strokeWidth={1.8} aria-hidden="true" />;
}
