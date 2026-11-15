import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import InstructorScheduleEditor, { instructorLocalDateTime, instructorScheduleIso } from './InstructorScheduleEditor';
import type { InstructorContent } from '../services/instructorTests';
it('configura fecha y hora de Honduras y conserva el resto del borrador', () => {
  function Editor() { const [content, setContent] = useState<InstructorContent>({nombre:'Prueba',instrucciones:'Texto',questions:[]});
    return <><InstructorScheduleEditor content={content} onChange={setContent}/><output>{JSON.stringify(content)}</output></>;
  }
  render(<Editor />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.change(screen.getByLabelText('Fecha y hora de apertura'),{target:{value:'2026-11-20T08:00'}});
  fireEvent.change(screen.getByLabelText('Fecha y hora de cierre'),{target:{value:'2026-11-20T10:00'}});
  expect(screen.queryByText(/Completa ambas fechas/)).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('2026-11-20T14:00:00.000Z');
  expect(instructorLocalDateTime(instructorScheduleIso('2026-11-20T08:00'))).toBe('2026-11-20T08:00');
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('status').textContent).not.toContain('schedule');
  expect(screen.getByRole('status')).toHaveTextContent('Texto');
});
