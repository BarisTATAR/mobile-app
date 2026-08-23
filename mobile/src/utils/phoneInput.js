/**
 * Cep / iletişim numarası: yalnızca rakamlar (0–9).
 * Harf, boşluk, +, tire, parantez vb. kaldırılır.
 */
export function digitsOnly(text) {
  return String(text ?? '').replace(/\D/g, '');
}
