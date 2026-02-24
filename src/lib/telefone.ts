/**
 * Formata telefone para exibição: (71) 90000-0000
 */
export function formatarTelefone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Valida se o telefone tem exatamente 11 dígitos (DDD + 9 + 8 dígitos)
 */
export function validarTelefone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length === 11 && digits[2] === "9";
}
