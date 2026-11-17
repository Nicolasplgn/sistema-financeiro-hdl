import React, { useCallback, useRef, useState } from 'react';
import { Button, Modal } from './index';

/**
 * Confirmação no lugar do window.confirm.
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (await confirm({ title, description, confirmLabel, danger })) { ... }
 *   ...render {confirmDialog}
 */
export const useConfirm = () => {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setState(options);
  }), []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  const dialog = (
    <Modal
      open={Boolean(state)}
      onClose={() => close(false)}
      title={state?.title}
      size="sm"
      footer={(
        <>
          <Button onClick={() => close(false)}>{state?.cancelLabel || 'Cancelar'}</Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>{state?.confirmLabel || 'Confirmar'}</Button>
        </>
      )}
    >
      <p className="text-sm text-ink-2 leading-relaxed">{state?.description}</p>
    </Modal>
  );

  return [confirm, dialog];
};

