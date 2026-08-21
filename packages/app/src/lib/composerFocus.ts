let suppressed = false;

export function suppressNextComposerAutofocus() {
  suppressed = true;
}

export function consumeComposerAutofocusSuppression(): boolean {
  const value = suppressed;
  suppressed = false;
  return value;
}
