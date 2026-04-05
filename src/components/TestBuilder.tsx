import React, { useEffect, useMemo, useState } from 'react';

export type QuestionBlockType =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'matching'
  | 'ordering'
  | 'dropdown_single';

export interface SingleOption {
  id: string;
  text: string;
}

export interface MatchingPair {
  id: string;
  left: string;
  right: string;
}

export interface SingleChoiceQuestion {
  id: string;
  prompt: string;
  options: SingleOption[];
  correctOptionId: string | null;
}

export interface MultipleChoiceQuestion {
  id: string;
  prompt: string;
  options: SingleOption[];
  correctOptionIds: string[];
}

export interface TrueFalseQuestion {
  id: string;
  prompt: string;
  correctAnswer: 'true' | 'false' | null;
}

export interface MatchingQuestion {
  id: string;
  prompt: string;
  pairs: MatchingPair[];
}

export interface OrderingQuestion {
  id: string;
  prompt: string;
  items: SingleOption[];
}

export interface DropdownQuestion {
  id: string;
  prompt: string;
  options: SingleOption[];
  correctOptionId: string | null;
}

export interface SingleChoiceBlock {
  id: string;
  type: 'single_choice';
  title: string;
  questions: SingleChoiceQuestion[];
}

export interface MultipleChoiceBlock {
  id: string;
  type: 'multiple_choice';
  title: string;
  questions: MultipleChoiceQuestion[];
}

export interface TrueFalseBlock {
  id: string;
  type: 'true_false';
  title: string;
  questions: TrueFalseQuestion[];
}

export interface MatchingBlock {
  id: string;
  type: 'matching';
  title: string;
  questions: MatchingQuestion[];
}

export interface OrderingBlock {
  id: string;
  type: 'ordering';
  title: string;
  questions: OrderingQuestion[];
}

export interface DropdownBlock {
  id: string;
  type: 'dropdown_single';
  title: string;
  questions: DropdownQuestion[];
}

export type QuestionBlock =
  | SingleChoiceBlock
  | MultipleChoiceBlock
  | TrueFalseBlock
  | MatchingBlock
  | OrderingBlock
  | DropdownBlock;

interface TestBuilderProps {
  onSave: (blocks: QuestionBlock[]) => Promise<void>;
  saveDisabled?: boolean;
  saveLabel?: string;
  initialBlocks?: QuestionBlock[];
  clearOnSave?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

const SUPPORTED_BLOCK_TYPE: QuestionBlockType = 'multiple_choice';

const keepSupportedBlocksOnly = (source?: QuestionBlock[]): QuestionBlock[] => {
  return (source ?? []).filter((block) => block.type === SUPPORTED_BLOCK_TYPE);
};

const makeId = () => crypto.randomUUID();

const createOption = (text = ''): SingleOption => ({ id: makeId(), text });

const createSingleChoiceQuestion = (): SingleChoiceQuestion => ({
  id: makeId(),
  prompt: '',
  options: [createOption('Opcion A'), createOption('Opcion B')],
  correctOptionId: null,
});

const createMultipleChoiceQuestion = (): MultipleChoiceQuestion => ({
  id: makeId(),
  prompt: '',
  options: [createOption('Opcion A'), createOption('Opcion B')],
  correctOptionIds: [],
});

const createTrueFalseQuestion = (): TrueFalseQuestion => ({
  id: makeId(),
  prompt: '',
  correctAnswer: null,
});

const createMatchingQuestion = (): MatchingQuestion => ({
  id: makeId(),
  prompt: '',
  pairs: [
    { id: makeId(), left: '', right: '' },
    { id: makeId(), left: '', right: '' },
  ],
});

const createOrderingQuestion = (): OrderingQuestion => ({
  id: makeId(),
  prompt: '',
  items: [createOption('Paso 1'), createOption('Paso 2'), createOption('Paso 3')],
});

const createDropdownQuestion = (): DropdownQuestion => ({
  id: makeId(),
  prompt: '',
  options: [createOption('Opcion 1'), createOption('Opcion 2')],
  correctOptionId: null,
});

const createBlock = (type: QuestionBlockType): QuestionBlock => {
  if (type === 'single_choice') {
    return {
      id: makeId(),
      type,
      title: 'Bloque de seleccion unica',
      questions: [createSingleChoiceQuestion()],
    };
  }
  if (type === 'multiple_choice') {
    return {
      id: makeId(),
      type,
      title: 'Bloque de seleccion multiple',
      questions: [createMultipleChoiceQuestion()],
    };
  }
  if (type === 'true_false') {
    return {
      id: makeId(),
      type,
      title: 'Bloque verdadero/falso',
      questions: [createTrueFalseQuestion()],
    };
  }
  if (type === 'matching') {
    return {
      id: makeId(),
      type,
      title: 'Bloque de terminos pareados',
      questions: [createMatchingQuestion()],
    };
  }
  if (type === 'ordering') {
    return {
      id: makeId(),
      type,
      title: 'Bloque de ordenar',
      questions: [createOrderingQuestion()],
    };
  }
  return {
    id: makeId(),
    type: 'dropdown_single',
    title: 'Bloque de lista desplegable',
    questions: [createDropdownQuestion()],
  };
};

const blockTypeLabel: Record<QuestionBlockType, string> = {
  single_choice: 'Seleccion unica',
  multiple_choice: 'Seleccion multiple',
  true_false: 'Verdadero/Falso',
  matching: 'Pareado',
  ordering: 'Ordenar',
  dropdown_single: 'Desplegable',
};

const TestBuilder: React.FC<TestBuilderProps> = ({
  onSave,
  saveDisabled = false,
  saveLabel = 'Guardar prueba',
  initialBlocks,
  clearOnSave = true,
  onDirtyChange,
}) => {
  const normalizedInitialBlocks = useMemo(
    () => keepSupportedBlocksOnly(initialBlocks),
    [initialBlocks]
  );

  const [blocks, setBlocks] = useState<QuestionBlock[]>(normalizedInitialBlocks);
  const [savedSignature, setSavedSignature] = useState<string>(
    JSON.stringify(normalizedInitialBlocks)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [dragState, setDragState] = useState<{ blockId: string; questionId: string; itemId: string } | null>(null);

  useEffect(() => {
    setBlocks(normalizedInitialBlocks);
    setSavedSignature(JSON.stringify(normalizedInitialBlocks));
  }, [normalizedInitialBlocks]);

  useEffect(() => {
    if (!onDirtyChange) return;
    onDirtyChange(JSON.stringify(blocks) !== savedSignature);
  }, [blocks, onDirtyChange, savedSignature]);

  const addBlock = (type: QuestionBlockType) => {
    setBlocks(prev => [...prev, createBlock(type)]);
  };

  const updateBlock = (blockId: string, updater: (block: QuestionBlock) => QuestionBlock) => {
    setBlocks(prev => prev.map(block => (block.id === blockId ? updater(block) : block)));
  };

  const deleteBlock = (blockId: string) => {
    if (!window.confirm('Eliminar este bloque de preguntas?')) return;
    setBlocks(prev => prev.filter(block => block.id !== blockId));
  };

  const addQuestionToBlock = (blockId: string) => {
    updateBlock(blockId, block => {
      if (block.type === 'single_choice') {
        return { ...block, questions: [...block.questions, createSingleChoiceQuestion()] };
      }
      if (block.type === 'multiple_choice') {
        return { ...block, questions: [...block.questions, createMultipleChoiceQuestion()] };
      }
      if (block.type === 'true_false') {
        return { ...block, questions: [...block.questions, createTrueFalseQuestion()] };
      }
      if (block.type === 'matching') {
        return { ...block, questions: [...block.questions, createMatchingQuestion()] };
      }
      if (block.type === 'ordering') {
        return { ...block, questions: [...block.questions, createOrderingQuestion()] };
      }
      return { ...block, questions: [...block.questions, createDropdownQuestion()] };
    });
  };

  const deleteQuestionFromBlock = (blockId: string, questionId: string) => {
    updateBlock(blockId, block => {
      if (block.questions.length <= 1) return block;
      return { ...block, questions: block.questions.filter(q => q.id !== questionId) } as QuestionBlock;
    });
  };

  const summary = useMemo(() => {
    const counts: Record<QuestionBlockType, number> = {
      single_choice: 0,
      multiple_choice: 0,
      true_false: 0,
      matching: 0,
      ordering: 0,
      dropdown_single: 0,
    };
    let totalQuestions = 0;
    blocks.forEach(block => {
      counts[block.type] += 1;
      totalQuestions += block.questions.length;
    });
    return { counts, totalQuestions };
  }, [blocks]);

  const handleSaveClick = async () => {
    if (saveDisabled || blocks.length === 0) return;
    setIsSaving(true);
    try {
      await onSave(blocks);
      if (clearOnSave) {
        setBlocks([]);
        setSavedSignature('[]');
      } else {
        setSavedSignature(JSON.stringify(blocks));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={tb.wrap}>
      <div style={tb.layout}>
        <div style={tb.editorArea}>
          <div style={tb.summaryRow}>
            <span style={tb.summaryPill}>Preguntas de seleccion multiple: {summary.counts.multiple_choice}</span>
            <span style={tb.summaryPill}>Total preguntas: {summary.totalQuestions}</span>
          </div>

          {blocks.length === 0 && (
            <div style={tb.emptyState}>
              Aun no hay preguntas. Usa el menu lateral para agregar la primera de seleccion multiple.
            </div>
          )}

          {blocks.map((block, index) => (
        <div key={block.id} style={tb.blockCard}>
              <div style={tb.blockHeader}>
                <div style={tb.blockHeaderLeft}>
                  <span style={tb.blockIndex}>#{index + 1}</span>
                  <span style={tb.blockType}>{blockTypeLabel[block.type]}</span>
                </div>
                <button type="button" style={tb.deleteBtn} onClick={() => deleteBlock(block.id)}>Eliminar bloque</button>
              </div>

              <div style={tb.fieldRow}>
                <label style={tb.fieldLabel}>Titulo del bloque</label>
                <input
                  value={block.title}
                  onChange={e => updateBlock(block.id, b => ({ ...b, title: e.target.value }))}
                  style={tb.input}
                  placeholder="Ej. Preguntas de seleccion sobre epitelio"
                />
              </div>

              {block.type === 'single_choice' && (
                <div style={tb.innerBox}>
                  {(block as SingleChoiceBlock).questions.map((question, qIndex) => (
                    <div key={question.id} style={tb.questionCard}>
                      <div style={tb.questionHeader}>
                        <span style={tb.questionTitle}>Pregunta {qIndex + 1}</span>
                        <button type="button" style={tb.smallBtn} onClick={() => deleteQuestionFromBlock(block.id, question.id)}>Quitar</button>
                      </div>
                      <textarea
                        value={question.prompt}
                        onChange={e =>
                          updateBlock(block.id, b => ({
                            ...(b as SingleChoiceBlock),
                            questions: (b as SingleChoiceBlock).questions.map(q =>
                              q.id === question.id ? { ...q, prompt: e.target.value } : q
                            ),
                          }))
                        }
                        style={tb.textarea}
                        placeholder="Escribe el enunciado de la pregunta"
                      />
                      {question.options.map((opt, optIdx) => (
                        <div key={opt.id} style={tb.optionRow}>
                          <input
                            type="radio"
                            name={`correct-${question.id}`}
                            checked={question.correctOptionId === opt.id}
                            onChange={() =>
                              updateBlock(block.id, b => ({
                                ...(b as SingleChoiceBlock),
                                questions: (b as SingleChoiceBlock).questions.map(q =>
                                  q.id === question.id ? { ...q, correctOptionId: opt.id } : q
                                ),
                              }))
                            }
                          />
                          <input
                            value={opt.text}
                            onChange={e =>
                              updateBlock(block.id, b => ({
                                ...(b as SingleChoiceBlock),
                                questions: (b as SingleChoiceBlock).questions.map(q =>
                                  q.id === question.id
                                    ? {
                                        ...q,
                                        options: q.options.map(item =>
                                          item.id === opt.id ? { ...item, text: e.target.value } : item
                                        ),
                                      }
                                    : q
                                ),
                              }))
                            }
                            style={tb.input}
                            placeholder={`Opcion ${optIdx + 1}`}
                          />
                          <button
                            type="button"
                            style={tb.smallBtn}
                            onClick={() =>
                              updateBlock(block.id, b => ({
                                ...(b as SingleChoiceBlock),
                                questions: (b as SingleChoiceBlock).questions.map(q => {
                                  if (q.id !== question.id || q.options.length <= 2) return q;
                                  const nextOptions = q.options.filter(item => item.id !== opt.id);
                                  return {
                                    ...q,
                                    options: nextOptions,
                                    correctOptionId: q.correctOptionId === opt.id ? null : q.correctOptionId,
                                  };
                                }),
                              }))
                            }
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        style={tb.addBtn}
                        onClick={() =>
                          updateBlock(block.id, b => ({
                            ...(b as SingleChoiceBlock),
                            questions: (b as SingleChoiceBlock).questions.map(q =>
                              q.id === question.id ? { ...q, options: [...q.options, createOption('')] } : q
                            ),
                          }))
                        }
                      >
                        Agregar opcion
                      </button>
                    </div>
                  ))}
                  <button type="button" style={tb.addTypeQuestionBtn} onClick={() => addQuestionToBlock(block.id)}>
                    + Agregar otra pregunta de seleccion unica
                  </button>
                </div>
              )}

              {block.type === 'multiple_choice' && (
                <div style={tb.innerBox}>
                  {(block as MultipleChoiceBlock).questions.map((question, qIndex) => (
                    <div key={question.id} style={tb.questionCard}>
                      <div style={tb.questionHeader}>
                        <span style={tb.questionTitle}>Pregunta {qIndex + 1}</span>
                        <button type="button" style={tb.smallBtn} onClick={() => deleteQuestionFromBlock(block.id, question.id)}>Quitar</button>
                      </div>
                      <textarea
                        value={question.prompt}
                        onChange={e =>
                          updateBlock(block.id, b => ({
                            ...(b as MultipleChoiceBlock),
                            questions: (b as MultipleChoiceBlock).questions.map(q =>
                              q.id === question.id ? { ...q, prompt: e.target.value } : q
                            ),
                          }))
                        }
                        style={tb.textarea}
                        placeholder="Escribe el enunciado de la pregunta"
                      />
                      {question.options.map((opt, optIdx) => (
                        <div key={opt.id} style={tb.optionRow}>
                          <input
                            type="checkbox"
                            checked={question.correctOptionIds.includes(opt.id)}
                            onChange={e =>
                              updateBlock(block.id, b => ({
                                ...(b as MultipleChoiceBlock),
                                questions: (b as MultipleChoiceBlock).questions.map(q => {
                                  if (q.id !== question.id) return q;
                                  const has = q.correctOptionIds.includes(opt.id);
                                  return {
                                    ...q,
                                    correctOptionIds: e.target.checked
                                      ? has
                                        ? q.correctOptionIds
                                        : [...q.correctOptionIds, opt.id]
                                      : q.correctOptionIds.filter(id => id !== opt.id),
                                  };
                                }),
                              }))
                            }
                          />
                          <input
                            value={opt.text}
                            onChange={e =>
                              updateBlock(block.id, b => ({
                                ...(b as MultipleChoiceBlock),
                                questions: (b as MultipleChoiceBlock).questions.map(q =>
                                  q.id === question.id
                                    ? {
                                        ...q,
                                        options: q.options.map(item =>
                                          item.id === opt.id ? { ...item, text: e.target.value } : item
                                        ),
                                      }
                                    : q
                                ),
                              }))
                            }
                            style={tb.input}
                            placeholder={`Opcion ${optIdx + 1}`}
                          />
                          <button
                            type="button"
                            style={tb.smallBtn}
                            onClick={() =>
                              updateBlock(block.id, b => ({
                                ...(b as MultipleChoiceBlock),
                                questions: (b as MultipleChoiceBlock).questions.map(q => {
                                  if (q.id !== question.id || q.options.length <= 2) return q;
                                  return {
                                    ...q,
                                    options: q.options.filter(item => item.id !== opt.id),
                                    correctOptionIds: q.correctOptionIds.filter(id => id !== opt.id),
                                  };
                                }),
                              }))
                            }
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        style={tb.addBtn}
                        onClick={() =>
                          updateBlock(block.id, b => ({
                            ...(b as MultipleChoiceBlock),
                            questions: (b as MultipleChoiceBlock).questions.map(q =>
                              q.id === question.id ? { ...q, options: [...q.options, createOption('')] } : q
                            ),
                          }))
                        }
                      >
                        Agregar opcion
                      </button>
                    </div>
                  ))}
                  <button type="button" style={tb.addTypeQuestionBtn} onClick={() => addQuestionToBlock(block.id)}>
                    + Agregar otra pregunta de seleccion multiple
                  </button>
                </div>
              )}

              {block.type === 'true_false' && (
                <div style={tb.innerBox}>
                  {(block as TrueFalseBlock).questions.map((question, qIndex) => (
                    <div key={question.id} style={tb.questionCard}>
                      <div style={tb.questionHeader}>
                        <span style={tb.questionTitle}>Pregunta {qIndex + 1}</span>
                        <button type="button" style={tb.smallBtn} onClick={() => deleteQuestionFromBlock(block.id, question.id)}>Quitar</button>
                      </div>
                      <textarea
                        value={question.prompt}
                        onChange={e =>
                          updateBlock(block.id, b => ({
                            ...(b as TrueFalseBlock),
                            questions: (b as TrueFalseBlock).questions.map(q =>
                              q.id === question.id ? { ...q, prompt: e.target.value } : q
                            ),
                          }))
                        }
                        style={tb.textarea}
                        placeholder="Escribe el enunciado de la pregunta"
                      />
                      <div style={tb.inlineChoices}>
                        <label style={tb.choiceLabel}>
                          <input
                            type="radio"
                            name={`tf-${question.id}`}
                            checked={question.correctAnswer === 'true'}
                            onChange={() =>
                              updateBlock(block.id, b => ({
                                ...(b as TrueFalseBlock),
                                questions: (b as TrueFalseBlock).questions.map(q =>
                                  q.id === question.id ? { ...q, correctAnswer: 'true' as const } : q
                                ),
                              }))
                            }
                          />
                          Verdadero
                        </label>
                        <label style={tb.choiceLabel}>
                          <input
                            type="radio"
                            name={`tf-${question.id}`}
                            checked={question.correctAnswer === 'false'}
                            onChange={() =>
                              updateBlock(block.id, b => ({
                                ...(b as TrueFalseBlock),
                                questions: (b as TrueFalseBlock).questions.map(q =>
                                  q.id === question.id ? { ...q, correctAnswer: 'false' as const } : q
                                ),
                              }))
                            }
                          />
                          Falso
                        </label>
                      </div>
                    </div>
                  ))}
                  <button type="button" style={tb.addTypeQuestionBtn} onClick={() => addQuestionToBlock(block.id)}>
                    + Agregar otra pregunta verdadero/falso
                  </button>
                </div>
              )}

              {block.type === 'matching' && (
                <div style={tb.innerBox}>
                  {(block as MatchingBlock).questions.map((question, qIndex) => (
                    <div key={question.id} style={tb.questionCard}>
                      <div style={tb.questionHeader}>
                        <span style={tb.questionTitle}>Pregunta {qIndex + 1}</span>
                        <button type="button" style={tb.smallBtn} onClick={() => deleteQuestionFromBlock(block.id, question.id)}>Quitar</button>
                      </div>
                      <textarea
                        value={question.prompt}
                        onChange={e =>
                          updateBlock(block.id, b => ({
                            ...(b as MatchingBlock),
                            questions: (b as MatchingBlock).questions.map(q =>
                              q.id === question.id ? { ...q, prompt: e.target.value } : q
                            ),
                          }))
                        }
                        style={tb.textarea}
                        placeholder="Escribe el enunciado de la pregunta"
                      />
                      {question.pairs.map(pair => (
                        <div key={pair.id} style={tb.matchRow}>
                          <input
                            value={pair.left}
                            onChange={e =>
                              updateBlock(block.id, b => ({
                                ...(b as MatchingBlock),
                                questions: (b as MatchingBlock).questions.map(q =>
                                  q.id === question.id
                                    ? {
                                        ...q,
                                        pairs: q.pairs.map(item =>
                                          item.id === pair.id ? { ...item, left: e.target.value } : item
                                        ),
                                      }
                                    : q
                                ),
                              }))
                            }
                            style={tb.input}
                            placeholder="Columna izquierda"
                          />
                          <span style={tb.matchArrow}>↔</span>
                          <input
                            value={pair.right}
                            onChange={e =>
                              updateBlock(block.id, b => ({
                                ...(b as MatchingBlock),
                                questions: (b as MatchingBlock).questions.map(q =>
                                  q.id === question.id
                                    ? {
                                        ...q,
                                        pairs: q.pairs.map(item =>
                                          item.id === pair.id ? { ...item, right: e.target.value } : item
                                        ),
                                      }
                                    : q
                                ),
                              }))
                            }
                            style={tb.input}
                            placeholder="Columna derecha"
                          />
                          <button
                            type="button"
                            style={tb.smallBtn}
                            onClick={() =>
                              updateBlock(block.id, b => ({
                                ...(b as MatchingBlock),
                                questions: (b as MatchingBlock).questions.map(q => {
                                  if (q.id !== question.id || q.pairs.length <= 2) return q;
                                  return { ...q, pairs: q.pairs.filter(item => item.id !== pair.id) };
                                }),
                              }))
                            }
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        style={tb.addBtn}
                        onClick={() =>
                          updateBlock(block.id, b => ({
                            ...(b as MatchingBlock),
                            questions: (b as MatchingBlock).questions.map(q =>
                              q.id === question.id
                                ? { ...q, pairs: [...q.pairs, { id: makeId(), left: '', right: '' }] }
                                : q
                            ),
                          }))
                        }
                      >
                        Agregar pareja
                      </button>
                    </div>
                  ))}
                  <button type="button" style={tb.addTypeQuestionBtn} onClick={() => addQuestionToBlock(block.id)}>
                    + Agregar otra pregunta de pareado
                  </button>
                </div>
              )}

              {block.type === 'ordering' && (
                <div style={tb.innerBox}>
                  {(block as OrderingBlock).questions.map((question, qIndex) => (
                    <div key={question.id} style={tb.questionCard}>
                      <div style={tb.questionHeader}>
                        <span style={tb.questionTitle}>Pregunta {qIndex + 1}</span>
                        <button type="button" style={tb.smallBtn} onClick={() => deleteQuestionFromBlock(block.id, question.id)}>Quitar</button>
                      </div>
                      <textarea
                        value={question.prompt}
                        onChange={e =>
                          updateBlock(block.id, b => ({
                            ...(b as OrderingBlock),
                            questions: (b as OrderingBlock).questions.map(q =>
                              q.id === question.id ? { ...q, prompt: e.target.value } : q
                            ),
                          }))
                        }
                        style={tb.textarea}
                        placeholder="Escribe el enunciado de la pregunta"
                      />
                      {question.items.map((item, itemIdx) => (
                        <div
                          key={item.id}
                          style={tb.orderItem}
                          draggable
                          onDragStart={() => setDragState({ blockId: block.id, questionId: question.id, itemId: item.id })}
                          onDragOver={e => e.preventDefault()}
                          onDrop={() => {
                            if (!dragState) return;
                            if (dragState.blockId !== block.id || dragState.questionId !== question.id || dragState.itemId === item.id) {
                              return;
                            }
                            updateBlock(block.id, b => ({
                              ...(b as OrderingBlock),
                              questions: (b as OrderingBlock).questions.map(q => {
                                if (q.id !== question.id) return q;
                                const from = q.items.findIndex(it => it.id === dragState.itemId);
                                const to = q.items.findIndex(it => it.id === item.id);
                                if (from < 0 || to < 0) return q;
                                const next = [...q.items];
                                const [moved] = next.splice(from, 1);
                                next.splice(to, 0, moved);
                                return { ...q, items: next };
                              }),
                            }));
                            setDragState(null);
                          }}
                          onDragEnd={() => setDragState(null)}
                        >
                          <span style={tb.dragHandle}>⋮⋮</span>
                          <span style={tb.orderIndex}>{itemIdx + 1}</span>
                          <input
                            value={item.text}
                            onChange={e =>
                              updateBlock(block.id, b => ({
                                ...(b as OrderingBlock),
                                questions: (b as OrderingBlock).questions.map(q =>
                                  q.id === question.id
                                    ? {
                                        ...q,
                                        items: q.items.map(it =>
                                          it.id === item.id ? { ...it, text: e.target.value } : it
                                        ),
                                      }
                                    : q
                                ),
                              }))
                            }
                            style={tb.input}
                            placeholder={`Elemento ${itemIdx + 1}`}
                          />
                          <button
                            type="button"
                            style={tb.smallBtn}
                            onClick={() =>
                              updateBlock(block.id, b => ({
                                ...(b as OrderingBlock),
                                questions: (b as OrderingBlock).questions.map(q => {
                                  if (q.id !== question.id || q.items.length <= 2) return q;
                                  return { ...q, items: q.items.filter(it => it.id !== item.id) };
                                }),
                              }))
                            }
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        style={tb.addBtn}
                        onClick={() =>
                          updateBlock(block.id, b => ({
                            ...(b as OrderingBlock),
                            questions: (b as OrderingBlock).questions.map(q =>
                              q.id === question.id ? { ...q, items: [...q.items, createOption('')] } : q
                            ),
                          }))
                        }
                      >
                        Agregar elemento
                      </button>
                    </div>
                  ))}
                  <button type="button" style={tb.addTypeQuestionBtn} onClick={() => addQuestionToBlock(block.id)}>
                    + Agregar otra pregunta de ordenar
                  </button>
                </div>
              )}

              {block.type === 'dropdown_single' && (
                <div style={tb.innerBox}>
                  {(block as DropdownBlock).questions.map((question, qIndex) => (
                    <div key={question.id} style={tb.questionCard}>
                      <div style={tb.questionHeader}>
                        <span style={tb.questionTitle}>Pregunta {qIndex + 1}</span>
                        <button type="button" style={tb.smallBtn} onClick={() => deleteQuestionFromBlock(block.id, question.id)}>Quitar</button>
                      </div>
                      <textarea
                        value={question.prompt}
                        onChange={e =>
                          updateBlock(block.id, b => ({
                            ...(b as DropdownBlock),
                            questions: (b as DropdownBlock).questions.map(q =>
                              q.id === question.id ? { ...q, prompt: e.target.value } : q
                            ),
                          }))
                        }
                        style={tb.textarea}
                        placeholder="Escribe el enunciado de la pregunta"
                      />
                      {question.options.map((opt, optIdx) => (
                        <div key={opt.id} style={tb.optionRow}>
                          <input
                            type="radio"
                            name={`dropdown-correct-${question.id}`}
                            checked={question.correctOptionId === opt.id}
                            onChange={() =>
                              updateBlock(block.id, b => ({
                                ...(b as DropdownBlock),
                                questions: (b as DropdownBlock).questions.map(q =>
                                  q.id === question.id ? { ...q, correctOptionId: opt.id } : q
                                ),
                              }))
                            }
                          />
                          <input
                            value={opt.text}
                            onChange={e =>
                              updateBlock(block.id, b => ({
                                ...(b as DropdownBlock),
                                questions: (b as DropdownBlock).questions.map(q =>
                                  q.id === question.id
                                    ? {
                                        ...q,
                                        options: q.options.map(item =>
                                          item.id === opt.id ? { ...item, text: e.target.value } : item
                                        ),
                                      }
                                    : q
                                ),
                              }))
                            }
                            style={tb.input}
                            placeholder={`Opcion ${optIdx + 1}`}
                          />
                          <button
                            type="button"
                            style={tb.smallBtn}
                            onClick={() =>
                              updateBlock(block.id, b => ({
                                ...(b as DropdownBlock),
                                questions: (b as DropdownBlock).questions.map(q => {
                                  if (q.id !== question.id || q.options.length <= 2) return q;
                                  const nextOptions = q.options.filter(item => item.id !== opt.id);
                                  return {
                                    ...q,
                                    options: nextOptions,
                                    correctOptionId: q.correctOptionId === opt.id ? null : q.correctOptionId,
                                  };
                                }),
                              }))
                            }
                          >
                            Quitar
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        style={tb.addBtn}
                        onClick={() =>
                          updateBlock(block.id, b => ({
                            ...(b as DropdownBlock),
                            questions: (b as DropdownBlock).questions.map(q =>
                              q.id === question.id ? { ...q, options: [...q.options, createOption('')] } : q
                            ),
                          }))
                        }
                      >
                        Agregar opcion
                      </button>
                    </div>
                  ))}
                  <button type="button" style={tb.addTypeQuestionBtn} onClick={() => addQuestionToBlock(block.id)}>
                    + Agregar otra pregunta desplegable
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <aside style={tb.topBar}>
          <span style={tb.topLabel}>Tipos de pregunta</span>
          <div style={tb.topActions}>
            <button type="button" style={tb.typeBtn} onClick={() => addBlock('multiple_choice')}>
              + Seleccion multiple
            </button>
          </div>
        </aside>
      </div>

      <div style={tb.saveRow}>
        <button
          type="button"
          style={!saveDisabled && blocks.length > 0 && !isSaving ? tb.saveBtn : tb.saveBtnDisabled}
          onClick={handleSaveClick}
          disabled={saveDisabled || blocks.length === 0 || isSaving}
        >
          {isSaving ? 'Guardando...' : saveLabel}
        </button>
      </div>
    </div>
  );
};

const tb: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '8px',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 260px)',
    gap: '12px',
    alignItems: 'start',
  },
  editorArea: {
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  topBar: {
    position: 'sticky',
    top: '24px',
    border: '1px solid #dbeafe',
    borderRadius: '14px',
    background: 'linear-gradient(165deg, #ffffff 0%, #f8fbff 100%)',
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  topLabel: {
    fontSize: '0.76em',
    color: '#0369a1',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  topHint: {
    margin: 0,
    fontSize: '0.86em',
    color: '#475569',
    lineHeight: 1.45,
  },
  topActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  typeBtn: {
    width: '100%',
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1px solid #93c5fd',
    background: '#eff6ff',
    color: '#1e3a8a',
    fontWeight: 700,
    fontSize: '0.8em',
    fontFamily: 'inherit',
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
  },
  summaryRow: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  summaryPill: {
    padding: '4px 10px',
    borderRadius: '999px',
    background: '#f1f5f9',
    border: '1px solid #e2e8f0',
    color: '#334155',
    fontWeight: 700,
    fontSize: '0.75em',
  },
  emptyState: {
    border: '1px dashed #cbd5e1',
    borderRadius: '12px',
    padding: '14px',
    textAlign: 'center',
    color: '#64748b',
    background: '#f8fafc',
  },
  blockCard: {
    border: '1px solid #dbeafe',
    borderRadius: '14px',
    background: 'linear-gradient(155deg, #ffffff 0%, #f8fafc 100%)',
    boxShadow: '0 10px 20px rgba(15,23,42,0.07)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  blockHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  blockHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  blockIndex: {
    fontSize: '0.75em',
    fontWeight: 800,
    color: '#0ea5e9',
  },
  blockType: {
    fontSize: '0.73em',
    fontWeight: 800,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  deleteBtn: {
    padding: '6px 10px',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#dc2626',
    fontWeight: 700,
    fontSize: '0.78em',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  fieldLabel: {
    fontSize: '0.74em',
    color: '#64748b',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #dbeafe',
    background: '#fff',
    color: '#0f172a',
    fontSize: '0.86em',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    minHeight: '74px',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid #dbeafe',
    background: '#fff',
    color: '#0f172a',
    fontSize: '0.86em',
    fontFamily: 'inherit',
    resize: 'vertical',
    boxSizing: 'border-box',
    lineHeight: 1.55,
  },
  innerBox: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#f8fbff',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  questionCard: {
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    background: '#fff',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  questionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
  },
  questionTitle: {
    fontSize: '0.78em',
    fontWeight: 800,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  optionRow: {
    display: 'grid',
    gridTemplateColumns: '20px 1fr auto',
    gap: '8px',
    alignItems: 'center',
  },
  addBtn: {
    padding: '7px 10px',
    borderRadius: '8px',
    border: '1px solid #bfdbfe',
    background: '#eff6ff',
    color: '#1d4ed8',
    fontWeight: 700,
    fontSize: '0.78em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },
  addTypeQuestionBtn: {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid #bae6fd',
    background: '#ecfeff',
    color: '#0e7490',
    fontWeight: 800,
    fontSize: '0.8em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    alignSelf: 'flex-start',
  },
  smallBtn: {
    padding: '6px 8px',
    borderRadius: '8px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#dc2626',
    fontWeight: 700,
    fontSize: '0.75em',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  inlineChoices: {
    display: 'flex',
    gap: '14px',
    flexWrap: 'wrap',
  },
  choiceLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.85em',
    color: '#334155',
    fontWeight: 600,
  },
  matchRow: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr auto',
    gap: '8px',
    alignItems: 'center',
  },
  matchArrow: {
    color: '#64748b',
    fontWeight: 700,
    fontSize: '1em',
  },
  orderItem: {
    display: 'grid',
    gridTemplateColumns: '22px 24px 1fr auto',
    gap: '8px',
    alignItems: 'center',
    padding: '6px 8px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    background: '#fff',
  },
  dragHandle: {
    color: '#94a3b8',
    cursor: 'grab',
    lineHeight: 1,
  },
  orderIndex: {
    fontSize: '0.78em',
    color: '#64748b',
    fontWeight: 700,
  },
  saveRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '4px',
  },
  saveBtn: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '10px',
    background: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.86em',
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 8px 18px rgba(37,99,235,0.25)',
  },
  saveBtnDisabled: {
    padding: '10px 16px',
    border: 'none',
    borderRadius: '10px',
    background: '#e2e8f0',
    color: '#94a3b8',
    fontWeight: 800,
    fontSize: '0.86em',
    fontFamily: 'inherit',
    cursor: 'not-allowed',
  },
};

export default TestBuilder;
