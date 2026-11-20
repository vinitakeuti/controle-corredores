// Formulário do influenciador: tipos e conversões usados no servidor e no navegador.
export type RuleChoice = "program" | "yes" | "no";
export type ProgramDefaults = { plan: boolean; store: boolean; percent: number };

export const choiceOf = (value: boolean | null): RuleChoice => value === null ? "program" : value ? "yes" : "no";
export const percentText = (value: number) => `${Number.isInteger(value) ? value : value.toFixed(1).replace(".", ",")}%`;
