export const EDITABLE_FIELD = '[data-e2-editable]';
export const EDIT_TEXT_REQUEST = 'e2:edit-text';
export const INLINE_EDIT_MODE = 'e2:inline-edit-mode';

const TEXT_BLOCKS = new Set(['heading', 'text', 'button', 'table', 'callout', 'badge']);

export function hasInlineText(type: string) {
  return TEXT_BLOCKS.has(type);
}

export function setInlineEditMode(field: HTMLElement, active: boolean) {
  if (field.hasAttribute('data-e2-rich-on-demand')) {
    field.dispatchEvent(new CustomEvent(INLINE_EDIT_MODE, { detail: active }));
  } else {
    field.setAttribute('contenteditable', String(active));
  }
}
